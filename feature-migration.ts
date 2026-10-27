/**
 * Spec §5 cutover migration — sub-feature granularity.
 *
 *   for each existing TenantModule row where enabled = true:
 *     grant ALL features under that moduleKey (core + every billable one)
 *     as TenantFeature rows, source = "tier" (core rows source = "core")
 *
 * Deliberately generous: nobody loses access on cutover, and every tenant is
 * fully materialised *before* any route moves from requireUserWithModule to
 * requireUserWithFeature (handoff §4 ordering constraint).
 *
 * Safety rules:
 *  - only INSERTS: an existing TenantFeature row (tier opt-out, addon grant,
 *    support grant) is never overwritten — those are business decisions.
 *  - idempotent: re-running produces zero new rows.
 *  - `--dry-run` prints exactly what would be created and writes nothing.
 *
 * Usage:
 *   npx tsx feature-migration.ts            # migrate + verify
 *   npx tsx feature-migration.ts --dry-run  # report only
 */
import { db } from "./src/lib/db";
import {
  MODULE_KEYS,
  FEATURE_REGISTRY,
  featuresForModule,
} from "./src/lib/module-registry";
import type { ModuleKey } from "./src/lib/module-registry";

const DRY_RUN = process.argv.includes("--dry-run");
const MODULE_KEY_SET = new Set<string>(MODULE_KEYS);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const started = Date.now();

  const [tenantCount, moduleRows, existingFeatures] = await Promise.all([
    db.tenant.count(),
    db.tenantModule.findMany({
      select: {
        tenantId: true,
        moduleKey: true,
        enabled: true,
        planTier: true,
        enabledAt: true,
      },
    }),
    db.tenantFeature.findMany({
      select: { tenantId: true, featureKey: true, enabled: true, source: true },
    }),
  ]);

  const existingByKey = new Map(
    existingFeatures.map((row) => [`${row.tenantId}:${row.featureKey}`, row])
  );
  const existingBySource = existingFeatures.reduce<Record<string, number>>(
    (acc, row) => ((acc[row.source] = (acc[row.source] ?? 0) + 1), acc),
    {}
  );

  const enabledModules = moduleRows.filter((row) => row.enabled);
  const disabledModules = moduleRows.length - enabledModules.length;
  const tenantsWithModules = new Set(moduleRows.map((row) => row.tenantId));
  const tenantsWithoutModules = tenantCount - tenantsWithModules.size;

  const now = new Date();
  const createRows: Array<{
    tenantId: string;
    moduleKey: string;
    featureKey: string;
    enabled: boolean;
    source: string;
    planTier: string;
    enabledAt: Date | null;
  }> = [];
  let skippedExisting = 0;
  let unknownModuleRows = 0;

  for (const mod of enabledModules) {
    if (!MODULE_KEY_SET.has(mod.moduleKey)) {
      unknownModuleRows++;
      continue;
    }
    for (const featureKey of featuresForModule(mod.moduleKey as ModuleKey)) {
      if (existingByKey.has(`${mod.tenantId}:${featureKey}`)) {
        skippedExisting++;
        continue; // never overwrite an existing decision
      }
      createRows.push({
        tenantId: mod.tenantId,
        moduleKey: mod.moduleKey,
        featureKey,
        enabled: true,
        source: FEATURE_REGISTRY[featureKey].core ? "core" : "tier",
        planTier: mod.planTier,
        enabledAt: mod.enabledAt ?? now,
      });
    }
  }

  console.log(`\n=== Spec §5 feature migration ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  console.log(`tenants                 : ${tenantCount}`);
  console.log(`TenantModule rows       : ${moduleRows.length} (${enabledModules.length} enabled, ${disabledModules} disabled)`);
  console.log(`tenants without modules : ${tenantsWithoutModules} (left untouched — see handoff)`);
  if (unknownModuleRows > 0) {
    console.log(`unknown module keys     : ${unknownModuleRows} (skipped)`);
  }
  console.log(`TenantFeature before    : ${existingFeatures.length} rows ${JSON.stringify(existingBySource)}`);
  console.log(`to create               : ${createRows.length} (${skippedExisting} already present, skipped)`);

  const perTenant = new Map<string, number>();
  for (const row of createRows) perTenant.set(row.tenantId, (perTenant.get(row.tenantId) ?? 0) + 1);
  const sample = [...perTenant.entries()].slice(0, 5);
  if (sample.length > 0) {
    console.log(
      `sample tenants          : ${sample
        .map(([id, n]) => `${id.slice(0, 10)}… +${n}`)
        .join(", ")}${perTenant.size > sample.length ? ` …(+${perTenant.size - sample.length} more)` : ""}`
    );
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.\n");
    return;
  }

  for (const batch of chunk(createRows, 500)) {
    await db.tenantFeature.createMany({ data: batch, skipDuplicates: true });
  }

  // ---- verification (spec §5: nobody loses access) ----
  const after = await db.tenantFeature.findMany({
    select: { tenantId: true, featureKey: true, enabled: true, source: true },
  });
  const afterByKey = new Map(after.map((row) => [`${row.tenantId}:${row.featureKey}`, row]));

  const gaps: string[] = [];
  for (const mod of enabledModules) {
    if (!MODULE_KEY_SET.has(mod.moduleKey)) continue;
    for (const featureKey of featuresForModule(mod.moduleKey as ModuleKey)) {
      const row = afterByKey.get(`${mod.tenantId}:${featureKey}`);
      if (!row || !row.enabled) gaps.push(`${mod.tenantId}/${featureKey}`);
    }
  }

  // every pre-existing row must be byte-identical (we only ever insert)
  let mutated = 0;
  for (const [key, before] of existingByKey) {
    const nowRow = afterByKey.get(key);
    if (!nowRow || nowRow.enabled !== before.enabled || nowRow.source !== before.source) mutated++;
  }

  const afterBySource = after.reduce<Record<string, number>>(
    (acc, row) => ((acc[row.source] = (acc[row.source] ?? 0) + 1), acc),
    {}
  );

  console.log(`\nTenantFeature after     : ${after.length} rows ${JSON.stringify(afterBySource)}`);
  console.log(`coverage gaps           : ${gaps.length}${gaps.length ? ` -> ${gaps.slice(0, 10).join(", ")}` : " (every enabled module fully granted)"}`);
  console.log(`pre-existing rows mutated: ${mutated} (must be 0)`);
  console.log(`done in ${Date.now() - started}ms\n`);

  if (gaps.length > 0 || mutated > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());