import { db } from "@/lib/db";
import { buildAreaIntelligence } from "./area-intelligence";
import { clamp, confidenceFromSample, median, normalizeName, percentChange, round } from "./intel-utils";
import type {
  BusinessIntelligence, CustomerIntelligence, DataQuality, IntelligenceInsight,
  InventoryIntelligence, PricingSignal, ProductIntelligence, RestockSuggestion,
  SalesIntelligence,
} from "./types";

/**
 * LipaPoint Intelligence Engine
 * - All numbers are calculated here, deterministically.
 * - The AI layer only interprets this output; it never invents data.
 */

const ANALYSIS_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
const TARGET_COVER_DAYS = 14;
const MIN_TARGET_MARGIN = 20;

export async function buildIntelligence(tenantId: string): Promise<BusinessIntelligence> {
  const now = new Date();
  const currentFrom = new Date(now.getTime() - ANALYSIS_DAYS * DAY);
  const previousFrom = new Date(currentFrom.getTime() - ANALYSIS_DAYS * DAY);
  const since180 = new Date(now.getTime() - 180 * DAY);

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, type: true, city: true, county: true, currency: true },
  });
  if (!tenant) throw new Error("Business not found");

  const completed = { tenantId, status: "COMPLETED" } as const;

  const [currentOrders, previousOrders, currentItems, previousItems, products, stocks, customers, customerOrders] =
    await Promise.all([
      db.order.findMany({
        where: { ...completed, createdAt: { gte: currentFrom } },
        select: { id: true, total: true, customerId: true, createdAt: true },
      }),
      db.order.findMany({
        where: { ...completed, createdAt: { gte: previousFrom, lt: currentFrom } },
        select: { id: true, total: true },
      }),
      db.orderItem.findMany({
        where: { order: { ...completed, createdAt: { gte: currentFrom } } },
        select: {
          productId: true, baseQuantity: true, total: true,
          product: {
            select: { id: true, name: true, price: true, cost: true, category: { select: { name: true } } },
          },
        },
      }),
      db.orderItem.findMany({
        where: { order: { ...completed, createdAt: { gte: previousFrom, lt: currentFrom } } },
        select: { productId: true, baseQuantity: true },
      }),
      db.product.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true, name: true, price: true, cost: true, trackStock: true, lowStockAlert: true,
          category: { select: { name: true } },
        },
      }),
      db.stock.findMany({
        where: { product: { tenantId, isActive: true } },
        select: { productId: true, quantity: true },
      }),
      db.customer.findMany({
        where: { tenantId },
        select: { id: true, totalSpent: true, visitCount: true, lastVisit: true },
      }),
      db.order.findMany({
        where: { ...completed, customerId: { not: null }, createdAt: { gte: since180 } },
        select: { customerId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const sum = (rows: Array<{ total: number }>) => rows.reduce((s, r) => s + r.total, 0);
  const currentRevenue = sum(currentOrders);
  const previousRevenue = sum(previousOrders);
  const currentAov = currentOrders.length ? currentRevenue / currentOrders.length : 0;
  const previousAov = previousOrders.length ? previousRevenue / previousOrders.length : 0;

  /* ---------------- stock (summed across locations) ---------------- */
  const stockMap = new Map<string, number>();
  for (const s of stocks) stockMap.set(s.productId, (stockMap.get(s.productId) ?? 0) + s.quantity);

  /* ---------------- product performance ---------------- */
  type Agg = { units: number; revenue: number; product: (typeof currentItems)[number]["product"] };
  const sold = new Map<string, Agg>();
  for (const item of currentItems) {
    const a = sold.get(item.productId);
    if (a) { a.units += item.baseQuantity; a.revenue += item.total; }
    else sold.set(item.productId, { units: item.baseQuantity, revenue: item.total, product: item.product });
  }
  const previousUnits = new Map<string, number>();
  for (const i of previousItems) previousUnits.set(i.productId, (previousUnits.get(i.productId) ?? 0) + i.baseQuantity);

  const topProducts: ProductIntelligence[] = [];
  for (const [productId, d] of sold.entries()) {
    const p = d.product;
    const velocity = d.units / ANALYSIS_DAYS;
    const stock = stockMap.get(productId) ?? null;
    const cover = stock !== null && velocity > 0 ? stock / velocity : null;
    const cost = p.cost > 0 ? p.cost : null; // cost defaults to 0 = "not recorded"
    const margin = cost !== null ? p.price - cost : null;
    const marginPercent = cost !== null && p.price > 0 ? ((p.price - cost) / p.price) * 100 : null;
    const prev = previousUnits.get(productId) ?? 0;
    const growth = prev > 0 ? ((d.units - prev) / prev) * 100 : d.units > 0 ? 100 : 0;

    let demand = 40 + clamp(d.units * 2, 0, 30) + clamp(growth / 3, -10, 20);
    if (cover !== null) demand += cover < 3 ? 10 : cover < 7 ? 5 : 0;
    demand = clamp(demand);

    let status: ProductIntelligence["status"] = "healthy";
    if (cover !== null && cover < 3) status = "low-stock";
    else if (growth > 25 && d.units >= 5) status = "high-demand";
    else if (d.units >= 10) status = "top-seller";

    topProducts.push({
      name: p.name,
      category: p.category?.name ?? "Uncategorised",
      unitsSold: round(d.units),
      revenue: round(d.revenue),
      price: p.price,
      cost,
      stock,
      margin: margin === null ? null : round(margin),
      marginPercent: marginPercent === null ? null : round(marginPercent),
      velocityPerDay: round(velocity),
      daysOfCover: cover === null ? null : round(cover),
      demandScore: round(demand),
      opportunityScore: 0,
      status,
    });
  }

  /* ---------------- inventory ---------------- */
  const tracked = products.filter((p) => p.trackStock);
  let lowStockCount = 0, criticalStockCount = 0, stockoutRiskCount = 0, deadStockCount = 0, fastMovingCount = 0;
  let stockValue = 0;
  for (const p of tracked) {
    const stock = stockMap.get(p.id) ?? 0;
    stockValue += stock * p.cost;
    if (stock <= p.lowStockAlert) lowStockCount++;
    if (stock <= 0) criticalStockCount++;
    const s = sold.get(p.id);
    if (s) {
      const v = s.units / ANALYSIS_DAYS;
      if (v > 0.5) fastMovingCount++;
      if (v > 0 && stock / v < 3) stockoutRiskCount++;
    } else if (stock > 0) deadStockCount++;
  }
  const inventory: InventoryIntelligence = {
    totalTrackedProducts: tracked.length, lowStockCount, criticalStockCount,
    estimatedStockValue: round(stockValue), fastMovingCount, deadStockCount, stockoutRiskCount,
  };

  /* ---------------- restock suggestions (deterministic) ---------------- */
  const restock: RestockSuggestion[] = [];
  for (const p of topProducts) {
    if (p.stock === null || p.daysOfCover === null || p.daysOfCover >= TARGET_COVER_DAYS) continue;
    const needed = Math.ceil(p.velocityPerDay * TARGET_COVER_DAYS - p.stock);
    if (needed <= 0) continue;
    restock.push({
      product: p.name, category: p.category, stock: p.stock, velocityPerDay: p.velocityPerDay,
      daysOfCover: p.daysOfCover, suggestedQty: needed, targetDays: TARGET_COVER_DAYS,
      urgency: p.daysOfCover < 3 ? "critical" : p.daysOfCover < 7 ? "high" : "medium",
    });
  }
  restock.sort((a, b) => a.daysOfCover - b.daysOfCover);
  restock.splice(10);

  /* ---------------- customers ---------------- */
  const visitsByCustomer = new Map<string, Date[]>();
  for (const o of customerOrders) {
    if (!o.customerId) continue;
    const list = visitsByCustomer.get(o.customerId) ?? [];
    list.push(o.createdAt);
    visitsByCustomer.set(o.customerId, list);
  }

  let returning = 0, fresh = 0, atRisk = 0, churned = 0;
  const allIntervals: number[] = [];
  for (const c of customers) {
    const visits = [...(visitsByCustomer.get(c.id) ?? [])].sort((a, b) => a.getTime() - b.getTime());
    const intervals = visits.slice(1).map((d, i) => (d.getTime() - visits[i].getTime()) / DAY);
    if (visits.length >= 2) { returning++; allIntervals.push(...intervals); }
    else if (visits.length === 1) fresh++;
    if (!c.lastVisit) continue;
    const since = (now.getTime() - c.lastVisit.getTime()) / DAY;
    const expected = median(intervals) ?? 30;
    if (since > Math.max(expected * 2, 45)) churned++;
    else if (since > Math.max(expected * 1.25, 21)) atRisk++;
  }

  const registered = customers.length;
  const d30 = now.getTime() - 30 * DAY;
  const d60 = now.getTime() - 60 * DAY;
  const activeCustomers = customers.filter((c) => c.lastVisit && c.lastVisit.getTime() >= d30).length;
  const pctOfRegistered = (n: number) => (registered > 0 ? round((n / registered) * 100, 1) : null);
  const yourRetention = {
    registered,
    repeatRate: pctOfRegistered(customers.filter((c) => c.visitCount >= 2).length),
    activeRate: pctOfRegistered(activeCustomers),
    churnRate: pctOfRegistered(customers.filter((c) => c.lastVisit && c.lastVisit.getTime() < d60).length),
  };

  const repeatRate = registered > 0 ? (returning / registered) * 100 : 0;
  const segShare = (n: number) => (registered > 0 ? round((n / registered) * 100) : 0);
  const medianInterval = median(allIntervals);
  const customerIntelligence: CustomerIntelligence = {
    registeredCustomers: registered,
    activeCustomers,
    newCustomers: fresh,
    returningCustomers: returning,
    repeatRate: round(repeatRate),
    averageCustomerValue: registered > 0 ? round(customers.reduce((s, c) => s + c.totalSpent, 0) / registered) : 0,
    averageVisitIntervalDays: medianInterval === null ? null : round(medianInterval),
    atRiskCustomers: atRisk,
    churnedCustomers: churned,
    retentionScore: round(clamp(repeatRate - (churned / Math.max(registered, 1)) * 100)),
    coverage: confidenceFromSample(registered),
    segments: [
      { name: "Loyal customers", customers: returning, share: segShare(returning),
        behavior: "Customers with multiple recorded purchases.",
        opportunity: "Protect repeat purchasing through loyalty offers, bundles and personalised recommendations." },
      { name: "At-risk customers", customers: atRisk, share: segShare(atRisk),
        behavior: "Customers whose latest visit is later than their usual purchasing rhythm.",
        opportunity: "Send a timely reminder, relevant offer or replenishment message." },
      { name: "Churn-risk customers", customers: churned, share: segShare(churned),
        behavior: "Customers well beyond their normal repeat interval.",
        opportunity: "Run a win-back campaign and check whether availability, pricing or service changed." },
    ],
  };

  /* ---------------- area intelligence ---------------- */
  const yourCatalogue = new Map<string, { price: number; category: string }>();
  for (const p of products) yourCatalogue.set(normalizeName(p.name), { price: p.price, category: p.category?.name ?? "Uncategorised" });
  const yourUnitsByName = new Map<string, number>();
  for (const t of topProducts) yourUnitsByName.set(normalizeName(t.name), t.unitsSold);
  const yourCategoryRevenue = new Map<string, number>();
  for (const i of currentItems) {
    const cat = i.product.category?.name;
    if (cat) yourCategoryRevenue.set(normalizeName(cat), (yourCategoryRevenue.get(normalizeName(cat)) ?? 0) + i.total);
  }
  const yourSales = currentItems.map((i) => ({
    text: normalizeName(`${i.product.name} ${i.product.category?.name ?? ""}`),
    revenue: i.total,
  }));

  const { market, demographics, priceIndex } = await buildAreaIntelligence({
    tenantId, type: tenant.type, county: tenant.county, city: tenant.city,
    analysisDays: ANALYSIS_DAYS, currentRevenue, currentOrders: currentOrders.length,
    currentAverageOrder: currentAov, yourCatalogue, yourUnitsByName, yourCategoryRevenue,
    yourSales, yourRetention,
  });

  /* ---------------- pricing signals ---------------- */
  const pricing: PricingSignal[] = [];
  const cur = tenant.currency ?? "KES";
  for (const p of [...topProducts].sort((a, b) => b.revenue - a.revenue).slice(0, 10)) {
    const bench = priceIndex.get(normalizeName(p.name));
    const delta = bench ? ((p.price - bench.median) / bench.median) * 100 : null;
    const base = {
      product: p.name, category: p.category, currentPrice: p.price, cost: p.cost,
      marginPercent: p.marginPercent, areaMedianPrice: bench ? round(bench.median, 0) : null,
      priceDeltaPercent: delta === null ? null : round(delta, 1),
    };

    if (p.cost !== null && p.marginPercent !== null && p.marginPercent < MIN_TARGET_MARGIN) {
      const target = Math.ceil(p.cost / (1 - MIN_TARGET_MARGIN / 100));
      pricing.push({ ...base, suggestedPrice: target, basis: "margin",
        message: `Margin is only ${p.marginPercent}%. A price of ${cur} ${target} would restore a ${MIN_TARGET_MARGIN}% margin.` });
    } else if (delta !== null && delta <= -10 && p.velocityPerDay > 0) {
      pricing.push({ ...base, suggestedPrice: Math.round(bench!.median), basis: "area-price",
        message: `Listed ${Math.abs(round(delta, 0))}% below the area median (${cur} ${Math.round(bench!.median)}). If demand holds, test a modest increase.` });
    } else if (delta !== null && delta >= 15) {
      pricing.push({ ...base, suggestedPrice: null, basis: "area-price",
        message: `Listed ${round(delta, 0)}% above the area median (${cur} ${Math.round(bench!.median)}). Watch volume, or confirm the premium is intentional.` });
    }
  }

  /* ---------------- sales ---------------- */
  const costed = currentItems.filter((i) => i.product.cost > 0);
  const costedRevenue = costed.reduce((s, i) => s + i.total, 0);
  const marginCoverage = currentRevenue > 0 ? (costedRevenue / currentRevenue) * 100 : 0;
  const grossProfit = costed.reduce((s, i) => s + (i.total - i.product.cost * i.baseQuantity), 0);
  const marginReliable = marginCoverage >= 30 && costedRevenue > 0;

  /* ---------------- opportunity scoring ---------------- */
  const opportunities: BusinessIntelligence["opportunities"] = [];
  for (const p of topProducts) {
    let score = p.demandScore;
    if (p.daysOfCover !== null && p.daysOfCover < 7) score += 15;
    if (p.marginPercent !== null && p.marginPercent >= 25) score += 10;
    p.opportunityScore = round(clamp(score));
    if (p.opportunityScore >= 70) {
      opportunities.push({
        title: `Protect ${p.name}`,
        description: `${p.name} has strong sales momentum and should be protected from stockouts.`,
        score: p.opportunityScore,
        potential: p.daysOfCover !== null
          ? `${p.velocityPerDay} units/day with about ${p.daysOfCover} days of cover.`
          : "Strong demand signal; stock coverage unavailable.",
      });
    }
  }
  for (const s of market.localTopProducts) {
    if (s.signal === "gap" || s.signal === "understocked") {
      opportunities.push({
        title: `Area demand: ${s.name}`,
        description: s.signal === "gap"
          ? `${s.name} sells at ${s.merchantsObserved}+ comparable businesses (${market.scopeLabel}) but you recorded no sales.`
          : `${s.name} sells noticeably better at comparable businesses than at yours.`,
        score: s.opportunityScore,
        potential: `Peers average ${s.estimatedUnits} units per 30 days; you sold ${s.yourUnits}.`,
      });
    }
  }
  if (inventory.stockoutRiskCount > 0) {
    opportunities.push({
      title: "Reduce stockout risk",
      description: `${inventory.stockoutRiskCount} fast-moving products have under three days of stock cover.`,
      score: 90,
      potential: "Protect revenue by prioritising replenishment of fast movers.",
    });
  }

  const sales: SalesIntelligence = {
    currentRevenue: round(currentRevenue), previousRevenue: round(previousRevenue),
    revenueGrowthPercent: percentChange(currentRevenue, previousRevenue),
    currentOrders: currentOrders.length, previousOrders: previousOrders.length,
    orderGrowthPercent: percentChange(currentOrders.length, previousOrders.length),
    currentAverageOrder: round(currentAov), previousAverageOrder: round(previousAov),
    averageOrderGrowthPercent: percentChange(currentAov, previousAov),
    grossProfit: marginReliable ? round(grossProfit) : null,
    grossMarginPercent: marginReliable ? round((grossProfit / costedRevenue) * 100) : null,
    marginCoveragePercent: round(marginCoverage, 1),
    topProducts: [...topProducts].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
  };

  /* ---------------- risks ---------------- */
  const risks: BusinessIntelligence["risks"] = [];
  if (inventory.criticalStockCount > 0)
    risks.push({ title: "Stockouts detected", severity: "critical",
      description: `${inventory.criticalStockCount} tracked products currently have zero stock.` });
  if (inventory.stockoutRiskCount > 0)
    risks.push({ title: "Fast-moving stock at risk", severity: "high",
      description: `${inventory.stockoutRiskCount} products may run out within about three days at current velocity.` });
  if (customerIntelligence.churnedCustomers > 0)
    risks.push({ title: "Customer churn signal", severity: "high",
      description: `${customerIntelligence.churnedCustomers} registered customers are well beyond their normal purchase interval.` });
  if (sales.grossMarginPercent !== null && sales.grossMarginPercent < 15)
    risks.push({ title: "Low gross margin", severity: "high",
      description: `Gross margin on costed products is ${sales.grossMarginPercent}%, which may point to pricing or product-mix pressure.` });
  if (inventory.deadStockCount > 0)
    risks.push({ title: "Dead stock", severity: "medium",
      description: `${inventory.deadStockCount} tracked products hold stock but had no sales this period.` });

  /* ---------------- deterministic insights ---------------- */
  const insights: IntelligenceInsight[] = [];
  if (sales.revenueGrowthPercent > 10)
    insights.push({ id: "revenue-growth", title: "Revenue is accelerating", category: "growth", priority: "high",
      description: `Revenue rose ${sales.revenueGrowthPercent}% against the previous 30 days.`,
      metric: `${sales.revenueGrowthPercent}%`, action: "Protect the products and channels driving the increase." });
  else if (sales.revenueGrowthPercent < -10)
    insights.push({ id: "revenue-decline", title: "Revenue is under pressure", category: "risk", priority: "high",
      description: `Revenue fell ${Math.abs(sales.revenueGrowthPercent)}% against the previous 30 days.`,
      metric: `${sales.revenueGrowthPercent}%`, action: "Check demand, retention and pricing before adding inventory." });
  if (restock.length > 0)
    insights.push({ id: "restock", title: "Restock needed", category: "inventory",
      priority: restock[0].urgency === "critical" ? "critical" : "high",
      description: `${restock.length} selling products have under ${TARGET_COVER_DAYS} days of cover. Most urgent: ${restock[0].product} (${restock[0].daysOfCover} days left).`,
      metric: `${restock[0].suggestedQty} units`, action: `Order about ${restock[0].suggestedQty} units of ${restock[0].product} to reach ${TARGET_COVER_DAYS} days of cover.` });
  if (customerIntelligence.churnedCustomers > 0)
    insights.push({ id: "customer-churn", title: "Customers are showing churn signals", category: "customer", priority: "high",
      description: `${customerIntelligence.churnedCustomers} registered customers are overdue against their own purchasing rhythm.`,
      metric: `${customerIntelligence.churnedCustomers} customers`,
      action: "Run a targeted win-back campaign rather than a generic promotion." });
  if (market.available) {
    const gap = market.localTopProducts.find((s) => s.signal === "gap" || s.signal === "understocked");
    if (gap)
      insights.push({ id: "market-gap", title: "A local demand gap is visible", category: "market", priority: "high",
        description: `${gap.name} sells ${gap.estimatedUnits} units per peer per 30 days (${market.scopeLabel}); you sold ${gap.yourUnits}.`,
        metric: `${gap.demandScore}/100 demand`,
        action: "Check fit with your customers and supplier economics before stocking it." });
    const lag = market.categoryDemand.find((c) => c.gap >= 10);
    if (lag)
      insights.push({ id: "category-gap", title: `${lag.category} is under-represented`, category: "market", priority: "medium",
        description: `${lag.category} is ${lag.areaShare}% of peer sales but ${lag.yourShare}% of yours.`,
        metric: `${lag.gap} pts gap`, action: "Review range depth and shelf space in this category." });
  }
  const priceCue = pricing.find((p) => p.basis === "margin");
  if (priceCue)
    insights.push({ id: "price-margin", title: "A top seller has a thin margin", category: "profitability", priority: "high",
      description: priceCue.message, metric: `${priceCue.marginPercent}% margin` });
  if (sales.grossMarginPercent !== null && sales.grossMarginPercent >= 25)
    insights.push({ id: "margin-health", title: "Gross margin is healthy", category: "profitability", priority: "medium",
      description: `Gross margin on costed products is ${sales.grossMarginPercent}%.`,
      metric: `${sales.grossMarginPercent}%`, action: "Protect margin on high-volume products when running promotions." });

  /* ---------------- actions ---------------- */
  const actions: BusinessIntelligence["actions"] = [];
  if (restock.length > 0) {
    const top = restock.slice(0, 3).map((r) => `${r.product} (~${r.suggestedQty})`).join(", ");
    actions.push({
      priority: restock[0].urgency === "critical" ? 1 : 2,
      title: `Restock ${restock.length} product${restock.length > 1 ? "s" : ""}`,
      reason: `Lowest cover first: ${top}.`,
      expectedImpact: `Reach about ${TARGET_COVER_DAYS} days of cover at current sales speed; adjust for supplier lead time.`,
    });
  }
  for (const r of risks.slice(0, 3))
    actions.push({
      priority: r.severity === "critical" ? 1 : r.severity === "high" ? 2 : 3,
      title: r.title, reason: r.description,
      expectedImpact: r.severity === "critical" ? "Protect immediate revenue and availability." : "Reduce avoidable revenue or retention risk.",
    });
  for (const o of [...opportunities].sort((a, b) => b.score - a.score).slice(0, 3))
    actions.push({ priority: 3, title: o.title, reason: o.description, expectedImpact: o.potential });

  /* ---------------- data quality (shown to the user) ---------------- */
  const linkedOrders = currentOrders.filter((o) => o.customerId).length;
  const linkedPct = currentOrders.length > 0 ? (linkedOrders / currentOrders.length) * 100 : 0;
  const notes: string[] = [];
  if (!tenant.county) notes.push("Set your county to unlock local benchmarks and area demographics.");
  if (marginCoverage < 50) notes.push(`Only ${round(marginCoverage, 0)}% of sales have a product cost recorded — add costs to unlock reliable margin and pricing advice.`);
  if (registered === 0 || linkedPct < 20) notes.push("Few orders are linked to a customer, so retention and churn figures are limited. Capturing customer details at checkout will improve them.");
  if (currentOrders.length < 10) notes.push("Fewer than 10 completed orders in the last 30 days — treat trends as indicative only.");
  const dataQuality: DataQuality = {
    costCoveragePercent: round(marginCoverage, 1), linkedOrdersPercent: round(linkedPct, 1),
    registeredCustomers: registered, locationSet: !!tenant.county, notes,
  };

  return {
    tenant: { id: tenant.id, name: tenant.name, type: tenant.type, city: tenant.city, county: tenant.county, currency: cur },
    period: { days: ANALYSIS_DAYS, from: currentFrom.toISOString(), to: now.toISOString() },
    sales, customers: customerIntelligence, inventory, restock, pricing, market, demographics,
    insights: insights.slice(0, 10),
    opportunities: [...opportunities].sort((a, b) => b.score - a.score).slice(0, 8),
    risks: risks.slice(0, 8),
    actions: actions.sort((a, b) => a.priority - b.priority).slice(0, 8),
    dataQuality,
    dataConfidence: confidenceFromSample(Math.max(currentOrders.length, registered)),
    generatedAt: now.toISOString(),
  };
}