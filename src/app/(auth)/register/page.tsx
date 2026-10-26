"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  UserPlus, Smartphone, XCircle, Check, CheckCircle2,
  LayoutDashboard, Users, Calculator, HandCoins, Boxes, Globe,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { BUSINESS_TYPES, VERTICAL_PLANS, getBusinessCategory, formatPrice } from "@/lib/plans";
import {
  APPS,
  type AppId,
  appTierLabel,
  minTierIndexForApps,
  modulesForApps,
} from "@/lib/apps";
import { TIER_ORDER } from "@/lib/module-registry";
import { cn } from "@/lib/utils";

/**
 * Odoo-shaped onboarding (lipapoint-erp-saas-ui skill §5), no free trial:
 *   1. Choose the apps you want → becomes the tenant's module configuration
 *   2. Business profile + plan  → plan auto-fits the app selection
 *   3. Account + coupon gate     → coupon is a first-class step (it replaces
 *                                  trials as the acquisition lever), then
 *                                  M-Pesa payment.
 *
 * Steps render inside one <form>, hidden with CSS — FormData still collects
 * the display-hidden step's inputs on submit, so the flow can jump back and
 * forth without losing values.
 */

function getPlansForType(businessType: string) {
  const category = getBusinessCategory(businessType);
  return Object.entries(VERTICAL_PLANS[category]).map(([tier, config]) => ({
    value: tier,
    label: `${tier.charAt(0) + tier.slice(1).toLowerCase()} - ${formatPrice(config.pricing.monthly)}/mo`,
    index: TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]),
  }));
}

const POLL_INTERVAL_MS = 3000;

type PaymentPhase = "idle" | "awaiting" | "failed";

const APP_ICONS: Record<AppId, React.ComponentType<{ className?: string }>> = {
  pos: LayoutDashboard,
  crm: Users,
  finance: Calculator,
  payroll: HandCoins,
  assets: Boxes,
  etims: Globe,
};

const STEP_LABELS = ["Apps", "Business", "Account"] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  // Step 1 — app selection (Odoo's "which apps do you want?")
  const [selectedApps, setSelectedApps] = useState<Set<AppId>>(new Set(["pos"]));

  // Step 2 — business profile
  const [businessType, setBusinessType] = useState("RETAIL");
  const [selectedPlan, setSelectedPlan] = useState("STARTER");

  // Step 3 — account + coupon gate
  const [couponInput, setCouponInput] = useState("");
  const [couponInfo, setCouponInfo] = useState<{
    code: string;
    name: string | null;
    type: "PERCENT" | "FIXED";
    value: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [resellerInput, setResellerInput] = useState("");
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("idle");
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const pollRef = useRef<{ pendingSignupId: string; completionToken: string } | null>(null);
  const stopPollingRef = useRef(false);

  const plans = getPlansForType(businessType);

  // The plan can't sit below what the chosen apps need — auto-fit it and
  // say so (the server re-checks entitlement at provisioning time).
  const minTierIndex = useMemo(() => minTierIndexForApps(selectedApps), [selectedApps]);
  const planIndex = plans.find((p) => p.value === selectedPlan)?.index ?? 0;
  const planAutoFitted = planIndex < minTierIndex;

  useEffect(() => {
    if (planIndex < minTierIndex) {
      setSelectedPlan(TIER_ORDER[minTierIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTierIndex]);

  const monthlyPrice =
    VERTICAL_PLANS[getBusinessCategory(businessType)]?.[selectedPlan]?.pricing.monthly ?? 0;
  const discount = couponInfo
    ? couponInfo.type === "PERCENT"
      ? (monthlyPrice * Math.min(couponInfo.value, 100)) / 100
      : Math.min(couponInfo.value, monthlyPrice)
    : 0;
  const discountedPrice = Math.round((monthlyPrice - discount) * 100) / 100;

  function toggleApp(id: AppId) {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Never allow an empty selection — Odoo always installs something.
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponInfo(null);
        setCouponError(data.error || "That coupon code isn't valid.");
        return;
      }
      setCouponInfo(data);
    } catch {
      setCouponInfo(null);
      setCouponError("Couldn't check the coupon — please try again.");
    } finally {
      setCouponChecking(false);
    }
  }

  async function pollUntilResolved() {
    const target = pollRef.current;
    if (!target || stopPollingRef.current) return;

    try {
      const res = await fetch(`/api/auth/register/status/${target.pendingSignupId}`);
      const data = await res.json();

      if (res.ok && data.status === "COMPLETED") {
        const loginRes = await fetch("/api/auth/register/complete-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pendingSignupId: target.pendingSignupId,
            completionToken: target.completionToken,
          }),
        });
        const loginData = await loginRes.json();

        if (loginRes.ok) {
          router.push(`/${loginData.tenant.slug}/dashboard`);
          router.refresh();
        } else {
          setPaymentPhase("failed");
          setFailureReason(loginData.error ?? "Something went wrong finishing sign-in.");
        }
        return;
      }

      if (res.ok && data.status === "FAILED") {
        setPaymentPhase("failed");
        setFailureReason(data.failureReason ?? "Payment didn't go through.");
        return;
      }
    } catch {
      // A single failed status check isn't fatal — keep polling.
    }

    if (!stopPollingRef.current) {
      setTimeout(pollUntilResolved, POLL_INTERVAL_MS);
    }
  }

  function resetToForm() {
    stopPollingRef.current = true;
    pollRef.current = null;
    setPaymentPhase("idle");
    setFailureReason(null);
    setStep(3);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const selectedModules = [...modulesForApps(selectedApps)];

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.get("businessName"),
          businessType: form.get("businessType"),
          plan: form.get("plan"),
          ownerName: form.get("ownerName"),
          email: form.get("email"),
          phone: form.get("phone"),
          password: form.get("password"),
          couponCode: couponInput.trim() || undefined,
          resellerCode: resellerInput.trim() || undefined,
          selectedApps: selectedModules,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      pollRef.current = {
        pendingSignupId: data.pendingSignupId,
        completionToken: data.completionToken,
      };
      stopPollingRef.current = false;
      setPaymentPhase("awaiting");
      pollUntilResolved();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (paymentPhase === "awaiting") {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 animate-pulse">
              <Smartphone size={28} className="text-gold" />
            </div>
          </div>
          <CardTitle className="text-2xl">Check your phone</CardTitle>
          <CardDescription>
                        We&apos;ve sent an M-Pesa payment prompt to your device. Enter your M-Pesa PIN to
            complete your subscription — this page will update automatically once it&apos;s confirmed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (paymentPhase === "failed") {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
              <XCircle size={28} className="text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Payment didn&apos;t complete</CardTitle>
          <CardDescription>{failureReason}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full" onClick={resetToForm}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selectedAppList = APPS.filter((a) => selectedApps.has(a.id));

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
            <Logo size={28} className="text-gold" />
          </div>
        </div>
        <CardTitle className="text-2xl">Get started with LipaPoint</CardTitle>
        <CardDescription>
          {step === 1 && "Choose the apps your business needs — one or all of them, together."}
          {step === 2 && "Tell us about your business and confirm your plan."}
          {step === 3 && "Create your account, apply your coupon, then pay with M-Pesa."}
        </CardDescription>

        {/* Step progress */}
        <div className="flex items-center justify-center gap-2 mt-4" aria-label="Sign-up progress">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6 bg-border" />}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
                    state === "current" && "border-gold/50 bg-gold/10 text-gold",
                    state === "done" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                    state === "todo" && "border-border bg-surface-elevated text-text-muted"
                  )}
                >
                  {state === "done" ? <Check className="h-3 w-3" /> : n}
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ── Step 1: app selection (Odoo's "which apps do you want?") ── */}
          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-secondary">Your apps</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedApps(new Set(["pos", "crm"]))}
                  className="rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Just the till
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedApps(new Set(APPS.map((a) => a.id)))}
                  className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs text-gold transition-colors"
                >
                  All apps
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {APPS.map((app) => {
                const Icon = APP_ICONS[app.id];
                const active = selectedApps.has(app.id);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => toggleApp(app.id)}
                    aria-pressed={active}
                    className={cn(
                      "relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-gold/60 bg-gold/5 shadow-sm"
                        : "border-border bg-surface-elevated hover:bg-surface-hover"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-gold/15 text-gold" : "bg-surface text-text-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-text-primary">{app.label}</span>
                        {active && <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />}
                      </span>
                      <span className="block text-xs text-text-secondary mt-0.5 leading-snug">
                        {app.tagline}
                      </span>
                      <span className="mt-1.5 inline-block rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted border border-border">
                        {appTierLabel(app)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-text-muted">
              Everything works together — a POS sale posts to Finance, a payroll run shows up in
              your books. You can switch the rest on later from the Apps screen.
            </p>

            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => setStep(2)}
              disabled={selectedApps.size === 0}
            >
              Continue
            </Button>
          </div>

          {/* ── Step 2: business profile + plan ── */}
          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="text-xs text-text-muted">Apps:</span>
              {selectedAppList.map((a) => (
                <span
                  key={a.id}
                  className="rounded-md bg-gold/10 px-1.5 py-0.5 text-[11px] font-medium text-gold"
                >
                  {a.label}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-auto text-xs text-gold hover:underline"
              >
                Change
              </button>
            </div>

            <Input name="businessName" label="Business Name" placeholder="Acme Enterprises" required />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Business Type</label>
              <select
                name="businessType"
                required
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
              >
                <option value="">Select your business type...</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Choose a Plan</label>
              <select
                name="plan"
                required
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
              >
                {plans.map((p) => (
                  <option key={p.value} value={p.value} disabled={p.index < minTierIndex}>
                    {p.label}
                    {p.index < minTierIndex ? " — needs a higher plan for your apps" : ""}
                  </option>
                ))}
              </select>
              {planAutoFitted && (
                <p className="text-xs text-gold">
                  Your app selection needs {TIER_ORDER[minTierIndex].toLowerCase()} — we&apos;ve
                  picked that plan for you.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" size="lg" className="flex-1" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>

          {/* ── Step 3: account + coupon gate (first-class, not buried) ── */}
          <div className={step === 3 ? "space-y-4" : "hidden"}>
            <Input name="ownerName" label="Your Full Name" placeholder="John Doe" required />
            <Input name="email" label="Email Address" type="email" placeholder="john@business.co.ke" required />
            <Input name="phone" label="Phone Number" type="tel" placeholder="0712345678" required />
            <Input name="password" label="Password" type="password" placeholder="Min 8 characters" required minLength={8} />

            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3.5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Have a coupon code?</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Coupons are how we onboard — enter yours to apply it to your first M-Pesa payment.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. WELCOME10"
                  aria-label="Coupon code"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setCouponInfo(null);
                    setCouponError("");
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="self-center h-10 px-4"
                  disabled={couponChecking || !couponInput.trim()}
                  onClick={handleApplyCoupon}
                >
                  {couponChecking ? "Checking..." : "Apply"}
                </Button>
              </div>
              {couponError && <p className="text-xs text-red-400">{couponError}</p>}
              {couponInfo && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
                  {couponInfo.name ? `${couponInfo.name} — ` : ""}
                  {couponInfo.type === "PERCENT" ? `${couponInfo.value}% off` : `${formatPrice(couponInfo.value)} off`} your first payment{" "}
                  (<span className="line-through opacity-70">{formatPrice(monthlyPrice)}</span>{" "}
                  → <span className="font-semibold">{formatPrice(discountedPrice)}</span>)
                </div>
              )}
            </div>

            <Input
              label="Reseller Code (optional)"
              placeholder="e.g. JOHN2026"
              value={resellerInput}
              onChange={(e) => setResellerInput(e.target.value)}
            />

            <div className="flex gap-3">
              <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? "Starting payment..." : "Continue to payment"}
              </Button>
            </div>
          </div>
        </form>

        <p className="text-sm text-text-muted text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
