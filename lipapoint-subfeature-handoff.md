# HANDOFF — LipaPoint Sub-Feature Granularity Build (living tracker)

> **Purpose:** resume point if the agent times out mid-build. This file tracks *progress* and session
> knowledge; it does **not** replace the spec. `lipapoint-subfeature-granularity-spec.md` is the
> authoritative build document — read it first.
>
> **How to use:** update §4 statuses and append to §9 every session. Anything learned that the spec
> does not say goes in §7 (decisions) or §3 (codebase facts).
>
> **Created:** 2026-10-27 · **Spec:** `lipapoint-subfeature-granularity-spec.md` · **Repo HEAD:** `e89c636`

---

## 1. Current status (read this first)

| Item | State |
|---|---|
| Build stage | **Spec §9 steps 1–10 all landed, built and verified** (2026-10-27): engine, migration, all guard swaps, soft-dep degrade, vertical filter, Apps tree UI, feature-keyed nav, `FEATURE_PRICES` + the /pricing à la carte table, the §10 demo-tenant matrix, and the step-8 `offline-mode` entitlement gate. `tsc`, lint (0 errors across 92 files), `next build`, `feature-registry.check.ts`, `offline-entitlement.check.ts`, live HTTP smoke and headless-Chrome screenshots all pass. **Still open: D6 price validation before publishing, §11 marketing copy, optional offline UX polish.** |
| Spec status | Received and read; §9 build order is the plan of record |
| `src/` working tree | **Clean for this feature** — no uncommitted source edits relating to granularity (only the previous session's work, already committed) |
| Repo baseline | HEAD `e89c636` "updated registration/onboarding, added HR and payroll, added finance and procurement, added etims, added asset management, Fixed UI theme issues, other simple mods" (2026-10-27 01:43) |
| Untracked / uncommitted | 7 deleted spec docs (`lipapoint-erp-spec*.md`, `lipapoint-reports-spec.md`, gap analyses, `report-engine.spec-check.md`, `lipapoint-reports-gap-analysis.xlsx`), plus `LipaPoint-Session-Change-Report.docx`, `lipapoint-erp-saas-ui.skill.md`, `lipapoint-subfeature-granularity-spec.md`, this file |
| Prior session record | `LipaPoint-Session-Change-Report.docx` — the Oct 26–27 session (theme fixes, `/api/modules`, Apps screen, reports UI, Odoo onboarding, app switcher, `/industries`) |
| First action on resume | Spec §9 is complete. Remaining: D6 price validation before publishing, §11 marketing/pricing copy, and (optional) offline queue UX polish |

### Extra requirements added by the user mid-session (not in the spec)

| ID | Requirement | Where handled |
|---|---|---|
| **R1** | **Maintain the reports already in the app** and map each one to an appropriate sub-feature / module. Nothing may disappear or stop running for tenants that can run it today. | §5 (full 59-row mapping) |
| **R2** | **Maintain the payment integration in POS / Settings.** No payment flow may regress during the granularity migration. | §6 (inventory + rules) |

These are *constraints on* the spec build, not separate projects: every step in §4 must satisfy R1 and R2.

---

## 2. What the spec asks for (one-paragraph digest)

Three layers: **App** (`src/lib/apps.ts`, 6 apps) → **Module** (entitlement key, 8 keys) → **Feature**
(sub-capability, **41 total = 8 core (free, auto-granted) + 33 billable**). New `TenantFeature` table
(`@@unique([tenantId, featureKey])`) becomes the stored entitlement; `TenantModule` becomes a *derived
rollup* computed from it, never a parallel table. Engine lives client-safe in
`src/lib/module-registry.ts`. Migration is deliberately generous: every enabled `TenantModule` row
grants **all** of its features as `source: "tier"`, so nobody loses access on cutover. Route guards
swap from `requireUserWithModule(...)` to `requireUserWithFeature(...)` per endpoint (§4 of spec),
Payroll/HR first. Soft dependencies (`general-ledger` posting, `loyalty-program`, `employee-records`)
degrade instead of blocking.

---

## 3. Verified codebase anchors (paths that exist right now)

Checked against the working tree on 2026-10-27. Use these; do not re-derive them.

| Path | What's there |
|---|---|
| `src/lib/module-registry.ts` | Client-safe module layer: `MODULE_KEYS`, `ModuleKey`, `ModuleSource`, `MODULE_REGISTRY`, `expandModuleSet()`, `TIER_MODULES`, `TIER_ORDER`, `modulesForTier()`, `minTierForModules()`. **This is where `FEATURE_REGISTRY` goes.** |
| `src/lib/modules.ts` | Server half: re-exports the registry + Prisma-backed `grantModule`/`revokeModule`/`provisionTenantModules`/`requireModule`, `ModuleNotEnabledError` |
| `src/lib/apps.ts` | `APPS` (6): `pos`(pos,inventory), `crm`(crm), `finance`(finance,procurement), `payroll`(payroll), `assets`(assets), `etims`(etims); `AppDefinition`, `APP_IDS`, `getApp()` |
| `src/lib/api-guards.ts:24` | `requireUserWithModule(moduleKey?)` — **session-only when called with no argument** (that is how reports are guarded today). `routeError`, `parseBody`, `pagination` also live here. `requireUserWithFeature` joins this file per spec §3. |
| `src/lib/plans.ts` | **The real pricing file.** `VERTICAL_PLANS` (category × tier → `limits.features: string[]` + pricing), `REPORT_GROUP_FEATURES`, `FEATURE_DISPLAY`, `TENANT_TYPE_TO_CATEGORY`, `getBusinessCategory()`, `canAccessFeature()`, `getPlanPricing()` |
| `src/app/api/modules/route.ts` | `GET`/`POST` module admin API (OWNER/ADMIN, 401/403/400/409 semantics) — the pattern `src/app/api/features/route.ts` now mirrors (`GET` = session-only App→Module→Feature tree, vertically filtered; `POST { featureKey, action }` = OWNER/ADMIN grant/revoke, 400/403/409) |
| `src/app/(dashboard)/[tenant]/dashboard/modules/page.tsx` | Odoo-style Apps screen (flat module rows today; §8 of spec turns it into App → Module → Feature tree) |
| `src/components/sidebar.tsx` | Unified app switcher with locked "Add" rows; §8 switches nav items to `feature:` keys |
| `prisma/schema.prisma:621` | `model TenantModule` (source: tier/addon/manual, opt-out survives re-sync). `PendingSignup.selectedApps` also here. |
| `prisma/seed.reports.ts:4` | `CATALOG` — **59 report definitions**, each `{ key, name, module, category, description, parameters, columns }`; `buildReportDefinitions()` at line 979 |
| `src/lib/report-catalog.ts` | `ensureReportCatalog(tenantId)` — idempotent provisioning, called at signup |
| `src/app/api/reports/route.ts:17`, `src/app/api/reports/[key]/route.ts:22` | Both call `requireUserWithModule()` **with no module argument → session-only, no entitlement gate** |
| `src/app/(dashboard)/[tenant]/reports/page.tsx` | Groups the catalog by `section` (search, date presets, stat tiles, CSV/Print) |

### Discrepancies the spec has against reality

1. **`src/lib/pricing-config.ts` does not exist.** Spec §3/§6/§11 reference it repeatedly — the real
   file is **`src/lib/plans.ts`** (`VERTICAL_PLANS`). Re-point every `pricing-config.ts` mention there
   before doing spec step 7.
2. **CRM discrepancy (spec §0)** — skill file lists 5 apps, code ships 6 (`crm`). **RESOLVED (D1):
   CRM stays the 6th app**; CRM feature rows are built under it as spec'd.
3. Spec §1 numbers: 41 features. **Actual registry ships 46** (7 core + 39 billable; eTIMS has no
   core feature) — see D8. `feature-registry.check.ts` asserts the real counts, not the spec's 41.

---

## 4. Build tracker (mirrors spec §9 — update Status as you go)

| # | Step (spec §9) | Status | Notes / files touched |
|---|---|---|---|
| 1 | `FEATURE_REGISTRY` (46 keys) + `TenantFeature` model + engine functions (spec §2–§3) | **Done** | `prisma/schema.prisma` (`TenantFeature` + `Tenant` relation), `src/lib/module-registry.ts` (registry/`FeatureKey`/`expandFeatureSet`), `src/lib/features.ts` (provision/grant/revoke/isEnabled/require), `src/lib/api-guards.ts` (`requireUserWithFeature`), wired in `signup-completion.ts` + `plan-upgrade.ts`, invariant check in `feature-registry.check.ts` |
| 2 | Migration script (spec §5) — all features of enabled modules → `source: "tier"`, spot-check before/after | **Done — RUN** | `feature-migration.ts` (root, `--dry-run` supported). Ran on dev DB: 10 tenants, 38 enabled modules → **300 rows created (36 `core` + 264 `tier`)**, 0 coverage gaps, 0 pre-existing rows mutated, re-run creates 0 (idempotent) |
| 3 | Route guard swap (spec §4), **Payroll/HR first** (client-driven urgency) | **Done — all groups** | 13 HR/payroll files first, then the remaining 41 module-guard sites (finance, bank, credit/debit, procurement, assets, eTIMS) and 61 session-only POS/CRM/inventory sites → `requireUserWithFeature` per spec §4. **0 `requireUserWithModule("…")` call sites remain**; only the 2 session-only report guards (D2) and the payment routes (R2) keep the coarser style |
| 4 | Soft-dependency inline checks (`supplier-invoicing`, `depreciation`, `disposal-management`, `stock-valuation` → `general-ledger`; `staff-scheduling` → `employee-records`; `loyalty-program-pos` → `loyalty-program`) | **Done (GL paths); others N/A today** | `src/lib/procurement.ts` (invoice + payment) and `src/lib/assets.ts` (depreciation run + disposal) now post to the GL only when `general-ledger` is effective — the record still lands with `journalEntryId: null`. `stock-valuation`, `staff-scheduling`, `loyalty-program-pos` have **no GL-posting code path yet**, so there is nothing to degrade — revisit when those features get built |
| 5 | Vertical filtering (spec §7) wired into picker + pricing | **Done** | `GET /api/features` filters with `featuresForCategory(getBusinessCategory(tenant.type))` — verified live: a BAR tenant sees 43/46 features, Restaurant sees `kitchen-display`; demo tenants prove Retail 15 / Restaurant 20 / Barbershop 18 POS+inventory features |
| 6 | Apps screen tree UI + sidebar nav (spec §8) | **Done** | `dashboard/modules/page.tsx` rebuilt as App → Module → Feature cards (core = locked "Free", billable = checkboxes); new `src/app/api/features/route.ts` (GET tree session-only, POST grant/revoke OWNER/ADMIN); `sidebar.tsx` nav items now carry `featureKey` (28 items) and the layout passes the effective enabled-feature set |
| 7 | À la carte pricing wired into `plans.ts` (spec §6; **file name corrected — see §3**) | **Done** | `FEATURE_PRICES` + `getFeaturePrice()` + `formatFeaturePrice()` in `src/lib/plans.ts` — all 39 billable keys priced (loyalty-program-pos = `includedWith`), core keys never priced. Invariant-checked against the spec's §6 table by `feature-registry.check.ts` §7. **D6 still open: KES figures are placeholders** |
| 8 | `offline-mode` — separately scoped, do **not** let it block the rest | **Entitlement slice done** | The paid feature is now enforced where it matters: `src/lib/offline-entitlement.ts` (5-min cached probe of `/api/features`, documented fail-open fallbacks) gates `saveOfflineOrder`/`saveOfflineAction` in `src/lib/offline-db.ts` — denial dispatches an event and **throws**, so no caller can show "Saved offline" for a write that never queued, and `OfflineIndicator` explains why on screen. PWAProvider warms the probe on load. Policy covered by `offline-entitlement.check.ts` (13 assertions). Still open: richer offline UX (queue inspector, per-call-site messaging) if product wants it |
| 9 | Resolve CRM discrepancy (spec §0) | **Done (D1)** | CRM stays the 6th app — no code change needed, `apps.ts` already ships it |
| 10 | Rebuild demo tenants against spec §10 matrix, add `demo-payroll-only` | **Done** | `prisma/seed.demo-tenants.ts` (idempotent, never truncates — only touches `demo-*` slugs). 7 tenants seeded with exact `TenantFeature` sets + assertions, all passing: retail 15 / restaurant 20 / barbershop 18, finance-hr 7, assets-only 4, unified 38, payroll-only 3. Sign in `owner+<slug>@lipapoint.co.ke` / `password123` |
| **R1** | **Reports preserved + mapped to features** (§5 below) | **Done — built + verified** | `src/lib/reports/feature-map.ts` (59 keys, D7 code-side map) + gate in `src/app/api/reports/[key]/route.ts`; live-tested, see §5.5 |
| **R2** | **Payment integration preserved (POS/Settings)** (§6 below) | **Verified unchanged** | no payment/settings file touched; live-tested, see §6.3 |

**Ordering constraints that are easy to get wrong:**
- Step 2 (migration) must land **before** step 3 (guard swap), or existing tenants get 403s on day one.
- Steps R1/R2 verification must run **after** step 3 — that is the only point regressions can appear.
- Step 9 (CRM) before any CRM rows in step 1/6.

---

## 5. R1 — Reports: maintain + map to sub-features (spec mapping)

### 5.1 Facts about reports today

- **59 reports** in `CATALOG` (`prisma/seed.reports.ts`), tagged by module: **pos 21, inventory 11,
  finance 9, payroll 4, procurement 4, crm 4, assets 3, etims 2, platform 1**.
- Both API routes are **session-only** (`requireUserWithModule()` with no argument): the catalog list
  and report run are *not* entitlement-gated today. Every tenant sees all 59.
- The Reports UI groups by `section`, not by module.
- `plans.ts` already sells four **report suites** as flat plan strings:
  `REPORT_GROUP_FEATURES = [sales-reports, stock-reports, customer-reports, cashier-reports]`, each
  with a `FEATURE_DISPLAY` blurb. Spec §6 says plan strings must not be renamed — so these suites
  become *unions of feature keys*, not new registry entries.

### 5.2 Mapping rules (how "maintain" is guaranteed)

1. **No report key is deleted or renamed.** `ReportDefinition` rows and `buildReportDefinitions()`
   stay as they are.
2. **Cutover safety:** spec §5's generous migration grants every feature of every enabled module, so
   any report whose data module is enabled keeps working. Any report mapped to a feature in a module
   the tenant never had was *already* returning empty/meaningless data — but the **list entry must
   still be visible or clearly disabled, never silently gone**.
3. **Recommended gating policy** (confirm before coding): keep `GET /api/reports` returning the full
   catalog (session-only, as now) and gate **only** `GET /api/reports/[key]` with the mapped feature,
   returning a friendly 403 ("Enable <feature> to run this report") instead of a bare error. This
   satisfies R1 with the least UI churn.
4. **`platform` module:** `audit-trail` is not a sellable feature — keep it session-only, no
   `FeatureKey`.

### 5.3 Full report → module → feature mapping (drafted 2026-10-27)

Feature keys are from spec §1. ⚑ = needs a product decision before step 3 lands.

**Finance module (9 + 2 stragglers)**

| Report key | Name | Target feature |
|---|---|---|
| `profit-and-loss` | Profit and Loss Statement | `financial-statements` |
| `balance-sheet` | Balance Sheet | `financial-statements` |
| `trial-balance` | Trial Balance | `general-ledger` (core) |
| `gl-journal-register` | General Journal Register | `general-ledger` (core) |
| `cash-bank-statement` | Cash / Bank Statement (Detailed) | `bank-reconciliation` |
| `cash-bank-summary` | Cash / Bank Summary | `bank-reconciliation` |
| `mpesa-card-pdq-report` | M-Pesa / Card / PDQ Report | ⚑ `bank-reconciliation` **or** `core-till` — verify which tables it reads; pure-POS tenants see it today |
| `cheques-received` | Cheques Received Report | ⚑ `bank-reconciliation` (verify data source) |
| `transfer-report` | Transfer Report | ⚑ `bank-reconciliation` (verify data source) |

**Platform (1)**

| `audit-trail` | Audit Trail Report | *no feature — session-only, always available* |

**Payroll module (4)**

| `payroll-run-summary` | Payroll Run Summary | `payroll` |
| `statutory-deductions-summary` | Statutory Deductions (PAYE/NSSF/SHIF/Housing Levy) | `payroll` |
| `payslip-register` | Payslip Register | `payroll` |
| `p9-annual-export` | P9 Annual Export | `payroll` |

**Assets module (3)**

| `asset-register` | Asset Register | `asset-register` (core) |
| `depreciation-schedule` | Depreciation Schedule | `depreciation` |
| `maintenance-cost-report` | Asset Maintenance Cost Report | `maintenance-tracking` |

**eTIMS module (2)**

| `etims-submission-log` | eTIMS Submission Log / Status | `etims-submission` |
| `vat-output-reconciliation` | VAT Output Reconciliation | ⚑ `etims-compliance-dashboard` (or `etims-submission` — dashboard is the compliance view) |

**Procurement module (4)**

| `supplier-statement` | Supplier Statement | `supplier-invoicing` |
| `supplier-unpaid-invoices` | Supplier Unpaid Invoices | `supplier-invoicing` |
| `supplier-invoice-received` | Supplier Invoice Received | `supplier-invoicing` |
| `purchased-by-item` | Purchased-by-Item Report | `purchase-orders` |

**CRM module (4)**

| `customer-statement` | Customer Statement (Detailed & Summary) | `customer-statements` |
| `customer-balance` | Customer Balance (Detailed & Summary) | `customer-statements` |
| `customer-balance-by-department` | Customer Balance by Department | `customer-statements` |
| `withholding-tax-by-customer` | Withholding Tax by Customer | `withholding-tax-tracking` |

**Inventory module (11)**

| `stock-report` | Stock Report (Detailed & Summary) | `stock-records` |
| `stock-by-department` | Stock Report by Department | `stock-records` |
| `stock-received` | Stock Received Report | `stock-records` |
| `items-not-sold` | Items Not Sold Report | `stock-records` |
| `stock-adjustment` | Stock Adjustment Report | `stock-records` |
| `price-change` | Price Change Report | `stock-records` |
| `stock-valuation` | Stock Valuation Report | `stock-valuation` |
| `reorder-points` | Re-order Points Report | `reorder-alerts` |
| `stock-transferred` | Stock Transferred Report | `multi-location-transfers` |
| `stock-expiry` | Stock Expiry Report | `expiry-tracking` |
| `physical-stock-take` | Physical Stock-Take Report | `physical-stock-take` |

**POS module (21)**

| `invoice-report` | Invoice Report | `core-till` (core) |
| `sales-detailed` | Sales Detailed Report | `core-till` |
| `sales-summary` | Sales Summary Report | `core-till` |
| `sales-by-day` / `sales-by-week` / `sales-by-month` / `sales-by-hour` | Sales by Day/Week/Month/Hour | `core-till` |
| `sales-by-item` | Sales by Item per Day | `core-till` |
| `sales-by-customer` | Sales by Customer | `core-till` |
| `sales-by-payment-method` | Sales by Till/M-Pesa/Card/PDQ/Cash | `core-till` |
| `sales-by-tax` | Sales by Tax | `core-till` |
| `sales-return-report` | Sales Return / Credit Sales | `core-till` |
| `unpaid-bills` | Unpaid Bills Report | `core-till` |
| `sales-by-sales-rep`, `sales-by-sales-rep-per-day` | Sales by Sales Rep (per Day) | `core-till` |
| `sales-complementary` | Sales Complementary Report | `core-till` |
| `discount-report` | Discount Report | `discounts-coupons` (billable — STARTER tenants lose it ⚑ acceptable?) |
| `items-sold-out-of-set-price` | Items Sold Out of Set Price | `price-override` (bundled in every tier today per spec §1, so no loss) |
| `cashier-cash-print-report` | Cashier Cash / Prints | ⚑ `core-till` **or** `multi-till-cashier` (plans.ts sells a `cashier-reports` suite) |
| `cashier-shortage-report` | Cashier Shortage / Over-report | ⚑ same as above |
| `cash-collection-from-cashiers` | Cash Collection from Cashiers | ⚑ same as above |

### 5.4 Report-suite → feature union (keeps `plans.ts` strings working)

| Plan string (unchanged) | Union of feature keys it should grant |
|---|---|
| `sales-reports` | the 18 `sales`-category POS reports → gated by `core-till` + `discounts-coupons` + `price-override` |
| `stock-reports` | the 11 inventory reports → `stock-records`, `stock-valuation`, `reorder-alerts`, `multi-location-transfers`, `expiry-tracking`, `physical-stock-take` |
| `customer-reports` | `customer-statements` (+ `withholding-tax-tracking` if WHT report belongs in the suite — ⚑) |
| `cashier-reports` | ⚑ pending the cashier-report decision above; `bank-reconciliation` covers the M-Pesa/Card/PDQ half |

### 5.5 Acceptance tests for R1

- [x] After step 2 (migration), a pre-existing tenant's `GET /api/reports` returns **the same 59 keys** as before — ENTERPRISE tenant returned **59** post-migration (2026-10-27).
- [x] Every report that runs today for a given demo tenant still runs (HTTP 200) after step 3 — spot-checked `profit-and-loss`, `cashier-shortage-report`, `audit-trail` (200) on ENTERPRISE.
- [x] A `payroll`-less tenant sees a clear gated message (not a crash/404): STARTER got `Feature "employee-records" is not enabled for your plan` (403) on `/api/hr/employees` and `/api/payroll/runs`.
- [x] `audit-trail` is reachable (200 for STARTER, the one report its plan flag allows).
- [x] Feature gate itself proven: disabling `multi-till-cashier` on one tenant turned `cashier-shortage-report` into `403 {"error":"Enable \"Multi-Till & Cashiers\" to run this report", "feature": "multi-till-cashier"}`; re-enabling restored 200. (Row was restored — DB unchanged.)
- [ ] Reports UI section grouping and CSV/Print unchanged — **not exercised** (no browser run); code for the list/section grouping is untouched.

---

## 6. R2 — Payment integration: maintain (POS / Settings)

### 6.1 Inventory of what must keep working

| Area | Paths |
|---|---|
| Gateway adapters | `src/lib/payment-gateways/` — `registry.ts` (`getTenantGatewayAdapter`), `daraja.ts` (M-Pesa STK), `palpluss-adapter.ts`, `order-completion.ts`, `types.ts`. `UNIMPLEMENTED = {INTASEND, PESAPAL, KOPOKOPO, FLUTTERWAVE}` **throws deliberately — do not "fix" this into fake support.** |
| Gateway config API | `src/app/api/payment-gateways/route.ts` (GET/POST — `getCurrentUser()` → 401) |
| Business settings API | `src/app/api/settings/route.ts` (GET session-only; PUT session + **OWNER/ADMIN 403**) — carries `mpesaPaybill`, `mpesaTill`, `mpesaAccountName`, `paymentGateways[]` |
| POS payment flow | `src/app/api/pos/payments/initiate/route.ts`, `src/app/api/pos/payments/status/[transactionId]/route.ts` (both `getCurrentUser()` → 401) |
| Billing / upgrades | `src/app/api/settings/billing/*`, `src/app/api/paystack/{subscribe,verify,webhook}`, `src/app/api/palpluss/subscribe` |
| Settings UI | `src/app/(dashboard)/[tenant]/settings/page.tsx` — `GATEWAY_DEFS`, connect modal, M-Pesa fields, `gatewayStatusFor()` |
| Persistence | `TenantPaymentGateway` (`tenantId_provider` unique, `credentialsEnc` encrypted JSON, `isActive`, `merchantRef`) |

### 6.2 Rules for the granularity build

1. **None of these routes currently uses `requireUserWithModule`** — they authenticate with
   `getCurrentUser()` directly. **Leave them that way**, or if a guard is added it must be
   `requireUserWithFeature("core-till")` at most. Payment must never become *less* reachable than it
   is today (R2).
2. **Settings ≠ POS entitlement:** gateway configuration lives in Settings and stays available to
   OWNER/ADMIN regardless of which apps/features the tenant has enabled. A Finance-only tenant must
   still be able to configure Paystack/Daraja for its billing.
3. **Do not reorder or rename** `getTenantGatewayAdapter`, the `UNIMPLEMENTED` throw, or the
   `credentialsEnc` decrypt path while refactoring — a regression here charges real money or leaks
   credentials.
4. Spec §4's POS row says checkout routes move to `core-till` **"with conditional UI/logic branches
   for `price-override`, `discounts-coupons`, etc."** — the payment initiate/status endpoints sit
   inside that group: they must stay behind `core-till` only, never a billable sub-feature.
5. `webhook` routes (`/api/paystack/webhook`) are unauthenticated by design (provider callback) —
   confirm they are excluded from any guard sweep.

### 6.3 Acceptance tests for R2

- [x] `GET /api/settings` → 200 authenticated, 401 without session (verified 2026-10-27); `PUT` → 403 for a non-OWNER/ADMIN role — **PUT not exercised**, code untouched.
- [x] `POST /api/pos/payments/initiate` → 401 without session (verified); no payment file was modified this session, so behaviour with a session is unchanged by construction.
- [ ] Settings page still lists gateway connect/disconnect and the three M-Pesa fields — **not exercised** (no browser run).
- [ ] `getTenantGatewayAdapter("INTASEND")` still throws the "isn't implemented yet" error — file untouched.
- [x] No plaintext credentials in any log/output produced while testing.

---

## 7. Open decisions & blockers

| # | Decision | Owner | Blocking |
|---|---|---|---|
| D1 | CRM: add CRM as a 6th app to the skill's design/demo rules, or fold into Finance (spec §0) | ~~resolved~~ | **RESOLVED 2026-10-27: CRM stays the 6th app**, exactly as `apps.ts` ships it |
| D2 | ⚑ Report gating policy — full catalog always visible + gated run (§5.2 recommendation), or filtered list? | ~~resolved~~ | **RESOLVED 2026-10-27: §5.2 policy adopted** — `GET /api/reports` stays session-only with the full 59-row catalog; only `GET /api/reports/[key]` gets `requireUserWithFeature(<mapped key>)` with a friendly gated message. `audit-trail` stays session-only |
| D3 | ⚑ Cashier + M-Pesa/Card/PDQ reports: `core-till` (free, matches today) vs `bank-reconciliation`/`multi-till-cashier` (sellable) | ~~resolved~~ | **RESOLVED 2026-10-27 (user: "split")** — cashier 3 → `multi-till-cashier`; M-Pesa/Card/PDQ, cheques-received, transfer → `core-till` |
| D4 | ⚑ `discount-report` → `discounts-coupons` means STARTER tenants lose it. Acceptable? | ~~resolved~~ | **RESOLVED 2026-10-27 (user): keep it on `core-till`** — nobody loses the report |
| D5 | Spec's `pricing-config.ts` → real file is `src/lib/plans.ts` (§3 above) | agent | step 7 |
| D6 | À la carte KES prices in spec §6 are placeholders — validate before publishing | product | publishing, not code — **code side done (step 7)** |
| D7 | Whether reports gain a `featureKey` column on `ReportDefinition` (schema change) or a code-side map in `src/lib/reports/` | ~~resolved~~ | **RESOLVED: code-side map** — `src/lib/reports/feature-map.ts`, no schema churn; safe default for unmapped keys is "no gate" (R1) |
| D8 | Spec §1 says 41 features; the shipped `FEATURE_REGISTRY` has **46** (7 core + 39 billable, eTIMS core-less). Registry follows spec §1 semantics — one core floor per module — but the spec's count was stale | agent | none — check script asserts 46/7/39; spec count corrected in §2/§3 above |
| D9 | Spec §6's price table prices `general-ledger` (KES 3,000) even though §6's own closing rule says core features are never priced | agent | **RESOLVED: core rule wins** — `general-ledger` is not priced; `feature-registry.check.ts` §7 asserts the rest of the table matches `FEATURE_PRICES` and that no core key is priced |
| D10 | `demo-payroll-only` in §10 says "Payroll app, `payroll` feature only", but the module registry has `payroll → requires [finance]` and a payroll run posts to the GL | agent | **RESOLVED: tenant gets finance + payroll modules, features = `general-ledger` + `employee-records` + `payroll`** — attendance/leave/loans/ATS still OFF, which is the actual client-driven point; a pure payroll-without-finance tenant would need payroll posting to soft-degrade like procurement/assets (noted, not built) |

---

## 8. Verification checklist (run at every checkpoint)

```bash
npx tsc --noEmit                          # type gate
npm run build                             # production build (clean .next if BUILD_ID missing)
npx next lint --file <changed files>      # lint only the touched surfaces
npx prisma generate                       # after any schema change
# after schema changes also: npx prisma db push  (diff first — additive only, like selectedApps)
```

Runtime smoke (a production server may already hold :3000 — `npm start`; stop it before `npm run dev`):

```bash
# reports must keep returning the same key set
curl -s --cookie jar.txt localhost:3000/api/reports | python -c "import sys,json;print(len(json.load(sys.stdin)['reports']))"
# payment/settings guards must be unchanged
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/settings            # expect 401
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/pos/payments/initiate  # expect 401 (GET/POST as appropriate)
```

Baseline for comparison (2026-10-27, before any build work): **59 reports**, 64
`requireUserWithModule` call sites under `src/app/api/**`, 8 modules, 6 apps, 41 planned features.
Post-build (same day): **0** `requireUserWithModule("…")` call sites, 2 session-only report guards,
46 registry features, 300 `TenantFeature` rows across 10 tenants (36 `core` / 264 `tier`).

---

## 9. Session log (append-only, newest last)

- **2026-10-27** — Handoff created. Spec read; codebase scanned and anchors verified (§3). R1 (reports)
  and R2 (payment) recorded with drafted mappings and rules (§5, §6). No `src/` changes made for this
  feature yet; build stage = NOT STARTED. Discrepancies D1/D5 captured. Prior session's work is
  committed at `e89c636`; change report in `LipaPoint-Session-Change-Report.docx`.
- **2026-10-27 (session 2)** — **Spec step 1 built.** Added `model TenantFeature` + `Tenant.features`
  relation to `prisma/schema.prisma`; `FEATURE_REGISTRY` / `FeatureKey` / `expandFeatureSet()` to
  `src/lib/module-registry.ts`; new `src/lib/features.ts` (provision/grant/revoke/isEnabled/require);
  `requireUserWithFeature()` in `src/lib/api-guards.ts`; provisioning wired into
  `signup-completion.ts` and `plan-upgrade.ts`; `src/lib/apps.ts` extended for the feature layer.
  Added `feature-registry.check.ts` (spec-§1 ↔ registry invariant checker) — all checks pass:
  **46 features / 7 core / 39 billable across 8 modules and 6 apps**.
  Decisions recorded: **D1** CRM stays the 6th app, **D2** reports keep the full catalog with only
  the run endpoint gated, **D8** spec's "41 features" count was stale (46 shipped).
  Verified: `npx prisma validate` + `db push` (in sync) + `generate`, `npx tsc --noEmit` clean,
  `next lint --file` on all six touched files clean, `npx next build` exit 0.
  Not yet touched: soft-dependency inline checks (step 4), vertical filter (5), Apps UI (6), pricing
  (7), demo tenants (10); step 3 still open for finance/assets/procurement/pos/inventory/crm/etims
  route groups (51 module-guard call sites remain). Payment routes (R2) intentionally unchanged.
- **2026-10-27 (session 3)** — **Followups: spec step 2, step 3 (Payroll/HR), R1.**
  1. **Step 2:** new root script `feature-migration.ts` (spec §5, `--dry-run`, verify-after). Ran
     it on the dev DB: 10 tenants / 38 enabled modules → **300 `TenantFeature` rows created**
     (36 `core`, 264 `tier`), **0 coverage gaps, 0 pre-existing rows mutated**; re-run creates 0
     (idempotent).
  2. **Step 3 (Payroll/HR):** 13 files under `src/app/api/hr/**` and `src/app/api/payroll/**`
     swapped `requireUserWithModule("payroll")` → `requireUserWithFeature(...)` per spec §4
     (`employee-records`, `leave-management`, `loans-advances`, `payroll`). Zero `"payroll"`
     module guards left in those trees.
  3. **R1:** new `src/lib/reports/feature-map.ts` (all 59 report keys → feature, per §5.3 + rulings
     D3/D4) and a feature gate on `GET /api/reports/[key]` that answers a friendly 403
     (`Enable "<label>" to run this report`). `GET /api/reports` deliberately untouched (D2).
  Decisions closed: **D3** split (cashier → `multi-till-cashier`, money-in → `core-till`),
  **D4** discount-report → `core-till`, **D7** code-side map.
  Verified — `tsc --noEmit` clean, `next lint` clean on all 15 touched files, `next build` exit 0,
  `feature-registry.check.ts` all green — **plus live HTTP smoke** against `next start`:
  ENTERPRISE `GET /api/reports` = **59**; report runs 200 when enabled, `403 "Enable \"Multi-Till &
  Cashiers\"…"` when the feature row is flipped off (then restored); STARTER `/api/hr/employees`
  and `/api/payroll/runs` = 403 feature message, ENTERPRISE = 200; `/api/settings` 401 anon / 200
  auth; `/api/pos/payments/initiate` 401 anon (R2 unchanged). Server stopped, temp files removed.
- **2026-10-27 (session 4)** — **Followups: remaining guard groups (step 3), soft deps (step 4),
  vertical filter (step 5) + Apps tree & feature-keyed nav (step 6).**
  1. **Step 3 finished:** 41 more module-guard sites (finance/bank/credit-debit/procurement/assets/
     eTIMS) mapped per spec §4 (`general-ledger`, `bank-reconciliation`, `credit-debit-notes`,
     `purchase-orders`, `supplier-invoicing`, `supplier-management`, `asset-register`, `depreciation`,
     `disposal-management`, `maintenance-tracking`, `etims-submission`, `etims-compliance-dashboard`,
     `physical-stock-take`, `multi-location-transfers`), plus 61 session-only POS/CRM/inventory sites
     rewritten to `requireUserWithFeature` (`core-till`, `customer-records`, `stock-tracking-basic`,
     `table-management`, `menu-management`, `kitchen-display`, `queue-management`, `appointments`,
     `service-catalog`, `staff-scheduling`, `delivery-management`, `discounts-coupons`).
     `pos/payments/*` deliberately untouched (R2); reports stay session-only (D2).
  2. **Step 4:** `procurement.ts` (invoice + payment) and `assets.ts` (depreciation + disposal) now
     soft-check `general-ledger` before `postJournalEntry` — degrade = record persists with
     `journalEntryId: null`. The other three soft deps have no GL code path yet (noted in §4).
  3. **Step 5:** vertical filtering lives in `GET /api/features` (read-time filter, registry never
     forked). **Step 6:** new `GET/POST /api/features`; Apps screen rebuilt as App → Module →
     Feature cards; 28 sidebar items now gated by `featureKey`, layout passes the effective set.
  4. **Engine fixes found by testing:** `grantFeature` no longer flips a core sibling's row to
     `addon` source, and only calls `grantModule` when the module is actually off (a tier-sourced
     module keeps its source, so the monthly re-sync still manages it). One affected row
     (`employee-records` on savanna-lounge) was repaired — DB is back at 36 `core` / 264 `tier`.
  Verified — `tsc` clean, lint clean (0 errors across all 84 changed/new TS files),
  `feature-registry.check.ts` green, `next build` exit 0 — **plus live HTTP tests**:
  `GET /api/features` 200 for starter+ent (43/46 features shown to a BAR tenant — barbershop-only
  keys correctly filtered); POST roundtrip revoke→`source: manual`→grant→200; core revoke→409;
  anon POST→401; unknown key→400; grant of a feature in a switched-off module→403;
  every swapped endpoint returns 403-with-feature-name for STARTER and 200 for ENTERPRISE
  (`finance/accounts`, `suppliers`, `purchase-orders`, `bank-accounts`, `credit-notes`,
  `etims/invoices`, `assets`); `/api/customers` now 403 for STARTER (no CRM app — nav hides the
  link too); R2 surface re-checked (settings 401/200, payments initiate 401, reports still 59).
  **Soft-dep integration test:** supplier invoice with `general-ledger` off → created,
  `journalEntryId: null`, 0 new `JournalEntry` rows; on → posts exactly 1 entry; state restored,
  test rows cleaned up. Server stopped, temp files removed.
- **2026-10-27 (session 5)** — **Followups: demo-tenant matrix (step 10), à la carte pricing
  (step 7), visual check of the UI.**
  1. **Step 7:** `FEATURE_PRICES` / `getFeaturePrice()` / `formatFeaturePrice()` added to
     `src/lib/plans.ts` — 39 billable keys priced from spec §6 (`payroll` carries the
     +KES 400/employee component; `loyalty-program-pos` = `includedWith: "loyalty-program"`),
     7 core keys never priced (D9: §6's `general-ledger` price line is a misprint). Existing
     `limits.features` plan strings untouched. New invariant block §7 in
     `feature-registry.check.ts` parses the spec's price table and asserts 1:1 parity.
  2. **Step 10:** `prisma/seed.demo-tenants.ts` — idempotent (no truncate; only `demo-*` slugs),
     writes canonical module rows + all 46 feature rows per tenant (billable rows `source:
     "manual"` so a tier re-sync can't reshape the matrix), seeds COA where Finance is on and the
     report catalog everywhere. Asserts each tenant's exact effective feature set **plus** §10's
     explicit claims — all green on two consecutive runs (15/20/18/7/4/38/3 features).
  3. **Visual check (headless Chrome + CDP):** `shot-apps-payroll-only.png`,
     `shot-apps-pos-retail.png`, `shot-dash-payroll-only.png`, `shot-dash-unified.png` in the repo
     root. Confirmed by eye: App → Module → Feature cards render with locked "Free" cores and
     green billable checkboxes; `0/2 modules · 0/15 features` for switched-off apps with "Turn
     this module on to configure"; STARTER sees "Not in plan" on CRM; sidebar shows Finance but
     **not Banking** for payroll-only (bank-reconciliation off) and locked "Add" rows for every
     app the tenant doesn't run (POS/CRM/Assets/eTIMS on payroll-only; CRM/Finance/HR/Assets/eTIMS
     on pos-retail). Server stopped, temp files removed, screenshots kept for reference.
- **2026-10-27 (session 6)** — **Followups: offline-mode entitlement (step 8), the /pricing à la
  carte table, commit.**
  1. **Step 8 (bounded slice):** new `src/lib/offline-entitlement.ts` — `isOfflineQueueEnabled()`
     caches the tenant's `offline-mode` row (5-min TTL, warmed by PWAProvider on load) with the
     documented fallbacks: fresh cache short-circuits, stale cache re-fetches, unreachable API
     keeps the last known answer, and only a *never-fetched* cache fails open so a first-ever
     offline sale for an entitled tenant still queues. `saveOfflineOrder`/`saveOfflineAction` now
     consult it before touching IndexedDB; a denial dispatches `lipapoint:offline-feature-required`
     and **throws `OfflineModeRequiredError`** — throwing (not returning null) is deliberate,
     because every caller ignores the return value and would otherwise show "Saved offline — will
     sync" for a write that never queued. `OfflineIndicator` renders the explanation. Policy is
     pinned by the new `offline-entitlement.check.ts` (13 assertions, all green).
     Verified live: `demo-pos-retail` has `offline-mode` enabled, `demo-payroll-only` does not.
  2. **§11 pricing surface:** `pricing-client.tsx` gained a "Need just one part of an app?"
     section — 6 app cards listing all 39 billable sub-features with `formatFeaturePrice()`,
     plus the core-is-free footnote. Rendered in the prerendered `/pricing` HTML and screenshot
     (`shot-pricing-alacarte.png`): shows `Payroll Runs KES 2,500/mo + 400/employee`, `Till Loyalty
     Redemption = Included with Loyalty Program`, `Offline Mode KES 2,500/mo`.
  Verified: `tsc` clean, **0 lint errors across all 92 changed/new TS files**, `next build` exit 0,
  `feature-registry.check.ts` + `offline-entitlement.check.ts` green, `/pricing` 200 with the new
  section, `/api/features` entitlement differing correctly per tenant. Server stopped, temp files
  removed; `shot-pricing-alacarte.png` added to the screenshots kept for reference.
