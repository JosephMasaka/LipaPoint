import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { generateAiReply } from "@/lib/ai/orchestrator";
import { AiRateLimitError } from "@/lib/ai/types";
import { db } from "@/lib/db";

// Simple in-memory cache for insights per tenant
const insightsCache = new Map<
  string,
  {
    insights: string[];
    generatedAt: string;
    expiresAt: number;
    provider?: string;
  }
>();

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// App-level rate limit.
// This is separate from the provider-level limits handled by the
// shared AI orchestrator.
const rateLimitMap = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(tenantId, {
      count: 1,
      resetAt: now + RATE_WINDOW,
    });

    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;

  return true;
}

const SYSTEM_PROMPT = `
You are LipaPoint AI, an expert point-of-sale business assistant for small and medium businesses in Kenya.

Your task is to analyze the provided business data and generate useful, specific, actionable business insights.

Focus on:
- Revenue trends
- Sales performance
- Product performance
- Inventory and restocking
- Low-stock risks
- Customer and business growth opportunities
- Pricing or product opportunities when supported by the data

Important rules:
- Ground your insights strictly in the business data provided.
- Mention specific product names and numbers when useful.
- Do not invent data.
- Keep each insight short and actionable.
- Generate exactly 3 to 5 insights.
- Each insight must be one clear sentence.
- The business operates in Kenya and uses KES currency.
- Respond ONLY with a valid JSON array of strings.
- Do not wrap the JSON in Markdown.
- Do not include explanations outside the JSON array.

Example:
["Sales generated KES 45,000 this week, suggesting strong short-term demand.",
 "Milk is one of the top-performing products and should be monitored closely to avoid stockouts.",
 "Three products are below their low-stock thresholds and should be considered for immediate restocking."]
`.trim();

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      !canAccessFeature(
        user.tenant.tier,
        "ai-assistant",
        user.tenant.type
      )
    ) {
      return NextResponse.json(
        {
          error:
            "AI Insights is available on Professional and Enterprise plans. Upgrade to access.",
        },
        { status: 403 }
      );
    }

    if (
      !process.env.GEMINI_API_KEY &&
      !process.env.GROQ_API_KEY
    ) {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 500 }
      );
    }

    const tenantId = user.tenantId;

    // App-level rate limit
    if (!checkRateLimit(tenantId)) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait a moment before trying again.",
        },
        { status: 429 }
      );
    }

    // ---------------------------------------------------------
    // CACHE
    // ---------------------------------------------------------

    const cached = insightsCache.get(tenantId);

    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(
        {
          insights: cached.insights,
          generatedAt: cached.generatedAt,
          provider: cached.provider,
          cached: true,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=3600",
          },
        }
      );
    }

    // ---------------------------------------------------------
    // DATE RANGES
    // ---------------------------------------------------------

    const now = new Date();

    const weekStart = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    // ---------------------------------------------------------
    // BUSINESS DATA
    // ---------------------------------------------------------

    const [
      recentOrders,
      topProducts,
      lowStockItems,
      totalProducts,
    ] = await Promise.all([
      db.order.findMany({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: {
            gte: weekStart,
          },
        },
        select: {
          total: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      }),

      db.orderItem.findMany({
        where: {
          order: {
            tenantId,
            status: "COMPLETED",
            createdAt: {
              gte: monthStart,
            },
          },
        },
        select: {
          quantity: true,
          total: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      }),

      db.stock.findMany({
        where: {
          product: {
            tenantId,
            isActive: true,
          },
        },
        include: {
          product: {
            select: {
              name: true,
              lowStockAlert: true,
            },
          },
        },
      }),

      db.product.count({
        where: {
          tenantId,
          isActive: true,
        },
      }),
    ]);

    // ---------------------------------------------------------
    // CALCULATE SALES METRICS
    // ---------------------------------------------------------

    const weekRevenue = recentOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );

    const orderCount = recentOrders.length;

    const avgOrderValue =
      orderCount > 0
        ? Math.round(weekRevenue / orderCount)
        : 0;

    // ---------------------------------------------------------
    // TOP PRODUCTS
    // ---------------------------------------------------------

    const productMap = new Map<
      string,
      {
        qty: number;
        revenue: number;
      }
    >();

    for (const item of topProducts) {
      const existing = productMap.get(item.product.name) || {
        qty: 0,
        revenue: 0,
      };

      existing.qty += item.quantity;
      existing.revenue += item.total;

      productMap.set(item.product.name, existing);
    }

    const topProductsList = [...productMap.entries()]
      .sort(
        (a, b) =>
          b[1].revenue - a[1].revenue
      )
      .slice(0, 5)
      .map(
        ([name, data]) =>
          `${name} (${data.qty} sold, KES ${Math.round(
            data.revenue
          )})`
      );

    // ---------------------------------------------------------
    // LOW STOCK
    // ---------------------------------------------------------

    const lowStock = lowStockItems
      .filter(
        (stock) =>
          stock.quantity <=
          stock.product.lowStockAlert
      )
      .map((stock) => ({
        name: stock.product.name,
        quantity: stock.quantity,
        alertLevel: stock.product.lowStockAlert,
      }))
      .slice(0, 10);

    // ---------------------------------------------------------
    // BUSINESS CONTEXT
    // ---------------------------------------------------------

    const businessData = `
Business: ${user.tenant.name}
Business type: ${user.tenant.type}

Sales performance:
- Revenue this week: KES ${Math.round(weekRevenue)}
- Orders this week: ${orderCount}
- Average order value: KES ${avgOrderValue}

Products:
- Total active products: ${totalProducts}

Top products this month:
${
  topProductsList.length > 0
    ? topProductsList
        .map((product) => `- ${product}`)
        .join("\n")
    : "- No sales data yet"
}

Low-stock products:
${
  lowStock.length > 0
    ? lowStock
        .map(
          (item) =>
            `- ${item.name}: ${item.quantity} units remaining (alert level: ${item.alertLevel})`
        )
        .join("\n")
    : "- None"
}
`.trim();

    // ---------------------------------------------------------
    // GENERATE INSIGHTS USING SHARED AI ORCHESTRATOR
    // ---------------------------------------------------------

    const fullPrompt = `
${SYSTEM_PROMPT}

${businessData}

Analyze the business data above and return exactly 3 to 5 actionable insights as a JSON array of strings.
`.trim();

    const result = await generateAiReply(
      fullPrompt,
      "Generate the business insights now."
    );

    const responseText = result.reply.trim();

    // ---------------------------------------------------------
    // PARSE AI RESPONSE
    // ---------------------------------------------------------

    let insights: string[] = [];

    try {
      // First attempt: direct JSON parsing
      const parsed = JSON.parse(responseText);

      if (Array.isArray(parsed)) {
        insights = parsed
          .filter(
            (item): item is string =>
              typeof item === "string"
          )
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // Fallback: extract JSON array from the response
      try {
        const jsonMatch =
          responseText.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const parsed = JSON.parse(
            jsonMatch[0]
          );

          if (Array.isArray(parsed)) {
            insights = parsed
              .filter(
                (item): item is string =>
                  typeof item === "string"
              )
              .map((item) => item.trim())
              .filter(Boolean);
          }
        }
      } catch {
        insights = [];
      }
    }

    // ---------------------------------------------------------
    // VALIDATE RESULT
    // ---------------------------------------------------------

    if (insights.length === 0) {
      console.error(
        "AI Insights returned invalid response:",
        responseText
      );

      return NextResponse.json(
        {
          error:
            "Unable to generate insights at this time. Please try again later.",
        },
        { status: 500 }
      );
    }

    // Keep only the first 5 insights even if a provider returns more.
    insights = insights.slice(0, 5);

    const generatedAt =
      new Date().toISOString();

    // ---------------------------------------------------------
    // CACHE
    // ---------------------------------------------------------

    insightsCache.set(tenantId, {
      insights,
      generatedAt,
      expiresAt:
        Date.now() + CACHE_DURATION,
      provider: result.provider,
    });

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------

    return NextResponse.json(
      {
        insights,
        generatedAt,
        provider: result.provider,
        cached: false,
        usage: {
          tokensUsed:
            result.tokensUsed ?? 0,
          provider: result.provider,
        },
      },
      {
        headers: {
          "Cache-Control":
            "private, max-age=3600",
        },
      }
    );
  } catch (error: unknown) {
    // Shared AI orchestrator rate-limit/quota error
    if (error instanceof AiRateLimitError) {
      return NextResponse.json(
        {
          error:
            "AI quota exceeded. Please try again later.",
        },
        { status: 429 }
      );
    }

    const err = error as {
      status?: number;
      message?: string;
    };

    if (
      err.status === 429 ||
      err.message?.toLowerCase().includes("quota") ||
      err.message?.toLowerCase().includes("rate limit")
    ) {
      return NextResponse.json(
        {
          error:
            "AI quota exceeded. Please try again later.",
        },
        { status: 429 }
      );
    }

    console.error(
      "AI Insights Error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate insights. Please try again.",
      },
      { status: 500 }
    );
  }
}