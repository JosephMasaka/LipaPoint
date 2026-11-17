import type {
  AiScopeInfo,
  AiToolDeclaration,
  BusinessIntelligence,
  CustomerIntelligence,
  InventoryIntelligence,
  PricingSignal,
  ProductIntelligence,
  RestockSuggestion,
  SalesIntelligence,
} from "../types";

/**
 * Read-only tools the model may call.
 *
 * Every tool is a pure projection of an already tenant-scoped
 * `BusinessIntelligence` snapshot, so a tool call cannot widen access or
 * invent data. No tool mutates anything.
 */

export interface ToolExecution {
  toolName: string;
  label: string;
  rows: number;
  data: unknown;
}

export class AiToolError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AiToolError";
  }
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: AiToolDeclaration["parameters"];
  run(intel: BusinessIntelligence, args: Record<string, unknown>): ToolExecution;
}

const NO_ARGS: AiToolDeclaration["parameters"] = { type: "object", properties: {} };

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function rejectUnknown(args: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new AiToolError(`Unknown argument "${key}"`, "INVALID_ARGUMENT");
    }
  }
}

/** Sales totals for the resolved window, with the previous equal period. */
const salesSummary: ToolDefinition = {
  name: "get_sales_summary",
  description:
    "Revenue, completed order count, average order value, growth versus the previous equal-length period, and gross margin (null when costs are not recorded). Use for any sales-performance question.",
  parameters: NO_ARGS,
  run(intel) {
    const s: SalesIntelligence = intel.sales;
    return {
      toolName: this.name,
      label: "Sales summary",
      rows: 1,
      data: {
        period: intel.period,
        revenue: s.currentRevenue,
        previousRevenue: s.previousRevenue,
        revenueGrowthPercent: s.revenueGrowthPercent,
        completedOrders: s.currentOrders,
        previousOrders: s.previousOrders,
        orderGrowthPercent: s.orderGrowthPercent,
        averageOrderValue: s.currentAverageOrder,
        previousAverageOrder: s.previousAverageOrder,
        grossProfit: s.grossProfit,
        grossMarginPercent: s.grossMarginPercent,
        marginDataCoveragePercent: s.marginCoveragePercent,
        currency: intel.tenant.currency,
      },
    };
  },
};

/** Product-level units, revenue, margin and days of cover. */
const productPerformance: ToolDefinition = {
  name: "get_product_performance",
  description:
    "Products sold in the period with units, revenue, margin, stock and days of cover. Sort by revenue, units or margin. Use for best/worst sellers and product-mix questions.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "How many products to return (1-50). Default 10." },
      sort: { type: "string", description: "One of revenue, units, margin. Default revenue." },
    },
  },
  run(intel, args) {
    rejectUnknown(args, ["limit", "sort"]);
    const limit = boundedInt(args.limit, 10, 1, 50);
    const sort = args.sort === "units" || args.sort === "margin" ? args.sort : "revenue";

    const sorted = [...intel.sales.topProducts].sort((a, b) => {
      if (sort === "units") return b.unitsSold - a.unitsSold;
      if (sort === "margin") return (b.marginPercent ?? -1) - (a.marginPercent ?? -1);
      return b.revenue - a.revenue;
    });

    const products = sorted.slice(0, limit).map((p: ProductIntelligence) => ({
      name: p.name,
      category: p.category,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
      price: p.price,
      cost: p.cost,
      marginPercent: p.marginPercent,
      stock: p.stock,
      daysOfCover: p.daysOfCover,
      status: p.status,
    }));

    return {
      toolName: this.name,
      label: `Product performance (${sort})`,
      rows: products.length,
      data: { period: intel.period, sort, products },
    };
  },
};

/** Stock position and deterministic replenishment suggestions. */
const inventoryStatus: ToolDefinition = {
  name: "get_inventory_status",
  description:
    "Stock health: low/out-of-stock counts, dead stock, stock value, products at risk of stocking out, and restock suggestions with quantities for about 14 days of cover. Use for restocking and availability questions.",
  parameters: NO_ARGS,
  run(intel) {
    const inventory: InventoryIntelligence = intel.inventory;
    const restock: RestockSuggestion[] = intel.restock;
    const lowStock = intel.sales.topProducts
      .filter((p) => p.status === "low-stock")
      .slice(0, 20)
      .map((p) => ({ name: p.name, stock: p.stock, daysOfCover: p.daysOfCover }));

    return {
      toolName: this.name,
      label: "Inventory status",
      rows: restock.length,
      data: {
        period: intel.period,
        inventory,
        lowStockProducts: lowStock,
        restockSuggestions: restock,
        note: "Restock quantities target about 14 days of cover; adjust for supplier lead time, cash and seasonality.",
      },
    };
  },
};

/** Retention, churn and segment counts (aggregate only). */
const customerInsights: ToolDefinition = {
  name: "get_customer_insights",
  description:
    "Registered, active, new, returning and at-risk customers, repeat rate, average customer value and churn signals. Aggregate only — never individual customer identities.",
  parameters: NO_ARGS,
  run(intel) {
    const c: CustomerIntelligence = intel.customers;
    return {
      toolName: this.name,
      label: "Customer insights",
      rows: c.segments.length,
      data: {
        registeredCustomers: c.registeredCustomers,
        activeCustomers: c.activeCustomers,
        newCustomers: c.newCustomers,
        returningCustomers: c.returningCustomers,
        repeatRatePercent: c.repeatRate,
        averageCustomerValue: c.averageCustomerValue,
        averageVisitIntervalDays: c.averageVisitIntervalDays,
        atRiskCustomers: c.atRiskCustomers,
        churnedCustomers: c.churnedCustomers,
        retentionScore: c.retentionScore,
        coverage: c.coverage,
        segments: c.segments,
        dataQuality: intel.dataQuality,
      },
    };
  },
};

/** Pricing signals from margin rules and anonymised area list prices. */
const pricingSignals: ToolDefinition = {
  name: "get_pricing_signals",
  description:
    "Products with thin margins or a price far from the anonymised area median, with suggested price tests. Area prices are LIST prices, not realised prices, and are never tied to an individual business.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "How many signals to return (1-20). Default 10." },
    },
  },
  run(intel, args) {
    rejectUnknown(args, ["limit"]);
    const limit = boundedInt(args.limit, 10, 1, 20);
    const signals = intel.pricing.slice(0, limit).map((p: PricingSignal) => ({
      product: p.product,
      category: p.category,
      currentPrice: p.currentPrice,
      cost: p.cost,
      marginPercent: p.marginPercent,
      areaMedianListPrice: p.areaMedianPrice,
      priceDeltaPercent: p.priceDeltaPercent,
      suggestedPrice: p.suggestedPrice,
      basis: p.basis,
      message: p.message,
    }));

    return {
      toolName: this.name,
      label: "Pricing signals",
      rows: signals.length,
      data: {
        currency: intel.tenant.currency,
        areaBenchmarkAvailable: intel.market.available,
        areaScope: intel.market.available ? intel.market.scopeLabel : null,
        signals,
      },
    };
  },
};

const TOOLS: ToolDefinition[] = [
  salesSummary,
  productPerformance,
  inventoryStatus,
  customerInsights,
  pricingSignals,
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));
export function toolDeclarations(): AiToolDeclaration[] {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/** Runs one tool call; unknown tools and bad arguments are rejected. */
export function runTool(
  name: string,
  args: Record<string, unknown>,
  intel: BusinessIntelligence
): ToolExecution {
  const tool = BY_NAME.get(name);
  if (!tool) throw new AiToolError(`Unknown tool "${name}"`, "UNKNOWN_TOOL");
  return tool.run(intel, args);
}

/** Serialises tool output for the follow-up prompt, with a hard size cap. */
export function toolResultForPrompt(executions: ToolExecution[], scope: AiScopeInfo): string {
  const payload = JSON.stringify({
    scope: {
      from: scope.from,
      to: scope.to,
      location: scope.locationName ?? "all locations",
      currency: scope.currency,
    },
    results: executions.map((e) => ({ tool: e.toolName, data: e.data })),
  });
  const MAX = 8000;
  return payload.length > MAX ? payload.slice(0, MAX) + "…[truncated]" : payload;
}
