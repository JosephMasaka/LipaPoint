import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.tenantId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayOrders, monthOrders, openTabs, products, lowStock, staff] = await Promise.all([
    db.order.findMany({
      where: { tenantId, createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
      select: { id: true, orderNo: true, total: true, status: true, tabName: true, customerName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.order.findMany({
      where: { tenantId, createdAt: { gte: monthStart }, status: "COMPLETED" },
      select: { total: true },
    }),
    db.order.count({ where: { tenantId, status: "TAB" } }),
    db.product.count({ where: { tenantId, isActive: true } }),
    db.stock.findMany({
      where: { product: { tenantId, isActive: true } },
      include: { product: { select: { id: true, name: true, lowStockAlert: true } } },
    }),
    db.user.count({ where: { tenantId, isActive: true } }),
  ]);

  const todaySales = todayOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + o.total, 0);

  const monthRevenue = monthOrders.reduce((s, o) => s + o.total, 0);

  const lowStockProducts = lowStock
    .filter((s) => s.quantity <= s.product.lowStockAlert)
    .map((s) => ({ id: s.product.id, name: s.product.name, stock: s.quantity, lowStockAlert: s.product.lowStockAlert }));

  // Top products today
  const todayItems = await db.orderItem.findMany({
    where: { order: { tenantId, createdAt: { gte: todayStart }, status: { not: "CANCELLED" } } },
    select: { quantity: true, total: true, product: { select: { name: true } } },
  });

  const productMap = new Map<string, { count: number; revenue: number }>();
  for (const item of todayItems) {
    const existing = productMap.get(item.product.name) || { count: 0, revenue: 0 };
    existing.count += item.quantity;
    existing.revenue += item.total;
    productMap.set(item.product.name, existing);
  }
  const topProducts = [...productMap.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return NextResponse.json({
    todaySales,
    todayOrders: todayOrders.filter((o) => o.status !== "TAB").length,
    openTabs,
    monthRevenue,
    activeProducts: products,
    lowStockCount: lowStockProducts.length,
    activeStaff: staff,
    recentOrders: todayOrders.slice(0, 10),
    lowStockProducts,
    topProducts,
  });
}
