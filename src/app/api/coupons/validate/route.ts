import { NextRequest, NextResponse } from "next/server";
import { validateCouponCode } from "@/lib/coupons";

/**
 * Public: lets the registration and billing UI preview a coupon before any
 * payment is initiated. The payment routes re-validate and reserve the use
 * server-side, so this endpoint never mutates anything.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code : "";

    const result = await validateCouponCode(code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { coupon } = result;
    return NextResponse.json({
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
    });
  } catch (error) {
    console.error("Coupon validate error:", error);
    return NextResponse.json({ error: "Failed to validate coupon" }, { status: 500 });
  }
}
