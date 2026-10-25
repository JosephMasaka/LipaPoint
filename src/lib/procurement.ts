import { db } from "./db";
import { postJournalEntry } from "./journal";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit";
import type { Prisma } from "@prisma/client";

/**
 * Procurement lifecycle (LipaPoint ERP spec §4.6):
 *   PO (draft → sent) → GRN (partial or full receipt) → Supplier invoice → Payment
 *
 * Journal posting (spec §4.3 — Finance is the single source of truth):
 * - Invoice:   DR Inventory (1200) / CR Accounts Payable (2000)
 * - Payment:   DR Accounts Payable (2000) / CR Cash account (per method/bank)
 *
 * GRN itself does NOT post to the GL — it moves stock (StockMovement +
 * latest supplier cost on Product) and tracks receivedQty on the PO line,
 * so inventory value lands in the books when the invoice is recorded.
 */

export class ProcurementError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ProcurementError";
  }
}

/** Per-tenant sequential document numbers: PO-0001, GRN-0001, SI-0001… */
async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  prefix: string,
  count: () => Promise<number>
): Promise<string> {
  const n = (await count()) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export interface CreatePOInput {
  tenantId: string;
  supplierId: string;
  locationId?: string | null;
  expectedDate?: Date | null;
  notes?: string | null;
  createdBy?: string | null;
  items: Array<{
    productId?: string | null;
    description: string;
    quantity: number;
    unitCost: number;
  }>;
}

export async function createPurchaseOrder(input: CreatePOInput) {
  if (input.items.length === 0) {
    throw new ProcurementError("Purchase order needs at least one item");
  }
  for (const [i, item] of input.items.entries()) {
    if (item.quantity <= 0 || item.unitCost < 0) {
      throw new ProcurementError(
        `Item ${i + 1}: quantity must be > 0 and unitCost >= 0`
      );
    }
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, tenantId: input.tenantId, isActive: true },
    select: { id: true },
  });
  if (!supplier) throw new ProcurementError("Supplier not found", 404);

  const total = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  const po = await db.$transaction(async (tx) => {
    const poNumber = await nextDocumentNumber(
      tx,
      input.tenantId,
      "PO",
      () => tx.purchaseOrder.count({ where: { tenantId: input.tenantId } })
    );
    return tx.purchaseOrder.create({
      data: {
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        poNumber,
        status: "draft",
        locationId: input.locationId ?? null,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
        subtotal: total,
        total,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId ?? null,
            description: item.description,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      include: { items: true, supplier: { select: { name: true } } },
    });
    },
    { timeout: 20000 }
  );

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.PROCUREMENT.PO_CREATED,
    module: "procurement",
    entity: "purchaseOrder",
    entityId: po.id,
    after: { poNumber: po.poNumber, total: po.total, status: po.status },
  });

  return po;
}

/** draft → sent → (partially_received | received) → closed; cancel from draft/sent. */
export async function setPurchaseOrderStatus(
  tenantId: string,
  poId: string,
  status: "sent" | "closed" | "cancelled",
  userId?: string | null
) {
  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    select: { id: true, status: true, poNumber: true },
  });
  if (!po) throw new ProcurementError("Purchase order not found", 404);

  const allowed: Record<string, string[]> = {
    sent: ["draft"],
    closed: ["sent", "partially_received", "received"],
    cancelled: ["draft", "sent"],
  };
  if (!allowed[status].includes(po.status)) {
    throw new ProcurementError(
      `Cannot move PO ${po.poNumber} from ${po.status} to ${status}`
    );
  }

  const updated = await db.purchaseOrder.update({
    where: { id: poId },
    data: { status },
    include: { items: true },
  });

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action:
      status === "sent"
        ? AUDIT_ACTIONS.PROCUREMENT.PO_SENT
        : AUDIT_ACTIONS.PROCUREMENT.PO_CLOSED,
    module: "procurement",
    entity: "purchaseOrder",
    entityId: poId,
    before: { status: po.status },
    after: { status },
  });

  return updated;
}

export interface ReceiveGoodsInput {
  tenantId: string;
  purchaseOrderId: string;
  locationId?: string | null;
  receivedBy?: string | null;
  notes?: string | null;
  /** Partial receipt allowed: only these lines/quantities arrive now. */
  items: Array<{
    poItemId: string;
    quantity: number;
    unitCost?: number | null; // actual invoice cost if it differs from PO
    /** Optional lot details for this receipt line (stock expiry reporting). */
    batchNumber?: string | null;
    expiryDate?: string | null; // ISO date — omit when the line has no expiry
  }>;
}

/**
 * Records a GRN against a PO. Partial receipts are first-class: each line's
 * receivedQty accumulates, and the PO flips to partially_received/received
 * from the lines themselves. Stock moves at the receiving location and the
 * product's supplier cost is refreshed from the receipt.
 */
export async function receiveGoods(input: ReceiveGoodsInput) {
  const po = await db.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, tenantId: input.tenantId },
    include: { items: true },
  });
  if (!po) throw new ProcurementError("Purchase order not found", 404);
  if (!["sent", "partially_received"].includes(po.status)) {
    throw new ProcurementError(
      `PO ${po.poNumber} is ${po.status} — only sent/partially_received POs can be received`
    );
  }
  if (input.items.length === 0) {
    throw new ProcurementError("Receipt needs at least one line");
  }

  const poItemsById = new Map(po.items.map((item) => [item.id, item]));
  const receiptByPoItem = new Map(input.items.map((line) => [line.poItemId, line]));
  for (const [i, line] of input.items.entries()) {
    const poItem = poItemsById.get(line.poItemId);
    if (!poItem) {
      throw new ProcurementError(`Line ${i + 1}: not an item on this PO`);
    }
    if (line.quantity <= 0) {
      throw new ProcurementError(`Line ${i + 1}: quantity must be > 0`);
    }
    if (poItem.receivedQty + line.quantity > poItem.quantity) {
      throw new ProcurementError(
        `Line ${i + 1} (${poItem.description}): receiving ${line.quantity} would exceed ordered quantity (ordered ${poItem.quantity}, already received ${poItem.receivedQty})`
      );
    }
  }

  const locationId =
    input.locationId ?? po.locationId ?? (await defaultLocation(input.tenantId));

  const grn = await db.$transaction(
    async (tx) => {
    const grnNumber = await nextDocumentNumber(
      tx,
      input.tenantId,
      "GRN",
      () => tx.goodsReceivedNote.count({ where: { tenantId: input.tenantId } })
    );

    const created = await tx.goodsReceivedNote.create({
      data: {
        tenantId: input.tenantId,
        purchaseOrderId: po.id,
        grnNumber,
        receivedDate: new Date(),
        locationId,
        receivedBy: input.receivedBy ?? null,
        notes: input.notes ?? null,
        items: {
          create: input.items.map((line) => {
            const poItem = poItemsById.get(line.poItemId)!;
            return {
              poItemId: poItem.id,
              productId: poItem.productId,
              description: poItem.description,
              quantity: line.quantity,
              unitCost: line.unitCost ?? poItem.unitCost,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Accumulate received quantities, then derive PO status from the lines.
    for (const line of input.items) {
      await tx.purchaseOrderItem.update({
        where: { id: line.poItemId },
        data: { receivedQty: { increment: line.quantity } },
      });
    }

    for (const line of created.items) {
      if (line.productId && locationId) {
        await tx.stockMovement.create({
          data: {
            type: "GOODS_RECEIPT",
            quantity: line.quantity,
            productId: line.productId,
            locationId,
            tenantId: input.tenantId,
            userId: input.receivedBy ?? null,
            reference: grnNumber,
            notes: `Received against ${po.poNumber}`,
          },
        });
        // Refresh supplier cost so margin reports use the latest price paid.
        await tx.product.update({
          where: { id: line.productId },
          data: { cost: line.unitCost },
        });

        // Lot/expiry capture — the Stock Expiry report reads these rows.
        const receipt = line.poItemId ? receiptByPoItem.get(line.poItemId) : undefined;
        const expiryDate = receipt?.expiryDate ? new Date(receipt.expiryDate) : null;
        if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
          await tx.stockBatch.create({
            data: {
              tenantId: input.tenantId,
              productId: line.productId,
              locationId,
              batchNumber: receipt?.batchNumber || null,
              expiryDate,
              quantity: line.quantity,
              grnItemId: line.id,
              receivedAt: created.receivedDate,
            },
          });
        }
      }
    }

    const refreshed = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
      select: { quantity: true, receivedQty: true },
    });
    const allReceived = refreshed.every((r) => r.receivedQty >= r.quantity);
    const anyReceived = refreshed.some((r) => r.receivedQty > 0);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: allReceived ? "received" : anyReceived ? "partially_received" : po.status },
    });

    return created;
    },
    // GRN receipt touches many rows (GRN + items, PO lines, stock
    // movements, product costs) across a remote DB — the default 5s
    // interactive-transaction timeout is too tight.
    { timeout: 20000 }
  );

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.receivedBy ?? null,
    action: AUDIT_ACTIONS.PROCUREMENT.GRN_RECEIVED,
    module: "procurement",
    entity: "goodsReceivedNote",
    entityId: grn.id,
    after: {
      grnNumber: grn.grnNumber,
      poNumber: po.poNumber,
      lines: grn.items.map((l) => ({ description: l.description, quantity: l.quantity })),
    },
  });

  return grn;
}

export interface RecordInvoiceInput {
  tenantId: string;
  supplierId: string;
  poId?: string | null;
  invoiceNumber: string;
  amount: number;
  dueDate?: Date | null;
  etimsValidated?: boolean;
}

/**
 * Records a supplier invoice and posts DR Inventory / CR Accounts Payable.
 * Also bumps the supplier's running balance (amount owed).
 */
export async function recordSupplierInvoice(input: RecordInvoiceInput) {
  if (input.amount <= 0) {
    throw new ProcurementError("Invoice amount must be > 0");
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, tenantId: input.tenantId, isActive: true },
    select: { id: true },
  });
  if (!supplier) throw new ProcurementError("Supplier not found", 404);

  const duplicate = await db.supplierInvoice.findFirst({
    where: {
      tenantId: input.tenantId,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ProcurementError(
      `Invoice ${input.invoiceNumber} already exists for this supplier`,
      409
    );
  }

  return db.$transaction(async (tx) => {
    const invoice = await tx.supplierInvoice.create({
      data: {
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        poId: input.poId ?? null,
        invoiceNumber: input.invoiceNumber,
        amount: input.amount,
        dueDate: input.dueDate ?? null,
        status: "unpaid",
        etimsValidated: input.etimsValidated ?? false,
      },
    });

    const entry = await postJournalEntry(
      {
        tenantId: input.tenantId,
        reference: `SI-${invoice.id.slice(-6).toUpperCase()}`,
        sourceModule: "procurement",
        sourceId: invoice.id,
        description: `Supplier invoice ${input.invoiceNumber}`,
        lines: [
          { accountCode: "1200", debit: input.amount, description: "Inventory received" },
          { accountCode: "2000", credit: input.amount, description: `AP — ${input.invoiceNumber}` },
        ],
      },
      tx
    );

    const updated = await tx.supplierInvoice.update({
      where: { id: invoice.id },
      data: { journalEntryId: entry.id },
      include: { supplier: { select: { name: true } }, purchaseOrder: true },
    });

    await tx.supplier.update({
      where: { id: input.supplierId },
      data: { balance: { increment: input.amount } },
    });

    await writeAuditLog({
      tenantId: input.tenantId,
      action: AUDIT_ACTIONS.PROCUREMENT.INVOICE_RECORDED,
      module: "procurement",
      entity: "supplierInvoice",
      entityId: invoice.id,
      after: { invoiceNumber: input.invoiceNumber, amount: input.amount },
    }, tx);

    return updated;
    },
    { timeout: 20000 }
  );
}

export interface RecordPaymentInput {
  tenantId: string;
  supplierId: string;
  invoiceId?: string | null;
  bankAccountId?: string | null;
  amount: number;
  method: "cash" | "mpesa" | "bank" | "cheque";
  reference?: string | null;
  createdBy?: string | null;
}

const METHOD_DEFAULT_ACCOUNT: Record<string, string> = {
  cash: "1010",
  mpesa: "1020",
  bank: "1040",
  cheque: "1040",
};

/**
 * Records a supplier payment: DR Accounts Payable / CR Cash-or-bank. When
 * a bankAccountId is given its linked COA account is credited (so M-Pesa
 * till payments hit the till account), else the method's default cash
 * account is used. Updates supplier balance and invoice paid status.
 */
export async function recordSupplierPayment(input: RecordPaymentInput) {
  if (input.amount <= 0) {
    throw new ProcurementError("Payment amount must be > 0");
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, tenantId: input.tenantId },
    select: { id: true, balance: true },
  });
  if (!supplier) throw new ProcurementError("Supplier not found", 404);

  let creditAccountCode = METHOD_DEFAULT_ACCOUNT[input.method];
  if (input.bankAccountId) {
    const bank = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId, tenantId: input.tenantId, isActive: true },
      include: { coaAccount: { select: { code: true } } },
    });
    if (!bank) throw new ProcurementError("Bank account not found", 404);
    creditAccountCode = bank.coaAccount?.code ?? creditAccountCode;
  }

  let invoice = null;
  if (input.invoiceId) {
    invoice = await db.supplierInvoice.findFirst({
      where: { id: input.invoiceId, tenantId: input.tenantId },
    });
    if (!invoice) throw new ProcurementError("Invoice not found", 404);
    if (invoice.paidAmount + input.amount > invoice.amount + 0.005) {
      throw new ProcurementError(
        `Payment exceeds outstanding on invoice ${invoice.invoiceNumber} (outstanding ${(invoice.amount - invoice.paidAmount).toFixed(2)})`
      );
    }
  }

  return db.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      data: {
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        invoiceId: input.invoiceId ?? null,
        bankAccountId: input.bankAccountId ?? null,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        paidAt: new Date(),
        createdBy: input.createdBy ?? null,
      },
    });

    const entry = await postJournalEntry(
      {
        tenantId: input.tenantId,
        reference: `PAY-${payment.id.slice(-6).toUpperCase()}`,
        sourceModule: "procurement",
        sourceId: payment.id,
        description: `Supplier payment${invoice ? ` against ${invoice.invoiceNumber}` : ""}`,
        postedBy: input.createdBy ?? null,
        lines: [
          { accountCode: "2000", debit: input.amount, description: "AP settled" },
          { accountCode: creditAccountCode, credit: input.amount, description: `Paid via ${input.method}` },
        ],
      },
      tx
    );

    await tx.supplierPayment.update({
      where: { id: payment.id },
      data: { journalEntryId: entry.id },
    });

    await tx.supplier.update({
      where: { id: input.supplierId },
      data: { balance: { decrement: input.amount } },
    });

    if (invoice) {
      const newPaid = invoice.paidAmount + input.amount;
      await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          status:
            newPaid >= invoice.amount - 0.005
              ? "paid"
              : newPaid > 0
                ? "partial"
                : "unpaid",
        },
      });
    }

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.createdBy ?? null,
      action: AUDIT_ACTIONS.PROCUREMENT.PAYMENT_RECORDED,
      module: "procurement",
      entity: "supplierPayment",
      entityId: payment.id,
      after: { amount: input.amount, method: input.method, creditAccountCode },
    }, tx);

    return { payment, journalEntryId: entry.id };
    },
    { timeout: 20000 }
  );
}

async function defaultLocation(tenantId: string): Promise<string | null> {
  const location = await db.location.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return location?.id ?? null;
}
