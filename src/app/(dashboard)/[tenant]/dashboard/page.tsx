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

  // Dummy data (replace with real prisma queries when DB is connected)
  const stats = {
    todaySales: 48500,
    totalOrders: 34,
    monthRevenue: 1245000,
    activeProducts: 128,
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle="Here's what's happening with your business today."
      />

      <div className="p-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-400">
                Today&apos;s Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gold">
                {formatCurrency(stats.todaySales)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">+12% from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-100">
                {stats.totalOrders}
              </p>
              <p className="mt-1 text-xs text-zinc-500">+5 from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-400">
                Revenue This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">
                {formatCurrency(stats.monthRevenue)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">+8% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-400">
                Active Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-100">
                {stats.activeProducts}
              </p>
              <p className="mt-1 text-xs text-zinc-500">3 low stock alerts</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
