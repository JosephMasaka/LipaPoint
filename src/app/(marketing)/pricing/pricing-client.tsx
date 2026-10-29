"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Zap, Crown, Building2, Printer, ScanBarcode, Tablet } from "lucide-react";
import {
  type BusinessCategory,
  VERTICAL_PLANS,
  HARDWARE_ADDONS,
  CATEGORY_DISPLAY,
  formatFeaturePrice,
  formatPrice,
  groupPlanFeatures,
  FULL_ERP_FEATURES,
  FULL_ERP_PRICE,
  FULL_ERP_ANNUAL_PRICE,
  FULL_ERP_SIGNUP_HREF,
} from "@/lib/plans";
import { FEATURE_KEYS, FEATURE_REGISTRY, MODULE_REGISTRY } from "@/lib/module-registry";
import type { FeatureKey, ModuleKey } from "@/lib/module-registry";
import { APPS } from "@/lib/apps";

const CATEGORIES: BusinessCategory[] = [
  "RETAIL_GENERAL",
  "RESTAURANT_HOSPITALITY",
  "BARBERSHOP_SALON",
  "ASSET_MANAGEMENT",
  "FINANCE",
  "HUMAN_RESOURCE",
  "PROCUREMENT_WHOLESALE",
  "HEALTHCARE_PHARMACY",
  "EDUCATION_TRAINING",
  "LOGISTICS_WAREHOUSING",
  "PROFESSIONAL_SERVICES",
];

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

  // Deep links: /pricing?category=FINANCE opens straight on that vertical's
  // tab so one category's pricing can be shared as a URL. Validated against
  // the tab list so a stale or guessed value falls back to the default
  // instead of rendering an empty card grid. Read in an effect (not the
  // initial state) so server render and hydration stay in step.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("category");
    if (raw && (CATEGORIES as readonly string[]).includes(raw)) {
      setCategory(raw as BusinessCategory);
    }
  }, []);

  // Keep the URL in step with the chosen tab (replaceState: no history entry
  // per tab click, no Next router re-render). The default tab needs no param.
  const selectCategory = (cat: BusinessCategory) => {
    setCategory(cat);
    const url = new URL(window.location.href);
    if (cat === "RETAIL_GENERAL") url.searchParams.delete("category");
    else url.searchParams.set("category", cat);
    window.history.replaceState(null, "", url.toString());
  };

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
            No setup fees. No hidden charges. Cancel anytime. Start with one app —
            or just one feature inside it.
          </p>
          {/*<div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Have a coupon code? Apply it at sign-up.</span>
          </div>*/}
        </div>

        {/* Business Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => selectCategory(cat)}
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
                  {/* Grouped, not one-bullet-per-feature: entitlement is
                      unchanged (still limits.features), only the display is
                      bucketed so Enterprise isn't a 21-line wall. */}
                  {groupPlanFeatures(config.limits.features).map((group) => (
                    <li key={group.id} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium text-text-primary">{group.label}</span>
                        {group.items.length > 0 && (
                          <span> — {group.items.join(", ")}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <Button
                    variant={isPopular ? "default" : "secondary"}
                    className="w-full"
                    size="lg"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Unified Full ERP — one industry-agnostic plan above the per-vertical
            tiers. Sells the existing ENTERPRISE entitlements at a single price
            for every industry (see FULL_ERP_* in lib/plans). */}
        <div className="mt-6 rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/10 to-surface-elevated p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15">
                  <Crown className="h-5 w-5 text-gold" />
                </div>
                <h3 className="text-xl font-bold text-text-primary">Full ERP</h3>
                <span className="bg-gold text-black text-xs font-bold px-3 py-1 rounded-full">
                  All industries · Everything included
                </span>
              </div>
              <p className="text-sm text-text-secondary max-w-lg">
                One plan that ignores industry boundaries — every app, every
                feature, unlimited locations, staff and products. Buy the whole
                ERP at one price instead of piecing tiers together.
              </p>
            </div>
            <div className="md:text-right shrink-0">
              <div className="mb-2">
                <span className="text-4xl font-bold text-text-primary">
                  {formatPrice(annual ? FULL_ERP_ANNUAL_PRICE : FULL_ERP_PRICE)}
                </span>
                <span className="text-text-muted">{annual ? "/year" : "/month"}</span>
              </div>
              {!annual ? (
                <p className="text-xs text-gold mb-4">
                  Save {formatPrice(FULL_ERP_PRICE * 12 - FULL_ERP_ANNUAL_PRICE)}/yr with annual
                </p>
              ) : (
                <div className="mb-4" />
              )}
              <p className="text-xs text-text-muted mb-4">
                One flat price — every industry
              </p>
              <Link href={FULL_ERP_SIGNUP_HREF}>
                <Button variant="default" size="lg">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              Unlimited locations, staff & products
            </li>
            {groupPlanFeatures(FULL_ERP_FEATURES).map((group) => (
              <li key={group.id} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-text-primary">{group.label}</span>
                  {group.items.length > 0 && <span> — {group.items.join(", ")}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-text-muted">
            Same price for retail, restaurants and barbershops alike — no
            per-industry pricing to compare.
          </p>
        </div>

        {/* À la carte features (sub-feature spec §6/§11): the next level down
            from the tier cards — every billable sub-feature is independently
            purchasable, and core features are the free floor. */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-text-primary mb-3">
              Need just one part of an app?
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Every feature below can be switched on individually from the Apps
              screen — buy Payroll without the rest of HR, or Kitchen Display
              without a full restaurant bundle.
            </p>
          </div>

          {/* Every non-core feature is independently switchable from the
              Apps screen (sub-feature spec §6) — grouped by app, then by
              module, mirroring how the tier cards group their bullets, with
              each feature's revised à la carte price alongside it. */}
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
                  <h3 className="font-bold text-text-primary mb-1">
                    {app.label}
                  </h3>
                  <p className="text-xs text-text-muted mb-4">{app.tagline}</p>
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
                                {formatFeaturePrice(key)}
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

          <p className="mt-6 text-center text-xs text-text-muted">
            Core features — Till, Stock Tracking, Employee Records, General Ledger,
            Suppliers, Asset Register and Customer Records — are always included
            with their app at no extra charge.
          </p>
        </div>

        {/* FAQ — answers the two questions this granularity exists to settle
            (skill §7 / sub-feature spec §11). */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-8">
            Questions about buying less than everything
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-text-primary mb-2">
                Can I buy just one app?
              </h3>
              <p className="text-sm text-text-secondary">
                Yes. Every app stands alone — a shop can run Point of Sale and
                Inventory with no accounting, and a services business can run
                Finance and Payroll with no POS at all.
              </p>
            </div>
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6">
              <h3 className="font-semibold text-text-primary mb-2">
                Can I buy just part of an app?
              </h3>
              <p className="text-sm text-text-secondary">
                Yes — features are switched on individually from your Apps screen.
                Take Payroll and Employee Records and leave Attendance, Leave and
                Recruitment off; each add-on price is listed above.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-text-primary mb-2">
                What is always included?
              </h3>
              <p className="text-sm text-text-secondary">
                The core of every app is free with the app itself: the Till, Stock
                Tracking, Employee Records, General Ledger, Suppliers, Asset
                Register and Customer Records.
              </p>
            </div>
          </div>
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
