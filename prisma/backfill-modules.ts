import { db } from "../src/lib/db";
import { provisionTenantModules } from "../src/lib/modules";
import { seedChartOfAccounts } from "../src/lib/coa";
import { ensureStatutoryRates } from "../src/lib/payroll";

/**
 * Backfills TenantModule rows for tenants that predate module
 * provisioning (Phase 0 added the table; signups and tier changes
 * provision from then on, but existing tenants never got rows — leaving
 * every ERP API returning 403 for them).
 *
 * Also re-seeds the default COA (Phase 3 added payroll accounts) and the
 * statutory rate table. All three are idempotent: provisioning leaves
 * addon/manual grants alone, the COA upsert only fills gaps without
 * overwriting tenant edits, and rates are seeded only when absent.
 */
async function main() {
  await ensureStatutoryRates();
  console.log("  ✓ statutory rate table present");

  const tenants = await db.tenant.findMany({
    select: { id: true, name: true, tier: true },
    orderBy: { createdAt: "asc" },
  });
  for (const t of tenants) {
    await provisionTenantModules(t.id, t.tier);
    // Always run: upsert-only, so it adds accounts introduced by later
    // phases (payroll) to pre-existing tenants without touching edits.
    await seedChartOfAccounts(t.id);
    console.log(`  ✓ ${t.name} (${t.tier}) — modules + COA`);
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
