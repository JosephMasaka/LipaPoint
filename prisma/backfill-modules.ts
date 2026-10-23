import { db } from "../src/lib/db";
import { provisionTenantModules } from "../src/lib/modules";
import { seedChartOfAccounts } from "../src/lib/coa";

/**
 * Backfills TenantModule rows for tenants that predate module
 * provisioning (Phase 0 added the table; signups and tier changes
 * provision from then on, but existing tenants never got rows — leaving
 * every ERP API returning 403 for them).
 *
 * Idempotent: provisionTenantModules re-syncs tier-sourced rows and
 * leaves addon/manual grants alone, so this is safe to re-run any time.
 */
async function main() {
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true, tier: true },
    orderBy: { createdAt: "asc" },
  });
  for (const t of tenants) {
    await provisionTenantModules(t.id, t.tier);
    // Same class of gap: the default COA was only ever seeded on new
    // signups, so pre-Phase-1 tenants had nowhere to post journals.
    const accounts = await db.chartOfAccount.count({ where: { tenantId: t.id } });
    if (accounts === 0) {
      await seedChartOfAccounts(t.id);
      console.log(`  ✓ ${t.name} (${t.tier}) — modules + COA`);
    } else {
      console.log(`  ✓ ${t.name} (${t.tier})`);
    }
  }
  const count = await db.tenantModule.count();
  console.log(`\nProvisioned ${tenants.length} tenants — ${count} module rows total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
