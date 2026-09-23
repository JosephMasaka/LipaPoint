import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeSignupFromTransaction } from "@/lib/signup-completion";

// PalPluss confirms payloads are signed but the security docs I've fetched
// so far don't give the header name or algorithm. DO NOT deploy without
// confirming that — this endpoint creates real accounts and subscriptions.
//
//   const signature = request.headers.get("x-palpluss-signature");
//   const expected = createHmac("sha256", process.env.PALPLUSS_WEBHOOK_SECRET!)
//     .update(rawBody)
//     .digest("hex");
//   if (signature !== expected) return new NextResponse("Invalid signature", { status: 401 });
//
// Needs the raw body (before JSON parsing) to compute the HMAC correctly.

interface PalPlussWebhookTransaction {
  id: string;
  tenant_id: string;
  type: "STK" | "B2C";
  status: "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: number;
  currency: string;
  phone_number: string;
  external_reference: string | null;
  provider: string;
  provider_request_id: string;
  provider_checkout_id: string;
  mpesa_receipt: string | null;
  result_code: string;
  result_desc: string;
  created_at: string;
  updated_at: string;
}

interface PalPlussWebhookPayload {
  event: "transaction.updated";
  event_type:
    | "transaction.success"
    | "transaction.failed"
    | "transaction.cancelled"
    | "transaction.expired";
  transaction: PalPlussWebhookTransaction;
}

export async function POST(request: NextRequest) {
  let payload: PalPlussWebhookPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: verify signature here before trusting anything below.

  const { transaction } = payload;
  if (!transaction?.id || !transaction?.status) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const pendingSignupId = transaction.external_reference;
  if (!pendingSignupId) {
    console.error("PalPluss webhook: no external_reference on transaction", transaction.id);
    return NextResponse.json({ received: true });
  }

  const pending = await db.pendingSignup.findUnique({ where: { id: pendingSignupId } });
  if (!pending) {
    console.error("PalPluss webhook: no pending signup for reference", pendingSignupId);
    return NextResponse.json({ received: true });
  }

  // Idempotent — the status-poll fallback may have already resolved this
  // before the webhook arrived, or PalPluss may retry the same delivery.
  const result = await completeSignupFromTransaction(pending.id, {
    id: transaction.id,
    status: transaction.status,
    amount: transaction.amount,
    phone_number: transaction.phone_number,
    mpesa_receipt: transaction.mpesa_receipt,
    result_code: transaction.result_code,
    result_desc: transaction.result_desc,
    provider_request_id: transaction.provider_request_id,
  });

  if (!result.ok && result.reason === "pending_signup_not_found") {
    console.error("PalPluss webhook: pending signup vanished mid-processing", pending.id);
  }

  return NextResponse.json({ received: true });
}