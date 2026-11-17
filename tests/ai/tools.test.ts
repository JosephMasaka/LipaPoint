import assert from "node:assert/strict";
import test from "node:test";
import { AiToolError, runTool, toolDeclarations } from "../../src/lib/ai/tools/registry";
import type { BusinessIntelligence } from "../../src/lib/ai/types";

function fixture(): BusinessIntelligence {
  return {
    tenant: { id: "t1", name: "Shop", type: "RETAIL", city: "Nairobi", county: "Nairobi", currency: "KES" },
    period: { days: 30, from: "2026-10-18T00:00:00.000Z", to: "2026-11-17T00:00:00.000Z" },
    sales: {
      currentRevenue: 1000, previousRevenue: 800, revenueGrowthPercent: 25,
      currentOrders: 10, previousOrders: 8, orderGrowthPercent: 25,
      currentAverageOrder: 100, previousAverageOrder: 100, averageOrderGrowthPercent: 0,
      grossProfit: null, grossMarginPercent: null, marginCoveragePercent: 0,
      topProducts: [1, 2, 3].map((n) => ({
        productId: `p${n}`, name: `P${n}`, category: "Cat", unitsSold: n, revenue: n * 100, price: 100, cost: 60,
        stock: 10, margin: 40, marginPercent: 40, velocityPerDay: n / 10,
        daysOfCover: 10, demandScore: 50, opportunityScore: 50, status: "healthy",
      })),
    },
    customers: {
      registeredCustomers: 10, activeCustomers: 5, newCustomers: 2, returningCustomers: 3,
      repeatRate: 30, averageCustomerValue: 100, averageVisitIntervalDays: 7,
      atRiskCustomers: 1, churnedCustomers: 2, retentionScore: 10, coverage: "medium",
      segments: [],
    },
    inventory: {
      totalTrackedProducts: 3, lowStockCount: 1, criticalStockCount: 0,
      estimatedStockValue: 1000, fastMovingCount: 1, deadStockCount: 0, stockoutRiskCount: 0,
    },
    restock: [], pricing: [],
    market: { available: false } as unknown as BusinessIntelligence["market"],
    demographics: { available: false } as unknown as BusinessIntelligence["demographics"],
    insights: [], opportunities: [], risks: [], actions: [],
    dataQuality: {
      costCoveragePercent: 0, linkedOrdersPercent: 0, registeredCustomers: 10,
      locationSet: true, notes: [],
    },
    dataConfidence: "medium",
    generatedAt: "2026-11-17T00:00:00.000Z",
  };
}

const intel = fixture();

test("declares exactly the five read-only tools", () => {
  assert.deepEqual(
    toolDeclarations().map((t) => t.name).sort(),
    [
      "get_customer_insights",
      "get_inventory_status",
      "get_pricing_signals",
      "get_product_performance",
      "get_sales_summary",
    ]
  );
});

test("unknown tools are rejected", () => {
  assert.throws(() => runTool("drop_database", {}, intel), AiToolError);
});

test("unknown arguments are rejected", () => {
  assert.throws(
    () => runTool("get_product_performance", { tenantId: "other" }, intel),
    (err: unknown) => err instanceof AiToolError && err.code === "INVALID_ARGUMENT"
  );
});

test("limit is clamped, not trusted", () => {
  const result = runTool("get_product_performance", { limit: 9999 }, intel);
  const data = result.data as { products: unknown[] };
  assert.equal(data.products.length, 3);
  assert.equal(result.rows, 3);
});

test("sales summary reflects the scoped snapshot", () => {
  const result = runTool("get_sales_summary", {}, intel);
  const data = result.data as { revenue: number; completedOrders: number; currency: string };
  assert.equal(data.revenue, 1000);
  assert.equal(data.completedOrders, 10);
  assert.equal(data.currency, "KES");
});

test("customer tool returns aggregates only", () => {
  const result = runTool("get_customer_insights", {}, intel);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.registeredCustomers, 10);
  assert.equal("customers" in data, false);
});
