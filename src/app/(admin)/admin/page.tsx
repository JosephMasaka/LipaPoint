import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user || (user.role as string) !== "SUPER_ADMIN") redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalTenants,
    activeTenants,
    totalOrders,
    subscriptions,
    recentSignups,
    thisMonthTenants,
    lastMonthTenants,
  ] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { isActive: true } }),
    db.order.count({ where: { status: "COMPLETED" } }),
    db.subscription.findMany({ where: { status: "active" } }),
    db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        tier: true,
        createdAt: true,
        isActive: true,
      },
    }),
    db.tenant.count({ where: { createdAt: { gte: monthStart } } }),
    db.tenant.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
  ]);

  const totalRevenue = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  const growthRate = lastMonthTenants > 0
    ? Math.round(((thisMonthTenants - lastMonthTenants) / lastMonthTenants) * 100)
    : thisMonthTenants > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Platform Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Overview of the entire LipaPoint platform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{totalTenants}</p>
            <p className="text-xs text-text-muted mt-1">+{thisMonthTenants} this month</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{activeTenants}</p>
            <p className="text-xs text-text-muted mt-1">
              {totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0}% active rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Revenue (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-text-muted mt-1">{subscriptions.length} active subscriptions</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{totalOrders.toLocaleString()}</p>
            <p className="text-xs text-text-muted mt-1">
              {growthRate >= 0 ? "+" : ""}{growthRate}% growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Signups */}
      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Recent Signups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text-secondary font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-text-secondary font-medium">Slug</th>
                  <th className="text-left py-2 px-3 text-text-secondary font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-text-secondary font-medium">Tier</th>
                  <th className="text-left py-2 px-3 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-text-secondary font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 px-3 text-text-primary font-medium">{tenant.name}</td>
                    <td className="py-2 px-3 text-text-muted">{tenant.slug}</td>
                    <td className="py-2 px-3 text-text-secondary capitalize">{tenant.type.toLowerCase()}</td>
                    <td className="py-2 px-3">
                      <Badge variant="secondary" className="text-xs">{tenant.tier}</Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Badge className={tenant.isActive ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
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
        </CardContent>
      </Card>
    </div>
  );
}
