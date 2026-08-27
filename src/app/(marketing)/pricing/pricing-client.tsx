"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Zap, Crown, Building2, Printer, ScanBarcode, Tablet } from "lucide-react";
import {
  type BusinessCategory,
  VERTICAL_PLANS,
  HARDWARE_ADDONS,
  CATEGORY_DISPLAY,
  FEATURE_DISPLAY,
  formatPrice,
} from "@/lib/plans";

const CATEGORIES: BusinessCategory[] = ["RETAIL_GENERAL", "RESTAURANT_HOSPITALITY", "BARBERSHOP_SALON"];

const TIER_META: Record<string, { icon: typeof Zap; description: string }> = {
  STARTER: { icon: Zap, description: "Everything you need to launch your business" },
  PROFESSIONAL: { icon: Crown, description: "Scale with powerful tools and insights" },
  ENTERPRISE: { icon: Building2, description: "For chains and high-volume operations" },
};

const HARDWARE_ICONS: Record<string, typeof Printer> = {
  "thermal-printer": Printer,
  "barcode-scanner": ScanBarcode,
  "tablet-terminal": Tablet,
};

export function PricingClient() {
  const [category, setCategory] = useState<BusinessCategory>("RETAIL_GENERAL");
  const [annual, setAnnual] = useState(false);

  const plans = VERTICAL_PLANS[category];
  const tiers = Object.entries(plans);

  return (
    <div className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            No setup fees. No hidden charges. Cancel anytime.
            Every plan includes a 14-day free trial.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">14-day free trial on all plans</span>
          </div>
        </div>

        {/* Business Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                category === cat
                  ? "bg-gold text-black"
                  : "bg-surface-elevated border border-border text-text-secondary hover:text-text-primary hover:border-gold/30"
              }`}
            >
              {CATEGORY_DISPLAY[cat].label}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-text-muted mb-8">
          {CATEGORY_DISPLAY[category].description}
        </p>

        {/* Monthly / Annual Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${!annual ? "text-text-primary" : "text-text-muted"}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              annual ? "bg-gold" : "bg-surface-elevated border border-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                annual ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-text-primary" : "text-text-muted"}`}>
            Annual
          </span>
          {annual && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              Save ~17%
            </span>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map(([tier, config]) => {
            const meta = TIER_META[tier];
            const isPopular = tier === "PROFESSIONAL";
            const price = annual ? config.pricing.annual : config.pricing.monthly;
            const period = annual ? "/year" : "/month";

            return (
              <div
                key={tier}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  isPopular
                    ? "border-gold/50 bg-gold/5 ring-1 ring-gold/20 md:scale-105"
                    : "border-border bg-surface-elevated"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gold text-black text-xs font-bold px-3 py-1 rounded-full">
                      Best Value
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                    <meta.icon className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary capitalize">
                    {tier.toLowerCase()}
                  </h3>
                </div>

                <p className="text-sm text-text-secondary mb-6">{meta.description}</p>

                <div className="mb-2">
                  <span className="text-4xl font-bold text-text-primary">
                    {formatPrice(price)}
                  </span>
                  <span className="text-text-muted">{period}</span>
                </div>
                {!annual && (
                  <p className="text-xs text-gold mb-4">
                    Save {formatPrice(config.pricing.monthly * 12 - config.pricing.annual)}/yr with annual
                  </p>
                )}
                {annual && <div className="mb-4" />}

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    {config.limits.locations === Infinity ? "Unlimited locations" : `${config.limits.locations} Location${config.limits.locations > 1 ? "s" : ""}`}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    {config.limits.staff === Infinity ? "Unlimited staff" : `${config.limits.staff} Staff accounts`}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    {config.limits.products === Infinity ? "Unlimited products" : `Up to ${config.limits.products} products`}
                  </li>
                  {config.limits.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      {FEATURE_DISPLAY[feature] || feature}
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <Button
                    variant={isPopular ? "default" : "secondary"}
                    className="w-full"
                    size="lg"
                  >
                    Start 14-Day Free Trial
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Hardware Add-ons */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-text-primary mb-3">
              Complete Your Setup
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              Add hardware to your package. One-time purchase, delivered to your door.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HARDWARE_ADDONS.map((item) => {
              const Icon = HARDWARE_ICONS[item.id] || Printer;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-surface-elevated p-6 flex flex-col items-center text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 mb-4">
                    <Icon className="h-7 w-7 text-gold" />
                  </div>
                  <h3 className="font-bold text-text-primary mb-1">{item.name}</h3>
                  <p className="text-xs text-text-muted mb-3">{item.description}</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatPrice(item.price)}
                  </p>
                  <p className="text-xs text-text-muted mt-1">One-time purchase</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="rounded-xl border border-border bg-surface-elevated p-6">
            <p className="text-2xl font-bold text-text-primary">0</p>
            <p className="text-sm text-text-muted mt-1">Setup fees</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-6">
            <p className="text-2xl font-bold text-text-primary">5 min</p>
            <p className="text-sm text-text-muted mt-1">To get started</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-6">
            <p className="text-2xl font-bold text-text-primary">Cancel anytime</p>
            <p className="text-sm text-text-muted mt-1">No lock-in contracts</p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-text-muted text-sm">
            All prices in Kenyan Shillings (KSh). Pay via M-Pesa or card. Annual plans save up to 17%.
            <br />
            Need a custom plan?{" "}
            <Link href="/contact" className="text-gold hover:underline">
              Contact our sales team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
