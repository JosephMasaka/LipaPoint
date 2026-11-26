import { NextResponse } from "next/server";
import {
  verifyCallbackSecret,
  confirmEtimsSubmission,
  resolveSubmissionTenantId,
  EtimsCallbackError,
  CALLBACK_SECRET_HEADER,
} from "@/lib/etims/callback";
import { loadEtimsTenantConfig } from "@/lib/etims/tenant-config";
import { parseBody } from "@/lib/api-guards";

/**
 * POST /api/etims/callback — the device's (OSCU/VSCU) async confirmation endpoint.
 *
 * Deliberately NOT session-authenticated: KRA's middleware calls it, not a
 * user. Auth is a shared secret in the x-etims-callback-secret header — the
 * tenant's own (Settings > eTIMS) when it has one, otherwise the platform
 * ETIMS_CALLBACK_SECRET. The route 503s while neither is configured rather
 * than accepting unauthenticated confirmations.
 *
 * Body: { submissionId?, internalReference?, status: "accepted"|"rejected",
 *         kraInvoiceNumber?, qrCodeUrl?, reason?, raw? }
 */
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      submissionId?: string;
      internalReference?: string;
      status?: string;
      kraInvoiceNumber?: string;
      qrCodeUrl?: string;
      reason?: string;
      raw?: unknown;
    }>(request);

    // A tenant can have its own callback secret (Settings > eTIMS), so work
    // out which tenant this body refers to before checking the secret. Nothing
    // is written and nothing about the row is revealed until it passes.
    const tenantId = await resolveSubmissionTenantId({
      submissionId: body.submissionId ?? null,
      internalReference: body.internalReference ?? null,
    });
    const tenantSecret = tenantId
      ? (await loadEtimsTenantConfig(tenantId)).callbackSecret
      : null;

    const secret = verifyCallbackSecret(
      request.headers.get(CALLBACK_SECRET_HEADER),
      tenantSecret
    );
    if (!secret.ok) {
      return NextResponse.json({ error: secret.error }, { status: secret.status });
    }

    const { row, changed } = await confirmEtimsSubmission({
      submissionId: body.submissionId ?? null,
      internalReference: body.internalReference ?? null,
      status: body.status as "accepted" | "rejected",
      kraInvoiceNumber: body.kraInvoiceNumber ?? null,
      qrCodeUrl: body.qrCodeUrl ?? null,
      reason: body.reason ?? null,
      raw: body.raw,
    });

    return NextResponse.json({
      ok: true,
      changed,
      submissionId: row.id,
      status: row.status,
      kraInvoiceNumber: row.kraInvoiceNumber,
    });
  } catch (error) {
    if (error instanceof EtimsCallbackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/etims/callback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}