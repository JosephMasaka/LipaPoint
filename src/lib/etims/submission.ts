import { db } from "../db";
import type { Prisma } from "@prisma/client";
import type { EtimsDocumentType } from "./provider";
import {
  getEtimsProvider,
  normalizePaymentMethod,
  type EtimsSubmissionPayload,
} from "./provider";
import { isModuleEnabled } from "../modules";
import { writeAuditLog, AUDIT_ACTIONS } from "../audit";

/**
 * eTIMS submission lifecycle (LipaPoint ERP spec §4.8).
 *
 * One EtimsInvoice row per source document (unique on tenant+source), so a
 * retry or a double-hook can never double-submit the same sale to KRA.
 *
 * State machine:
 *
 *   pending ──submit──► submitted ──confirm──► accepted   (KRA invoice #)
 *      ▲                    │
 *      │  unreachable       ├──reject──► rejected  (human fix, then retry)
 *      └────────────────────┘
 *   rejected ──retry──► pending ──► …        (same machine, loop closed)
 *
 * `unreachable` is deliberately *not* a stored status: when the OSCU
 * endpoint is down we never got an answer, so the row stays `pending` and
 * is safe to retry in bulk — nothing was accepted, nothing can duplicate.
 * `rejected` means KRA saw the invoice and refused it; those wait for a
 * human and are never auto-retried.
 *
 * Network I/O never runs inside a caller's transaction: queueEtimsSubmission
 * writes the row (safe in-tx), then submission happens after commit.
 */

export type EtimsStatus = "pending" | "submitted" | "accepted" | "rejected";

export class EtimsError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "EtimsError";
  }
}

type Db = typeof db | Prisma.TransactionClient;

/** Round to cents — Float columns drift and KRA rejects mismatched totals. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

// ────────────────────────────── queueing ──────────────────────────────

export interface QueueEtimsInput {
  tenantId: string;
  sourceType: EtimsDocumentType;
  sourceId: string;
  sourceRef: string;
  totalAmount: number;
  taxAmount: number;
}

/**
 * Idempotently creates (or resets) the pending submission row for a source
 * document. Safe to call inside a transaction — it only touches the row.
 * An already-accepted row is never downgraded: KRA has the invoice, and
 * re-queueing it would risk a duplicate submission.
 */
export async function queueEtimsSubmission(
  input: QueueEtimsInput,
  tx: Db = db
) {
  const existing = await tx.etimsInvoice.findUnique({
    where: {
      tenantId_sourceType_sourceId: {
        tenantId: input.tenantId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
  });

  if (existing?.status === "accepted") return existing;

  return tx.etimsInvoice.upsert({
    where: {
      tenantId_sourceType_sourceId: {
        tenantId: input.tenantId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    create: {
      tenantId: input.tenantId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceRef: input.sourceRef,
      status: "pending",
      totalAmount: toCents(input.totalAmount),
      taxAmount: toCents(input.taxAmount),
    },
    update: {
      sourceRef: input.sourceRef,
      status: "pending",
      totalAmount: toCents(input.totalAmount),
      taxAmount: toCents(input.taxAmount),
    },
  });
}

// ────────────────────────── payload building ──────────────────────────

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: { select: { name: true } } } } };
}>;

type CreditNoteWithCustomer = Prisma.CreditNoteGetPayload<{
  include: { customer: { select: { name: true; phone: true } } };
}>;

/** VAT contained in a gross credit-note amount at the tenant's rate. */
export function creditNoteTax(amount: number, taxRate: number): number {
  return toCents((amount * taxRate) / (100 + taxRate));
}

interface TaxCheck {
  expectedTax: number;
  storedTax: number;
}

/**
 * The invoice-vs-expected compliance check (spec §4.8): the VAT we are
 * about to declare MUST equal what the sale actually carried at the
 * tenant's current rate. Deliberately computed from the *tenant rate ×
 * subtotal*, not from the stored figure itself — deriving the expectation
 * from the value being checked would make it pass unconditionally. A
 * mismatch means a stale/edited taxAmount would go to KRA, so it is
 * refused locally with a reason the dashboard shows: better a visible
 * rejection than a quietly wrong filing.
 */
function checkLineTax(order: {
  subtotal: number;
  discount: number;
  taxAmount: number;
}, tenantRate: number): TaxCheck {
  // Mirror how /api/orders computes it: tax on the pre-discount subtotal.
  const expectedTax = toCents((order.subtotal * tenantRate) / 100);
  return { expectedTax, storedTax: toCents(order.taxAmount) };
}

export function buildSalePayload(
  order: OrderWithItems,
  tenant: { taxRate: number; name: string }
): EtimsSubmissionPayload {
  const taxRate = tenant.taxRate;

  const lines = order.items.map((item) => {
    const lineTotal = toCents(item.total);
    return {
      description: item.product?.name ?? `Item ${item.productId}`,
      quantity: item.quantity,
      unitPrice: toCents(item.unitPrice),
      lineTotal,
      taxRate: toCents(taxRate),
      taxAmount: toCents((lineTotal * taxRate) / 100),
    };
  });

  // Declare the sum of line tax (self-consistent with what the customer
  // sees item-by-item); the caller has already verified it against the
  // order's own taxAmount before we get here.
  const declaredTax = toCents(lines.reduce((sum, l) => sum + l.taxAmount, 0));

  return {
    internalRef: order.orderNo,
    documentType: "sale",
    issuedAt: order.createdAt,
    currency: "KES",
    seller: { tin: "", branch: "", name: tenant.name },
    buyer: order.customerName
      ? { name: order.customerName, phone: order.customerPhone, tin: null }
      : null,
    paymentMethod: normalizePaymentMethod(order.paymentMethod, order.paymentStatus),
    lines,
    subtotal: toCents(order.subtotal),
    discount: toCents(order.discount),
    taxAmount: declaredTax,
    total: toCents(order.total),
    memo: order.notes ?? null,
  };
}

export function buildCreditNotePayload(
  note: CreditNoteWithCustomer,
  tenant: { taxRate: number; name: string }
): EtimsSubmissionPayload {
  // A credit note reverses what the customer actually gets back, so its
  // total is the credited gross and the tax is the VAT *inside* it — the
  // same money the receipt originally carried.
  const taxAmount = creditNoteTax(note.amount, tenant.taxRate);

  return {
    internalRef: note.creditNoteNumber,
    documentType: "credit_note",
    issuedAt: note.createdAt,
    currency: "KES",
    seller: { tin: "", branch: "", name: tenant.name },
    buyer: note.customer
      ? { name: note.customer.name, phone: note.customer.phone, tin: null }
      : null,
    paymentMethod: "CREDIT",
    lines: [
      {
        description: `Credit note — ${note.reason}`,
        quantity: 1,
        unitPrice: toCents(note.amount),
        lineTotal: toCents(note.amount),
        taxRate: toCents(tenant.taxRate),
        taxAmount,
      },
    ],
    subtotal: toCents(note.amount - taxAmount),
    discount: 0,
    taxAmount,
    total: toCents(note.amount),
    memo: note.reason,
  };
}

// ───────────────────────────── submitting ─────────────────────────────

/**
 * Submits one queued row. Never throws into the caller — provider outages
 * and KRA rejections are recorded on the row (status + lastError) so a POS
 * sale is never failed by a tax-server hiccup. Pass `tx` only to share the
 * audit write with an outer transaction; the provider call itself always
 * happens outside any transaction.
 */
export async function submitEtimsInvoice(
  etimsId: string,
  opts: { userId?: string | null } = {},
  tx: Db = db
) {
  const row = await tx.etimsInvoice.findUnique({ where: { id: etimsId } });
  if (!row) throw new EtimsError("eTIMS submission not found", 404);
  // Idempotency: an accepted invoice is filed with KRA, never re-sent.
  if (row.status === "accepted") return row;

  const tenant = await tx.tenant.findUnique({
    where: { id: row.tenantId },
    select: { name: true, taxRate: true },
  });
  if (!tenant) throw new EtimsError("Tenant not found", 404);

  // Build the payload from the source document; a missing source is a
  // permanent rejection (the sale was deleted/voided) needing a human.
  let payload: EtimsSubmissionPayload | null = null;
  let localRejection: string | null = null;

  try {
    if (row.sourceType === "sale") {
      const order = await tx.order.findUnique({
        where: { id: row.sourceId },
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      });
      if (!order) {
        localRejection = `Source order ${row.sourceId} no longer exists`;
      } else {
        const { expectedTax, storedTax } = checkLineTax(order, tenant.taxRate);
        if (Math.abs(expectedTax - storedTax) > 0.05 * order.items.length + 0.05) {
          localRejection =
            `Tax mismatch: order carries ${storedTax} but subtotal at ${tenant.taxRate}% ` +
            `is ${expectedTax} — refusing to declare a wrong figure to KRA`;
        } else {
          payload = buildSalePayload(order, tenant);
        }
      }
    } else if (row.sourceType === "credit_note") {
      const note = await tx.creditNote.findUnique({
        where: { id: row.sourceId },
        include: { customer: { select: { name: true, phone: true } } },
      });
      if (!note) {
        localRejection = `Source credit note ${row.sourceId} no longer exists`;
      } else {
        payload = buildCreditNotePayload(note, tenant);
      }
    } else {
      localRejection = `Unsupported source type "${row.sourceType}"`;
    }
  } catch (error) {
    // Payload build failed (bad data) — record and let a human look.
    localRejection = `Failed to build payload: ${(error as Error).message}`;
  }

  const now = new Date();

  if (localRejection || !payload) {
    const rejected = await tx.etimsInvoice.update({
      where: { id: row.id },
      data: {
        status: "rejected",
        attempts: { increment: 1 },
        lastError: localRejection ?? "No payload could be built",
        submittedAt: now,
      },
    });
    await writeAuditLog(
      {
        tenantId: row.tenantId,
        userId: opts.userId ?? null,
        action: AUDIT_ACTIONS.ETIMS.REJECTED,
        module: "etims",
        entity: "etimsInvoice",
        entityId: row.id,
        details: localRejection ?? "No payload",
        before: { status: row.status },
        after: { status: "rejected" },
      },
      tx
    );
    return rejected;
  }

  // Fill seller identity from env (KRA TIN/branch) at the last moment so
  // the payload builder stays free of process-global config. The OSCU
  // adapter overwrites these from its own config too — this is for
  // traceability of what was attempted (rawResponse, logs).
  payload.seller = {
    tin: process.env.ETIMS_SELLER_TIN?.trim() || "",
    branch: process.env.ETIMS_SELLER_BRANCH?.trim() || "",
    name: tenant.name,
  };

  const provider = getEtimsProvider();
  let outcome;
  try {
    outcome = await provider.submit(payload);
  } catch (error) {
    outcome = { outcome: "unreachable" as const, error: (error as Error).message };
  }

  if (outcome.outcome === "unreachable") {
    // Stay pending — safe to bulk-retry; nothing reached KRA.
    const stuck = await tx.etimsInvoice.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 }, lastError: outcome.error, submittedAt: now },
    });
    await writeAuditLog(
      {
        tenantId: row.tenantId,
        userId: opts.userId ?? null,
        action: AUDIT_ACTIONS.ETIMS.SUBMITTED,
        module: "etims",
        entity: "etimsInvoice",
        entityId: row.id,
        details: `Unreachable: ${outcome.error}`,
        before: { status: row.status },
        after: { status: "pending", provider: provider.name },
      },
      tx
    );
    return stuck;
  }

  if (outcome.outcome === "rejected") {
    const rejected = await tx.etimsInvoice.update({
      where: { id: row.id },
      data: {
        status: "rejected",
        attempts: { increment: 1 },
        lastError: outcome.reason,
        submittedAt: now,
        rawResponse: (outcome.raw as Prisma.InputJsonValue) ?? undefined,
      },
    });
    await writeAuditLog(
      {
        tenantId: row.tenantId,
        userId: opts.userId ?? null,
        action: AUDIT_ACTIONS.ETIMS.REJECTED,
        module: "etims",
        entity: "etimsInvoice",
        entityId: row.id,
        details: outcome.reason,
        before: { status: row.status },
        after: { status: "rejected", provider: provider.name },
      },
      tx
    );
    return rejected;
  }

  if (outcome.outcome === "submitted") {
    const submitted = await tx.etimsInvoice.update({
      where: { id: row.id },
      data: {
        status: "submitted",
        attempts: { increment: 1 },
        lastError: null,
        submittedAt: now,
        rawResponse: (outcome.raw as Prisma.InputJsonValue) ?? undefined,
      },
    });
    await writeAuditLog(
      {
        tenantId: row.tenantId,
        userId: opts.userId ?? null,
        action: AUDIT_ACTIONS.ETIMS.SUBMITTED,
        module: "etims",
        entity: "etimsInvoice",
        entityId: row.id,
        details: `Accepted for async processing (${provider.name})`,
        before: { status: row.status },
        after: { status: "submitted", provider: provider.name },
      },
      tx
    );
    return submitted;
  }

  const accepted = await tx.etimsInvoice.update({
    where: { id: row.id },
    data: {
      status: "accepted",
      attempts: { increment: 1 },
      lastError: null,
      submittedAt: now,
      kraInvoiceNumber: outcome.kraInvoiceNumber,
      qrCodeUrl: outcome.qrCodeUrl ?? null,
      rawResponse: (outcome.raw as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await writeAuditLog(
    {
      tenantId: row.tenantId,
      userId: opts.userId ?? null,
      action: AUDIT_ACTIONS.ETIMS.ACCEPTED,
      module: "etims",
      entity: "etimsInvoice",
      entityId: row.id,
      details: `KRA invoice ${outcome.kraInvoiceNumber}`,
      before: { status: row.status },
      after: { status: "accepted", kraInvoiceNumber: outcome.kraInvoiceNumber },
    },
    tx
  );
  return accepted;
}

/**
 * End-to-end hook used by the POS sale path and STK completion: queue the
 * row, then submit immediately. Returns null (not an error) when the tenant
 * doesn't have the eTIMS module — a pure-POS tenant's sale must never break
 * because a compliance hook exists.
 */
export async function submitOrderForEtims(
  tenantId: string,
  orderId: string,
  opts: { userId?: string | null } = {}
): Promise<import("@prisma/client").EtimsInvoice | null> {
  try {
    if (!(await isModuleEnabled(tenantId, "etims"))) return null;

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "COMPLETED") return null;

    const queued = await queueEtimsSubmission({
      tenantId,
      sourceType: "sale",
      sourceId: order.id,
      sourceRef: order.orderNo,
      totalAmount: order.total,
      taxAmount: order.taxAmount,
    });

    return await submitEtimsInvoice(queued.id, opts);
  } catch (error) {
    // Compliance is a side-channel: a tax-server problem must never fail
    // the sale it belongs to. The row (if queued) stays `pending` and the
    // dashboard's retry queue picks it up.
    console.error("eTIMS submission failed for order", { orderId, error });
    return null;
  }
}

/** Credit-note hook, called after approval commits (never in-tx). */
export async function submitCreditNoteForEtims(
  tenantId: string,
  noteId: string,
  opts: { userId?: string | null } = {}
): Promise<import("@prisma/client").EtimsInvoice | null> {
  try {
    if (!(await isModuleEnabled(tenantId, "etims"))) return null;

    const note = await db.creditNote.findUnique({ where: { id: noteId } });
    if (!note || note.status !== "approved") return null;

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { taxRate: true },
    });
    const taxAmount = creditNoteTax(note.amount, tenant?.taxRate ?? 16);

    const queued = await queueEtimsSubmission({
      tenantId,
      sourceType: "credit_note",
      sourceId: note.id,
      sourceRef: note.creditNoteNumber,
      totalAmount: note.amount,
      taxAmount,
    });

    return await submitEtimsInvoice(queued.id, opts);
  } catch (error) {
    console.error("eTIMS submission failed for credit note", { noteId, error });
    return null;
  }
}

// ────────────────────────────── retries ───────────────────────────────

/**
 * Retries one pending/rejected submission. `submitted` rows are refused:
 * they are already at KRA awaiting confirmation, and re-sending them is how
 * duplicate invoices happen.
 */
export async function retryEtimsInvoice(
  tenantId: string,
  etimsId: string,
  userId?: string | null
) {
  const row = await db.etimsInvoice.findFirst({
    where: { id: etimsId, tenantId },
  });
  if (!row) throw new EtimsError("eTIMS submission not found", 404);
  if (row.status === "accepted") {
    throw new EtimsError("Invoice already accepted by KRA — nothing to retry");
  }
  if (row.status === "submitted") {
    throw new EtimsError(
      "Invoice is awaiting KRA confirmation — retrying could duplicate it"
    );
  }

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.ETIMS.RETRIED,
    module: "etims",
    entity: "etimsInvoice",
    entityId: row.id,
    before: { status: row.status, attempts: row.attempts },
  });

  return submitEtimsInvoice(row.id, { userId });
}

/**
 * Bulk retry for the unreachable pile (spec: retry queue on the compliance
 * dashboard). Only touches `pending` rows — `rejected` ones need a human
 * fix first, and skipping them here is what stops a retry button from
 * hammering KRA with the same bad payload forever.
 */
export async function retryPendingEtims(
  tenantId: string,
  opts: { limit?: number; userId?: string | null } = {}
) {
  const limit = Math.min(opts.limit ?? 25, 100);
  const rows = await db.etimsInvoice.findMany({
    where: { tenantId, status: "pending" },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let accepted = 0;
  let stillPending = 0;
  let rejected = 0;

  for (const { id } of rows) {
    await writeAuditLog({
      tenantId,
      userId: opts.userId ?? null,
      action: AUDIT_ACTIONS.ETIMS.RETRIED,
      module: "etims",
      entity: "etimsInvoice",
      entityId: id,
      details: "bulk retry",
    });
    const result = await submitEtimsInvoice(id, { userId: opts.userId });
    if (result.status === "accepted") accepted++;
    else if (result.status === "rejected") rejected++;
    else stillPending++;
  }

  return { attempted: rows.length, accepted, rejected, stillPending };
}

// ────────────────────────────── reporting ─────────────────────────────

export interface EtimsStats {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  rejected: number;
  /** accepted / (accepted + rejected) — the number KRA cares about. */
  successRate: number;
  /** VAT declared on accepted invoices in the window. */
  acceptedTax: number;
  /** Total value of accepted invoices in the window. */
  acceptedTotal: number;
}

export async function getEtimsStats(
  tenantId: string,
  window?: { from?: Date; to?: Date }
): Promise<EtimsStats> {
  const createdAt: Prisma.EtimsInvoiceWhereInput["createdAt"] =
    window?.from || window?.to
      ? { gte: window?.from, lte: window?.to }
      : {};

  const [total, pending, submitted, accepted, rejected, acceptedByType] =
    await Promise.all([
      db.etimsInvoice.count({ where: { tenantId, createdAt } }),
      db.etimsInvoice.count({ where: { tenantId, createdAt, status: "pending" } }),
      db.etimsInvoice.count({ where: { tenantId, createdAt, status: "submitted" } }),
      db.etimsInvoice.count({ where: { tenantId, createdAt, status: "accepted" } }),
      db.etimsInvoice.count({ where: { tenantId, createdAt, status: "rejected" } }),
      db.etimsInvoice.groupBy({
        by: ["sourceType"],
        where: { tenantId, createdAt, status: "accepted" },
        _sum: { taxAmount: true, totalAmount: true },
      }),
    ]);

  // A credit note is a tax *reversal* — it takes back VAT that a sale
  // declared. "Declared to KRA" is therefore sales minus credit notes;
  // summing them as positives would overstate the filing.
  const sumFor = (sourceType: string, field: "taxAmount" | "totalAmount") =>
    toCents(
      acceptedByType.find((g) => g.sourceType === sourceType)?._sum[field] ?? 0
    );
  const declaredTax = toCents(
    sumFor("sale", "taxAmount") - sumFor("credit_note", "taxAmount")
  );
  const declaredTotal = toCents(
    sumFor("sale", "totalAmount") - sumFor("credit_note", "totalAmount")
  );

  const decided = accepted + rejected;

  return {
    total,
    pending,
    submitted,
    accepted,
    rejected,
    successRate: decided === 0 ? 1 : accepted / decided,
    acceptedTax: declaredTax,
    acceptedTotal: declaredTotal,
  };
}

export interface VatReconciliationRow {
  period: string; // "2026-10"
  etimsVat: number; // VAT actually declared to KRA (accepted invoices)
  salesVat: number; // VAT carried by recorded sales in the same month
  variance: number; // salesVat - etimsVat; > 0 = under-declared
  acceptedCount: number;
  salesCount: number;
}

/**
 * Month-by-month VAT output reconciliation (spec §4.8 dashboard):
 * declared-to-KRA vs what the sales ledger says we collected. A positive
 * variance is VAT we owe KRA that hasn't made it through eTIMS — the
 * invoice-vs-expected mismatch view.
 */
export async function getVatReconciliation(
  tenantId: string,
  months = 6
): Promise<VatReconciliationRow[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [etimsRows, salesRows] = await Promise.all([
    db.etimsInvoice.findMany({
      where: {
        tenantId,
        status: "accepted",
        // Sales only: a credit note reverses VAT and is netted out by the
        // filing, so including it here would double-count its effect —
        // it shows in the submission log and stats instead.
        sourceType: "sale",
        createdAt: { gte: start },
      },
      select: { taxAmount: true, totalAmount: true, createdAt: true },
    }),
    db.order.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: start },
        // Comped/zero-rated sales carry no VAT and aren't KRA-reportable.
        taxAmount: { gt: 0 },
      },
      select: { taxAmount: true, total: true, createdAt: true },
    }),
  ]);

  const byPeriod = new Map<string, VatReconciliationRow>();
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Pre-fill every month in the window so gaps show as zero rows.
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byPeriod.set(key(d), {
      period: key(d),
      etimsVat: 0,
      salesVat: 0,
      variance: 0,
      acceptedCount: 0,
      salesCount: 0,
    });
  }

  for (const row of etimsRows) {
    const bucket = byPeriod.get(key(row.createdAt));
    if (!bucket) continue;
    bucket.etimsVat = toCents(bucket.etimsVat + row.taxAmount);
    bucket.acceptedCount++;
  }

  for (const row of salesRows) {
    const bucket = byPeriod.get(key(row.createdAt));
    if (!bucket) continue;
    bucket.salesVat = toCents(bucket.salesVat + row.taxAmount);
    bucket.salesCount++;
  }

  for (const bucket of byPeriod.values()) {
    bucket.variance = toCents(bucket.salesVat - bucket.etimsVat);
  }

  return [...byPeriod.values()].sort((a, b) => b.period.localeCompare(a.period));
}
