import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PalPluss confirms payloads are signed but the security docs I've fetched
// so far don't give the header name or algorithm. DO NOT deploy without
// confirming that — right now this endpoint trusts any POST body, meaning
// anyone who finds this URL could fake a successful payment.
//
// Once confirmed, it'll likely look something like:
//
//   const signature = request.headers.get("x-palpluss-signature");
//   const expected = createHmac("sha256", process.env.PALPLUSS_WEBHOOK_SECRET!)
//     .update(rawBody)
//     .digest("hex");
//   if (signature !== expected) return new NextResponse("Invalid signature", { status: 401 });
//
// That needs the raw body (before JSON parsing) to compute the HMAC
// correctly — restructure the body-reading below if so.

interface PalPlussWebhookTransaction {
  id: string;
  tenant_id: string; // PalPluss's own tenant/business id — NOT our db.tenant.id
  type: "STK" | "B2C";
  status: "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: number;
  currency: string;
  phone_number: string;
  external_reference: string | null; // our accountReference / reference
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

const ACTION_BY_EVENT: Record<PalPlussWebhookPayload["event_type"], string> = {
  "transaction.success": "PAYMENT_SUCCESS",
  "transaction.failed": "PAYMENT_FAILED",
  "transaction.cancelled": "PAYMENT_CANCELLED",
  "transaction.expired": "PAYMENT_EXPIRED",
};

export async function POST(request: NextRequest) {
  let payload: PalPlussWebhookPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: verify signature here before trusting anything below.

  const { transaction, event_type } = payload;
  if (!transaction?.id || !transaction?.status || !event_type) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  // Idempotency guard — PalPluss says the same callback may be delivered
  // more than once on retry. transaction.id is stable per transaction.
  const alreadyProcessed = await db.activityLog.findFirst({
    where: { entity: "transaction", entityId: transaction.id },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true });
  }

  // external_reference round-trips the accountReference we set when
  // initiating the STK Push (the tenant's slug) in the signup route.
  const slug = transaction.external_reference;
  const tenant = slug ? await db.tenant.findUnique({ where: { slug } }) : null;

  if (!tenant) {
    console.error(
      "PalPluss webhook: no tenant found for external_reference",
      slug
    );
    // Still 2xx — acknowledging stops retries even when we can't correlate it.
    return NextResponse.json({ received: true });
  }

  await db.activityLog.create({
    data: {
      action: ACTION_BY_EVENT[event_type],
      entity: "transaction",
      entityId: transaction.id,
      tenantId: tenant.id,
    },
  });

  if (event_type === "transaction.success") {
    // transaction.mpesa_receipt (e.g. "LGR019G3J2") is the official M-Pesa
    // proof of payment — worth persisting somewhere queryable if you have
    // a payments/invoices table, rather than only in activityLog.
    console.log(
      `Payment confirmed for ${tenant.slug}: receipt ${transaction.mpesa_receipt}`
    );

    // TODO: this is where you'd flip the tenant from trial to an active
    // paid subscription — clearing trialEndsAt, setting a
    // subscriptionStatus field, etc. Left as a stub since I don't know
    // those field names in your schema.
    // await db.tenant.update({ where: { id: tenant.id }, data: { ... } });
  }

  // Note: the docs' own example acknowledges (200) before processing, to
  // stay well inside the 30s response window and avoid needless retries.
  // The work above is a couple of small queries, so responding after it
  // completes should still be safely within that window — but if you add
  // anything slower here (external calls, heavy processing), move it to a
  // background job and return 200 immediately instead.
  return NextResponse.json({ received: true });
}