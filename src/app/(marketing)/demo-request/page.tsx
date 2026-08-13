"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Monitor, CheckCircle } from "lucide-react";

const businessTypes = [
  "RETAIL",
  "RESTAURANT",
  "BAR",
  "SUPERMARKET",
  "PHARMACY",
  "HARDWARE",
];

export default function DemoRequestPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.get("businessName"),
          contactName: form.get("contactName"),
          email: form.get("email"),
          phone: form.get("phone"),
          businessType: form.get("businessType"),
          message: form.get("message"),
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 mx-auto mb-6">
            <Monitor className="h-7 w-7 text-gold" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-4">Request a Demo</h1>
          <p className="text-zinc-400 max-w-md mx-auto">
            See LipaPoint in action with a personalized demo tailored to your business type.
            Our team will walk you through every feature.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tell us about your business</CardTitle>
            <CardDescription>
              We will schedule a 30-minute demo within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                  Demo Request Received!
                </h3>
                <p className="text-zinc-400">
                  Our team will reach out within 24 hours to schedule your personalized demo.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input name="businessName" label="Business Name" placeholder="Mama Njeri's Restaurant" required />
                  <Input name="contactName" label="Contact Person" placeholder="Jane Njeri" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input name="email" label="Email" type="email" placeholder="jane@business.co.ke" required />
                  <Input name="phone" label="Phone Number" type="tel" placeholder="+254 7XX XXX XXX" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Business Type</label>
                  <select
                    name="businessType"
                    required
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
                  >
                    <option value="">Select type...</option>
                    {businessTypes.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">
                    Anything specific you&apos;d like to see? (Optional)
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    placeholder="E.g., I want to see how inventory tracking works for my supermarket..."
                    className="flex w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all resize-none"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Submitting..." : "Request Demo"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
