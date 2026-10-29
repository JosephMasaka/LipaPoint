import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/palpluss";
import { getPlanPricing, FULL_ERP_PRICE, FULL_ERP_TIER, BUSINESS_TYPES } from "@/lib/plans";
import {
  claimCouponUse,
  quoteCoupon,
  releaseCouponUse,
  resolveResellerCode,
  validateCouponCode,
} from "@/lib/coupons";
import { MODULE_KEYS } from "@/lib/modules";
import { FEATURE_KEYS } from "@/lib/module-registry";

// Single source of truth with the register form's dropdown (lib/plans), so a
// new vertical can never show up at signup only to be rejected by the API —
// and every accepted value is guaranteed to exist in TENANT_TYPE_TO_CATEGORY.
const VALID_BUSINESS_TYPES = BUSINESS_TYPES.map((t) => t.value);
type TenantType = (typeof VALID_BUSINESS_TYPES)[number];

const VALID_TIERS = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
type SubscriptionTier = (typeof VALID_TIERS)[number];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const PENDING_SIGNUP_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, businessType, plan, ownerName, email, phone, password, couponCode, resellerCode, selectedApps, selectedFeatures, fullErp } = body;

    if (!businessName || !businessType || !ownerName || !email || !phone || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Odoo-style onboarding: the apps chosen up front become the tenant's
    // initial module configuration once payment completes.
    const apps: string[] = Array.isArray(selectedApps)
      ? [...new Set(selectedApps.filter((k: unknown) =>
          typeof k === "string" && (MODULE_KEYS as readonly string[]).includes(k)
        ))]
      : [];

    // Granular feature selection: validate feature keys against registry
    const features: string[] = Array.isArray(selectedFeatures)
      ? [...new Set(selectedFeatures.filter((k: unknown) =>
          typeof k === "string" && (FEATURE_KEYS as readonly string[]).includes(k)
        ))]
      : [];

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (!VALID_BUSINESS_TYPES.includes(businessType)) {
      return NextResponse.json({ error: "Invalid business type" }, { status: 400 });
    }
    const tier: SubscriptionTier = VALID_TIERS.includes(plan) ? plan : "STARTER";

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!/^0\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "Enter a valid Kenyan phone number (e.g. 0712345678)" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    if (!process.env.PALPLUSS_SECRET_KEY) {
      console.error("Registration blocked — PALPLUSS_SECRET_KEY is not set");
      return NextResponse.json(
        { error: "Payment is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const activePending = await db.pendingSignup.findFirst({
      where: { email: normalizedEmail, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (activePending) {
      return NextResponse.json(
        { error: "A signup for this email is already in progress. Check your phone, or wait a few minutes and try again." },
        { status: 409 }
      );
    }

    let slug = generateSlug(businessName);
    const existingTenant = await db.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const hashedPassword = await hashPassword(password);
    // Unified Full ERP plan (pricing page's fourth card): identical
    // entitlements to ENTERPRISE, but one flat price for every industry
    // instead of getPlanPricing's per-vertical Enterprise rate. The flag is
    // only honored on an ENTERPRISE signup — anywhere else it's ignored.
    const useFullErpPrice = fullErp === true && tier === FULL_ERP_TIER;
    const listPrice = useFullErpPrice
      ? FULL_ERP_PRICE
      : getPlanPricing(tier, businessType as TenantType).monthly;
    let amount = listPrice;

    // Optional platform coupon — validate up-front so the user gets a clear
    // error before any payment prompt, then atomically reserve one use.
    const wantsCoupon = typeof couponCode === "string" && couponCode.trim() !== "";
    if (wantsCoupon) {
      const validation = await validateCouponCode(couponCode);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const claimed = await claimCouponUse(couponCode);
      if (!claimed) {
        return NextResponse.json(
          { error: "That coupon has reached its usage limit." },
          { status: 400 }
        );
      }
      const quote = quoteCoupon(claimed, listPrice);
      // M-Pesa STK Push won't charge less than KES 1.
      amount = Math.max(1, quote.finalAmount);
    }

    // Optional reseller referral code — attaches the new tenant to the
    // reseller who referred them (checked again at completion time).
    let appliedResellerCode: string | null = null;
    if (typeof resellerCode === "string" && resellerCode.trim() !== "") {
      const resolved = await resolveResellerCode(resellerCode);
      if (!resolved.ok) {
        if (wantsCoupon) await releaseCouponUse(couponCode);
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      appliedResellerCode = resolved.reseller.code;
    }

    const completionToken = randomBytes(32).toString("hex");

    const pendingSignup = await db.pendingSignup.create({
      data: {
        businessName,
        businessType,
        tier,
        ownerName,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash: hashedPassword,
        slug,
        amount,
        couponCode: wantsCoupon ? couponCode.trim().toUpperCase().replace(/\s+/g, "") : null,
        resellerCode: appliedResellerCode,
        selectedApps: apps,
        selectedFeatures: features,
        status: "PENDING",
        completionToken,
        expiresAt: new Date(Date.now() + PENDING_SIGNUP_TTL_MS),
      },
    });

    try {
      const txn = await initiateStkPush({
        phone: normalizedPhone,
        amount,
        accountReference: pendingSignup.id,
        // M-Pesa's underlying STK Push API is strict about this field —
        // plain ASCII only (no em-dash/smart quotes), and traditionally
        // capped around 13 characters. Keeping it short and safe.
        transactionDesc: `${tier} Signup`.slice(0, 13),
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/palpluss`,
      });

      await db.pendingSignup.update({
        where: { id: pendingSignup.id },
        data: { transactionId: txn.data.transactionId },
      });

      return NextResponse.json(
        {
          pendingSignupId: pendingSignup.id,
          completionToken,
          transactionId: txn.data.transactionId,
        },
        { status: 202 }
      );
    } catch (err) {
      // Now logs the real PalPluss error body (bad auth, invalid phone,
      // rate limit, etc.) instead of a bare generic failure.
      console.error("PalPluss STK Push failed for pending signup", pendingSignup.id, err);
      await releaseCouponUse(pendingSignup.couponCode);
      await db.pendingSignup.update({
        where: { id: pendingSignup.id },
        data: { status: "FAILED", failureReason: "We couldn't start the payment. Please try again." },
      });
      return NextResponse.json(
        { error: "Could not start payment. Please try again." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}