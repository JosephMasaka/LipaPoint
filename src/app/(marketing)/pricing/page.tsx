import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Zap, Crown, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — Affordable POS Plans from KSh 2,999/month",
  description:
    "LipaPoint POS pricing: Starter from KSh 2,999/mo, Professional KSh 5,999/mo, Enterprise KSh 14,999/mo. 14-day free trial. No setup fees. Cancel anytime. Best value POS in Kenya.",
  alternates: { canonical: "https://lipapoint.co.ke/pricing" },
  openGraph: {
    title: "LipaPoint Pricing — POS Plans for Every Business Size",
    description: "From KSh 2,999/month. 14-day free trial, no setup fees. Starter, Professional & Enterprise plans for Kenyan businesses.",
    url: "https://lipapoint.co.ke/pricing",
  },
};

const plans = [
  {
    name: "Starter",
    price: "2,999",
    period: "/month",
    icon: Zap,
    description: "Perfect for small shops and new businesses",
    features: [
      "1 Location",
      "3 Staff accounts",
      "Basic POS register",
      "Inventory tracking",
      "Daily sales reports",
      "M-Pesa payments",
      "Email support",
      "14-day free trial",
    ],
    cta: "Start Free Trial",
    popular: false,
    paystackPlan: "PLN_starter_monthly",
  },
  {
    name: "Professional",
    price: "7,999",
    period: "/month",
    icon: Crown,
    description: "For growing businesses with multiple staff",
    features: [
      "Up to 5 Locations",
      "Unlimited staff accounts",
      "Advanced POS + Kitchen Display",
      "Full inventory management",
      "Advanced analytics & reports",
      "M-Pesa + Card payments",
      "Staff performance tracking",
      "Priority support",
      "Product images & categories",
      "Transaction history & audit",
    ],
    cta: "Start Free Trial",
    popular: true,
    paystackPlan: "PLN_pro_monthly",
  },
  {
    name: "Enterprise",
    price: "19,999",
    period: "/month",
    icon: Building2,
    description: "For large operations and chains",
    features: [
      "Unlimited locations",
      "Unlimited staff accounts",
      "All Professional features",
      "Custom integrations & API",
      "Dedicated account manager",
      "White-label option",
      "SLA guarantee",
      "On-site training",
      "Custom reporting",
      "Multi-currency support",
    ],
    cta: "Contact Sales",
    popular: false,
    paystackPlan: "PLN_enterprise_monthly",
  },
];

export default function PricingPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Choose the plan that fits your business. All plans include a 14-day
            free trial. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.popular
                  ? "border-gold/50 bg-gold/5 ring-1 ring-gold/20 scale-105"
                  : "border-border bg-surface-elevated"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gold text-black text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                  <plan.icon className="h-5 w-5 text-gold" />
                </div>
                <h3 className="text-xl font-bold text-text-primary">{plan.name}</h3>
              </div>

              <p className="text-sm text-text-secondary mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-text-primary">
                  KSh {plan.price}
                </span>
                <span className="text-text-muted">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link href={plan.name === "Enterprise" ? "/contact" : "/register"}>
                <Button
                  variant={plan.popular ? "default" : "secondary"}
                  className="w-full"
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-text-muted text-sm">
            All prices in Kenyan Shillings (KSh). Payment via M-Pesa or card through Paystack.
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
