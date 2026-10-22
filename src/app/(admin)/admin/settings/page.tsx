import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VERTICAL_PLANS, formatPrice, type BusinessCategory } from "@/lib/plans";
import { Cpu, CreditCard, Mail, ShieldCheck } from "lucide-react";

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  RETAIL_GENERAL: "Retail / General",
  RESTAURANT_HOSPITALITY: "Restaurant / Hospitality",
  BARBERSHOP_SALON: "Barbershop / Salon",
};

const TIERS = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <Badge
      className={
        configured
          ? "bg-green-500/10 text-green-500 border-green-500/20"
          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
      }
    >
      {configured ? "Configured" : "Not configured"}
    </Badge>
  );
}

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role as string) !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const tenantCount = await db.tenant.count({ where: { type: { not: "PLATFORM" } } });
  const resellerCount = await db.reseller.count({ where: { isActive: true } });
  const activeCouponCount = await db.coupon.count({ where: { isActive: true } });

  const integrations = [
    {
      icon: CreditCard,
      name: "PalPluss (M-PESA)",
      detail: "Signup & subscription STK payments",
      configured: !!process.env.PALPLUSS_SECRET_KEY,
    },
    {
      icon: CreditCard,
      name: "Paystack",
      detail: "Card / alternative checkout for upgrades",
      configured: !!process.env.PAYSTACK_SECRET_KEY,
    },
    {
      icon: Cpu,
      name: "AI providers",
      detail: "Gemini / Groq for the in-app assistant",
      configured: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY),
    },
    {
      icon: Mail,
      name: "Email",
      detail: "SMTP delivery for transactional email",
      configured: !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Platform Settings</h1>
        <p className="text-text-secondary text-sm mt-1">
          Read-only overview of platform configuration, integrations and plan pricing
        </p>
      </div>

      {/* Platform snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-text-primary">{tenantCount}</p>
            <p className="text-xs text-text-muted mt-1">Total Tenants</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-text-primary">{resellerCount}</p>
            <p className="text-xs text-text-muted mt-1">Active Resellers</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-text-primary">{activeCouponCount}</p>
            <p className="text-xs text-text-muted mt-1">Active Coupons</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold" />
              <p className="text-sm font-bold text-text-primary truncate">{user.name}</p>
            </div>
            <p className="text-xs text-text-muted mt-1 truncate">{user.email}</p>
          </CardContent>
        </Card>
      </div>

      {/* Integrations */}
      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon className="h-4 w-4 text-text-secondary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{item.name}</p>
                  <p className="text-xs text-text-muted truncate">{item.detail}</p>
                </div>
              </div>
              <StatusBadge configured={item.configured} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Plan pricing matrix */}
      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="text-base">Plan Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {(Object.keys(VERTICAL_PLANS) as BusinessCategory[]).map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-text-secondary mb-2">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-text-secondary font-medium">Tier</th>
                      <th className="text-left py-2 px-3 text-text-secondary font-medium">Monthly</th>
                      <th className="text-left py-2 px-3 text-text-secondary font-medium">Annual</th>
                      <th className="text-left py-2 px-3 text-text-secondary font-medium">Products</th>
                      <th className="text-left py-2 px-3 text-text-secondary font-medium">Locations</th>
                      <th className="text-left py-2 px-3 text-text-secondary font-medium">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((tier) => {
                      const plan = VERTICAL_PLANS[category][tier];
                      if (!plan) return null;
                      return (
                        <tr key={tier} className="border-b border-border/50">
                          <td className="py-2 px-3 text-text-primary font-medium">{tier}</td>
                          <td className="py-2 px-3 text-text-secondary">
                            {formatPrice(plan.pricing.monthly)}
                          </td>
                          <td className="py-2 px-3 text-text-secondary">
                            {formatPrice(plan.pricing.annual)}
                          </td>
                          <td className="py-2 px-3 text-text-muted">
                            {plan.limits.products === Infinity ? "∞" : plan.limits.products}
                          </td>
                          <td className="py-2 px-3 text-text-muted">
                            {plan.limits.locations === Infinity ? "∞" : plan.limits.locations}
                          </td>
                          <td className="py-2 px-3 text-text-muted">
                            {plan.limits.staff === Infinity ? "∞" : plan.limits.staff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-xs text-text-muted">
            Pricing lives in <code className="text-gold">src/lib/plans.ts</code> — changes there
            apply to registration, renewal and upgrade flows immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
