/**
 * Spec §10 — demo tenants as a verification matrix for sub-feature granularity.
 *
 * Standalone and idempotent: it never truncates (unlike `prisma/seed.ts`) and
 * only touches the tenants it owns (slugs starting with `demo-`). Re-running
 * re-materialises each tenant's module/feature rows to the canonical matrix
 * below, so drift from manual toggling in the Apps screen is repaired.
 *
 *   npx tsx prisma/seed.demo-tenants.ts           # seed + assert
 *
 * Each tenant asserts its exact `TenantFeature` set at the end (exit 1 on any
 * mismatch), which is what makes this file the spec §10 acceptance test:
 *
 *   demo-pos-retail       POS only, Retail vertical filter
 *   demo-pos-restaurant   POS only, Restaurant vertical filter
 *   demo-pos-barbershop   POS only, Barbershop vertical filter
 *   demo-finance-hr       Finance + Payroll, zero pos/inventory/assets rows
 *                          (incl. payroll WITHOUT attendance/ATS)
 *   demo-assets-only      Assets only — no general-ledger, so depreciation and
 *                          disposal exercise the soft-dependency fallback
 *   demo-unified          All 8 modules, cross-module links end to end
 *   demo-payroll-only     The client-driven case: payroll runs, but
 *                          attendance/leave/loans/ATS are all OFF
 *
 * Every demo owner signs in with password `password123`.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  MODULE_KEYS,
  featuresForCategory,
} from "../src/lib/module-registry";
import type { FeatureKey, ModuleKey } from "../src/lib/module-registry";
import { getBusinessCategory } from "../src/lib/plans";
import { getEffectiveEnabledFeatures } from "../src/lib/features";
import { ensureReportCatalog } from "../src/lib/report-catalog";
import { seedChartOfAccounts } from "../src/lib/coa";

const prisma = new PrismaClient();

type TenantType = "RETAIL" | "SUPERMARKET" | "RESTAURANT" | "BARBERSHOP";

interface DemoDef {
  slug: string;
  name: string;
  type: TenantType;
  tier: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  /** Modules switched on — everything else stays off. */
  modules: ModuleKey[];
  /** The exact enabled feature set this tenant must resolve to. */
  expected: FeatureKey[];
  /** Seed the default chart of accounts (only meaningful with Finance on). */
  coa: boolean;
  proves: string;
}

/** POS + inventory features, filtered to what the vertical is allowed to see. */
function posFeaturesFor(tenantType: TenantType): FeatureKey[] {
  const applicable = new Set(featuresForCategory(getBusinessCategory(tenantType)));
  return FEATURE_KEYS.filter(
    (key) =>
      applicable.has(key) &&
      (FEATURE_REGISTRY[key].moduleKey === "pos" ||
        FEATURE_REGISTRY[key].moduleKey === "inventory")
  );
}

const POS_MODULES: ModuleKey[] = ["pos", "inventory"];

const FINANCE_HR: FeatureKey[] = [
  "general-ledger",
  "bank-reconciliation",
  "credit-debit-notes",
  "financial-statements",
  "employee-records",
  "payroll",
  "leave-management",
];

const ASSETS_ONLY: FeatureKey[] = [
  "asset-register",
  "depreciation",
  "maintenance-tracking",
  "disposal-management",
];

const PAYROLL_ONLY: FeatureKey[] = ["general-ledger", "employee-records", "payroll"];

const DEMOS: DemoDef[] = [
  {
    slug: "demo-pos-retail",
    name: "Demo — POS Retail",
    type: "RETAIL",
    tier: "STARTER",
    modules: POS_MODULES,
    expected: posFeaturesFor("RETAIL"),
    coa: false,
    proves: "Retail vertical, tier ladder visible, no restaurant/barbershop keys",
  },
  {
    slug: "demo-pos-restaurant",
    name: "Demo — POS Restaurant",
    type: "RESTAURANT",
    tier: "PROFESSIONAL",
    modules: POS_MODULES,
    expected: posFeaturesFor("RESTAURANT"),
    coa: false,
    proves: "Restaurant vertical (tables, menu, KDS, ordering) without barbershop keys",
  },
  {
    slug: "demo-pos-barbershop",
    name: "Demo — POS Barbershop",
    type: "BARBERSHOP",
    tier: "PROFESSIONAL",
    modules: POS_MODULES,
    expected: posFeaturesFor("BARBERSHOP"),
    coa: false,
    proves: "Barbershop vertical (appointments, services, queue) without kitchen keys",
  },
  {
    slug: "demo-finance-hr",
    name: "Demo — Finance & HR Only",
    type: "RETAIL",
    tier: "ENTERPRISE",
    modules: ["finance", "payroll"],
    expected: FINANCE_HR,
    coa: true,
    proves:
      "Back office with NO POS/stock: payroll runs without attendance or ATS (the client-driven case)",
  },
  {
    slug: "demo-assets-only",
    name: "Demo — Assets Only",
    type: "RETAIL",
    tier: "ENTERPRISE",
    modules: ["assets"],
    expected: ASSETS_ONLY,
    coa: false,
    proves:
      "No general-ledger row → depreciation/disposal post nothing to the GL (soft-dependency fallback)",
  },
  {
    slug: "demo-unified",
    name: "Demo — Unified ERP",
    type: "SUPERMARKET",
    tier: "ENTERPRISE",
    modules: [...MODULE_KEYS],
    expected: featuresForCategory(getBusinessCategory("SUPERMARKET")),
    coa: true,
    proves: "All 8 modules: a POS sale posts to GL, payroll shows in Finance, assets cross over",
  },
  {
    slug: "demo-payroll-only",
    name: "Demo — Payroll Only",
    type: "RETAIL",
    tier: "ENTERPRISE",
    // payroll's module-level requires finance, so Finance comes along for the
    // GL floor — but NO payroll sub-feature except `payroll` itself is on.
    modules: ["finance", "payroll"],
    expected: PAYROLL_ONLY,
    coa: true,
    proves:
      "Payroll without Attendance/Leave/Loans/ATS — what the client actually asked for",
  },
];

let failures = 0;
function assertOk(ok: boolean, label: string, detail = "") {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("🎯 Seeding spec §10 demo tenants (feature-granularity matrix)...\n");
  const hash = await bcrypt.hash("password123", 10);
  const now = new Date();

  for (const demo of DEMOS) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: demo.slug },
      update: { name: demo.name, type: demo.type, tier: demo.tier, isActive: true },
      create: {
        name: demo.name,
        slug: demo.slug,
        type: demo.type,
        tier: demo.tier,
        email: `owner+${demo.slug}@lipapoint.co.ke`,
        currency: "KES",
        receiptHeader: demo.name.toUpperCase(),
      },
    });

    await prisma.user.upsert({
      where: { email: `owner+${demo.slug}@lipapoint.co.ke` },
      update: { tenantId: tenant.id, role: "OWNER", isActive: true },
      create: {
        email: `owner+${demo.slug}@lipapoint.co.ke`,
        name: `${demo.name} Owner`,
        password: hash,
        role: "OWNER",
        tenantId: tenant.id,
      },
    });

    // Canonical re-materialisation: this tenant's rows are owned by this file.
    await prisma.tenantModule.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenantFeature.deleteMany({ where: { tenantId: tenant.id } });

    await prisma.tenantModule.createMany({
      data: MODULE_KEYS.map((moduleKey) => ({
        tenantId: tenant.id,
        moduleKey,
        enabled: demo.modules.includes(moduleKey),
        planTier: demo.tier,
        source: "tier",
        enabledAt: demo.modules.includes(moduleKey) ? now : null,
      })),
    });

    const enabledSet = new Set<string>(demo.expected);
    await prisma.tenantFeature.createMany({
      data: FEATURE_KEYS.map((featureKey) => {
        const def = FEATURE_REGISTRY[featureKey];
        const enabled = enabledSet.has(featureKey);
        return {
          tenantId: tenant.id,
          moduleKey: def.moduleKey,
          featureKey,
          enabled,
          // Core floors track their module; every billable row is written as
          // "manual" so a later tier re-sync can't reshape the matrix.
          source: def.core ? "core" : "manual",
          planTier: demo.tier,
          enabledAt: enabled ? now : null,
        };
      }),
    });

    if (demo.coa) await seedChartOfAccounts(tenant.id);
    await ensureReportCatalog(tenant.id);

    console.log(
      `  ✓ ${demo.slug} — ${demo.modules.length} modules, ${demo.expected.length} features enabled`
    );
  }

  console.log("\n🔍 Asserting each tenant resolves to its exact feature set...\n");

  for (const demo of DEMOS) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: demo.slug } });
    if (!tenant) {
      assertOk(false, `${demo.slug}: tenant exists`);
      continue;
    }

    const effective = await getEffectiveEnabledFeatures(tenant.id);
    const expected = new Set<string>(demo.expected);
    const missing = [...expected].filter((k) => !effective.has(k as FeatureKey));
    const extra = [...effective].filter((k) => !expected.has(k));

    assertOk(
      missing.length === 0 && extra.length === 0,
      `${demo.slug} → exactly ${demo.expected.length} features`,
      `missing=[${missing.join(",")}] extra=[${extra.join(",")}]`
    );

    // module rows must agree with the matrix (enabled set == demo.modules)
    const moduleRows = await prisma.tenantModule.findMany({
      where: { tenantId: tenant.id, enabled: true },
      select: { moduleKey: true },
    });
    const enabledModules = moduleRows.map((m) => m.moduleKey).sort();
    const wantModules = [...demo.modules].sort();
    assertOk(
      JSON.stringify(enabledModules) === JSON.stringify(wantModules),
      `${demo.slug} → modules [${wantModules.join(",")}]`,
      `got [${enabledModules.join(",")}]`
    );
  }

  // ---- §10's specific claims, stated one by one ----
  console.log("\n📋 Spec §10 claims:\n");
  const bySlug = async (slug: string) => {
    const t = await prisma.tenant.findUnique({ where: { slug } });
    return t ? getEffectiveEnabledFeatures(t.id) : new Set<FeatureKey>();
  };

  const financeHr = await bySlug("demo-finance-hr");
  assertOk(
    ![...financeHr].some((k) => ["pos", "inventory", "assets"].includes(FEATURE_REGISTRY[k].moduleKey)),
    "demo-finance-hr has zero pos/inventory/assets feature rows"
  );
  assertOk(
    financeHr.has("payroll") && financeHr.has("leave-management") && !financeHr.has("attendance") && !financeHr.has("ats-recruitment"),
    "demo-finance-hr runs Payroll WITHOUT Attendance or ATS"
  );

  const assetsOnly = await bySlug("demo-assets-only");
  assertOk(
    !assetsOnly.has("general-ledger"),
    "demo-assets-only has no general-ledger → depreciation/disposal degrade to no-GL posting"
  );

  const payrollOnly = await bySlug("demo-payroll-only");
  assertOk(
    payrollOnly.has("payroll") &&
      !payrollOnly.has("attendance") &&
      !payrollOnly.has("leave-management") &&
      !payrollOnly.has("loans-advances") &&
      !payrollOnly.has("ats-recruitment"),
    "demo-payroll-only: payroll feature only (no attendance/leave/loans/ATS)"
  );

  const unified = await bySlug("demo-unified");
  const allCores = FEATURE_KEYS.filter((k) => FEATURE_REGISTRY[k].core);
  assertOk(
    allCores.every((k) => unified.has(k)),
    "demo-unified has every core feature enabled"
  );

  const retail = await bySlug("demo-pos-retail");
  assertOk(!retail.has("kitchen-display") && !retail.has("appointments"), "demo-pos-retail sees neither Kitchen Display nor Appointments");
  const restaurant = await bySlug("demo-pos-restaurant");
  assertOk(restaurant.has("kitchen-display") && !restaurant.has("appointments"), "demo-pos-restaurant sees Kitchen Display, not Appointments");
  const barber = await bySlug("demo-pos-barbershop");
  assertOk(barber.has("appointments") && !barber.has("kitchen-display"), "demo-pos-barbershop sees Appointments, not Kitchen Display");

  console.log(
    failures === 0
      ? "\nAll §10 demo-tenant assertions passed — sign in as owner+<slug>@lipapoint.co.ke / password123.\n"
      : `\n${failures} assertion(s) FAILED.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());