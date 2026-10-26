/**
 * ERP module registry — pure data and logic, no Prisma.
 *
 * Split out of src/lib/modules.ts so Client Components (register onboarding,
 * the sidebar app switcher, the dashboard first-run tiles) can share the same
 * single source of truth without dragging the database driver into the
 * browser bundle. Server code keeps using src/lib/modules.ts, which
 * re-exports everything from here.
 */

export const MODULE_KEYS = [
  "pos",
  "inventory",
  "finance",
  "payroll",
  "assets",
  "procurement",
  "crm",
  "etims",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleSource = "tier" | "addon" | "manual";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  /** Modules that must be enabled alongside this one. */
  requires: ModuleKey[];
  /** Nav grouping for future UI: commerce modules vs back-office. */
  group: "commerce" | "backoffice";
}

export const MODULE_REGISTRY: Record<ModuleKey, ModuleDefinition> = {
  pos: {
    key: "pos",
    label: "Point of Sale",
    description: "Restaurant/retail POS, orders, tabs, kitchen display",
    requires: [],
    group: "commerce",
  },
  inventory: {
    key: "inventory",
    label: "Inventory & Stock",
    description: "Stock levels, movements, re-order alerts, valuation",
    requires: [],
    group: "commerce",
  },
  crm: {
    key: "crm",
    label: "Customers & Loyalty",
    description: "Customer ledger, statements, loyalty points",
    requires: [],
    group: "commerce",
  },
  finance: {
    key: "finance",
    label: "Finance / Accounting",
    description: "Chart of accounts, general ledger, bank & cash",
    requires: [],
    group: "backoffice",
  },
  procurement: {
    key: "procurement",
    label: "Procurement & Suppliers",
    description: "Purchase orders, goods received, supplier invoices & payments",
    requires: ["finance"],
    group: "backoffice",
  },
  etims: {
    key: "etims",
    label: "eTIMS Tax Compliance",
    description: "KRA OSCU invoice submission and compliance dashboard",
    requires: ["finance"],
    group: "backoffice",
  },
  payroll: {
    key: "payroll",
    label: "Payroll",
    description: "Kenya statutory payroll (PAYE/NSSF/SHIF/Housing Levy)",
    requires: ["finance"],
    group: "backoffice",
  },
  assets: {
    key: "assets",
    label: "Asset Management",
    description: "Fixed asset register, depreciation, maintenance",
    requires: ["finance"],
    group: "backoffice",
  },
};

/**
 * Expands a set of modules with their transitive dependencies, so tier
 * maps and addon grants never have to hand-maintain the closure.
 */
export function expandModuleSet(keys: Iterable<ModuleKey>): Set<ModuleKey> {
  const out = new Set<ModuleKey>();
  const queue = [...keys];
  while (queue.length > 0) {
    const key = queue.pop()!;
    if (out.has(key)) continue;
    out.add(key);
    queue.push(...MODULE_REGISTRY[key].requires);
  }
  return out;
}

/**
 * Which modules each SubscriptionTier includes (tier-sourced only;
 * dependencies are expanded at provisioning time). Spec §7 sketches a
 * four-tier structure as a placeholder; the live billing system has three
 * tiers, so the mapping folds onto those: STARTER = POS-only,
 * PROFESSIONAL = POS + CRM, ENTERPRISE = full ERP. Adjust here (not at
 * call sites) when real tier pricing lands.
 */
export const TIER_MODULES: Record<string, readonly ModuleKey[]> = {
  STARTER: ["pos", "inventory"],
  PROFESSIONAL: ["pos", "inventory", "crm"],
  ENTERPRISE: [
    "pos",
    "inventory",
    "crm",
    "finance",
    "procurement",
    "etims",
    "payroll",
    "assets",
  ],
};

export const TIER_ORDER = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
export type TierKey = (typeof TIER_ORDER)[number];

/** Tier entitlement (expanded with hard dependencies). Pure — usable from
 * server code as the fallback for tenants that predate module
 * provisioning (no TenantModule rows yet). */
export function modulesForTier(tier: string): Set<ModuleKey> {
  return expandModuleSet(TIER_MODULES[tier] ?? TIER_MODULES.STARTER);
}

/** Lowest tier index that includes every given module (or -1 if none does). */
export function minTierForModules(keys: Iterable<ModuleKey>): number {
  const wanted = expandModuleSet(keys);
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const entitled = modulesForTier(TIER_ORDER[i]);
    if ([...wanted].every((k) => entitled.has(k))) return i;
  }
  return -1;
}
