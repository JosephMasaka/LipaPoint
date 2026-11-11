import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPS } from "@/lib/apps";
import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  MODULE_REGISTRY,
} from "@/lib/module-registry";
import type { FeatureKey, ModuleKey } from "@/lib/module-registry";
import { formatFeaturePrice } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Individual Feature Pricing — Buy One Feature at a Time | LipaPoint",
  description:
    "Every LipaPoint add-on feature priced on its own: barcode scanning, purchase orders, payroll runs and more from KSh 300/mo, on top of any plan. Core features and Offline Mode are free on every plan.",
  alternates: { canonical: "https://lipapoint.co.ke/pricing/features" },
  openGraph: {
    title: "LipaPoint Individual Feature Pricing",
    description:
      "Add exactly the features you need — every add-on priced individually, billed monthly on top of any plan.",
    url: "https://lipapoint.co.ke/pricing/features",
  },
};

const CORE_NOTE =
  "Core features — Till, Stock Tracking, Employee Records, General Ledger, Suppliers, Asset Register and Customer Records — are always included with their app at no extra charge. Offline Mode is free for every business on every plan.";

export default function FeaturePricingPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/pricing"
            className="inline-block text-sm text-gold hover:underline mb-4"
          >
            ← Back to plans &amp; module bundles
          </Link>
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Individual Feature Pricing
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Add exactly the capability you need, one feature at a time. Every
            price below is monthly, in Kenyan Shillings, and sits on top of any
            plan — nothing else changes.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="rounded-xl border border-border bg-surface-elevated p-5 text-center">
            <p className="text-sm font-semibold text-text-primary mb-1">
              Pick a feature, not a bundle
            </p>
            <p className="text-xs text-text-muted">
              Tick what you need at sign-up — it shows in your total before you
              pay.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-5 text-center">
            <p className="text-sm font-semibold text-text-primary mb-1">
              Billed monthly on top of your plan
            </p>
            <p className="text-xs text-text-muted">
              Add more later from your Apps screen; nothing else on your
              invoice moves.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-5 text-center">
            <p className="text-sm font-semibold text-text-primary mb-1">
              The core is always free
            </p>
            <p className="text-xs text-text-muted">
              Each app&apos;s essentials ship with the app — you only pay for
              the add-ons.
            </p>
          </div>
        </div>

        {/* Feature cards — one per app, grouped by module */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {APPS.map((app) => {
            const rows = FEATURE_KEYS.filter((key) => {
              const def = FEATURE_REGISTRY[key as FeatureKey];
              return def.appKey === app.id && !def.core;
            });
            if (rows.length === 0) return null;

            const byModule = new Map<ModuleKey, FeatureKey[]>();
            for (const key of rows) {
              const def = FEATURE_REGISTRY[key as FeatureKey];
              const bucket = byModule.get(def.moduleKey) ?? [];
              bucket.push(key as FeatureKey);
              byModule.set(def.moduleKey, bucket);
            }

            return (
              <div
                key={app.id}
                className="rounded-2xl border border-border bg-surface-elevated p-6"
              >
                <h2 className="font-bold text-text-primary mb-1">
                  {app.label}
                </h2>
                <p className="text-xs text-text-muted mb-1">{app.tagline}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gold/80 mb-4">
                  Add-on features · billed monthly on top of any plan
                </p>

                <div className="space-y-4">
                  {[...byModule.entries()].map(([moduleKey, featureKeys]) => (
                    <div key={moduleKey}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                        {MODULE_REGISTRY[moduleKey].label}
                      </p>
                      <ul className="space-y-2.5">
                        {featureKeys.map((key) => (
                          <li
                            key={key}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-text-secondary">
                              {FEATURE_REGISTRY[key].label}
                            </span>
                            <span className="shrink-0 font-medium text-text-primary text-right">
                              {formatFeaturePrice(key) ?? "Contact sales"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">{CORE_NOTE}</p>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-8">
            How buying individual features works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-text-primary mb-2">
                How do I add one?
              </h3>
              <p className="text-sm text-text-secondary">
                Tick it while signing up and the running total updates before
                you pay. Once you are in, you can switch more on any time from
                the Apps screen.
              </p>
            </div>
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6">
              <h3 className="font-semibold text-text-primary mb-2">
                What if I want most of an app?
              </h3>
              <p className="text-sm text-text-secondary">
                Take the whole module instead — one bundle price, cheaper than
                adding its features one by one.{" "}
                <Link
                  href="/pricing"
                  className="text-gold hover:underline font-medium"
                >
                  See plans &amp; module bundles →
                </Link>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-text-primary mb-2">
                What is always included?
              </h3>
              <p className="text-sm text-text-secondary">
                The core of every app is free with the app itself: the Till,
                Stock Tracking, Employee Records, General Ledger, Suppliers,
                Asset Register and Customer Records — plus Offline Mode, which
                costs nothing on any plan.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/10 to-surface-elevated p-8 text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-3">
            Start with a plan, add features as you go
          </h2>
          <p className="text-sm text-text-secondary max-w-xl mx-auto mb-6">
            Every plan includes the core of every app it touches — features
            above are the extras. No setup fees, cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pricing">
              <Button size="lg">Choose your plan</Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" size="lg">
                Start free
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                Contact sales
              </Button>
            </Link>
          </div>
        </div>

        {/* Fine print */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            All prices in Kenyan Shillings (KSh)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Pay via M-Pesa or card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Need a custom mix?{" "}
            <Link href="/contact" className="text-gold hover:underline">
              Contact sales
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
