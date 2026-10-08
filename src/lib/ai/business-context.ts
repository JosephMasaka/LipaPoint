import { db } from "@/lib/db";

/**
 * Builds a compact summary of this tenant's actual recent sales and stock
 * data, to be injected into the AI's system prompt. This is NOT fine-tuning
 * or training a model — it's grounding each individual request in real
 * numbers so the assistant can say "restock Coca-Cola 500ml, you've sold 40
 * this month and have 3 left" instead of generic inventory advice.
 *
 * Kept deliberately compact (top 5 products, top 10 low-stock items) to
 * control token cost — this runs on every single chat message.
 */
export async function buildBusinessContext(tenantId: string): Promise<string> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [topItems, orderStats, stocks] = await Promise.all([
    db.orderItem.groupBy({
      by: ["productId"],
      where: { order: { tenantId, createdAt: { gte: since }, status: "COMPLETED" } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.order.aggregate({
      where: { tenantId, createdAt: { gte: since }, status: "COMPLETED" },
      _sum: { total: true },
      _count: true,
    }),
    db.stock.findMany({
      where: { product: { tenantId, trackStock: true } },
      include: { product: { select: { name: true, lowStockAlert: true, price: true } } },
    }),
  ]);

  const productIds = topItems.map((i) => i.productId);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const topLines =
    topItems
      .map((i) => {
        const p = productMap.get(i.productId);
        if (!p) return null;
        const qty = i._sum.quantity ?? 0;
        const revenue = Math.round(i._sum.total ?? 0);
        return `- ${p.name} (KSh ${p.price.toLocaleString()}/unit): ${qty} units sold, KSh ${revenue.toLocaleString()} revenue`;
      })
      .filter(Boolean)
      .join("\n") || "No sales recorded in the last 30 days.";

  const lowStockLines =
    stocks
      .filter((s) => s.quantity < s.product.lowStockAlert)
      .slice(0, 10)
      .map((s) => `- ${s.product.name}: ${s.quantity} units left (alert threshold ${s.product.lowStockAlert})`)
      .join("\n") || "No products currently below their low-stock threshold.";

  const totalRevenue = Math.round(orderStats._sum.total ?? 0);
  const orderCount = orderStats._count ?? 0;

  return `
Here is this business's actual data from the last 30 days — use it to give specific, concrete advice (cite real product names and numbers) rather than generic suggestions, whenever the question relates to sales, stock, restocking, or pricing:

Sales summary: ${orderCount} completed orders, KSh ${totalRevenue.toLocaleString()} total revenue.

Top-selling products:
${topLines}

Low-stock products (restock candidates):
${lowStockLines}
`.trim();
}
