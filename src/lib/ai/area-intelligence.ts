import { db } from "@/lib/db";
import type { TenantType } from "@prisma/client";
import { canonicalCounty } from "@/lib/kenya-counties";
import { getAreaDemographics } from "./demographics-data";
import {
  average, chunk, clamp, confidenceFromSample, median, normalizeName, round,
} from "./intel-utils";
import type {
  AreaRetention, BuyingPotentialItem, CategoryDemand, DemographicIntelligence,
  DemographicSegment, DemographicSegmentId, LoyaltyProductSignal, MarketIntelligence,
  MarketProductSignal, MarketScope,
} from "./types";

/**
 * PRIVACY MODEL
 * - Benchmarks only exist when >= COHORT_THRESHOLD OTHER comparable businesses
 *   (the requesting business is excluded) have recent sales.
 * - Product / category signals need >= PRODUCT_MERCHANT_THRESHOLD distinct peers.
 * - Everything returned is an aggregate. No peer is ever identifiable.
 *
 * NOTE: using other tenants' data in anonymised aggregates should be covered
 * by your Terms / Privacy Policy (Kenya Data Protection Act, 2019).
 */
export const COHORT_THRESHOLD = 5;
const PRODUCT_MERCHANT_THRESHOLD = 3;
const NETWORK_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

const TYPE_LABEL: Record<string, string> = {
  RETAIL: "Retail shops", SUPERMARKET: "Supermarkets", PHARMACY: "Pharmacies",
  HARDWARE: "Hardware stores", RESTAURANT: "Restaurants", BAR: "Bars & lounges",
  BARBERSHOP: "Barbershops & salons",
};

export interface AreaContext {
  tenantId: string;
  type: TenantType;
  county: string | null;
  city: string | null;
  analysisDays: number;
  currentRevenue: number;
  currentOrders: number;
  currentAverageOrder: number;
  /** Your catalogue, keyed by normalised product name. */
  yourCatalogue: Map<string, { price: number; category: string }>;
  /** Your base-unit sales in the analysis window, keyed by normalised product name. */
  yourUnitsByName: Map<string, number>;
  /** Your revenue by normalised category name. */
  yourCategoryRevenue: Map<string, number>;
  /** Your sold items as normalised "product category" text, for keyword matching. */
  yourSales: Array<{ text: string; revenue: number }>;
  yourRetention: {
    registered: number;
    repeatRate: number | null;
    activeRate: number | null;
    churnRate: number | null;
  };
}

export interface AreaResult {
  market: MarketIntelligence;
  demographics: DemographicIntelligence;
  /** normalised product name -> peer median list price (used for pricing signals) */
  priceIndex: Map<string, { median: number; merchants: number }>;
}

/* =========================================================
   COHORT SELECTION
   ========================================================= */

interface Cohort {
  ids: string[];
  scope: MarketScope;
  peers: number;
  scopeLabel: string;
}

async function selectCohort(ctx: AreaContext, county: string | null): Promise<Cohort> {
  const typeLabel = TYPE_LABEL[ctx.type] ?? ctx.type;
  let localPeers = 0;

  if (county) {
    const local = await db.tenant.findMany({
      where: {
        isActive: true,
        type: ctx.type,
        id: { not: ctx.tenantId },
        county: { equals: county, mode: "insensitive" },
      },
      select: { id: true },
    });
    localPeers = local.length;
    if (local.length >= COHORT_THRESHOLD) {
      return {
        ids: local.map((t: { id: string }) => t.id),
        scope: "county",
        peers: local.length,
        scopeLabel: `${county} County · ${typeLabel}`,
      };
    }
  }

  const national = await db.tenant.findMany({
    where: { isActive: true, type: ctx.type, id: { not: ctx.tenantId } },
    select: { id: true },
  });
  if (national.length >= COHORT_THRESHOLD) {
    return {
      ids: national.map((t: { id: string }) => t.id),
      scope: "national",
      peers: national.length,
      scopeLabel: `Kenya-wide · ${typeLabel}`,
    };
  }

  return {
    ids: [],
    scope: "none",
    peers: county ? localPeers : national.length,
    scopeLabel: county ? `${county} County · ${typeLabel}` : typeLabel,
  };
}

function emptyRetention(ctx: AreaContext, note: string): AreaRetention {
  return {
    available: false,
    peersWithCustomers: 0,
    customersObserved: 0,
    areaRepeatRate: null,
    areaActiveRate: null,
    areaChurnRate: null,
    yourRepeatRate: ctx.yourRetention.repeatRate,
    yourActiveRate: ctx.yourRetention.activeRate,
    yourChurnRate: ctx.yourRetention.churnRate,
    note,
  };
}

function emptyMarket(ctx: AreaContext, county: string | null, cohort: Cohort): MarketIntelligence {
  const missingCounty = !county;
  return {
    available: false,
    scope: "none",
    scopeLabel: cohort.scopeLabel,
    county,
    city: ctx.city,
    businessType: ctx.type,
    cohortMerchants: cohort.peers,
    qualifiedMerchants: 0,
    cohortThreshold: COHORT_THRESHOLD,
    revenueIndex: null,
    orderIndex: null,
    averageOrderIndex: null,
    localTopProducts: [],
    loyaltyProducts: [],
    categoryDemand: [],
    retention: emptyRetention(ctx, "Not enough comparable businesses for a privacy-safe retention benchmark."),
    marketSummary:
      `Not enough comparable LipaPoint businesses${county ? ` in ${county} County` : ""} ` +
      `to produce a privacy-safe benchmark (${cohort.peers} of ${COHORT_THRESHOLD} needed).` +
      (missingCounty ? " Set your county to compare against local peers." : ""),
    confidence: "insufficient",
    dataSource: "insufficient",
  };
}

/* =========================================================
   MAIN
   ========================================================= */

export async function buildAreaIntelligence(ctx: AreaContext): Promise<AreaResult> {
  const county = canonicalCounty(ctx.county);
  const demographics = buildDemographics(ctx, county);
  const cohort = await selectCohort(ctx, county);
  const priceIndex: AreaResult["priceIndex"] = new Map();

  if (cohort.scope === "none") {
    return { market: emptyMarket(ctx, county, cohort), demographics, priceIndex };
  }

  const networkFrom = new Date(Date.now() - NETWORK_DAYS * DAY);
  const window = ctx.analysisDays / NETWORK_DAYS; // scales 90-day peer data to the 30-day window
  const idChunks = chunk(cohort.ids);
  const baseOrderWhere = (ids: string[]) => ({
    tenantId: { in: ids }, status: "COMPLETED" as const, createdAt: { gte: networkFrom },
  });

  /* ---- per-peer revenue / orders (indices) ---- */
  const perTenant: Array<{ tenantId: string; revenue: number; orders: number }> = (
    await Promise.all(
      idChunks.map((ids) =>
        db.order.groupBy({
          by: ["tenantId"],
          where: baseOrderWhere(ids),
          _sum: { total: true },
          _count: { _all: true },
        })
      )
    )
  )
    .flat()
    .map((g) => ({
      tenantId: g.tenantId,
      revenue: g._sum?.total ?? 0,
      orders: g._count?._all ?? 0,
    }))
    .filter((t) => t.orders > 0);

  const qualified = perTenant.length;
  if (qualified < COHORT_THRESHOLD) {
    const m = emptyMarket(ctx, county, cohort);
    m.scope = cohort.scope;
    m.cohortMerchants = cohort.peers;
    m.qualifiedMerchants = qualified;
    m.marketSummary =
      `${cohort.peers} comparable businesses found (${cohort.scopeLabel}), but only ${qualified} have recent sales — ` +
      `${COHORT_THRESHOLD} are needed for a privacy-safe benchmark.`;
    return { market: m, demographics, priceIndex };
  }

  const medRevenue = median(perTenant.map((t) => t.revenue)) ?? 0;
  const medOrders = median(perTenant.map((t) => t.orders)) ?? 0;
  const medAov = median(perTenant.map((t) => t.revenue / t.orders)) ?? 0;

  const revenueIndex = medRevenue > 0
    ? round((ctx.currentRevenue / (medRevenue * window)) * 100) : null;
  const orderIndex = medOrders > 0
    ? round((ctx.currentOrders / (medOrders * window)) * 100) : null;
  const averageOrderIndex = medAov > 0
    ? round((ctx.currentAverageOrder / medAov) * 100) : null;

  /* ---- product-level demand (grouped in the DB, not row-by-row) ---- */
  type Group = { productId: string; _sum?: { baseQuantity?: number | null; total?: number | null } };
  const sumArgs = { baseQuantity: true, total: true } as const;

  const [allGroups, loyaltyGroups]: [Group[], Group[]] = await Promise.all([
    Promise.all(idChunks.map((ids) =>
      db.orderItem.groupBy({
        by: ["productId"], where: { order: baseOrderWhere(ids) }, _sum: sumArgs,
      }))).then((r) => r.flat()),
    Promise.all(idChunks.map((ids) =>
      db.orderItem.groupBy({
        by: ["productId"],
        where: { order: { ...baseOrderWhere(ids), customerId: { not: null } } },
        _sum: sumArgs,
      }))).then((r) => r.flat()),
  ]);

  const productIds = [...new Set(allGroups.map((g) => g.productId))];
  type Meta = { id: string; name: string; price: number; tenantId: string; category: { name: string } | null };
  const metas: Meta[] = (
    await Promise.all(chunk(productIds).map((ids) =>
      db.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, price: true, tenantId: true, category: { select: { name: true } } },
      })))
  ).flat();
  const metaById = new Map(metas.map((m) => [m.id, m]));
  const loyaltyById = new Map(loyaltyGroups.map((g) => [g.productId, g._sum?.baseQuantity ?? 0]));

  interface Entry {
    name: string; category: string; units: number; loyaltyUnits: number;
    merchants: Set<string>; loyaltyMerchants: Set<string>; prices: number[];
  }
  const entries = new Map<string, Entry>();
  const categories = new Map<string, { label: string; revenue: number; merchants: Set<string> }>();
  let totalCategoryRevenue = 0;

  for (const g of allGroups) {
    const p = metaById.get(g.productId);
    if (!p) continue;
    const key = normalizeName(p.name);
    if (!key) continue;
    const units = g._sum?.baseQuantity ?? 0;
    const loyalty = loyaltyById.get(g.productId) ?? 0;

    const e = entries.get(key) ?? {
      name: p.name, category: p.category?.name ?? "Uncategorised", units: 0, loyaltyUnits: 0,
      merchants: new Set<string>(), loyaltyMerchants: new Set<string>(), prices: [],
    };
    e.units += units;
    e.loyaltyUnits += loyalty;
    e.merchants.add(p.tenantId);
    if (loyalty > 0) e.loyaltyMerchants.add(p.tenantId);
    if (p.price > 0) e.prices.push(p.price);
    entries.set(key, e);

    const catName = p.category?.name;
    if (catName) {
      const ck = normalizeName(catName);
      const c = categories.get(ck) ?? { label: catName, revenue: 0, merchants: new Set<string>() };
      const rev = g._sum?.total ?? 0;
      c.revenue += rev;
      c.merchants.add(p.tenantId);
      categories.set(ck, c);
      totalCategoryRevenue += rev;
    }
  }

  const eligible = [...entries.entries()].filter(([, e]) => e.merchants.size >= PRODUCT_MERCHANT_THRESHOLD);
  const avgUnits30 = (e: Entry) => (e.units / e.merchants.size) * window;
  const maxAvg = Math.max(1, ...eligible.map(([, e]) => avgUnits30(e)));
  const sortedAvg = eligible.map(([, e]) => avgUnits30(e)).sort((a, b) => a - b);
  const q75 = sortedAvg.length ? sortedAvg[Math.floor(sortedAvg.length * 0.75)] : Infinity;

  const signals: MarketProductSignal[] = eligible.map(([key, e]) => {
    const areaAvg = avgUnits30(e);
    const yourUnits = ctx.yourUnitsByName.get(key) ?? 0;
    const yourPrice = ctx.yourCatalogue.get(key)?.price ?? null;
    const medPrice = e.prices.length >= PRODUCT_MERCHANT_THRESHOLD ? median(e.prices) : null;
    if (medPrice) priceIndex.set(key, { median: medPrice, merchants: e.prices.length });

    const demandScore = clamp((areaAvg / maxAvg) * 100);
    let signal: MarketProductSignal["signal"] = "normal";
    if (yourUnits === 0 && areaAvg >= 5) signal = "gap";
    else if (yourUnits < areaAvg * 0.5) signal = "understocked";
    else if (areaAvg >= q75) signal = "strong-demand";

    const opportunityScore = clamp(
      demandScore + (signal === "gap" ? 30 : signal === "understocked" ? 20 : 0) -
        (yourUnits > areaAvg * 1.5 ? 10 : 0)
    );

    return {
      name: e.name,
      category: e.category,
      estimatedUnits: round(areaAvg),
      merchantsObserved: e.merchants.size,
      demandScore: round(demandScore),
      yourUnits: round(yourUnits),
      opportunityScore: round(opportunityScore),
      signal,
      areaMedianPrice: medPrice !== null ? round(medPrice, 0) : null,
      yourPrice,
      priceDeltaPercent:
        medPrice && yourPrice !== null ? round(((yourPrice - medPrice) / medPrice) * 100, 1) : null,
    };
  });

  signals.sort((a, b) => b.estimatedUnits - a.estimatedUnits);

  const loyaltyProducts: LoyaltyProductSignal[] = eligible
    .filter(([, e]) => e.loyaltyMerchants.size >= PRODUCT_MERCHANT_THRESHOLD && e.loyaltyUnits > 0)
    .map(([, e]) => ({
      name: e.name,
      category: e.category,
      estimatedUnits: round((e.loyaltyUnits / e.loyaltyMerchants.size) * window),
      merchantsObserved: e.loyaltyMerchants.size,
    }))
    .sort((a, b) => b.estimatedUnits - a.estimatedUnits)
    .slice(0, 8);

  const yourCategoryTotal = [...ctx.yourCategoryRevenue.values()].reduce((s, v) => s + v, 0);
  const categoryDemand: CategoryDemand[] = [...categories.entries()]
    .filter(([, c]) => c.merchants.size >= PRODUCT_MERCHANT_THRESHOLD && totalCategoryRevenue > 0)
    .map(([key, c]) => {
      const areaShare = (c.revenue / totalCategoryRevenue) * 100;
      const yourShare = yourCategoryTotal > 0
        ? ((ctx.yourCategoryRevenue.get(key) ?? 0) / yourCategoryTotal) * 100 : 0;
      return {
        category: c.label,
        areaShare: round(areaShare, 1),
        yourShare: round(yourShare, 1),
        gap: round(areaShare - yourShare, 1),
        merchantsObserved: c.merchants.size,
      };
    })
    .sort((a, b) => b.areaShare - a.areaShare)
    .slice(0, 8);

  const retention = await buildAreaRetention(ctx, cohort.ids);

  const market: MarketIntelligence = {
    available: true,
    scope: cohort.scope,
    scopeLabel: cohort.scopeLabel,
    county,
    city: ctx.city,
    businessType: ctx.type,
    cohortMerchants: cohort.peers,
    qualifiedMerchants: qualified,
    cohortThreshold: COHORT_THRESHOLD,
    revenueIndex,
    orderIndex,
    averageOrderIndex,
    localTopProducts: signals.slice(0, 12),
    loyaltyProducts,
    categoryDemand,
    retention,
    marketSummary:
      `Benchmark from ${qualified} comparable LipaPoint businesses (${cohort.scopeLabel}), last ${NETWORK_DAYS} days. ` +
      `Aggregated and anonymised — no individual business is identifiable.` +
      (cohort.scope === "national"
        ? ` This is a Kenya-wide benchmark because fewer than ${COHORT_THRESHOLD} peers have joined in ${county ?? "your county"} yet.`
        : ""),
    confidence: confidenceFromSample(qualified),
    dataSource: "lipapoint-network",
  };

  return { market, demographics, priceIndex };
}

/* =========================================================
   AREA RETENTION (peer customer behaviour, aggregate only)
   ========================================================= */

async function buildAreaRetention(ctx: AreaContext, ids: string[]): Promise<AreaRetention> {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY);
  const d60 = new Date(now - 60 * DAY);
  const count = async (extra: object) =>
    (await Promise.all(chunk(ids).map((c) =>
      db.customer.count({ where: { tenantId: { in: c }, ...extra } })))
    ).reduce((a: number, b: number) => a + b, 0);

  const [total, repeat, active, churned, perTenant] = await Promise.all([
    count({}),
    count({ visitCount: { gte: 2 } }),
    count({ lastVisit: { gte: d30 } }),
    count({ lastVisit: { lt: d60 } }),
    Promise.all(chunk(ids).map((c) =>
      db.customer.groupBy({ by: ["tenantId"], where: { tenantId: { in: c } }, _count: { _all: true } })
    )).then((r) => r.flat()),
  ]);

  const peersWithCustomers = perTenant.length;
  const available = total >= 20 && peersWithCustomers >= PRODUCT_MERCHANT_THRESHOLD;
  const pct = (n: number) => (total > 0 ? round((n / total) * 100, 1) : null);

  return {
    available,
    peersWithCustomers,
    customersObserved: available ? total : 0,
    areaRepeatRate: available ? pct(repeat) : null,
    areaActiveRate: available ? pct(active) : null,
    areaChurnRate: available ? pct(churned) : null,
    yourRepeatRate: ctx.yourRetention.repeatRate,
    yourActiveRate: ctx.yourRetention.activeRate,
    yourChurnRate: ctx.yourRetention.churnRate,
    note: available
      ? "Based on registered customers across comparable businesses. Active = bought in the last 30 days; lapsed = no purchase for 60+ days."
      : "Peers have not recorded enough registered customers yet for a privacy-safe retention benchmark.",
  };
}

/* =========================================================
   DEMOGRAPHICS + MODELLED BUYING POTENTIAL
   ========================================================= */

type AffinityGroup = "retail" | "pharmacy" | "food";
const GROUP_BY_TYPE: Record<string, AffinityGroup> = {
  RETAIL: "retail", SUPERMARKET: "retail", PHARMACY: "pharmacy", RESTAURANT: "food", BAR: "food",
};

interface Affinity {
  group: AffinityGroup;
  segment: "children" | "youth" | "adults" | "older";
  category: string;
  keywords: string[];
  affinity: "high" | "medium";
  rationale: string;
}

/**
 * HEURISTIC, NOT DATA. Typical category affinity by life-stage, used only to
 * generate hypotheses worth testing. Every item is shown in the UI as a
 * "modelled estimate" next to what the business actually sells.
 */
const AFFINITY: Affinity[] = [
  // Retail / supermarket
  { group: "retail", segment: "children", category: "School & stationery", affinity: "high",
    keywords: ["exercise", "pen", "pencil", "stationery", "school", "uniform", "geometry", "crayon"],
    rationale: "Households with school-age children buy stationery in recurring bursts (term openings)." },
  { group: "retail", segment: "children", category: "Baby & child care", affinity: "high",
    keywords: ["diaper", "nappy", "baby", "formula", "cerelac", "wipes"],
    rationale: "Young children drive steady, repeat purchases of care items." },
  { group: "retail", segment: "youth", category: "Airtime, data & phone accessories", affinity: "high",
    keywords: ["airtime", "data", "bundle", "charger", "earphone", "cable", "powerbank"],
    rationale: "Younger adults are heavy mobile users and frequent small-ticket buyers." },
  { group: "retail", segment: "youth", category: "Snacks & beverages", affinity: "high",
    keywords: ["soda", "juice", "energy", "water", "snack", "biscuit", "crisps", "chips"],
    rationale: "High-frequency, impulse-friendly purchases among younger customers." },
  { group: "retail", segment: "adults", category: "Household staples", affinity: "high",
    keywords: ["rice", "flour", "unga", "maize", "sugar", "oil", "bread", "milk", "tea", "salt"],
    rationale: "Working-age adults run the household shopping basket." },
  { group: "retail", segment: "adults", category: "Cleaning & home care", affinity: "medium",
    keywords: ["soap", "detergent", "bleach", "tissue", "toilet", "omo", "jik"],
    rationale: "Regular replenishment purchases for established households." },
  { group: "retail", segment: "older", category: "Everyday essentials", affinity: "medium",
    keywords: ["tea", "sugar", "bread", "milk", "salt", "soap"],
    rationale: "Smaller, routine baskets of essentials." },
  // Pharmacy
  { group: "pharmacy", segment: "children", category: "Child health", affinity: "high",
    keywords: ["syrup", "paediatric", "pediatric", "children", "zinc", "ors", "vitamin", "baby"],
    rationale: "Common childhood ailments create frequent pharmacy visits." },
  { group: "pharmacy", segment: "youth", category: "Skin & personal care", affinity: "medium",
    keywords: ["acne", "lotion", "sunscreen", "cream", "deodorant"],
    rationale: "Personal-care and skincare spend skews younger." },
  { group: "pharmacy", segment: "youth", category: "Family planning & sexual health", affinity: "high",
    keywords: ["condom", "contracept", "pill", "pregnancy", "emergency"],
    rationale: "Reproductive-age adults are the core buyers of these products." },
  { group: "pharmacy", segment: "adults", category: "Supplements & chronic care", affinity: "medium",
    keywords: ["vitamin", "supplement", "multivitamin", "pressure", "diabet", "metformin"],
    rationale: "Prevalence of lifestyle conditions rises through working age." },
  { group: "pharmacy", segment: "older", category: "Chronic-condition medication", affinity: "high",
    keywords: ["pressure", "diabet", "arthritis", "cholesterol", "amlodipine", "metformin", "atorvastatin"],
    rationale: "Older customers have the highest need for repeat chronic medication." },
  // Restaurant / bar
  { group: "food", segment: "children", category: "Family & kids' meals", affinity: "medium",
    keywords: ["kids", "children", "fries", "juice", "pizza", "nuggets"],
    rationale: "Families with children influence order mix and group size." },
  { group: "food", segment: "youth", category: "Fast food & snacks", affinity: "high",
    keywords: ["burger", "fries", "pizza", "chicken", "wrap", "sandwich", "snack"],
    rationale: "Younger diners over-index on quick, affordable meals." },
  { group: "food", segment: "youth", category: "Social drinks", affinity: "high",
    keywords: ["beer", "cocktail", "soda", "juice", "energy", "smoothie"],
    rationale: "Social occasions drive drinks sales among younger adults." },
  { group: "food", segment: "adults", category: "Lunch & set meals", affinity: "high",
    keywords: ["lunch", "ugali", "rice", "pilau", "stew", "combo", "meal"],
    rationale: "Working-age customers drive weekday lunch demand." },
  { group: "food", segment: "adults", category: "Breakfast & tea", affinity: "medium",
    keywords: ["tea", "coffee", "mandazi", "chapati", "breakfast"],
    rationale: "Commuters and workers buy breakfast and hot drinks." },
  { group: "food", segment: "older", category: "Traditional & lighter meals", affinity: "medium",
    keywords: ["githeri", "porridge", "soup", "ugali", "traditional", "tea"],
    rationale: "Older customers favour familiar, lighter dishes." },
];

function keywordRevenueShare(
  keywords: string[], sales: AreaContext["yourSales"], total: number
): number | null {
  if (total <= 0) return null;
  // Word-START match so "rice" does not match "price".
  const matched = sales.reduce(
    (s, x) => (keywords.some((k) => ` ${x.text}`.includes(` ${k}`)) ? s + x.revenue : s), 0);
  return round((matched / total) * 100, 1);
}

function buildDemographics(ctx: AreaContext, county: string | null): DemographicIntelligence {
  const { record, scope } = getAreaDemographics(county);
  const total = record.age0to14 + record.age15to64 + record.age65plus;
  const share = (n: number) => round((n / total) * 100, 1);

  const segments: DemographicSegment[] = [
    { id: "children", label: "Children", ageRange: "0–14", population: record.age0to14, share: share(record.age0to14) },
  ];
  if (record.age15to35 !== null) {
    const adults = Math.max(0, record.age15to64 - record.age15to35);
    segments.push(
      { id: "youth", label: "Youth", ageRange: "15–35", population: record.age15to35, share: share(record.age15to35) },
      { id: "adults", label: "Adults (approx.)", ageRange: "36–64", population: adults, share: share(adults) },
    );
  } else {
    segments.push({ id: "working-age", label: "Working-age", ageRange: "15–64", population: record.age15to64, share: share(record.age15to64) });
  }
  segments.push({ id: "older", label: "Older adults", ageRange: "65+", population: record.age65plus, share: share(record.age65plus) });

  const group = GROUP_BY_TYPE[ctx.type];
  const hasYouthSplit = record.age15to35 !== null;
  const byId = new Map<DemographicSegmentId, DemographicSegment>(segments.map((s) => [s.id, s]));

  const potential: BuyingPotentialItem[] = [];
  const seen = new Set<string>();
  if (group) {
    for (const a of AFFINITY.filter((x) => x.group === group)) {
      const segId: DemographicSegmentId =
        hasYouthSplit || a.segment === "children" || a.segment === "older" ? a.segment : "working-age";
      const seg = byId.get(segId);
      if (!seg) continue;
      const dedupe = `${segId}|${a.category}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const yourShare = keywordRevenueShare(a.keywords, ctx.yourSales, ctx.currentRevenue);
      potential.push({
        segmentId: segId,
        segmentLabel: seg.label,
        segmentShare: seg.share,
        category: a.category,
        affinity: a.affinity,
        rationale: a.rationale,
        yourRevenueShare: yourShare,
        status: yourShare === null ? "unknown" : yourShare < 3 ? "gap" : "covered",
      });
    }
    // Gaps first, then high-affinity before medium, then the larger population segment.
    potential.sort((x, y) =>
      Number(y.status === "gap") - Number(x.status === "gap") ||
      Number(y.affinity === "high") - Number(x.affinity === "high") ||
      y.segmentShare - x.segmentShare);
  }

  const scopeNote = scope === "national"
    ? "Showing the Kenya-wide age structure because verified county-level data for your area has not been loaded yet. Treat this as context, not local precision."
    : `County-level age structure for ${record.geography}.`;

  return {
    available: true,
    scope,
    source: record.source,
    sourceNote: record.sourceNote,
    year: record.year,
    geography: record.geography,
    confidence: scope === "county" ? "high" : "medium",
    population: record.population,
    households: record.households,
    averageHouseholdSize: record.averageHouseholdSize,
    segments,
    buyingPotential: potential,
    methodology:
      "Population shares come from official census data. Buying potential is a MODELLED estimate: it combines those shares with typical category affinity by life-stage and compares the result with what you actually sell. It shows hypotheses to test, not measured purchasing behaviour. LipaPoint does not infer customer age, sex or income from POS transactions.",
    note: scopeNote,
  };
}