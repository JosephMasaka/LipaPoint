import { db } from "./db";
import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  MODULE_CORE_FEATURE,
  expandFeatureSet,
  modulesForTier,
} from "./module-registry";
import type { FeatureKey, FeatureSource, ModuleKey } from "./module-registry";
import { grantModule } from "./modules";

/**
 * Sub-feature entitlement engine — server side (sub-feature spec §2/§3).
 *
 * The pure layer (FEATURE_REGISTRY, expandFeatureSet, deriveActiveModules)
 * lives in src/lib/module-registry.ts so Client Components can import it
 * without Prisma in the browser bundle; this module re-exports it and adds
 * the database-backed operations, mirroring src/lib/modules.ts.
 *
 * Every tenant has one TenantFeature row per registry key. Rows carry a
 * `source`:
 *  - "core"   the free floor of a module — always on while the module is
 *             active, never revocable (siblings hard-depend on it);
 *  - "tier"   derived from the subscription, re-synced on every tier change;
 *  - "addon"  explicitly purchased / granted, survives re-syncs;
 *  - "manual" support grant or a user opt-out on the Apps screen, survives
 *             re-syncs.
 *
 * Transitional rule while route guards migrate (spec §4): `isFeatureEnabled`
 * falls back to the tenant's *module* entitlement when no feature row exists
 * yet, so no tenant is locked out by the cutover itself. Grants keep the
 * TenantModule row in sync; revokes never switch a module off (the module
 * gate is the coarser check and must stay a superset until step 3 lands).
 */

export * from "./module-registry";
export type { FeatureKey, FeatureSource, ModuleKey };

/** Registry keys as a Set for membership checks. */
const FEATURE_KEY_SET: ReadonlySet<string> = new Set<string>(FEATURE_KEYS);

export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEY_SET.has(value);
}

export class FeatureNotEnabledError extends Error {
  public readonly status = 403;
  constructor(
    public readonly featureKey: FeatureKey,
    public readonly tenantId: string
  ) {
    super(`Feature "${featureKey}" is not enabled for your plan`);
    this.name = "FeatureNotEnabledError";
  }
}

/** Revoking a feature that an enabled sibling hard-depends on (or a core
 * floor feature) — the API surfaces this as 409, matching the Modules API's
 * conflict behaviour. */
export class FeatureDependencyError extends Error {
  public readonly status = 409;
  constructor(
    public readonly featureKey: FeatureKey,
    public readonly blockers: FeatureKey[],
    reason: string
  ) {
    super(
      blockers.length > 0
        ? `"${featureKey}" is required by ${blockers.join(", ")} — disable those first`
        : reason
    );
    this.name = "FeatureDependencyError";
  }
}

/**
 * Syncs a tenant's tier-sourced feature rows to match their tier, leaving
 * addon/manual grants and opt-outs untouched. Called at tenant creation and
 * on every tier change (src/lib/signup-completion.ts, src/lib/plan-upgrade.ts).
 *
 * Tier scope: a tier grants *every* feature of every module it entitles —
 * exactly the generosity of spec §5's migration, so feature granularity
 * changes nothing about who can access what until the per-tier feature lists
 * (spec §6/§7, build step 7) deliberately narrow it.
 *
 * Core rows are always written with source "core" and track their module's
 * entitlement, so they can never drift from the module they floor.
 */
export async function provisionTenantFeatures(
  tenantId: string,
  tier: string
): Promise<void> {
  const entitledModules = modulesForTier(tier);
  const existing = await db.tenantFeature.findMany({
    where: { tenantId },
    select: {
      id: true,
      featureKey: true,
      enabled: true,
      enabledAt: true,
      source: true,
    },
  });
  const byKey = new Map(existing.map((row) => [row.featureKey, row]));
  const now = new Date();

  const ops = FEATURE_KEYS.map((featureKey) => {
    const def = FEATURE_REGISTRY[featureKey];
    const current = byKey.get(featureKey);

    // Addon/manual rows are explicit business decisions (including the
    // onboarding opt-out for apps the customer didn't pick) — a tier sync
    // must never flip them.
    if (current && current.source !== "tier" && current.source !== "core") {
      return null;
    }

    const enabled = entitledModules.has(def.moduleKey);
    const source: FeatureSource = def.core ? "core" : "tier";

    if (!current) {
      return db.tenantFeature.create({
        data: {
          tenantId,
          moduleKey: def.moduleKey,
          featureKey,
          enabled,
          source,
          planTier: tier,
          enabledAt: enabled ? now : null,
        },
      });
    }

    return db.tenantFeature.update({
      where: { id: current.id },
      data: {
        enabled,
        source,
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
 * Explicitly grants a feature (and its hard dependencies + each touched
 * module's core floor) outside the tier. Also switches the parent module on
 * so the coarser, still-in-use module gates agree with the feature rows.
 */
export async function grantFeature(
  tenantId: string,
  featureKey: FeatureKey,
  source: Extract<FeatureSource, "addon" | "manual"> = "addon"
): Promise<void> {
  const needed = expandFeatureSet([featureKey]);
  const now = new Date();

  await db.$transaction(
    [...needed].map((key) =>
      db.tenantFeature.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey: key } },
        create: {
          tenantId,
          moduleKey: FEATURE_REGISTRY[key].moduleKey,
          featureKey: key,
          enabled: true,
          // Core floors stay "core" — they're free and revocable-by-no-one,
          // and a core row marked "addon" would drop out of the tier re-sync.
          source: key === featureKey ? source : FEATURE_REGISTRY[key].core ? "core" : "addon",
          planTier: "ADDON",
          enabledAt: now,
        },
        update: {
          enabled: true,
          source: key === featureKey ? source : FEATURE_REGISTRY[key].core ? "core" : "addon",
          enabledAt: now,
        },
      })
    )
  );

  // Turn the parent module on only if it isn't already: an existing
  // tier-sourced row must keep its source, or the monthly tier re-sync would
  // stop managing it (grantModule would flip it to "addon").
  const moduleRow = await db.tenantModule.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey: FEATURE_REGISTRY[featureKey].moduleKey } },
    select: { enabled: true },
  });
  if (!moduleRow?.enabled) {
    await grantModule(tenantId, FEATURE_REGISTRY[featureKey].moduleKey, "addon");
  }
}

/**
 * Revokes an addon/manual feature grant. Refuses (409) when an enabled
 * feature hard-depends on it, and always refuses for core features — the
 * free floor is what makes any billable sibling usable (spec §1).
 *
 * Never touches TenantModule: the module gate stays a superset of the
 * feature rows until every route uses requireUserWithFeature (spec §4).
 */
export async function revokeFeature(
  tenantId: string,
  featureKey: FeatureKey
): Promise<void> {
  const def = FEATURE_REGISTRY[featureKey];
  if (def.core) {
    throw new FeatureDependencyError(featureKey, [], `"${featureKey}" is a core feature and can't be disabled`);
  }

  const enabledRows = await db.tenantFeature.findMany({
    where: { tenantId, enabled: true },
    select: { featureKey: true },
  });
  const enabled = new Set(enabledRows.map((row) => row.featureKey));
  const blockers: FeatureKey[] = [...enabled].filter(
    (key): key is FeatureKey =>
      key !== featureKey &&
      isFeatureKey(key) &&
      FEATURE_REGISTRY[key].requires.includes(featureKey)
  );
  if (blockers.length > 0) {
    throw new FeatureDependencyError(featureKey, blockers, `"${featureKey}" is required by ${blockers.join(", ")}`);
  }

  await db.tenantFeature.updateMany({
    where: { tenantId, featureKey, source: { not: "core" } },
    data: { enabled: false, enabledAt: null, source: "manual" },
  });
}

/**
 * Entitlement check for feature surfaces (nav, API routes, reports).
 *
 * Falls back to the tenant's module entitlement when no row exists yet
 * (tenants that predate the feature migration — spec §5 keeps them at full
 * module-level access, so this degrades to the behaviour they have today).
 */
export async function isFeatureEnabled(
  tenantId: string,
  featureKey: FeatureKey
): Promise<boolean> {
  const row = await db.tenantFeature.findUnique({
    where: { tenantId_featureKey: { tenantId, featureKey } },
    select: { enabled: true },
  });
  if (row) return row.enabled;

  const def = FEATURE_REGISTRY[featureKey];
  const moduleRow = await db.tenantModule.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey: def.moduleKey } },
    select: { enabled: true },
  });
  return moduleRow?.enabled ?? false;
}

/** All currently-enabled feature keys for a tenant (nav, Apps tree, reports). */
export async function getEnabledFeatures(
  tenantId: string
): Promise<Set<FeatureKey>> {
  const rows = await db.tenantFeature.findMany({
    where: { tenantId, enabled: true },
    select: { featureKey: true },
  });
  return new Set(
    rows.map((row) => row.featureKey).filter(isFeatureKey)
  );
}

/**
 * Effective enabled features, applying the same transitional fallback as
 * `isFeatureEnabled`: a key with no row yet resolves to its module's state.
 * The sidebar and GET /api/features read this, so a tenant that predates the
 * feature migration sees exactly the nav it sees today — never less.
 */
export async function getEffectiveEnabledFeatures(
  tenantId: string
): Promise<Set<FeatureKey>> {
  const [rows, modules] = await Promise.all([
    db.tenantFeature.findMany({
      where: { tenantId },
      select: { featureKey: true, enabled: true },
    }),
    db.tenantModule.findMany({
      where: { tenantId },
      select: { moduleKey: true, enabled: true },
    }),
  ]);
  const byKey = new Map(rows.map((row) => [row.featureKey, row.enabled]));
  const moduleOn = new Set(modules.filter((m) => m.enabled).map((m) => m.moduleKey));

  const out = new Set<FeatureKey>();
  for (const key of FEATURE_KEYS) {
    const row = byKey.get(key);
    const enabled = row !== undefined ? row : moduleOn.has(FEATURE_REGISTRY[key].moduleKey);
    if (enabled) out.add(key);
  }
  return out;
}

/**
 * Guard for feature-scoped API routes (spec §4): throws
 * FeatureNotEnabledError instead of returning data the tenant's plan
 * doesn't include.
 */
export async function requireFeature(
  tenantId: string,
  featureKey: FeatureKey
): Promise<void> {
  if (!(await isFeatureEnabled(tenantId, featureKey))) {
    throw new FeatureNotEnabledError(featureKey, tenantId);
  }
}

/** Soft-dependency probe (spec §4): true when the optional feature is on —
 * used to decide whether e.g. a supplier invoice posts to the GL or just
 * records a balance. Never throws. */
export async function hasSoftDependency(
  tenantId: string,
  featureKey: FeatureKey
): Promise<boolean> {
  return isFeatureEnabled(tenantId, featureKey);
}

/** Core feature for a module, if it has one (etims doesn't — spec §1). */
export function coreFeatureFor(moduleKey: ModuleKey): FeatureKey | undefined {
  return MODULE_CORE_FEATURE[moduleKey];
}
