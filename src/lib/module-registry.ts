/**
 * ERP module registry — pure data and logic, no Prisma.
 *
 * Split out of src/lib/modules.ts so Client Components (register onboarding,
 * the sidebar app switcher, the dashboard first-run tiles) can share the same
 * single source of truth without dragging the database driver into the
 * browser bundle. Server code keeps using src/lib/modules.ts, which
 * re-exports everything from here.
 *
 * This file now also carries the sub-feature layer (sub-feature spec §1/§3):
 * App → Module → Feature, all client-safe. Feature keys are defined in the
 * FEATURE_KEYS/FEATURE_REGISTRY tables below and are cross-checked against
 * the spec's §1 tables by feature-registry.check.ts.
 */

import type { BusinessCategory } from "./plans";

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

/* ------------------------------------------------------------------ *
 * Sub-feature layer (sub-feature granularity spec §1/§3/§7)
 * ------------------------------------------------------------------ */

/** Apps are declared here (not in src/lib/apps.ts) to avoid an import cycle:
 * apps.ts already imports this module. apps.ts re-uses this union as its own
 * `AppId` type so the two can never drift. */
export const APP_KEYS = [
  "pos",
  "crm",
  "finance",
  "payroll",
  "assets",
  "etims",
] as const;
export type AppKey = (typeof APP_KEYS)[number];

/** "core" rows are the free floor of a module; "tier" rows re-sync on tier
 * changes; "addon"/"manual" rows are explicit decisions that survive them. */
export type FeatureSource = "core" | "tier" | "addon" | "manual";

export interface FeatureDefinition {
  key: FeatureKey;
  moduleKey: ModuleKey;
  appKey: AppKey;
  label: string;
  /** Core features are free and auto-granted whenever the module is active. */
  core: boolean;
  /** Hard dependencies — always enabled together (transitively). */
  requires: FeatureKey[];
  /** Soft dependencies — degrade gracefully instead of blocking
   * (e.g. supplier invoices post to the GL when finance is present, and
   * merely record the balance when it isn't). Never expanded automatically. */
  softRequires?: FeatureKey[];
  /** Vertical filter for the Apps picker / marketing (spec §7). Omitted =
   * applicable to every business category. */
  applicableCategories?: readonly BusinessCategory[];
}

/** Every sub-feature key in the system, grouped by module for readability. */
export const FEATURE_KEYS = [
  // payroll module (Payroll App)
  "employee-records",
  "attendance",
  "leave-management",
  "loans-advances",
  "payroll",
  "ats-recruitment",
  // finance module (Finance App)
  "general-ledger",
  "bank-reconciliation",
  "credit-debit-notes",
  "financial-statements",
  // procurement module (Finance App)
  "supplier-management",
  "purchase-orders",
  "supplier-invoicing",
  // assets module (Assets App)
  "asset-register",
  "depreciation",
  "maintenance-tracking",
  "disposal-management",
  // etims module (eTIMS App)
  "etims-submission",
  "etims-compliance-dashboard",
  // crm module (CRM App)
  "customer-records",
  "customer-statements",
  "withholding-tax-tracking",
  "loyalty-program",
  // pos module (Point of Sale App)
  "core-till",
  "price-override",
  "discounts-coupons",
  "multi-till-cashier",
  "barcode-scanning",
  "table-management",
  "menu-management",
  "kitchen-display",
  "online-ordering",
  "delivery-management",
  "appointments",
  "service-catalog",
  "queue-management",
  "staff-scheduling",
  "loyalty-program-pos",
  "offline-mode",
  // inventory module (Point of Sale App)
  "stock-tracking-basic",
  "stock-records",
  "reorder-alerts",
  "stock-valuation",
  "multi-location-transfers",
  "expiry-tracking",
  "physical-stock-take",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * The single source of truth for sub-features (spec §1 — 46 entries:
 * 7 core + 39 billable; the spec's prose "41 / 8 / 33" total is a miscount,
 * its own per-module tables sum to this — see handoff D8).
 *
 * Vertical filtering uses the spec's §7 rule — only where the spec is
 * explicit (restaurant-only and barbershop-only POS capabilities) do we set
 * `applicableCategories`; "primarily <vertical>" rows stay visible to all so
 * no tenant silently loses a feature it has today.
 */
export const FEATURE_REGISTRY: Record<FeatureKey, FeatureDefinition> = {
  /* payroll module */
  "employee-records": {
    key: "employee-records", moduleKey: "payroll", appKey: "payroll",
    label: "Employee Records", core: true, requires: [],
  },
  attendance: {
    key: "attendance", moduleKey: "payroll", appKey: "payroll",
    label: "Attendance", core: false, requires: ["employee-records"],
  },
  "leave-management": {
    key: "leave-management", moduleKey: "payroll", appKey: "payroll",
    label: "Leave Management", core: false, requires: ["employee-records"],
  },
  "loans-advances": {
    key: "loans-advances", moduleKey: "payroll", appKey: "payroll",
    label: "Staff Loans & Advances", core: false, requires: ["employee-records"],
  },
  payroll: {
    key: "payroll", moduleKey: "payroll", appKey: "payroll",
    label: "Payroll Runs", core: false, requires: ["employee-records"],
  },
  "ats-recruitment": {
    key: "ats-recruitment", moduleKey: "payroll", appKey: "payroll",
    label: "Recruitment (ATS)", core: false, requires: ["employee-records"],
  },

  /* finance module */
  "general-ledger": {
    key: "general-ledger", moduleKey: "finance", appKey: "finance",
    label: "General Ledger", core: true, requires: [],
  },
  "bank-reconciliation": {
    key: "bank-reconciliation", moduleKey: "finance", appKey: "finance",
    label: "Bank Reconciliation", core: false, requires: ["general-ledger"],
  },
  "credit-debit-notes": {
    key: "credit-debit-notes", moduleKey: "finance", appKey: "finance",
    label: "Credit & Debit Notes", core: false, requires: ["general-ledger"],
  },
  "financial-statements": {
    key: "financial-statements", moduleKey: "finance", appKey: "finance",
    label: "Financial Statements", core: false, requires: ["general-ledger"],
  },

  /* procurement module */
  "supplier-management": {
    key: "supplier-management", moduleKey: "procurement", appKey: "finance",
    label: "Supplier Management", core: true, requires: [],
  },
  "purchase-orders": {
    key: "purchase-orders", moduleKey: "procurement", appKey: "finance",
    label: "Purchase Orders", core: false, requires: ["supplier-management"],
  },
  "supplier-invoicing": {
    key: "supplier-invoicing", moduleKey: "procurement", appKey: "finance",
    label: "Supplier Invoicing", core: false, requires: ["supplier-management"],
    softRequires: ["general-ledger"],
  },

  /* assets module */
  "asset-register": {
    key: "asset-register", moduleKey: "assets", appKey: "assets",
    label: "Asset Register", core: true, requires: [],
  },
  depreciation: {
    key: "depreciation", moduleKey: "assets", appKey: "assets",
    label: "Depreciation", core: false, requires: ["asset-register"],
    softRequires: ["general-ledger"],
  },
  "maintenance-tracking": {
    key: "maintenance-tracking", moduleKey: "assets", appKey: "assets",
    label: "Maintenance Tracking", core: false, requires: ["asset-register"],
  },
  "disposal-management": {
    key: "disposal-management", moduleKey: "assets", appKey: "assets",
    label: "Disposal Management", core: false, requires: ["asset-register"],
    softRequires: ["general-ledger"],
  },

  /* etims module — no core feature by design (spec §1) */
  "etims-submission": {
    key: "etims-submission", moduleKey: "etims", appKey: "etims",
    label: "eTIMS Submission", core: false, requires: [],
  },
  "etims-compliance-dashboard": {
    key: "etims-compliance-dashboard", moduleKey: "etims", appKey: "etims",
    label: "eTIMS Compliance Dashboard", core: false, requires: ["etims-submission"],
  },

  /* crm module */
  "customer-records": {
    key: "customer-records", moduleKey: "crm", appKey: "crm",
    label: "Customer Records", core: true, requires: [],
  },
  "customer-statements": {
    key: "customer-statements", moduleKey: "crm", appKey: "crm",
    label: "Customer Statements", core: false, requires: ["customer-records"],
  },
  "withholding-tax-tracking": {
    key: "withholding-tax-tracking", moduleKey: "crm", appKey: "crm",
    label: "Withholding Tax Tracking", core: false, requires: ["customer-records"],
  },
  "loyalty-program": {
    key: "loyalty-program", moduleKey: "crm", appKey: "crm",
    label: "Loyalty Program", core: false, requires: ["customer-records"],
  },

  /* pos module */
  "core-till": {
    key: "core-till", moduleKey: "pos", appKey: "pos",
    label: "Core Till", core: true, requires: [],
  },
  "price-override": {
    key: "price-override", moduleKey: "pos", appKey: "pos",
    label: "Price Override", core: false, requires: ["core-till"],
  },
  "discounts-coupons": {
    key: "discounts-coupons", moduleKey: "pos", appKey: "pos",
    label: "Discounts & Coupons", core: false, requires: ["core-till"],
  },
  "multi-till-cashier": {
    key: "multi-till-cashier", moduleKey: "pos", appKey: "pos",
    label: "Multi-Till & Cashiers", core: false, requires: ["core-till"],
  },
  "barcode-scanning": {
    key: "barcode-scanning", moduleKey: "pos", appKey: "pos",
    label: "Barcode Scanning", core: false, requires: ["core-till"],
  },
  "table-management": {
    key: "table-management", moduleKey: "pos", appKey: "pos",
    label: "Table Management", core: false, requires: ["core-till"],
    applicableCategories: ["RESTAURANT_HOSPITALITY"],
  },
  "menu-management": {
    key: "menu-management", moduleKey: "pos", appKey: "pos",
    label: "Menu Management", core: false, requires: ["core-till"],
    applicableCategories: ["RESTAURANT_HOSPITALITY"],
  },
  "kitchen-display": {
    key: "kitchen-display", moduleKey: "pos", appKey: "pos",
    label: "Kitchen Display (KDS)", core: false, requires: ["menu-management"],
    applicableCategories: ["RESTAURANT_HOSPITALITY"],
  },
  "online-ordering": {
    key: "online-ordering", moduleKey: "pos", appKey: "pos",
    label: "Online Ordering", core: false, requires: ["menu-management"],
    applicableCategories: ["RESTAURANT_HOSPITALITY"],
  },
  "delivery-management": {
    key: "delivery-management", moduleKey: "pos", appKey: "pos",
    label: "Delivery Management", core: false, requires: [],
    softRequires: ["online-ordering"],
    applicableCategories: ["RESTAURANT_HOSPITALITY"],
  },
  appointments: {
    key: "appointments", moduleKey: "pos", appKey: "pos",
    label: "Appointment Booking", core: false, requires: ["core-till"],
    applicableCategories: ["BARBERSHOP_SALON"],
  },
  "service-catalog": {
    key: "service-catalog", moduleKey: "pos", appKey: "pos",
    label: "Service Catalog", core: false, requires: ["core-till"],
    applicableCategories: ["BARBERSHOP_SALON"],
  },
  "queue-management": {
    key: "queue-management", moduleKey: "pos", appKey: "pos",
    label: "Queue Management", core: false, requires: [],
    softRequires: ["appointments"],
    applicableCategories: ["BARBERSHOP_SALON"],
  },
  "staff-scheduling": {
    key: "staff-scheduling", moduleKey: "pos", appKey: "pos",
    label: "Staff Scheduling", core: false, requires: [],
    softRequires: ["employee-records"],
  },
  "loyalty-program-pos": {
    key: "loyalty-program-pos", moduleKey: "pos", appKey: "pos",
    label: "Till Loyalty Redemption", core: false, requires: [],
    softRequires: ["loyalty-program"],
  },
  "offline-mode": {
    key: "offline-mode", moduleKey: "pos", appKey: "pos",
    label: "Offline Mode", core: false, requires: ["core-till"],
  },

  /* inventory module */
  "stock-tracking-basic": {
    key: "stock-tracking-basic", moduleKey: "inventory", appKey: "pos",
    label: "Stock Tracking", core: true, requires: [],
  },
  "stock-records": {
    key: "stock-records", moduleKey: "inventory", appKey: "pos",
    label: "Stock Records", core: false, requires: ["stock-tracking-basic"],
  },
  "reorder-alerts": {
    key: "reorder-alerts", moduleKey: "inventory", appKey: "pos",
    label: "Re-order Alerts", core: false, requires: ["stock-tracking-basic"],
  },
  "stock-valuation": {
    key: "stock-valuation", moduleKey: "inventory", appKey: "pos",
    label: "Stock Valuation", core: false, requires: ["stock-records"],
    softRequires: ["general-ledger"],
  },
  "multi-location-transfers": {
    key: "multi-location-transfers", moduleKey: "inventory", appKey: "pos",
    label: "Multi-Location Transfers", core: false, requires: ["stock-records"],
  },
  "expiry-tracking": {
    key: "expiry-tracking", moduleKey: "inventory", appKey: "pos",
    label: "Expiry Tracking", core: false, requires: ["stock-tracking-basic"],
  },
  "physical-stock-take": {
    key: "physical-stock-take", moduleKey: "inventory", appKey: "pos",
    label: "Physical Stock-Take", core: false, requires: ["stock-records"],
  },
};

/** The one free feature per module (etims has none — spec §1). */
export const MODULE_CORE_FEATURE: Partial<Record<ModuleKey, FeatureKey>> = {
  pos: "core-till",
  inventory: "stock-tracking-basic",
  finance: "general-ledger",
  procurement: "supplier-management",
  assets: "asset-register",
  crm: "customer-records",
  payroll: "employee-records",
};

/** All features belonging to one module, in registry order. */
export function featuresForModule(moduleKey: ModuleKey): FeatureKey[] {
  return FEATURE_KEYS.filter((k) => FEATURE_REGISTRY[k].moduleKey === moduleKey);
}

/**
 * Transitive closure over *hard* dependencies, auto-including each touched
 * module's core feature (you can't run Payroll with zero employee records,
 * or sell with zero stock tracking). Soft dependencies are never expanded —
 * they degrade instead of blocking (spec §1/§3).
 */
export function expandFeatureSet(keys: Iterable<FeatureKey>): Set<FeatureKey> {
  const out = new Set<FeatureKey>();
  const queue = [...keys];
  while (queue.length > 0) {
    const key = queue.pop()!;
    if (out.has(key)) continue;
    const def = FEATURE_REGISTRY[key];
    out.add(key);
    queue.push(...def.requires);
    const core = MODULE_CORE_FEATURE[def.moduleKey];
    if (core) queue.push(core);
  }
  return out;
}

/**
 * Derives which modules are active from feature rows — the rollup that lets
 * TenantModule stop being a stored second source of truth (spec §2):
 * a module is active when it has ≥1 enabled feature that isn't its free
 * core floor (source != "core").
 */
export function deriveActiveModules(
  features: Iterable<{ moduleKey: string; enabled: boolean; source: string }>
): Set<ModuleKey> {
  const active = new Set<ModuleKey>();
  for (const row of features) {
    if (!row.enabled || row.source === "core") continue;
    if ((MODULE_KEYS as readonly string[]).includes(row.moduleKey)) {
      active.add(row.moduleKey as ModuleKey);
    }
  }
  return active;
}

/** Vertical filter for pickers/marketing (spec §7): omitted categories =
 * applicable everywhere. Never forks the registry. */
export function featuresForCategory(
  category: BusinessCategory
): FeatureKey[] {
  return FEATURE_KEYS.filter((k) => {
    const cats = FEATURE_REGISTRY[k].applicableCategories;
    return !cats || cats.includes(category);
  });
}
