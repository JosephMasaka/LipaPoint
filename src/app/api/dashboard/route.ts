import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { supplierCostPerUnit } from "@/lib/price-override";

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

  // Top products today + today's on-the-go pricing impact, off the same
  // item set (the Items Sold Out of Set Price report has the full history).
  const todayItems = await db.orderItem.findMany({
    where: { order: { tenantId, createdAt: { gte: todayStart }, status: { not: "CANCELLED" } } },
    select: {
      quantity: true,
      total: true,
      unitPrice: true,
      product: { select: { name: true, price: true, cost: true, trackStock: true } },
      productUom: { select: { price: true, cost: true, conversionFactor: true } },
    },
  });

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  let todayDiscountGiven = 0;
  let todayBelowCostLines = 0;
  let todayBelowCostValue = 0;

  const productMap = new Map<string, { count: number; revenue: number }>();
  for (const item of todayItems) {
    if (item.product) {
      const existing = productMap.get(item.product.name) || { count: 0, revenue: 0 };
      existing.count += item.quantity;
      existing.revenue += item.total;
      productMap.set(item.product.name, existing);

      // Lines sold below the set price — what the bargain pricing gave away.
      const setPrice = item.productUom?.price ?? item.product.price;
      if (item.unitPrice < setPrice) {
        todayDiscountGiven += (setPrice - item.unitPrice) * item.quantity;
      }
      // …and lines that went out under the supplier price (stock items only).
      const supplierPrice = supplierCostPerUnit(
        item.product.cost,
        item.productUom?.conversionFactor ?? 1,
        item.productUom?.cost ?? null
      );
      if (item.product.trackStock && supplierPrice > 0 && item.unitPrice < supplierPrice) {
        todayBelowCostLines += 1;
        todayBelowCostValue += (supplierPrice - item.unitPrice) * item.quantity;
      }
    }
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
    // On-the-go pricing impact so far today
    todayDiscountGiven: round2(todayDiscountGiven),
    todayBelowCostLines,
    todayBelowCostValue: round2(todayBelowCostValue),
  });
}
