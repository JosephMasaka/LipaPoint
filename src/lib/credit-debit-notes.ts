import { db } from "./db";
import { postJournalEntry } from "./journal";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit";
import { submitCreditNoteForEtims } from "./etims/submission";

/**
 * Credit & debit notes (LipaPoint ERP spec §4.3).
 *
 * A credit note reduces what a customer owes us (sales return / pricing
 * error); a debit note reduces what we owe a supplier (returned goods /
 * billing error). Both MUST post an offsetting journal entry on approval
 * and move the counterparty balance, per the spec.
 *
 * Flow: create (draft) → approve (posts GL + moves balance) | void.
 */

export class NoteError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "NoteError";
  }
}

async function nextNoteNumber(
  tenantId: string,
  prefix: string,
  count: () => Promise<number>
): Promise<string> {
  const n = (await count()) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export interface CreateCreditNoteInput {
  tenantId: string;
  customerId: string;
  amount: number;
  reason: string;
  createdBy?: string | null;
}

export async function createCreditNote(input: CreateCreditNoteInput) {
  if (input.amount <= 0) throw new NoteError("Amount must be > 0");
  if (!input.reason?.trim()) throw new NoteError("A reason is required");

  const customer = await db.customer.findFirst({
    where: { id: input.customerId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!customer) throw new NoteError("Customer not found", 404);

  const creditNoteNumber = await nextNoteNumber(
    input.tenantId,
    "CN",
    () => db.creditNote.count({ where: { tenantId: input.tenantId } })
  );

  const note = await db.creditNote.create({
    data: {
      tenantId: input.tenantId,
      customerId: input.customerId,
      creditNoteNumber,
      amount: input.amount,
      reason: input.reason,
      status: "draft",
      createdBy: input.createdBy ?? null,
    },
    include: { customer: { select: { name: true } } },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.FINANCE.CREDIT_NOTE_CREATED,
    module: "finance",
    entity: "creditNote",
    entityId: note.id,
    after: { creditNoteNumber, amount: input.amount, reason: input.reason },
  });

  return note;
}

/**
 * Approves a credit note: posts DR Sales (4000) / CR Accounts Receivable
 * (1100) — the customer owes less — and records it against the customer.
 */
export async function approveCreditNote(
  tenantId: string,
  noteId: string,
  approvedBy?: string | null
) {
  const note = await db.creditNote.findFirst({
    where: { id: noteId, tenantId },
  });
  if (!note) throw new NoteError("Credit note not found", 404);
  if (note.status !== "draft") {
    throw new NoteError(`Credit note is already ${note.status}`);
  }

  const approved = await db.$transaction(async (tx) => {
    const entry = await postJournalEntry(
      {
        tenantId,
        reference: note.creditNoteNumber,
        sourceModule: "finance",
        sourceId: note.id,
        description: `Credit note ${note.creditNoteNumber} — ${note.reason}`,
        postedBy: approvedBy ?? null,
        lines: [
          { accountCode: "4000", debit: note.amount, description: "Sales credited" },
          { accountCode: "1100", credit: note.amount, description: "AR reduced" },
        ],
      },
      tx
    );

    const approved = await tx.creditNote.update({
      where: { id: note.id },
      data: { status: "approved", approvedBy: approvedBy ?? null, journalEntryId: entry.id },
      include: { customer: { select: { name: true } } },
    });

    await writeAuditLog({
      tenantId,
      userId: approvedBy ?? null,
      action: AUDIT_ACTIONS.FINANCE.CREDIT_NOTE_APPROVED,
      module: "finance",
      entity: "creditNote",
      entityId: note.id,
      before: { status: "draft" },
      after: { status: "approved", amount: note.amount },
    }, tx);

    return approved;
    },
    { timeout: 20000 }
  );

  // eTIMS: a credit note is a KRA-reportable document (spec §4.8) —
  // submit after the approval commits, never inside the transaction
  // (the provider does network I/O). Never throws back into the caller.
  await submitCreditNoteForEtims(tenantId, approved.id, { userId: approvedBy });

  return approved;
}

export interface CreateDebitNoteInput {
  tenantId: string;
  supplierId: string;
  invoiceId?: string | null;
  amount: number;
  reason: string;
  createdBy?: string | null;
}

export async function createDebitNote(input: CreateDebitNoteInput) {
  if (input.amount <= 0) throw new NoteError("Amount must be > 0");
  if (!input.reason?.trim()) throw new NoteError("A reason is required");

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!supplier) throw new NoteError("Supplier not found", 404);

  const debitNoteNumber = await nextNoteNumber(
    input.tenantId,
    "DN",
    () => db.debitNote.count({ where: { tenantId: input.tenantId } })
  );

  const note = await db.debitNote.create({
    data: {
      tenantId: input.tenantId,
      supplierId: input.supplierId,
      invoiceId: input.invoiceId ?? null,
      debitNoteNumber,
      amount: input.amount,
      reason: input.reason,
      status: "draft",
      createdBy: input.createdBy ?? null,
    },
    include: { supplier: { select: { name: true } } },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.FINANCE.DEBIT_NOTE_CREATED,
    module: "finance",
    entity: "debitNote",
    entityId: note.id,
    after: { debitNoteNumber, amount: input.amount, reason: input.reason },
  });

  return note;
}

/**
 * Approves a debit note: posts DR Accounts Payable (2000) / CR Inventory
 * (1200) — we owe the supplier less — and decrements the supplier balance.
 */
export async function approveDebitNote(
  tenantId: string,
  noteId: string,
  approvedBy?: string | null
) {
  const note = await db.debitNote.findFirst({
    where: { id: noteId, tenantId },
  });
  if (!note) throw new NoteError("Debit note not found", 404);
  if (note.status !== "draft") {
    throw new NoteError(`Debit note is already ${note.status}`);
  }

  return db.$transaction(async (tx) => {
    const entry = await postJournalEntry(
      {
        tenantId,
        reference: note.debitNoteNumber,
        sourceModule: "finance",
        sourceId: note.id,
        description: `Debit note ${note.debitNoteNumber} — ${note.reason}`,
        postedBy: approvedBy ?? null,
        lines: [
          { accountCode: "2000", debit: note.amount, description: "AP reduced" },
          { accountCode: "1200", credit: note.amount, description: "Inventory returned" },
        ],
      },
      tx
    );

    const approved = await tx.debitNote.update({
      where: { id: note.id },
      data: { status: "approved", approvedBy: approvedBy ?? null, journalEntryId: entry.id },
      include: { supplier: { select: { name: true } } },
    });

    await tx.supplier.update({
      where: { id: note.supplierId },
      data: { balance: { decrement: note.amount } },
    });

    await writeAuditLog({
      tenantId,
      userId: approvedBy ?? null,
      action: AUDIT_ACTIONS.FINANCE.DEBIT_NOTE_APPROVED,
      module: "finance",
      entity: "debitNote",
      entityId: note.id,
      before: { status: "draft" },
      after: { status: "approved", amount: note.amount },
    }, tx);

    return approved;
    },
    { timeout: 20000 }
  );
}
