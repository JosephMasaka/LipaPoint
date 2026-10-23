import { db } from "./db";

/**
 * ERP module gating (LipaPoint ERP spec §1/§7).
 *
 * Every tenant has one row per module key in TenantModule. A pure-POS
 * customer never sees Payroll/Assets in their nav because those rows are
 * created disabled and stay that way until their tier entitles them.
 *
 * Scalability notes:
 * - MODULE_REGISTRY is the single place to add a module: key, UI metadata,
 *   and hard dependencies (enabling etims implies finance, etc). Nothing
 *   else needs touching — tier maps, provisioning and checks all resolve
 *   through the registry.
 * - Rows carry a `source`: "tier" (derived from the subscription, re-synced
 *   on every tier change), "addon" (explicitly granted, e.g. payroll as a
 *   per-employee add-on on a lower tier — survives re-syncs), or "manual"
 *   (support-granted, also survives re-syncs).
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

/**
 * Tier entitlement (expanded with hard dependencies). Pure — usable from
 * server code as the fallback for tenants that predate module
 * provisioning (no TenantModule rows yet).
 */
export function modulesForTier(tier: string): Set<ModuleKey> {
  return expandModuleSet(TIER_MODULES[tier] ?? TIER_MODULES.STARTER);
}

/**
 * Syncs a tenant's tier-sourced module rows to match their tier, leaving
 * addon/manual grants untouched. Called at tenant creation and on every
 * tier change (src/lib/signup-completion.ts, src/lib/plan-upgrade.ts).
 * Preserves enabledAt on rows that stay enabled so "since when" survives
 * renewals and re-provisioning.
 */
export async function provisionTenantModules(
  tenantId: string,
  tier: string
): Promise<void> {
  const entitled = modulesForTier(tier);
  const existing = await db.tenantModule.findMany({
    where: { tenantId },
    select: {
      id: true,
      moduleKey: true,
      enabled: true,
      enabledAt: true,
      source: true,
    },
  });
  const byKey = new Map(existing.map((row) => [row.moduleKey, row]));
  const now = new Date();

  const ops = MODULE_KEYS.map((moduleKey) => {
    const current = byKey.get(moduleKey);
    // Addon/manual grants are explicit business decisions — never flip
    // them from a tier sync (a PAYROLL add-on on PROFESSIONAL must survive
    // the monthly renewal re-sync).
    if (current && current.source !== "tier") return null;

    const enabled = entitled.has(moduleKey);

    if (!current) {
      return db.tenantModule.create({
        data: {
          tenantId,
          moduleKey,
          enabled,
          planTier: tier,
          source: "tier",
          enabledAt: enabled ? now : null,
        },
      });
    }

    return db.tenantModule.update({
      where: { id: current.id },
      data: {
        enabled,
        planTier: tier,
        enabledAt:
          enabled && !current.enabled
            ? now
            : current.enabled
              ? current.enabledAt
              : null,
      },
    });
  });

  await db.$transaction(ops.filter((op): op is NonNullable<typeof op> => op !== null));
}

/**
 * Explicitly grants a module outside the tier (paid add-on or support
 * grant). Also enables any dependencies as addon-sourced rows so they
 * survive re-syncs too.
 */
export async function grantModule(
  tenantId: string,
  moduleKey: ModuleKey,
  source: Extract<ModuleSource, "addon" | "manual"> = "addon"
): Promise<void> {
  const needed = expandModuleSet([moduleKey]);
  const now = new Date();

  await db.$transaction(
    [...needed].map((key) =>
      db.tenantModule.upsert({
        where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
        create: {
          tenantId,
          moduleKey: key,
          enabled: true,
          planTier: "ADDON",
          source: key === moduleKey ? source : "addon",
          enabledAt: now,
        },
        update: { enabled: true, source: key === moduleKey ? source : "addon" },
      })
    )
  );
}

/** Revokes an addon/manual grant (tier-sourced modules are tier-controlled). */
export async function revokeModule(
  tenantId: string,
  moduleKey: ModuleKey
): Promise<void> {
  await db.tenantModule.updateMany({
    where: { tenantId, moduleKey, source: { not: "tier" } },
    data: { enabled: false, enabledAt: null },
  });
}

/** Entitlement check for feature surfaces (nav, API routes, reports). */
export async function isModuleEnabled(
  tenantId: string,
  moduleKey: ModuleKey
): Promise<boolean> {
  const row = await db.tenantModule.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
    select: { enabled: true },
  });
  return row?.enabled ?? false;
}

/** All currently-enabled modules for a tenant (e.g. to filter a nav menu). */
export async function getEnabledModules(tenantId: string): Promise<Set<string>> {
  const rows = await db.tenantModule.findMany({
    where: { tenantId, enabled: true },
    select: { moduleKey: true },
  });
  return new Set(rows.map((row) => row.moduleKey));
}

export class ModuleNotEnabledError extends Error {
  constructor(
    public readonly moduleKey: ModuleKey,
    public readonly tenantId: string
  ) {
    super(`Module "${moduleKey}" is not enabled for this tenant`);
    this.name = "ModuleNotEnabledError";
  }
}

/**
 * Guard for module-scoped API routes: throws ModuleNotEnabledError instead
 * of returning data the tenant's plan doesn't include.
 */
export async function requireModule(
  tenantId: string,
  moduleKey: ModuleKey
): Promise<void> {
  if (!(await isModuleEnabled(tenantId, moduleKey))) {
    throw new ModuleNotEnabledError(moduleKey, tenantId);
  }
}
