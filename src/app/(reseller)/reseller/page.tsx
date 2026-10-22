import { redirect } from "next/navigation";
import { getCurrentReseller } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ReferralCodeCard } from "./referral-code-card";

/** Subscription-related transaction types a reseller earns commission on. */
const BILLING_TYPES = [
  { type: "SUBSCRIPTION" },
  { type: "SUBSCRIPTION_PAYMENT" },
  { type: { startsWith: "UPGRADE:" } },
];

export default async function ResellerDashboardPage() {
  const reseller = await getCurrentReseller();
  if (!reseller) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const tenants = await db.tenant.findMany({
    where: { resellerId: reseller.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      tier: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  const tenantIds = tenants.map((t) => t.id);
  const payments = tenantIds.length
    ? await db.transaction.findMany({
        where: {
          tenantId: { in: tenantIds },
          status: "COMPLETED",
          OR: BILLING_TYPES,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
          tenant: { select: { id: true, name: true } },
        },
      })
    : [];

  const commissionRate = reseller.commissionPercent / 100;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalCommission = Math.round(totalRevenue * commissionRate * 100) / 100;
  const activeTenants = tenants.filter((t) => t.isActive).length;
  const newThisMonth = tenants.filter((t) => t.createdAt >= monthStart).length;
  const thisMonthPayments = payments.filter((p) => p.createdAt >= monthStart);
  const thisMonthCommission =
    Math.round(thisMonthPayments.reduce((s, p) => s + p.amount, 0) * commissionRate * 100) / 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Welcome, {reseller.name}</h1>
        <p className="text-text-secondary text-sm mt-1">
          Your referral code, referred businesses and commission earnings
        </p>
      </div>

      <ReferralCodeCard code={reseller.code} commissionPercent={reseller.commissionPercent} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Referred Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{tenants.length}</p>
            <p className="text-xs text-text-muted mt-1">+{newThisMonth} this month</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{activeTenants}</p>
            <p className="text-xs text-text-muted mt-1">
              {tenants.length > 0 ? Math.round((activeTenants / tenants.length) * 100) : 0}% active rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Revenue Brought</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-text-muted mt-1">All-time subscription payments</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Commission Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gold">{formatCurrency(totalCommission)}</p>
            <p className="text-xs text-text-muted mt-1">
              +{formatCurrency(thisMonthCommission)} this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent tenants */}
      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Recent Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-sm text-text-muted">
              No signups yet — share your code so businesses enter it during registration.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Business</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Tier</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.slice(0, 10).map((tenant) => (
                    <tr key={tenant.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-2 px-3 text-text-primary font-medium">{tenant.name}</td>
                      <td className="py-2 px-3 text-text-secondary capitalize">
                        {tenant.type.toLowerCase()}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary" className="text-xs">{tenant.tier}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge
                          className={
                            tenant.isActive
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          }
                        >
                          {tenant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission history */}
      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-text-muted">No subscription payments from your referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Business</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Payment</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Your {reseller.commissionPercent}%</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 20).map((payment) => (
                    <tr key={payment.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-2 px-3 text-text-muted">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-text-primary">{payment.tenant?.name ?? "—"}</td>
                      <td className="py-2 px-3 text-text-secondary">
                        {payment.type.startsWith("UPGRADE:")
                          ? `Upgrade · ${payment.type.slice(8)}`
                          : "Subscription"}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="py-2 px-3 text-gold font-medium">
                        {formatCurrency(Math.round(payment.amount * commissionRate * 100) / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
