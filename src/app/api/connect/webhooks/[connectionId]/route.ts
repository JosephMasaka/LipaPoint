import { NextResponse } from "next/server";
import { routeError } from "@/lib/api-guards";
import { ConnectError } from "@/lib/connect/errors";
import { handleInboundWebhook } from "@/lib/connect/webhooks";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 1024 * 1024;

/**
 * Public by necessity — the caller is an external system, not a session.
 * Authentication is the HMAC signature (see src/lib/connect/webhooks.ts),
 * which is why this route is one of only two under /api/connect without a
 * session guard.
 */
export async function POST(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const { connectionId } = await params;
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const outcome = await handleInboundWebhook({
      connectionId,
      rawBody,
      signature: request.headers.get("x-lipapoint-signature"),
    });

    return NextResponse.json(outcome, { status: outcome.status });
  } catch (error) {
    if (error instanceof ConnectError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return routeError("POST /api/connect/webhooks/[connectionId]", error);
  }
}
