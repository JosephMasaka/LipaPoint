import { NextResponse } from "next/server";
import {
  verifyCallbackSecret,
  confirmEtimsSubmission,
  EtimsCallbackError,
  CALLBACK_SECRET_HEADER,
} from "@/lib/etims/callback";
import { parseBody } from "@/lib/api-guards";

/**
 * POST /api/etims/callback — OSCU's async confirmation endpoint.
 *
 * Deliberately NOT session-authenticated: KRA's middleware calls it, not a
 * user. Auth is the shared ETIMS_CALLBACK_SECRET in the
 * x-etims-callback-secret header; the route 503s while that secret is
 * unset rather than accepting unauthenticated confirmations.
 *
 * Body: { submissionId?, internalReference?, status: "accepted"|"rejected",
 *         kraInvoiceNumber?, qrCodeUrl?, reason?, raw? }
 */
export async function POST(request: Request) {
  const secret = verifyCallbackSecret(request.headers.get(CALLBACK_SECRET_HEADER));
  if (!secret.ok) {
    return NextResponse.json({ error: secret.error }, { status: secret.status });
  }

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