import { db } from "./db";
import type { Prisma } from "@prisma/client";
import type { ModuleKey } from "./modules";

/**
 * Audit trail (LipaPoint ERP spec §9: every financial-impact action MUST
 * write to the audit log with before/after state).
 *
 * Built around ActivityLog (extended with before/after Json and module in
 * Phase 0/1). Design notes for scale:
 * - AUDIT_ACTIONS is a namespaced registry ("MODULE.ACTION") so action
 *   strings stay consistent across call sites and modules can be added
 *   without inventing free-form strings at each site. Free-form strings are
 *   still accepted for one-off/admin actions.
 * - writeAuditLog is one row, fire-and-forget-safe (never throws into the
 *   caller — auditing must not take down the action it's auditing).
 * - writeAuditLogs batches via createMany for high-volume paths (imports,
 *   backfills, batch payroll posting) instead of N round-trips.
 *
 * Transaction usage: inside an interactive transaction pass `tx` as the
 * second argument. The audit row then commits/rolls back atomically with
 * the business action, and — critically — uses the transaction's own
 * connection instead of the outer pool (which deadlocks when the pool is
 * exhausted by the open transaction). Failures inside a transaction
 * propagate, because the transaction would be aborted either way.
 */

/** A normal client, or the interactive-transaction client of a caller. */
type AuditClient = Prisma.TransactionClient | typeof db;

export const AUDIT_ACTIONS = {
  // platform / admin
  AUTH: {
    LOGIN: "AUTH.LOGIN",
    LOGOUT: "AUTH.LOGOUT",
    PASSWORD_RESET: "AUTH.PASSWORD_RESET",
    IMPERSONATION_START: "AUTH.IMPERSONATION_START",
  },
  TENANT: {
    CREATED: "TENANT.CREATED",
    TIER_CHANGED: "TENANT.TIER_CHANGED",
    MODULE_GRANTED: "TENANT.MODULE_GRANTED",
    MODULE_REVOKED: "TENANT.MODULE_REVOKED",
  },
  // pos
  POS: {
    SALE: "POS.SALE",
    REFUND: "POS.REFUND",
    COMPLIMENTARY: "POS.COMPLIMENTARY",
    PRICE_OVERRIDE: "POS.PRICE_OVERRIDE",
  },
  // finance
  FINANCE: {
    JOURNAL_POSTED: "FINANCE.JOURNAL_POSTED",
    JOURNAL_REVERSED: "FINANCE.JOURNAL_REVERSED",
    CREDIT_NOTE_CREATED: "FINANCE.CREDIT_NOTE_CREATED",
    CREDIT_NOTE_APPROVED: "FINANCE.CREDIT_NOTE_APPROVED",
    DEBIT_NOTE_CREATED: "FINANCE.DEBIT_NOTE_CREATED",
    DEBIT_NOTE_APPROVED: "FINANCE.DEBIT_NOTE_APPROVED",
    BANK_TRANSACTION_RECORDED: "FINANCE.BANK_TRANSACTION_RECORDED",
    BANK_RECONCILED: "FINANCE.BANK_RECONCILED",
  },
  // etims / tax compliance
  ETIMS: {
    SUBMITTED: "ETIMS.SUBMITTED",
    ACCEPTED: "ETIMS.ACCEPTED",
    REJECTED: "ETIMS.REJECTED",
    RETRIED: "ETIMS.RETRIED",
  },
  // payroll / hr
  PAYROLL: {
    EMPLOYEE_CREATED: "PAYROLL.EMPLOYEE_CREATED",
    EMPLOYEE_UPDATED: "PAYROLL.EMPLOYEE_UPDATED",
    EMPLOYEE_ARCHIVED: "PAYROLL.EMPLOYEE_ARCHIVED",
    LEAVE_REQUESTED: "PAYROLL.LEAVE_REQUESTED",
    LEAVE_DECIDED: "PAYROLL.LEAVE_DECIDED",
    LOAN_ISSUED: "PAYROLL.LOAN_ISSUED",
    LOAN_CLEARED: "PAYROLL.LOAN_CLEARED",
    RUN_CREATED: "PAYROLL.RUN_CREATED",
    RUN_APPROVED: "PAYROLL.RUN_APPROVED",
    RUN_PAID: "PAYROLL.RUN_PAID",
    RUN_FILED: "PAYROLL.RUN_FILED",
    RUN_DELETED: "PAYROLL.RUN_DELETED",
  },
  // procurement
  PROCUREMENT: {
    SUPPLIER_CREATED: "PROCUREMENT.SUPPLIER_CREATED",
    SUPPLIER_UPDATED: "PROCUREMENT.SUPPLIER_UPDATED",
    PO_CREATED: "PROCUREMENT.PO_CREATED",
    PO_SENT: "PROCUREMENT.PO_SENT",
    PO_CLOSED: "PROCUREMENT.PO_CLOSED",
    GRN_RECEIVED: "PROCUREMENT.GRN_RECEIVED",
    INVOICE_RECORDED: "PROCUREMENT.INVOICE_RECORDED",
    PAYMENT_RECORDED: "PROCUREMENT.PAYMENT_RECORDED",
  },
} as const;

/** Extracts the string leaves of the nested AUDIT_ACTIONS registry. */
export type AuditActionLeaves<T> = {
  [K in keyof T]: T[K] extends string ? T[K] : AuditActionLeaves<T[K]>;
}[keyof T];

/** Registry values with autocomplete; free-form strings still accepted. */
export type AuditAction =
  | AuditActionLeaves<typeof AUDIT_ACTIONS>
  | (string & {});

export interface AuditLogInput {
  tenantId: string;
  userId?: string | null;
  /** Prefer a value from AUDIT_ACTIONS; free-form allowed for one-offs. */
  action: AuditAction;
  /** Which ERP module this belongs to — inferred from the action prefix. */
  module?: ModuleKey | "admin" | null;
  entity: string; // e.g. order, payslip, product, journalEntry, purchaseOrder
  entityId?: string | null;
  details?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

function inferModule(action: string): string | null {
  const prefix = action.split(".")[0];
  return prefix ? prefix.toLowerCase() : null;
}

/**
 * Writes one audit row.
 *
 * Outside a transaction it never throws into the caller — a failed audit
 * write is logged loudly for ops but must not roll back the business
 * action it describes. Pass `tx` (from `db.$transaction`) to write the row
 * atomically with the action it describes; in that mode failures
 * propagate so the transaction aborts instead of committing unaudited.
 */
export async function writeAuditLog(
  input: AuditLogInput,
  client: AuditClient = db
): Promise<void> {
  try {
    await client.activityLog.create({
      data: toRow(input),
    });
  } catch (error) {
    if (client !== db) {
      // In-transaction write: the tx is already aborted on error — rethrow
      // so the caller's transaction fails loudly rather than silently
      // committing without its audit row.
      throw error;
    }
    console.error("writeAuditLog failed", {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      tenantId: input.tenantId,
      error,
    });
  }
}

/**
 * Batched audit write for high-volume paths (imports, backfills, batch
 * postings). One createMany round-trip; failures surface to the caller
 * since batch callers usually wrap a transaction and want to know. Pass
 * `tx` to join the caller's transaction.
 */
export async function writeAuditLogs(
  inputs: AuditLogInput[],
  client: AuditClient = db
): Promise<void> {
  if (inputs.length === 0) return;
  await client.activityLog.createMany({
    data: inputs.map(toRow),
  });
}

function toRow(input: AuditLogInput) {
  return {
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    action: input.action,
    module: input.module ?? inferModule(input.action),
    entity: input.entity,
    entityId: input.entityId ?? null,
    details: input.details ?? null,
    before: input.before ?? undefined,
    after: input.after ?? undefined,
  };
}
