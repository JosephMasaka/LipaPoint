import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initializeTransaction } from "@/lib/paystack";
import { db } from "@/lib/db";
import { getPlanPricing, VERTICAL_PLANS, getBusinessCategory } from "@/lib/plans";
import { quoteCoupon, validateCouponCode } from "@/lib/coupons";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only owners/admins can change plans" }, { status: 403 });
    }

    const { tier, couponCode } = await request.json();

    const category = getBusinessCategory(user.tenant.type);
    if (!tier || !(tier in VERTICAL_PLANS[category])) {
      return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
    }

    if (tier === user.tenant.tier) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    const listPrice = getPlanPricing(tier, user.tenant.type).monthly;
    let amount = listPrice;

    // Validate the coupon up-front so the user finds out before being
    // redirected to checkout. Quota is claimed at completion (there's no
    // failure callback for an abandoned checkout) — see verify/webhook.
    let appliedCouponCode: string | null = null;
    if (typeof couponCode === "string" && couponCode.trim() !== "") {
      const validation = await validateCouponCode(couponCode);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      appliedCouponCode = validation.coupon.code;
      amount = quoteCoupon(validation.coupon, listPrice).finalAmount;
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const result = await initializeTransaction({
      email: user.email,
      amount,
      callbackUrl: `${origin}/${user.tenant.slug}/settings?upgraded=${tier}`,
      metadata: {
        tenantId: user.tenantId,
        tier,
        type: "subscription_upgrade",
        ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
      },
    });

    return NextResponse.json({ url: result.data.authorization_url });
  } catch (error) {
    console.error("Paystack subscribe error:", error);
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}
