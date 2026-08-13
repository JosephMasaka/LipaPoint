"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus } from "lucide-react";

const businessTypes = [
  { value: "RETAIL", label: "Retail Shop" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "BAR", label: "Bar / Lounge" },
  { value: "SUPERMARKET", label: "Supermarket" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "HARDWARE", label: "Hardware Store" },
];

const plans = [
  { value: "STARTER", label: "Starter - KSh 2,999/mo", price: "2999" },
  { value: "PROFESSIONAL", label: "Professional - KSh 7,999/mo", price: "7999" },
  { value: "ENTERPRISE", label: "Enterprise - KSh 19,999/mo", price: "19999" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

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

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        router.push(`/${data.tenant.slug}/dashboard`);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Your Account</CardTitle>
        <CardDescription>
          Start your 14-day free trial. No credit card required.
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
              <Input name="businessName" label="Business Name" placeholder="Kamau Enterprises" required />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Business Type</label>
                <select
                  name="businessType"
                  required
                  className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
                >
                  <option value="">Select your business type...</option>
                  {businessTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Choose a Plan</label>
                <select
                  name="plan"
                  required
                  className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
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
              <Input name="ownerName" label="Your Full Name" placeholder="John Kamau" required />
              <Input name="email" label="Email Address" type="email" placeholder="john@business.co.ke" required />
              <Input name="phone" label="Phone Number" type="tel" placeholder="+254 7XX XXX XXX" required />
              <Input name="password" label="Password" type="password" placeholder="Min 8 characters" required minLength={8} />

              <div className="flex gap-3">
                <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" size="lg" className="flex-1" disabled={loading}>
                  <UserPlus className="h-4 w-4" />
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </div>
          </div>
        </form>

        <p className="text-sm text-zinc-500 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
