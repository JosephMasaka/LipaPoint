import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/palpluss";
import { getPlanPricing } from "@/lib/plans";

const VALID_TIERS = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tier = body?.tier;

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!process.env.PALPLUSS_SECRET_KEY) {
    console.error("Plan upgrade blocked — PALPLUSS_SECRET_KEY is not set");
    return NextResponse.json(
      { error: "Payment is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  // getCurrentUser()'s tenant selection doesn't include phone — fall back
  // to a direct lookup if the user record itself has none.
  let phone = currentUser.phone;
  if (!phone) {
    const tenantRecord = await db.tenant.findUnique({
      where: { id: currentUser.tenantId },
      select: { phone: true },
    });
    phone = tenantRecord?.phone ?? null;
  }
  if (!phone) {
    return NextResponse.json(
      { error: "Add a phone number in Settings before upgrading." },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeKenyanPhone(phone);
  if (!/^0\d{9}$/.test(normalizedPhone)) {
    return NextResponse.json(
      { error: "The phone number on file isn't valid. Update it in Settings first." },
      { status: 400 }
    );
  }

  const amount = getPlanPricing(tier, currentUser.tenant.type).monthly;

  // type carries "UPGRADE:<TIER>" so the webhook/poll-fallback can recover
  // the target tier without a schema change — see plan-upgrade.ts.
  const transaction = await db.transaction.create({
    data: {
      type: `UPGRADE:${tier}`,
      amount,
      method: "MPESA_STK",
      status: "PENDING",
      description: `Upgrade to ${tier} — ${currentUser.tenant.name}`,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
    },
  });

  try {
    const txn = await initiateStkPush({
      phone: normalizedPhone,
      amount,
      accountReference: transaction.id,
      // Same ASCII/length constraints as the signup flow — see register/route.ts.
      transactionDesc: `Upgrade ${tier}`.slice(0, 13),
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/palpluss`,
    });

    // gatewayRef temporarily holds the PalPluss transaction id so the poll
    // route can reconcile directly — overwritten with the mpesa receipt
    // once the payment actually completes.
    await db.transaction.update({
      where: { id: transaction.id },
      data: { gatewayRef: txn.data.transactionId },
    });

    return NextResponse.json(
      { upgradeTransactionId: transaction.id, tier },
      { status: 202 }
    );
  } catch (err) {
    console.error("PalPluss STK Push failed for plan upgrade", transaction.id, err);
    await db.transaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED", gatewayStatus: "STK initiation failed" },
    });
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 502 }
    );
  }
}