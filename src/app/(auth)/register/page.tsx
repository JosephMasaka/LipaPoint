"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Smartphone, XCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { BUSINESS_TYPES, VERTICAL_PLANS, getBusinessCategory, formatPrice } from "@/lib/plans";

function getPlansForType(businessType: string) {
  const category = getBusinessCategory(businessType);
  return Object.entries(VERTICAL_PLANS[category]).map(([tier, config]) => ({
    value: tier,
    label: `${tier.charAt(0) + tier.slice(1).toLowerCase()} - ${formatPrice(config.pricing.monthly)}/mo`,
  }));
}

const POLL_INTERVAL_MS = 3000;

type PaymentPhase = "idle" | "awaiting" | "failed";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState("RETAIL");
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("idle");
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const pollRef = useRef<{ pendingSignupId: string; completionToken: string } | null>(null);
  const stopPollingRef = useRef(false);

  const plans = getPlansForType(businessType);

  async function pollUntilResolved() {
    const target = pollRef.current;
    if (!target || stopPollingRef.current) return;

    try {
      const res = await fetch(`/api/auth/register/status/${target.pendingSignupId}`);
      const data = await res.json();

      if (res.ok && data.status === "COMPLETED") {
        const loginRes = await fetch("/api/auth/complete-login", {
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
    setStep(2);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

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
            We've sent an M-Pesa payment prompt to your device. Enter your M-Pesa PIN to
            complete your subscription — this page will update automatically once it's confirmed.
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
          <CardTitle className="text-2xl">Payment didn't complete</CardTitle>
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

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
            <Logo size={28} className="text-gold" />
          </div>
        </div>
        <CardTitle className="text-2xl">Create Your Account</CardTitle>
        <CardDescription>
          Get started with an M-Pesa payment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className={step === 1 ? "space-y-4" : "hidden"}>
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
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
                >
                  {plans.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <Button type="button" size="lg" className="w-full" onClick={() => setStep(2)}>
                Continue
              </Button>
          </div>

          <div className={step === 2 ? "space-y-4" : "hidden"}>
              <Input name="ownerName" label="Your Full Name" placeholder="John Doe" required />
              <Input name="email" label="Email Address" type="email" placeholder="john@business.co.ke" required />
              <Input name="phone" label="Phone Number" type="tel" placeholder="0712345678" required />
              <Input name="password" label="Password" type="password" placeholder="Min 8 characters" required minLength={8} />

              <div className="flex gap-3">
                <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>
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