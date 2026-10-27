/**
 * Invariant check for the sub-feature layer (sub-feature granularity spec §1).
 *
 * Mirrors the report-engine.*.check.* convention: a standalone script you can
 * run at any time with `npx tsx feature-registry.check.ts`. It cross-checks
 * FEATURE_REGISTRY against the spec's own §1 tables (the authoritative
 * source), plus the structural invariants the rest of the engine relies on.
 *
 * Exit code 0 = all checks pass; 1 = at least one failure (printed).
 */
import { readFileSync } from "node:fs";
import {
  APP_KEYS,
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  MODULE_CORE_FEATURE,
  MODULE_KEYS,
  deriveActiveModules,
  expandFeatureSet,
  featuresForCategory,
  featuresForModule,
} from "./src/lib/module-registry";
import { APPS } from "./src/lib/apps";
import { FEATURE_PRICES } from "./src/lib/plans";
import type { FeatureKey } from "./src/lib/module-registry";

let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ *
 * 1. Parse the spec's §1 tables (authoritative source)
 * ------------------------------------------------------------------ */
interface SpecRow {
  key: string;
  core: boolean;
  module: string;
  requires: string[];
  soft: string[];
  verticals: string;
}

function cellKeys(cell: string): string[] {
  if (/^\s*—\s*$/.test(cell)) return [];
  return [...cell.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
}

function parseSpec(): SpecRow[] {
  const md = readFileSync("lipapoint-subfeature-granularity-spec.md", "utf8");
  const section = md.split("## 1. Full Feature Taxonomy")[1].split("## 2. Data model")[0];
  const rows: SpecRow[] = [];
  let modKey = "";
  for (const line of section.split("\n")) {
    const heading = line.match(/^### .+? `([a-z-]+)` module/);
    if (heading) {
      modKey = heading[1];
      continue;
    }
    if (!modKey || !line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    // Tables have 3 (no soft-deps column), 4, or 5 (verticals) cells.
    if (cells.length < 3) continue;
    const keyMatch = cells[0].match(/^`([a-z0-9-]+)`$/);
    if (!keyMatch) continue;
    const second = cells[1].replace(/\*/g, "").trim();
    // eTIMS rows carry a parenthetical note: "billable *(no core — …)*".
    const isCore = second === "core";
    const isBillable = second.startsWith("billable");
    if (!isCore && !isBillable) continue;
    rows.push({
      key: keyMatch[1],
      core: isCore,
      module: modKey,
      requires: cellKeys(cells[2]),
      soft: cells[3] ? cellKeys(cells[3]) : [],
      verticals: cells[4] ?? "",
    });
  }
  return rows;
}

const spec = parseSpec();
const specKeys = new Set(spec.map((r) => r.key));
const registryKeys = new Set<string>(FEATURE_KEYS);

console.log("\n1. Spec §1 tables ↔ FEATURE_REGISTRY");
check(spec.length > 0, `parsed ${spec.length} spec rows`);
check(
  specKeys.size === registryKeys.size &&
    [...specKeys].every((k) => registryKeys.has(k)),
  `key sets match (${registryKeys.size} in registry)`,
  `spec-only: ${[...specKeys].filter((k) => !registryKeys.has(k)).join(", ") || "—"} / registry-only: ${[...registryKeys].filter((k) => !specKeys.has(k)).join(", ") || "—"}`
);
check(
  Object.keys(FEATURE_REGISTRY).length === FEATURE_KEYS.length,
  "FEATURE_REGISTRY has an entry per FEATURE_KEY"
);

for (const row of spec) {
  const def = FEATURE_REGISTRY[row.key as FeatureKey];
  if (!def) continue;
  const problems: string[] = [];
  if (def.moduleKey !== row.module) problems.push(`module ${def.moduleKey}≠${row.module}`);
  if (def.core !== row.core) problems.push(`core ${def.core}≠${row.core}`);
  const hard = [...def.requires].sort().join(",");
  const specHard = [...row.requires].sort().join(",");
  if (hard !== specHard) problems.push(`requires [${hard}]≠[${specHard}]`);
  const soft = [...(def.softRequires ?? [])].sort().join(",");
  const specSoft = [...row.soft].sort().join(",");
  if (soft !== specSoft) problems.push(`soft [${soft}]≠[${specSoft}]`);
  check(problems.length === 0, `${row.key}`, problems.join("; "));
}

/* ------------------------------------------------------------------ *
 * 2. Counts (spec prose says 41/8/33; its tables sum to 46/7/39 — handoff D8)
 * ------------------------------------------------------------------ */
console.log("\n2. Counts");
const coreCount = FEATURE_KEYS.filter((k) => FEATURE_REGISTRY[k].core).length;
check(FEATURE_KEYS.length === 46, `46 features total (got ${FEATURE_KEYS.length})`);
check(coreCount === 7, `7 core features (got ${coreCount})`);
check(FEATURE_KEYS.length - coreCount === 39, `39 billable features (got ${FEATURE_KEYS.length - coreCount})`);

/* ------------------------------------------------------------------ *
 * 3. Structural invariants
 * ------------------------------------------------------------------ */
console.log("\n3. Structural invariants");
let badRefs = 0;
for (const key of FEATURE_KEYS) {
  const def = FEATURE_REGISTRY[key];
  for (const dep of [...def.requires, ...(def.softRequires ?? [])]) {
    if (!registryKeys.has(dep)) {
      badRefs++;
      console.error(`    ${key} references unknown feature "${dep}"`);
    }
  }
}
check(badRefs === 0, "every requires/softRequires target exists");

let crossModuleHard = 0;
for (const key of FEATURE_KEYS) {
  for (const dep of FEATURE_REGISTRY[key].requires) {
    if (FEATURE_REGISTRY[dep].moduleKey !== FEATURE_REGISTRY[key].moduleKey) {
      crossModuleHard++;
      console.error(`    ${key} → hard dep ${dep} crosses modules`);
    }
  }
}
check(crossModuleHard === 0, "hard dependencies stay inside their own module");

let coreProblems = 0;
for (const moduleKey of MODULE_KEYS) {
  const cores = featuresForModule(moduleKey).filter((k) => FEATURE_REGISTRY[k].core);
  const expected = moduleKey === "etims" ? 0 : 1;
  if (cores.length !== expected) {
    coreProblems++;
    console.error(`    ${moduleKey}: ${cores.length} core feature(s), expected ${expected}`);
  }
  if (MODULE_CORE_FEATURE[moduleKey] !== cores[0]) {
    coreProblems++;
    console.error(`    ${moduleKey}: MODULE_CORE_FEATURE mismatch`);
  }
}
check(coreProblems === 0, "exactly one core feature per module (etims has none)");

let appProblems = 0;
const appsByModule = new Map<string, string>();
for (const app of APPS) for (const m of app.modules) appsByModule.set(m, app.id);
for (const key of FEATURE_KEYS) {
  const def = FEATURE_REGISTRY[key];
  if (!(APP_KEYS as readonly string[]).includes(def.appKey)) {
    appProblems++;
    console.error(`    ${key}: unknown appKey ${def.appKey}`);
    continue;
  }
  if (appsByModule.get(def.moduleKey) !== def.appKey) {
    appProblems++;
    console.error(`    ${key}: appKey ${def.appKey} ≠ apps.ts mapping for ${def.moduleKey}`);
  }
}
check(appProblems === 0, "appKey agrees with apps.ts APPS mapping for every feature");

let moduleCoverage = 0;
for (const moduleKey of MODULE_KEYS) {
  if (featuresForModule(moduleKey).length === 0) {
    moduleCoverage++;
    console.error(`    ${moduleKey} has no features`);
  }
}
check(moduleCoverage === 0, "every module has at least one feature");

/* ------------------------------------------------------------------ *
 * 4. Dependency expansion
 * ------------------------------------------------------------------ */
console.log("\n4. expandFeatureSet");
function expand(keys: FeatureKey[]): string {
  return [...expandFeatureSet(keys)].sort().join(",");
}
check(
  expand(["kitchen-display"]) === ["core-till", "kitchen-display", "menu-management"].sort().join(","),
  "kitchen-display pulls menu-management + core-till",
  `got ${expand(["kitchen-display"])}`
);
check(
  expand(["stock-valuation"]) === ["stock-tracking-basic", "stock-records", "stock-valuation"].sort().join(","),
  "stock-valuation pulls stock-records + stock-tracking-basic",
  `got ${expand(["stock-valuation"])}`
);
const deliveryExpanded = [...expandFeatureSet(["delivery-management"] as FeatureKey[])];
check(
  deliveryExpanded.includes("core-till") && !deliveryExpanded.includes("online-ordering"),
  "delivery-management pulls its module's core floor but NOT its soft dep (online-ordering)",
  `got ${deliveryExpanded.join(",")}`
);
const schedExpanded = [...expandFeatureSet(["staff-scheduling"] as FeatureKey[])];
check(
  schedExpanded.includes("core-till") && !schedExpanded.includes("employee-records"),
  "staff-scheduling pulls core-till but NOT its cross-module soft dep (employee-records)",
  `got ${schedExpanded.join(",")}`
);
check(expand(["etims-compliance-dashboard"]) === "etims-compliance-dashboard,etims-submission", "eTIMS chain expands without a core");
check(expand(["payroll"]) === "employee-records,payroll", "payroll pulls its core floor");

/* ------------------------------------------------------------------ *
 * 5. Rollup + vertical filter
 * ------------------------------------------------------------------ */
console.log("\n5. Rollup and vertical filter");
const rollup = deriveActiveModules([
  { moduleKey: "finance", enabled: true, source: "tier" },
  { moduleKey: "finance", enabled: true, source: "core" },
  { moduleKey: "payroll", enabled: true, source: "manual" },
  { moduleKey: "pos", enabled: false, source: "tier" },
  { moduleKey: "nonsense", enabled: true, source: "tier" },
]);
check(
  rollup.size === 2 && rollup.has("finance") && rollup.has("payroll"),
  "rollup: active = ≥1 enabled non-core row, unknown keys ignored",
  `got ${[...rollup].join(",")}`
);

const barber = new Set(featuresForCategory("BARBERSHOP_SALON"));
const restaurant = new Set(featuresForCategory("RESTAURANT_HOSPITALITY"));
const retail = new Set(featuresForCategory("RETAIL_GENERAL"));
check(!barber.has("kitchen-display") && barber.has("appointments"), "barbershop sees appointments, never Kitchen Display");
check(restaurant.has("kitchen-display") && !restaurant.has("appointments"), "restaurant sees Kitchen Display, never appointments");
check(!retail.has("appointments") && retail.has("core-till"), "retail never sees appointments");

/* Spec §7 cross-check: POS rows whose vertical column is exactly
 * "Restaurant/Bar" or "Barbershop/Salon" must be filtered; "…primarily"
 * rows and "all" stay visible everywhere (documented in the registry). */
console.log("\n6. Spec vertical column ↔ applicableCategories");
const posRows = spec.filter((r) => r.module === "pos");
let vertProblems = 0;
for (const row of posRows) {
  const v = row.verticals.toLowerCase();
  // "…primarily" rows are intentionally visible everywhere (registry doc).
  if (v.includes("primarily")) continue;
  const cats = FEATURE_REGISTRY[row.key as FeatureKey].applicableCategories;
  if (v.startsWith("restaurant/bar")) {
    if (!(cats?.length === 1 && cats[0] === "RESTAURANT_HOSPITALITY")) {
      vertProblems++;
      console.error(`    ${row.key}: spec says Restaurant/Bar, registry has ${JSON.stringify(cats)}`);
    }
  } else if (v.startsWith("barbershop/salon")) {
    if (!(cats?.length === 1 && cats[0] === "BARBERSHOP_SALON")) {
      vertProblems++;
      console.error(`    ${row.key}: spec says Barbershop/Salon, registry has ${JSON.stringify(cats)}`);
    }
  } else if (v.startsWith("all")) {
    if (cats) {
      vertProblems++;
      console.error(`    ${row.key}: spec says all verticals, registry restricts to ${JSON.stringify(cats)}`);
    }
  }
  // "…primarily" rows intentionally unset — no check
}
check(vertProblems === 0, "vertical filtering matches the spec's vertical column");

/* ------------------------------------------------------------------ *
 * 7. Spec §6 price table ↔ plans.ts FEATURE_PRICES (step 7 invariant)
 * ------------------------------------------------------------------ */
console.log("\n7. Spec §6 à la carte prices ↔ plans.ts FEATURE_PRICES");
const priceMd = readFileSync("lipapoint-subfeature-granularity-spec.md", "utf8");
const priceSection = priceMd.split("## 6. Pricing")[1].split("## 7. Vertical")[0];
const specPrices = new Map<string, number | "included">();
for (const line of priceSection.split("\n")) {
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  for (let i = 0; i + 1 < cells.length; i++) {
    const key = cells[i].match(/^`([a-z0-9-]+)`$/)?.[1];
    if (!key) continue;
    if (/included free/i.test(cells[i + 1])) {
      specPrices.set(key, "included");
      continue;
    }
    const amount = cells[i + 1].match(/KES\s*([\d,]+)/);
    if (amount) specPrices.set(key, Number(amount[1].replace(/,/g, "")));
  }
}
// general-ledger is priced in §6's table, but it is a CORE feature and §6's
// own closing rule ("core features are never priced") wins — handoff D9.
specPrices.delete("general-ledger");

let priceProblems = 0;
for (const [key, expected] of specPrices) {
  const price = FEATURE_PRICES[key as FeatureKey];
  if (!price) {
    priceProblems++;
    console.error(`    ${key}: priced in the spec, missing from FEATURE_PRICES`);
    continue;
  }
  if (expected === "included") {
    if (!price.includedWith) {
      priceProblems++;
      console.error(`    ${key}: spec says "included with…", FEATURE_PRICES has no includedWith`);
    }
  } else if (price.monthly !== expected || price.includedWith) {
    priceProblems++;
    console.error(`    ${key}: spec says KES ${expected}/mo, FEATURE_PRICES says ${price.monthly}`);
  }
}
for (const key of FEATURE_KEYS) {
  const core = FEATURE_REGISTRY[key].core;
  const priced = Boolean(FEATURE_PRICES[key]);
  if (core && priced) {
    priceProblems++;
    console.error(`    ${key}: CORE feature must never be priced`);
  }
  if (!core && !priced) {
    priceProblems++;
    console.error(`    ${key}: billable feature has no à la carte price`);
  }
}
check(
  priceProblems === 0,
  `à la carte prices match spec §6`,
  `${specPrices.size} spec prices ↔ ${Object.keys(FEATURE_PRICES).length} in plans.ts`
);

/* ------------------------------------------------------------------ */
console.log(
  failures === 0
    ? `\nAll checks passed — ${FEATURE_KEYS.length} features across ${MODULE_KEYS.length} modules / ${APPS.length} apps.\n`
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
