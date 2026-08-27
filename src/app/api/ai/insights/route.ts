import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { db } from "@/lib/db";

// Simple in-memory cache for insights per tenant
const insightsCache = new Map<string, { insights: string[]; generatedAt: string; expiresAt: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type)) {
      return NextResponse.json(
        { error: "AI Insights is available on Professional and Enterprise plans. Upgrade to access." },
        { status: 403 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 500 }
      );
    }

    const tenantId = user.tenantId;

    // Check cache
    const cached = insightsCache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(
        { insights: cached.insights, generatedAt: cached.generatedAt },
        {
          headers: {
            "Cache-Control": "private, max-age=3600",
          },
        }
      );
    }

    // Gather business data
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [recentOrders, topProducts, lowStockItems, totalProducts] = await Promise.all([
      db.order.findMany({
        where: { tenantId, status: "COMPLETED", createdAt: { gte: weekStart } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.orderItem.findMany({
        where: { order: { tenantId, status: "COMPLETED", createdAt: { gte: monthStart } } },
        select: { quantity: true, total: true, product: { select: { name: true } } },
      }),
      db.stock.findMany({
        where: { product: { tenantId, isActive: true } },
        include: { product: { select: { name: true, lowStockAlert: true } } },
      }),
      db.product.count({ where: { tenantId, isActive: true } }),
    ]);

    // Calculate metrics
    const weekRevenue = recentOrders.reduce((s, o) => s + o.total, 0);
    const orderCount = recentOrders.length;
    const avgOrderValue = orderCount > 0 ? Math.round(weekRevenue / orderCount) : 0;

    // Top products by revenue
    const productMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of topProducts) {
      const existing = productMap.get(item.product.name) || { qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += item.total;
      productMap.set(item.product.name, existing);
    }
    const topProductsList = [...productMap.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, data]) => `${name} (${data.qty} sold, KES ${Math.round(data.revenue)})`);

    // Low stock items
    const lowStock = lowStockItems
      .filter((s) => s.quantity <= s.product.lowStockAlert)
      .map((s) => s.product.name)
      .slice(0, 5);

    const businessData = `
Business: ${user.tenant.name} (${user.tenant.type})
Week revenue: KES ${Math.round(weekRevenue)}
Orders this week: ${orderCount}
Average order value: KES ${avgOrderValue}
Total active products: ${totalProducts}
Top products this month: ${topProductsList.join(", ") || "No sales data yet"}
Low stock items: ${lowStock.length > 0 ? lowStock.join(", ") : "None"}
    `.trim();

    const prompt = `Based on this business data, provide exactly 3-5 short, actionable business insights. Each insight should be one clear sentence. Focus on: revenue trends, inventory actions, product performance, and growth opportunities. Format as a JSON array of strings.

${businessData}

Respond ONLY with a JSON array of strings, no other text. Example: ["Insight 1", "Insight 2", "Insight 3"]`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Parse the JSON response
    let insights: string[];
    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        insights = ["Unable to generate insights at this time. Please try again later."];
      }
    } catch {
      insights = ["Unable to generate insights at this time. Please try again later."];
    }

    const generatedAt = new Date().toISOString();

    // Cache the result
    insightsCache.set(tenantId, {
      insights,
      generatedAt,
      expiresAt: Date.now() + CACHE_DURATION,
    });

    return NextResponse.json(
      { insights, generatedAt },
      {
        headers: {
          "Cache-Control": "private, max-age=3600",
        },
      }
    );
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 429 || err.message?.includes("quota")) {
      return NextResponse.json(
        { error: "AI quota exceeded. Please try again later." },
        { status: 429 }
      );
    }

    console.error("AI Insights Error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights. Please try again." },
      { status: 500 }
    );
  }
}
