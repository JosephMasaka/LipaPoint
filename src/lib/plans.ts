export interface PlanLimits {
  products: number;
  locations: number;
  staff: number;
  features: string[];
}

export const PLAN_CONFIG: Record<string, PlanLimits> = {
  STARTER: {
    products: 100,
    locations: 1,
    staff: 2,
    features: ["pos", "orders", "tabs", "inventory", "expenses"],
  },
  PROFESSIONAL: {
    products: Infinity,
    locations: 3,
    staff: 10,
    features: ["pos", "orders", "tabs", "inventory", "expenses", "analytics", "stock-records", "daily-summary"],
  },
  ENTERPRISE: {
    products: Infinity,
    locations: Infinity,
    staff: Infinity,
    features: ["pos", "orders", "tabs", "inventory", "expenses", "analytics", "stock-records", "daily-summary", "api-access", "custom-reports"],
  },
};

export const PLAN_PRICES: Record<string, number> = {
  STARTER: 2999,
  PROFESSIONAL: 7999,
  ENTERPRISE: 19999,
};

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_CONFIG[tier] || PLAN_CONFIG.STARTER;
}

export function canAccessFeature(tier: string, feature: string): boolean {
  const limits = getPlanLimits(tier);
  return limits.features.includes(feature);
}

export interface UsageStatus {
  products: { used: number; limit: number; exceeded: boolean };
  locations: { used: number; limit: number; exceeded: boolean };
  staff: { used: number; limit: number; exceeded: boolean };
}

export function checkUsage(
  tier: string,
  counts: { products: number; locations: number; staff: number }
): UsageStatus {
  const limits = getPlanLimits(tier);
  return {
    products: { used: counts.products, limit: limits.products, exceeded: counts.products >= limits.products },
    locations: { used: counts.locations, limit: limits.locations, exceeded: counts.locations >= limits.locations },
    staff: { used: counts.staff, limit: limits.staff, exceeded: counts.staff >= limits.staff },
  };
}
