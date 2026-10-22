import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyTransaction } from "@/lib/paystack";
import { sendEmail, planUpgradeEmail } from "@/lib/email";
import { finalizeSubscriptionCoupon } from "@/lib/coupons";

export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get("reference");
    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await verifyTransaction(reference);

    if (result.data.status !== "success") {
      return NextResponse.json({ error: "Payment not successful", status: result.data.status }, { status: 400 });
    }

    const metadata = result.data.metadata as Record<string, string> | null;
    const tier = metadata?.tier;
    const tenantId = metadata?.tenantId;

    if (!tier || !tenantId || tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Invalid payment metadata" }, { status: 400 });
    }

    if (!["STARTER", "PROFESSIONAL", "ENTERPRISE"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const existing = await db.transaction.findUnique({ where: { reference } });
    if (!existing) {
      await db.transaction.create({
        data: {
          type: "SUBSCRIPTION_PAYMENT",
          amount: result.data.amount / 100,
          method: "PAYSTACK",
          status: "COMPLETED",
          reference,
          gatewayRef: reference,
          tenantId,
          couponCode: typeof metadata?.couponCode === "string" ? metadata.couponCode : null,
          description: `Plan upgrade to ${tier}`,
        },
      });

      // Payment succeeded — claim the coupon quota now (Paystack has no
      // initiation-side claim) and record the redemption.
      await finalizeSubscriptionCoupon({
        code: typeof metadata?.couponCode === "string" ? metadata.couponCode : null,
        tenantId,
        targetTier: tier,
        currentTier: user.tenant.tier,
        tenantType: user.tenant.type,
        paidAmount: result.data.amount / 100,
      });
    }

    await db.tenant.update({
      where: { id: tenantId },
      data: { tier: tier as "STARTER" | "PROFESSIONAL" | "ENTERPRISE", isActive: true, paystackSubCode: reference },
    });

    const emailContent = planUpgradeEmail(user.name, user.tenant.name, tier);
    await sendEmail({ to: user.email, ...emailContent });

    return NextResponse.json({ success: true, tier });
  } catch (error) {
    console.error("Paystack verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
