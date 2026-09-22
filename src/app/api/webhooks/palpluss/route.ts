import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, welcomeEmail } from "@/lib/email";

// PalPluss confirms payloads are signed but the security docs I've fetched
// so far don't give the header name or algorithm. DO NOT deploy without
// confirming that — right now this endpoint trusts any POST body. That
// matters more now than before: this endpoint creates real accounts and
// real subscriptions.
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
  tenant_id: string; // PalPluss's own tenant/business id — unrelated to our db.tenant
  type: "STK" | "B2C";
  status: "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: number;
  currency: string;
  phone_number: string;
  external_reference: string | null; // our PendingSignup.id, set as accountReference
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

const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

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

  const pendingSignupId = transaction.external_reference;
  const pending = pendingSignupId
    ? await db.pendingSignup.findUnique({ where: { id: pendingSignupId } })
    : null;

  if (!pending) {
    console.error("PalPluss webhook: no pending signup for reference", pendingSignupId);
    return NextResponse.json({ received: true });
  }

  // Idempotency — PalPluss retries the same callback on delivery failure.
  // Once a pending signup has left PENDING, it's already been handled.
  if (pending.status !== "PENDING") {
    return NextResponse.json({ received: true });
  }

  if (event_type === "transaction.success") {
    // Re-check uniqueness — time has passed since the original request,
    // so someone else could have taken this email or slug in the meantime.
    const existingUser = await db.user.findUnique({ where: { email: pending.email } });
    if (existingUser) {
      await db.pendingSignup.update({
        where: { id: pending.id },
        data: { status: "FAILED", failureReason: "email_taken_before_completion" },
      });
      console.error(
        "PalPluss webhook: payment succeeded but email was claimed before completion",
        pending.email
      );
      // TODO: real edge case worth refunding/flagging for support review —
      // the customer paid but we couldn't create their account.
      return NextResponse.json({ received: true });
    }

    let slug = pending.slug;
    const slugTaken = await db.tenant.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${generateSlug(pending.businessName)}-${Date.now().toString(36)}`;
    }

    // No trial period here — payment already happened, so this tenant
    // starts as an active paying customer, not a trial.
    const tenant = await db.tenant.create({
      data: {
        name: pending.businessName,
        slug,
        type: pending.businessType,
        tier: pending.tier,
        email: pending.email,
        phone: pending.phone,
        trialEndsAt: null,
        locations: {
          create: {
            name: "Main Location",
            registers: { create: { name: "Register 1" } },
          },
        },
        users: {
          create: {
            name: pending.ownerName,
            email: pending.email,
            phone: pending.phone,
            password: pending.passwordHash,
            role: "OWNER",
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];

    await db.activityLog.create({
      data: {
        action: "TENANT_CREATED",
        entity: "tenant",
        entityId: tenant.id,
        tenantId: tenant.id,
        userId: user.id,
      },
    });

    // The schema's Subscription model has paystackPlanCode/SubCode/CustCode
    // fields — left null here since PalPluss has no plan/subscription API
    // (just one-off STK Push). Renewing this monthly will need your own
    // cron that triggers a fresh STK Push and extends currentPeriodEnd —
    // not built yet, flagging rather than guessing at that design.
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        tier: pending.tier,
        amount: pending.amount,
        currency: "KES",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_PERIOD_MS),
      },
    });

    await db.transaction.create({
      data: {
        type: "SUBSCRIPTION",
        amount: transaction.amount,
        method: "MPESA_STK",
        status: "COMPLETED",
        reference: transaction.id,
        gatewayRef: transaction.mpesa_receipt ?? transaction.provider_request_id,
        gatewayStatus: transaction.result_desc,
        mpesaPhone: transaction.phone_number,
        description: `${pending.tier} subscription — ${pending.businessName}`,
        tenantId: tenant.id,
        userId: user.id,
      },
    });

    await db.pendingSignup.update({
      where: { id: pending.id },
      data: {
        status: "COMPLETED",
        transactionId: transaction.id,
        tenantId: tenant.id,
        userId: user.id,
        // Clear the password hash now that the real User row has it —
        // no reason for two copies of it to exist.
        passwordHash: "",
      },
    });

    const emailContent = welcomeEmail(pending.ownerName, pending.businessName, pending.tier, slug);
    sendEmail({ to: pending.email, ...emailContent }).catch(() => {});

    return NextResponse.json({ received: true });
  }

  // FAILED, CANCELLED, or EXPIRED — no tenant exists yet to attach a
  // Transaction row to, so the failure only lives on the pending signup.
  await db.pendingSignup.update({
    where: { id: pending.id },
    data: {
      status: "FAILED",
      failureReason: event_type,
      transactionId: transaction.id,
    },
  });

  return NextResponse.json({ received: true });
}