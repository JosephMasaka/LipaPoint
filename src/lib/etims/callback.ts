import { db } from "../db";
import type { Prisma } from "@prisma/client";
import { writeAuditLog, AUDIT_ACTIONS } from "../audit";

/**
 * eTIMS async confirmation callback (spec §4.8).
 *
 * OSCU can answer in two ways: synchronously from the submit call (already
 * handled in submission.ts), or later by calling back for invoices that
 * came back `submitted` — "accepted for processing, invoice number still
 * coming". Without this endpoint those rows have no exit: retrying them is
 * deliberately blocked (it would double-submit), so this is the only path
 * that closes the loop.
 *
 * Authentication is a shared secret (ETIMS_CALLBACK_SECRET) in the
 * x-etims-callback-secret header. The endpoint refuses to run at all while
 * the secret is unconfigured — an unauthenticated way to mark invoices
 * accepted is a KRA-compliance hole, so there is no dev bypass.
 */

export const CALLBACK_SECRET_HEADER = "x-etims-callback-secret";

export type SecretCheck =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function verifyCallbackSecret(provided: string | null | undefined): SecretCheck {
  const configured = process.env.ETIMS_CALLBACK_SECRET?.trim();
  if (!configured) {
    return {
      ok: false,
      status: 503,
      error: "eTIMS callback is not configured (set ETIMS_CALLBACK_SECRET)",
    };
  }
  if (!provided) {
    return { ok: false, status: 401, error: `Missing ${CALLBACK_SECRET_HEADER} header` };
  }
  // Constant-time-ish compare is overkill for a bootstrap shared secret,
  // but never echo the expected value back in the error.
  if (provided !== configured) {
    return { ok: false, status: 401, error: "Invalid callback secret" };
  }
  return { ok: true };
}

export interface ConfirmSubmissionInput {
  /** Preferred: our EtimsInvoice.id, echoed back as `submissionId`. */
  submissionId?: string | null;
  /** Fallback: orderNo / CN number. Must resolve to exactly one row. */
  internalReference?: string | null;
  status: "accepted" | "rejected";
  kraInvoiceNumber?: string | null;
  qrCodeUrl?: string | null;
  reason?: string | null;
  raw?: unknown;
}

/**
 * Applies KRA's async verdict to a row.
 *
 * State rules:
 * - `submitted` / `pending` → accepted | rejected (pending is included on
 *   purpose: if our call timed out but OSCU still processed the invoice,
 *   this callback is the proof it exists — flipping it to accepted is the
 *   *correct* recovery, not a duplicate).
 * - `accepted` → idempotent no-op (KRA confirming twice changes nothing).
 * - `rejected` → 409: a rejection already needs a human fix; a late
 *   callback must not silently overwrite that decision.
 */
export async function confirmEtimsSubmission(input: ConfirmSubmissionInput) {
  if (!input.submissionId && !input.internalReference) {
    throw new EtimsCallbackError("submissionId or internalReference is required", 400);
  }
  if (input.status !== "accepted" && input.status !== "rejected") {
    throw new EtimsCallbackError(`Unknown status "${input.status}"`, 400);
  }

  const row = await resolveRow(input);
  if (!row) throw new EtimsCallbackError("Submission not found", 404);

  if (row.status === "accepted") {
    return { row, changed: false };
  }
  if (row.status === "rejected") {
    throw new EtimsCallbackError(
      "Submission is rejected and awaiting a manual fix — use the dashboard retry",
      409
    );
  }

  const data: Prisma.EtimsInvoiceUpdateInput =
    input.status === "accepted"
      ? {
          status: "accepted",
          lastError: null,
          kraInvoiceNumber: input.kraInvoiceNumber ?? row.kraInvoiceNumber,
          qrCodeUrl: input.qrCodeUrl ?? row.qrCodeUrl,
        }
      : {
          status: "rejected",
          lastError: input.reason ?? "Rejected by KRA (async confirmation)",
        };

  const updated = await db.etimsInvoice.update({ where: { id: row.id }, data });

  await writeAuditLog({
    tenantId: row.tenantId,
    action:
      input.status === "accepted"
        ? AUDIT_ACTIONS.ETIMS.ACCEPTED
        : AUDIT_ACTIONS.ETIMS.REJECTED,
    module: "etims",
    entity: "etimsInvoice",
    entityId: row.id,
    details:
      input.status === "accepted"
        ? `Async confirmation — KRA invoice ${updated.kraInvoiceNumber ?? "pending"}`
        : `Async confirmation — ${input.reason ?? "rejected"}`,
    before: { status: row.status },
    after: { status: input.status, kraInvoiceNumber: updated.kraInvoiceNumber },
  });

  return { row: updated, changed: true };
}

async function resolveRow(input: ConfirmSubmissionInput) {
  if (input.submissionId) {
    return db.etimsInvoice.findUnique({ where: { id: input.submissionId } });
  }

  // internalRef is only unique per tenant — require an unambiguous match
  // rather than picking one and confirming the wrong tenant's invoice.
  const matches = await db.etimsInvoice.findMany({
    where: { sourceRef: input.internalReference! },
    select: { id: true },
    take: 2,
  });
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new EtimsCallbackError(
      `internalReference "${input.internalReference}" matches multiple submissions — send submissionId`,
      409
    );
  }
  return db.etimsInvoice.findUnique({ where: { id: matches[0].id } });
}

export class EtimsCallbackError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "EtimsCallbackError";
  }
}