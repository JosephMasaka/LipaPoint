import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const stats = {
    todaySales: 48500,
    totalOrders: 34,
    monthRevenue: 1245000,
    activeProducts: 128,
  };

  return (
    <div className="min-h-screen bg-surface">
      <Header
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle="Here's what's happening with your business today."
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                Today&apos;s Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-gold">
                {formatCurrency(stats.todaySales)}
              </p>
              <p className="mt-1 text-xs text-text-muted">+12% from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary">
                {stats.totalOrders}
              </p>
              <p className="mt-1 text-xs text-text-muted">+5 from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                Revenue This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-500">
                {formatCurrency(stats.monthRevenue)}
              </p>
              <p className="mt-1 text-xs text-text-muted">+8% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                Active Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary">
                {stats.activeProducts}
              </p>
              <p className="mt-1 text-xs text-text-muted">3 low stock alerts</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
