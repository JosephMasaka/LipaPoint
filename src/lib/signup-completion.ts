import { db } from "@/lib/db";
import { sendEmail, welcomeEmail } from "@/lib/email";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

// M-Pesa result codes from PalPluss's docs — extend as you encounter more.
const RESULT_CODE_MESSAGES: Record<string, string> = {
  "1": "Insufficient M-Pesa balance.",
  "17": "This transaction exceeds your M-Pesa risk limit.",
  "20": "Too many requests — please wait a moment and try again.",
  "1032": "You cancelled the M-Pesa prompt.",
  "1037": "You didn't respond to the M-Pesa prompt in time.",
};

export function describeFailure(
  status: string,
  resultCode?: string | null,
  resultDesc?: string | null
): string {
  if (resultCode && RESULT_CODE_MESSAGES[resultCode]) {
    return RESULT_CODE_MESSAGES[resultCode];
  }
  if (status === "CANCELLED") return "You cancelled the M-Pesa prompt.";
  if (status === "EXPIRED") return "The M-Pesa prompt timed out before you responded.";
  if (resultDesc) return resultDesc;
  return "Payment didn't go through.";
}

export interface PalPlussTransactionLike {
  id: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED" | "PENDING";
  amount: number;
  phone_number: string;
  mpesa_receipt: string | null;
  result_code?: string | null;
  result_desc?: string | null;
  provider_request_id?: string | null;
}

type CompletionResult =
  | { ok: true; alreadyProcessed?: true; tenantId?: string; userId?: string }
  | { ok: false; reason: string };

/**
 * Resolves a PendingSignup based on a terminal PalPluss transaction result.
 * Called from both the webhook and the status-poll fallback, so both paths
 * stay in sync — idempotent via the PENDING status check.
 */
export async function completeSignupFromTransaction(
  pendingSignupId: string,
  txn: PalPlussTransactionLike
): Promise<CompletionResult> {
  const pending = await db.pendingSignup.findUnique({ where: { id: pendingSignupId } });
  if (!pending) return { ok: false, reason: "pending_signup_not_found" };
  if (pending.status !== "PENDING") return { ok: true, alreadyProcessed: true };

  if (txn.status === "SUCCESS") {
    const existingUser = await db.user.findUnique({ where: { email: pending.email } });
    if (existingUser) {
      const message =
        "This email was registered by someone else while your payment was processing. Please contact support.";
      await db.pendingSignup.update({
        where: { id: pending.id },
        data: { status: "FAILED", failureReason: message },
      });
      console.error(
        "Signup completion: payment succeeded but email was claimed before completion",
        pending.email
      );
      // TODO: real edge case worth a refund/support-review flag — the
      // customer paid but we couldn't create their account.
      return { ok: false, reason: message };
    }

    let slug = pending.slug;
    const slugTaken = await db.tenant.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${generateSlug(pending.businessName)}-${Date.now().toString(36)}`;
    }

    const tenant = await db.tenant.create({
      data: {
        name: pending.businessName,
        slug,
        type: pending.businessType,
        tier: pending.tier,
        email: pending.email,
        phone: pending.phone,
        trialEndsAt: null, // paid immediately — no trial
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

    // paystackPlanCode/SubCode/CustCode left null — PalPluss has no
    // plan/subscription API, just one-off STK Push. Renewal needs your own
    // cron to trigger a fresh STK Push and extend currentPeriodEnd.
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        tier: pending.tier,
        amount: pending.amount,
        currency: "KES",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await db.transaction.create({
      data: {
        type: "SUBSCRIPTION",
        amount: txn.amount,
        method: "MPESA_STK",
        status: "COMPLETED",
        reference: txn.id,
        gatewayRef: txn.mpesa_receipt ?? txn.provider_request_id ?? undefined,
        gatewayStatus: txn.result_desc ?? undefined,
        mpesaPhone: txn.phone_number,
        description: `${pending.tier} subscription — ${pending.businessName}`,
        tenantId: tenant.id,
        userId: user.id,
      },
    });

    await db.pendingSignup.update({
      where: { id: pending.id },
      data: {
        status: "COMPLETED",
        transactionId: txn.id,
        tenantId: tenant.id,
        userId: user.id,
        passwordHash: "", // no reason to keep a second copy once User has it
      },
    });

    const emailContent = welcomeEmail(pending.ownerName, pending.businessName, pending.tier, slug);
    sendEmail({ to: pending.email, ...emailContent }).catch(() => {});

    return { ok: true, tenantId: tenant.id, userId: user.id };
  }

  // FAILED, CANCELLED, or EXPIRED — no tenant gets created.
  const message = describeFailure(txn.status, txn.result_code, txn.result_desc);
  await db.pendingSignup.update({
    where: { id: pending.id },
    data: { status: "FAILED", failureReason: message, transactionId: txn.id },
  });
  return { ok: false, reason: message };
}