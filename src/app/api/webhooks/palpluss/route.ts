import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeSignupFromTransaction } from "@/lib/signup-completion";
import { completeUpgradeFromTransaction } from "@/lib/plan-upgrade";
import { completeOrderPayment } from "@/lib/payment-gateways/order-completion";

// PalPluss confirms payloads are signed but the security docs I've fetched
// so far don't give the header name or algorithm. DO NOT deploy without
// confirming that — this endpoint creates real accounts, subscriptions,
// AND completes real POS sales for tenants' own customers.
//
//   const signature = request.headers.get("x-palpluss-signature");
//   const expected = createHmac("sha256", process.env.PALPLUSS_WEBHOOK_SECRET!)
//     .update(rawBody)
//     .digest("hex");
//   if (signature !== expected) return new NextResponse("Invalid signature", { status: 401 });
//
// Needs the raw body (before JSON parsing) to compute the HMAC correctly.
//
// This one endpoint serves three callers — platform subscription billing
// (env-var key), tenant POS sales, and tenant plan upgrades (tenant's own
// stored key) — all pointing their callbackUrl here. external_reference
// disambiguates which record to resolve.

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

  const externalReference = transaction.external_reference;
  if (!externalReference) {
    console.error("PalPluss webhook: no external_reference on transaction", transaction.id);
    return NextResponse.json({ received: true });
  }

  const txnLike = {
    id: transaction.id,
    status: transaction.status,
    amount: transaction.amount,
    phone_number: transaction.phone_number,
    mpesa_receipt: transaction.mpesa_receipt,
    result_code: transaction.result_code,
    result_desc: transaction.result_desc,
    provider_request_id: transaction.provider_request_id,
  };

  // 1. New account signup?
  const pending = await db.pendingSignup.findUnique({ where: { id: externalReference } });
  if (pending) {
    await completeSignupFromTransaction(pending.id, txnLike);
    return NextResponse.json({ received: true });
  }

  // 2. Existing tenant's plan upgrade or POS sale — both are Transaction
  // rows keyed by their own id as external_reference. orderId is set only
  // for POS sales (see /api/orders' isPendingStk path) — plan upgrades
  // never have one, which is what disambiguates them here.
  const record = await db.transaction.findUnique({ where: { id: externalReference } });
  if (record) {
    if (record.orderId) {
      await completeOrderPayment(record.id, {
        status: transaction.status === "SUCCESS" ? "SUCCESS" : "FAILED",
        receiptNumber: transaction.mpesa_receipt ?? undefined,
        resultDesc: transaction.result_desc,
      });
    } else if (record.type.startsWith("UPGRADE:")) {
      await completeUpgradeFromTransaction(record.id, txnLike);
    } else {
      console.error(
        "PalPluss webhook: transaction matched but couldn't be classified",
        record.id,
        record.type
      );
    }
    return NextResponse.json({ received: true });
  }

  console.error(
    "PalPluss webhook: external_reference matched neither a pending signup nor a transaction",
    externalReference
  );
  return NextResponse.json({ received: true });
}