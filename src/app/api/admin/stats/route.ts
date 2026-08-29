import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role as string) !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalTenants,
    activeTenants,
    totalOrders,
    subscriptions,
    thisMonthTenants,
    lastMonthTenants,
  ] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { isActive: true } }),
    db.order.count({ where: { status: "COMPLETED" } }),
    db.subscription.findMany({ where: { status: "active" } }),
    db.tenant.count({ where: { createdAt: { gte: monthStart } } }),
    db.tenant.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
  ]);

  const totalRevenue = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  const growthRate = lastMonthTenants > 0
    ? Math.round(((thisMonthTenants - lastMonthTenants) / lastMonthTenants) * 100)
    : thisMonthTenants > 0 ? 100 : 0;

  return NextResponse.json({
    totalTenants,
    activeTenants,
    totalOrders,
    totalRevenue,
    activeSubscriptions: subscriptions.length,
    thisMonthTenants,
    growthRate,
  });
}
