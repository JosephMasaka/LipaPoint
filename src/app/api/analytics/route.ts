import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.tenantId;
  const period = request.nextUrl.searchParams.get("period") || "today";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  let periodStart = todayStart;
  if (period === "week") periodStart = weekStart;
  if (period === "month") periodStart = monthStart;

  const [allOrders, yesterdayOrders, lastMonthOrders, periodItems] = await Promise.all([
    db.order.findMany({
      where: { tenantId, status: "COMPLETED" },
      select: { total: true, createdAt: true, paymentMethod: true, userId: true, user: { select: { name: true } } },
    }),
    db.order.findMany({
      where: { tenantId, status: "COMPLETED", createdAt: { gte: yesterdayStart, lt: todayStart } },
      select: { total: true },
    }),
    db.order.findMany({
      where: { tenantId, status: "COMPLETED", createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      select: { total: true },
    }),
    db.orderItem.findMany({
      where: { order: { tenantId, status: "COMPLETED", createdAt: { gte: periodStart } } },
      select: { quantity: true, total: true, unitPrice: true, product: { select: { name: true, cost: true, category: { select: { name: true } } } } },
    }),
  ]);

  // Revenue calculations
  const todayCompleted = allOrders.filter((o) => o.createdAt >= todayStart);
  const weekCompleted = allOrders.filter((o) => o.createdAt >= weekStart);
  const monthCompleted = allOrders.filter((o) => o.createdAt >= monthStart);

  const revenue = {
    today: todayCompleted.reduce((s, o) => s + o.total, 0),
    yesterday: yesterdayOrders.reduce((s, o) => s + o.total, 0),
    week: weekCompleted.reduce((s, o) => s + o.total, 0),
    month: monthCompleted.reduce((s, o) => s + o.total, 0),
    lastMonth: lastMonthOrders.reduce((s, o) => s + o.total, 0),
  };

  // Orders
  const periodOrders = allOrders.filter((o) => o.createdAt >= periodStart);
  const orders = {
    today: todayCompleted.length,
    week: weekCompleted.length,
    month: monthCompleted.length,
    avgOrderValue: periodOrders.length > 0
      ? periodOrders.reduce((s, o) => s + o.total, 0) / periodOrders.length
      : 0,
  };

  // Top products
  const prodMap = new Map<string, { quantity: number; revenue: number }>();
  for (const item of periodItems) {
    const key = item.product.name;
    const existing = prodMap.get(key) || { quantity: 0, revenue: 0 };
    existing.quantity += item.quantity;
    existing.revenue += item.total;
    prodMap.set(key, existing);
  }
  const topProducts = [...prodMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Categories
  const catMap = new Map<string, number>();
  let totalCatRevenue = 0;
  for (const item of periodItems) {
    const catName = item.product.category?.name || "Uncategorized";
    catMap.set(catName, (catMap.get(catName) || 0) + item.total);
    totalCatRevenue += item.total;
  }
  const topCategories = [...catMap.entries()]
    .map(([name, rev]) => ({ name, revenue: rev, percentage: totalCatRevenue > 0 ? (rev / totalCatRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Sales by hour (today)
  const salesByHour: { hour: string; sales: number }[] = [];
  for (let h = 6; h <= 23; h++) {
    const hourOrders = todayCompleted.filter((o) => o.createdAt.getHours() === h);
    salesByHour.push({ hour: `${h}:00`, sales: hourOrders.reduce((s, o) => s + o.total, 0) });
  }

  // Sales by day (last 7 days)
  const salesByDay: { day: string; sales: number }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
    salesByDay.push({
      day: dayNames[dayStart.getDay()],
      sales: dayOrders.reduce((s, o) => s + o.total, 0),
    });
  }

  // Payment methods
  const pmMap = new Map<string, { count: number; total: number }>();
  for (const o of periodOrders) {
    const existing = pmMap.get(o.paymentMethod) || { count: 0, total: 0 };
    existing.count++;
    existing.total += o.total;
    pmMap.set(o.paymentMethod, existing);
  }
  const paymentMethods = [...pmMap.entries()]
    .map(([method, d]) => ({ method, ...d }))
    .sort((a, b) => b.total - a.total);

  // Staff performance
  const staffMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of periodOrders) {
    const name = o.user.name;
    const existing = staffMap.get(name) || { orders: 0, revenue: 0 };
    existing.orders++;
    existing.revenue += o.total;
    staffMap.set(name, existing);
  }
  const staffPerformance = [...staffMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue);

  // Profit margin
  let totalRevenue = 0;
  let totalCost = 0;
  for (const item of periodItems) {
    totalRevenue += item.total;
    totalCost += item.product.cost * item.quantity;
  }
  const profitMargin = {
    revenue: totalRevenue,
    cost: totalCost,
    profit: totalRevenue - totalCost,
    margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
  };

  return NextResponse.json({
    revenue, orders, topProducts, topCategories,
    salesByHour, salesByDay, paymentMethods, staffPerformance, profitMargin,
  });
}
