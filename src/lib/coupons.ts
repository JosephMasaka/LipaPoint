import { db } from "@/lib/db";
import { getPlanPricing } from "@/lib/plans";
import type { Coupon } from "@prisma/client";

export type CouponValidation =
  | { ok: true; coupon: Coupon }
  | { ok: false; error: string };

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Validates a platform coupon for immediate use (active flag, validity
 * window, remaining quota). Does NOT consume the coupon — see
 * `claimCouponUse` for the step that reserves a use before payment.
 */
export async function validateCouponCode(rawCode: string): Promise<CouponValidation> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false, error: "That coupon code doesn't exist." };
  if (!coupon.isActive) return { ok: false, error: "That coupon is no longer active." };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { ok: false, error: "That coupon isn't active yet." };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { ok: false, error: "That coupon has expired." };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "That coupon has reached its usage limit." };
  }

  return { ok: true, coupon };
}

export interface CouponQuote {
  originalAmount: number;
  discount: number;
  finalAmount: number;
}

/** Pure math — what `amount` becomes once `coupon` is applied. */
export function quoteCoupon(
  coupon: Pick<Coupon, "type" | "value">,
  amount: number
): CouponQuote {
  const originalAmount = Math.max(0, amount);
  let discount =
    coupon.type === "PERCENT"
      ? (originalAmount * Math.min(Math.max(coupon.value, 0), 100)) / 100
      : Math.min(Math.max(coupon.value, 0), originalAmount);
  discount = Math.round(discount * 100) / 100;
  return {
    originalAmount,
    discount,
    finalAmount: Math.round((originalAmount - discount) * 100) / 100,
  };
}

/**
 * Reserves one use of the coupon before initiating payment, so concurrent
 * signups/upgrades can't both spend the last remaining use. Uses an
 * optimistic guard on usedCount (Prisma can't compare two columns in a
 * where clause), retrying once on a lost race.
 *
 * The reserved use MUST be given back via `releaseCouponUse` on every
 * payment-failure path, or the quota stays consumed.
 */
export async function claimCouponUse(rawCode: string): Promise<Coupon | null> {
  const normalized = normalizeCouponCode(rawCode);

  for (let attempt = 0; attempt < 2; attempt++) {
    const validation = await validateCouponCode(normalized);
    if (!validation.ok) return null;

    const { coupon } = validation;
    const res = await db.coupon.updateMany({
      where: { id: coupon.id, usedCount: coupon.usedCount, isActive: true },
      data: { usedCount: { increment: 1 } },
    });
    if (res.count === 1) return coupon;
    // Lost a race with another claim — re-read and try once more.
  }

  return null;
}

/** Gives a reserved use back when a payment never completed. */
export async function releaseCouponUse(rawCode: string | null | undefined): Promise<void> {
  if (!rawCode) return;
  try {
    await db.coupon.updateMany({
      where: { code: normalizeCouponCode(rawCode), usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  } catch (err) {
    // Never fail the caller's error path because bookkeeping hiccuped.
    console.error("Failed to release coupon use", rawCode, err);
  }
}

/**
 * Records the final, successful use of a coupon against a tenant.
 * `amount` is the list price, `paidAmount` what was actually charged.
 * The claim (usedCount) was already made at payment initiation.
 */
export async function recordCouponRedemption(params: {
  code: string | null | undefined;
  tenantId: string;
  context: "SIGNUP" | "RENEWAL" | "UPGRADE";
  amount: number;
  paidAmount: number;
}): Promise<void> {
  if (!params.code) return;
  try {
    const coupon = await db.coupon.findUnique({
      where: { code: normalizeCouponCode(params.code) },
    });
    if (!coupon) return;
    await db.couponRedemption.create({
      data: {
        couponId: coupon.id,
        tenantId: params.tenantId,
        context: params.context,
        amount: params.amount,
        discount: Math.round((params.amount - params.paidAmount) * 100) / 100,
        paidAmount: params.paidAmount,
      },
    });
  } catch (err) {
    console.error("Failed to record coupon redemption", params.code, err);
  }
}

const TIER_ORDER = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];

/**
 * Called once a subscription payment has actually succeeded on the Paystack
 * path (which has no initiation-side claim, because an abandoned checkout
 * never calls back). Reserves quota — best-effort, the money already moved —
 * then records the redemption.
 */
export async function finalizeSubscriptionCoupon(params: {
  code: string | null | undefined;
  tenantId: string;
  targetTier: string;
  currentTier: string;
  tenantType: string;
  paidAmount: number;
}): Promise<void> {
  if (!params.code) return;
  await claimCouponUse(params.code);
  const listPrice = getPlanPricing(params.targetTier, params.tenantType).monthly;
  const context =
    TIER_ORDER.indexOf(params.targetTier) > TIER_ORDER.indexOf(params.currentTier)
      ? "UPGRADE"
      : "RENEWAL";
  await recordCouponRedemption({
    code: params.code,
    tenantId: params.tenantId,
    context,
    amount: listPrice,
    paidAmount: params.paidAmount,
  });
}

export type ResellerResolution =
  | { ok: true; reseller: { id: string; code: string } }
  | { ok: false; error: string };

/** Resolves an optional reseller signup code entered during registration. */
export async function resolveResellerCode(rawCode: string): Promise<ResellerResolution> {
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { ok: false, error: "Enter a reseller code." };

  const reseller = await db.reseller.findUnique({ where: { code } });
  if (!reseller || !reseller.isActive) {
    return { ok: false, error: "That reseller code isn't valid." };
  }
  return { ok: true, reseller: { id: reseller.id, code: reseller.code } };
}
