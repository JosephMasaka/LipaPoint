export interface AiGenerateResult {
  reply: string;
  tokensUsed?: number;
  provider: "gemini" | "groq";
}

export class AiRateLimitError extends Error {
  constructor(message = "AI rate limit exceeded") {
    super(message);
    this.name = "AiRateLimitError";
  }
}

export class AiProviderError extends Error {
  constructor(message = "AI provider failed") {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  name: "gemini" | "groq";
  generate(systemPrompt: string, message: string): Promise<AiGenerateResult>;
}

/* =========================================================
   LIPAPOINT INTELLIGENCE
   ========================================================= */

export type IntelligenceConfidence = "high" | "medium" | "low" | "insufficient";
export type IntelligencePriority = "critical" | "high" | "medium" | "low";

export type InsightCategory =
  | "sales" | "inventory" | "customer" | "market"
  | "opportunity" | "risk" | "profitability" | "growth";

export interface IntelligenceInsight {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  priority: IntelligencePriority;
  metric?: string;
  action?: string;
}

export interface ProductIntelligence {
  name: string;
  category: string;
  unitsSold: number; // in the product's BASE unit, so it is comparable with stock
  revenue: number;
  price: number;
  cost: number | null; // null when no cost has been recorded (cost defaults to 0 in the DB)
  stock: number | null;
  margin: number | null;
  marginPercent: number | null;
  velocityPerDay: number;
  daysOfCover: number | null;
  demandScore: number;
  opportunityScore: number;
  status: "top-seller" | "high-demand" | "low-stock" | "underperforming" | "healthy";
}

export interface CustomerSegment {
  name: string;
  customers: number;
  share: number;
  behavior: string;
  opportunity: string;
}

export interface CustomerIntelligence {
  registeredCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatRate: number;
  averageCustomerValue: number;
  averageVisitIntervalDays: number | null;
  atRiskCustomers: number;
  churnedCustomers: number;
  retentionScore: number;
  coverage: IntelligenceConfidence;
  segments: CustomerSegment[];
}

/* ---------- Area / market ---------- */

export type MarketScope = "county" | "national" | "none";

export interface MarketProductSignal {
  name: string;
  category: string;
  /** Average units per selling peer, scaled to the 30-day analysis window. */
  estimatedUnits: number;
  merchantsObserved: number;
  demandScore: number;
  yourUnits: number;
  opportunityScore: number;
  signal: "strong-demand" | "understocked" | "gap" | "normal";
  /** Median LIST price among peers (not realised price). */
  areaMedianPrice: number | null;
  yourPrice: number | null;
  priceDeltaPercent: number | null;
}

export interface LoyaltyProductSignal {
  name: string;
  category: string;
  estimatedUnits: number;
  merchantsObserved: number;
}

export interface CategoryDemand {
  category: string;
  areaShare: number;
  yourShare: number;
  gap: number; // percentage points: areaShare - yourShare
  merchantsObserved: number;
}

export interface AreaRetention {
  available: boolean;
  peersWithCustomers: number;
  customersObserved: number;
  areaRepeatRate: number | null; // % of customers with 2+ recorded visits
  areaActiveRate: number | null; // % bought in last 30 days
  areaChurnRate: number | null; // % with no purchase for 60+ days
  yourRepeatRate: number | null;
  yourActiveRate: number | null;
  yourChurnRate: number | null;
  note: string;
}

export interface MarketIntelligence {
  available: boolean;
  scope: MarketScope;
  scopeLabel: string;
  county: string | null;
  city: string | null;
  businessType: string;
  cohortMerchants: number;
  qualifiedMerchants: number;
  cohortThreshold: number;
  revenueIndex: number | null;
  orderIndex: number | null;
  averageOrderIndex: number | null;
  localTopProducts: MarketProductSignal[];
  loyaltyProducts: LoyaltyProductSignal[];
  categoryDemand: CategoryDemand[];
  retention: AreaRetention;
  marketSummary: string;
  confidence: IntelligenceConfidence;
  dataSource: "lipapoint-network" | "insufficient";
}

/* ---------- Demographics ---------- */

export type DemographicSegmentId = "children" | "youth" | "working-age" | "adults" | "older";

export interface DemographicSegment {
  id: DemographicSegmentId;
  label: string;
  ageRange: string;
  population: number;
  share: number;
}

export interface BuyingPotentialItem {
  segmentId: DemographicSegmentId;
  segmentLabel: string;
  segmentShare: number;
  category: string;
  affinity: "high" | "medium";
  rationale: string;
  /** Share of YOUR revenue that falls in this category (keyword match), or null if no sales. */
  yourRevenueShare: number | null;
  status: "gap" | "covered" | "unknown";
}

export interface DemographicIntelligence {
  available: boolean;
  scope: MarketScope;
  source: string | null;
  sourceNote: string | null;
  year: number | null;
  geography: string | null;
  confidence: IntelligenceConfidence;
  population: number | null;
  households: number | null;
  averageHouseholdSize: number | null;
  segments: DemographicSegment[];
  /** MODELLED hypotheses — population mix x typical category affinity. Not measured behaviour. */
  buyingPotential: BuyingPotentialItem[];
  methodology: string;
  note: string;
}

/* ---------- Inventory / sales / actions ---------- */

export interface InventoryIntelligence {
  totalTrackedProducts: number;
  lowStockCount: number;
  criticalStockCount: number;
  estimatedStockValue: number;
  fastMovingCount: number;
  deadStockCount: number;
  stockoutRiskCount: number;
}

export interface RestockSuggestion {
  product: string;
  category: string;
  stock: number;
  velocityPerDay: number;
  daysOfCover: number;
  suggestedQty: number;
  targetDays: number;
  urgency: "critical" | "high" | "medium";
}

export interface PricingSignal {
  product: string;
  category: string;
  currentPrice: number;
  cost: number | null;
  marginPercent: number | null;
  areaMedianPrice: number | null;
  priceDeltaPercent: number | null;
  suggestedPrice: number | null;
  basis: "margin" | "area-price";
  message: string;
}

export interface SalesIntelligence {
  currentRevenue: number;
  previousRevenue: number;
  revenueGrowthPercent: number;
  currentOrders: number;
  previousOrders: number;
  orderGrowthPercent: number;
  currentAverageOrder: number;
  previousAverageOrder: number;
  averageOrderGrowthPercent: number;
  grossProfit: number | null;
  grossMarginPercent: number | null;
  /** % of revenue that comes from products with a recorded cost. */
  marginCoveragePercent: number;
  topProducts: ProductIntelligence[];
}

export interface DataQuality {
  costCoveragePercent: number;
  linkedOrdersPercent: number;
  registeredCustomers: number;
  locationSet: boolean;
  notes: string[];
}

export interface AiNarrative {
  summary: string;
  priorities: Array<{ title: string; why: string; action: string }>;
}

export interface BusinessIntelligence {
  tenant: {
    id: string;
    name: string;
    type: string;
    city: string | null;
    county: string | null;
    currency: string;
  };
  period: { days: number; from: string; to: string };
  sales: SalesIntelligence;
  customers: CustomerIntelligence;
  inventory: InventoryIntelligence;
  restock: RestockSuggestion[];
  pricing: PricingSignal[];
  market: MarketIntelligence;
  demographics: DemographicIntelligence;
  insights: IntelligenceInsight[];
  opportunities: Array<{ title: string; description: string; score: number; potential: string }>;
  risks: Array<{ title: string; description: string; severity: IntelligencePriority }>;
  actions: Array<{ priority: number; title: string; reason: string; expectedImpact: string }>;
  dataQuality: DataQuality;
  dataConfidence: IntelligenceConfidence;
  generatedAt: string;
  ai?: { provider: "gemini" | "groq"; tokensUsed?: number; narrative: AiNarrative };
  cached?: boolean;
}