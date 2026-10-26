import { db } from "./db";
import { MODULE_KEYS, expandModuleSet, modulesForTier } from "./module-registry";
import type { ModuleKey, ModuleSource } from "./module-registry";

/**
 * ERP module gating (LipaPoint ERP spec §1/§7) — server side.
 *
 * The pure parts (keys, registry, dependency expansion, tier maps) live in
 * src/lib/module-registry.ts so Client Components can import them without
 * pulling Prisma into the browser bundle; this module re-exports them for
 * existing server imports and adds the database-backed operations.
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
 *   (support-granted or a user opt-out on the Apps screen, also survives
 *   re-syncs).
 */

export * from "./module-registry";
export type { ModuleKey, ModuleSource };

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
