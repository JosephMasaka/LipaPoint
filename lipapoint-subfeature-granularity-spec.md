# LipaPoint ERP — Sub-Feature Granularity Spec (Consolidated)

**This file supersedes and merges `lipapoint-feature-granularity-spec.md` (HR/Finance/Procurement/Assets) and `lipapoint-pos-granularity-spec.md` (POS/Inventory) into one build-ready spec.** Both of those stay on disk as historical record, but hand Claude CLI this one going forward — it's written against the Apps/Module architecture your Oct 26–27 session actually shipped, not the model either of the two source files assumed at the time they were written.

**Companion file:** `lipapoint-subfeature-handoff.md` — the living progress tracker for building this spec (current status, codebase anchors, the existing-report → feature mapping, payment-integration protection rules, open decisions, session log). Read it alongside this spec; if you time out, it is what the next session resumes from.

**Update:** `lipapoint-erp-saas-ui.skill.md` has now been provided — the §0 mapping below is confirmed against it rather than inferred, and the one real discrepancy it surfaces is called out explicitly.

---

## 0. Terminology and the confirmed App mapping

Three layers:

```
App        — purchasable, user-facing (src/lib/apps.ts)
 └ Module  — internal entitlement key (pos, inventory, finance, payroll, assets, procurement, crm, etims)
    └ Feature — NEW in this spec: sub-capability inside a module
```

The skill file's §4.1 names the Apps explicitly: **POS, Finance & HR** (its own note: *"can also be split into `Finance` and `HR/Payroll` if billing needs it"*), **Asset Management, eTIMS**. The Oct 26–27 change report shows the split already happened in code (`apps.ts` lists Point of Sale, CRM, Finance, Payroll, Assets, eTIMS as six separate Apps), which confirms the mapping this spec already used:

| App | Modules | Reasoning |
|---|---|---|
| Point of Sale | `pos`, `inventory` | Selling without stock tracking isn't a sellable product in any of the three verticals |
| Finance | `finance`, `procurement` | `procurement` already hard-requires `finance`; skill's "Finance & HR" app, split |
| Payroll | `payroll` | Skill's "Finance & HR" app, split — this module already covers HR (employees/leave/loans) + payroll together per the dev-log audit, matching the skill's own "`HR/Payroll`" naming |
| Assets | `assets` | 1:1 — matches skill's "Asset Management" |
| eTIMS | `etims` | 1:1 |
| CRM | `crm` | 1:1 |

**One real discrepancy, not just a naming gap:** the skill file's design direction (§3) explicitly colors and lists **five** modules — "POS, Finance, HR, Assets, eTIMS" — with no CRM in that list, and §4.1's app roster doesn't mention CRM either. The actual shipped code added CRM as a sixth App anyway. This means CRM currently has no design-token color variant, no `/apps/crm` marketing page per the skill's §4.1 pattern, and isn't in the skill's demo-tenant table (§6, reproduced in §10 below). **Resolve this before building the CRM feature tier of this spec** — either formally add CRM as a sixth app to the skill's own design/demo rules, or fold `crm`'s features into the Finance app (where "customer statements" and "withholding tax" arguably belong anyway, alongside the rest of the financial-reporting feature set). This spec's §1 CRM taxonomy stands either way; only its App grouping is in question.

---

## 1. Full Feature Taxonomy (all 8 modules)

Every module gets exactly one **core** feature: free, auto-granted the instant any sibling in that module is purchased, because it's the minimum needed for the sibling to function (you can't run Payroll with zero employee records; you can't sell physical goods with zero stock tracking). Everything else is **billable** and independently purchasable.

### Payroll App → `payroll` module (the client-driven case: Payroll without the rest of HR)

| Feature key | Core/Billable | Hard depends on |
|---|---|---|
| `employee-records` | **core** | — |
| `attendance` | billable | `employee-records` |
| `leave-management` | billable | `employee-records` |
| `loans-advances` | billable | `employee-records` |
| `payroll` | billable | `employee-records` |
| `ats-recruitment` | billable | `employee-records` |

### Finance App → `finance` module

| Feature key | Core/Billable | Hard depends on |
|---|---|---|
| `general-ledger` | **core** | — |
| `bank-reconciliation` | billable | `general-ledger` |
| `credit-debit-notes` | billable | `general-ledger` |
| `financial-statements` | billable | `general-ledger` |

### Finance App → `procurement` module

| Feature key | Core/Billable | Hard depends on | Soft depends on |
|---|---|---|---|
| `supplier-management` | **core** | — | — |
| `purchase-orders` | billable | `supplier-management` | — |
| `supplier-invoicing` | billable | `supplier-management` | `general-ledger` *(posts to GL if Finance's core is active; otherwise just records the invoice/balance)* |

### Assets App → `assets` module

| Feature key | Core/Billable | Hard depends on | Soft depends on |
|---|---|---|---|
| `asset-register` | **core** | — | — |
| `depreciation` | billable | `asset-register` | `general-ledger` |
| `maintenance-tracking` | billable | `asset-register` | — |
| `disposal-management` | billable | `asset-register` | `general-ledger` |

### eTIMS App → `etims` module

| Feature key | Core/Billable | Hard depends on |
|---|---|---|
| `etims-submission` | billable *(no core — this module has no standalone value without submission)* | — |
| `etims-compliance-dashboard` | billable | `etims-submission` |

### CRM App → `crm` module

| Feature key | Core/Billable | Hard depends on |
|---|---|---|
| `customer-records` | **core** | — |
| `customer-statements` | billable | `customer-records` *(the Customer Reports group: statement, balance, balance-by-department)* |
| `withholding-tax-tracking` | billable | `customer-records` |
| `loyalty-program` | billable | `customer-records` *(the points/rewards engine lives here since it's fundamentally customer data; POS's loyalty UI soft-depends on this — see below)* |

### Point of Sale App → `pos` module

| Feature key | Core/Billable | Hard depends on | Soft depends on | Relevant verticals |
|---|---|---|---|---|
| `core-till` | **core** | — | — | all |
| `price-override` | billable | `core-till` | — | all *(the client's original "bargain pricing" requirement — currently bundled free into every tier; this lets it later become a standalone sellable toggle)* |
| `discounts-coupons` | billable | `core-till` | — | all |
| `multi-till-cashier` | billable | `core-till` | — | all |
| `barcode-scanning` | billable | `core-till` | — | Retail primarily |
| `table-management` | billable | `core-till` | — | Restaurant/Bar |
| `menu-management` | billable | `core-till` | — | Restaurant/Bar |
| `kitchen-display` | billable | `menu-management` | — | Restaurant/Bar |
| `online-ordering` | billable | `menu-management` | — | Restaurant/Bar |
| `delivery-management` | billable | — | `online-ordering` | Restaurant/Bar |
| `appointments` | billable | `core-till` | — | Barbershop/Salon |
| `service-catalog` | billable | `core-till` | — | Barbershop/Salon |
| `queue-management` | billable | — | `appointments` | Barbershop/Salon |
| `staff-scheduling` | billable | — | `employee-records` *(cross-module, Payroll App)* | Barbershop/Salon primarily |
| `loyalty-program-pos` | billable | — | `loyalty-program` *(cross-module, CRM App — this is the till-side redemption UI; the ledger lives in CRM)* | all |
| `offline-mode` | billable | `core-till` | — | all *(bigger build, scope separately — see §9)* |

### Point of Sale App → `inventory` module

| Feature key | Core/Billable | Hard depends on | Soft depends on |
|---|---|---|---|
| `stock-tracking-basic` | **core** | — | — |
| `stock-records` | billable | `stock-tracking-basic` | — |
| `reorder-alerts` | billable | `stock-tracking-basic` | — |
| `stock-valuation` | billable | `stock-records` | `general-ledger` |
| `multi-location-transfers` | billable | `stock-records` | — |
| `expiry-tracking` | billable | `stock-tracking-basic` | — |
| `physical-stock-take` | billable | `stock-records` | — |

**Total: 8 core features (free) + 33 billable features = 41 sub-features across 8 modules / 6 Apps.**

---

## 2. Data model

```prisma
model TenantFeature {
  id         String    @id @default(cuid())
  tenantId   String
  moduleKey  String    // "hr" is represented as "payroll" module per §0 — pos | inventory | finance | procurement | assets | etims | crm | payroll
  featureKey String    // see §1 — unique across the whole registry, not just within a module
  enabled    Boolean   @default(false)
  source     String    // "core" | "tier" | "addon" | "manual"
  planTier   String?
  enabledAt  DateTime?
  @@unique([tenantId, featureKey])
  @@index([tenantId, moduleKey])
}
```

`TenantModule` stays as a **derived rollup**, not a second stored entitlement: "is the Finance App active for this tenant" = "does this tenant have ≥1 enabled `TenantFeature` with `moduleKey IN ('finance','procurement')` and `source != 'core'`". Compute it with a query helper; don't maintain a parallel table that can drift from `TenantFeature`.

---

## 3. Engine (`src/lib/module-registry.ts` — client-safe, per the split your last session already did)

- `FEATURE_REGISTRY: Record<FeatureKey, { moduleKey: ModuleKey; appKey: AppKey; label: string; core: boolean; requires: FeatureKey[]; softRequires?: FeatureKey[]; applicableCategories?: BusinessCategory[] }>` — one flat registry, all 41 keys from §1, `appKey` added so the Apps UI can group by App → Module → Feature in one pass without a second lookup table.
- `expandFeatureSet(keys: FeatureKey[])` — transitive closure over `requires` (hard deps only); auto-adds each selected feature's module's core feature.
- `TIER_FEATURES: Record<PlanTier, FeatureKey[]>` — per-vertical tier definitions (Starter/Professional/Enterprise × Retail/Restaurant/Barbershop) now list feature keys, reconciled 1:1 against the existing `features` string arrays already in `pricing-config.ts` (§6 below has the mapping — nothing in `pricing-config.ts` gets renamed).
- `provisionTenantFeatures(tenantId, tier, category)` — syncs tier-sourced rows, preserves manual grants/opt-outs exactly like `provisionTenantModules` already does (including the existing "opt-out survives tier re-sync via `source: 'manual'`" behavior your API already verified).
- `grantFeature(tenantId, featureKey, source)` / `revokeFeature(tenantId, featureKey)` — mirror the already-built `grantModule`/`revokeModule`, at feature granularity; `revokeFeature` refuses (409, matching the existing Modules API's conflict behavior) if another enabled feature hard-depends on it.
- `isFeatureEnabled` / `getEnabledFeatures` — direct replacements for the module-level equivalents.
- `requireUserWithFeature(featureKey)` in `src/lib/api-guards.ts`, alongside (not replacing) `requireUserWithModule` — routes not being decomposed this phase keep the coarser guard.

---

## 4. Route guard migration (what changes in code that's already shipped)

| Route group | Current guard | New guard |
|---|---|---|
| `src/app/api/hr/employees/*` | `requireUserWithModule("payroll")` | `requireUserWithFeature("employee-records")` |
| `src/app/api/hr/leave/*` | `requireUserWithModule("payroll")` | `requireUserWithFeature("leave-management")` |
| `src/app/api/hr/loans/*` | `requireUserWithModule("payroll")` | `requireUserWithFeature("loans-advances")` |
| `src/app/api/payroll/*` | `requireUserWithModule("payroll")` | `requireUserWithFeature("payroll")` |
| `src/app/api/finance/accounts`, `/journal` | `requireUserWithModule("finance")` | `requireUserWithFeature("general-ledger")` |
| `src/app/api/bank-accounts/*`, `/bank-transactions/*` | `requireUserWithModule("finance")` | `requireUserWithFeature("bank-reconciliation")` |
| `src/app/api/credit-notes/*`, `/debit-notes/*` | `requireUserWithModule("finance")` | `requireUserWithFeature("credit-debit-notes")` |
| `src/app/api/purchase-orders/*` | `requireUserWithModule("procurement")` | `requireUserWithFeature("purchase-orders")` |
| `src/app/api/supplier-invoices/*` | `requireUserWithModule("procurement")` | `requireUserWithFeature("supplier-invoicing")` + soft-check `general-ledger` before posting (§1 footnote) |
| `src/app/api/assets/route.ts` | `requireUserWithModule("assets")` | `requireUserWithFeature("asset-register")` |
| `src/app/api/assets/depreciation/*` | `requireUserWithModule("assets")` | `requireUserWithFeature("depreciation")` + soft-check `general-ledger` |
| `src/app/api/assets/dispose/*` | `requireUserWithModule("assets")` | `requireUserWithFeature("disposal-management")` + soft-check `general-ledger` |
| POS sale/checkout routes | `requireUserWithModule("pos")` | `requireUserWithFeature("core-till")`, with conditional UI/logic branches for `price-override`, `discounts-coupons`, etc. |
| Inventory stock routes | `requireUserWithModule("inventory")` | `requireUserWithFeature("stock-tracking-basic")`, +`stock-records`/`reorder-alerts`/etc. per endpoint |
| CRM customer routes | `requireUserWithModule("crm")` | `requireUserWithFeature("customer-records")`, +`customer-statements`/`loyalty-program` per endpoint |
| eTIMS routes | `requireUserWithModule("etims")` | `requireUserWithFeature("etims-submission")` / `etims-compliance-dashboard` |

---

## 5. Migration — existing tenants keep everything they have

```
for each existing TenantModule row where enabled = true:
  grant ALL features under that moduleKey (core + every billable one)
  as TenantFeature rows, source = "tier"
```

Deliberately generous: nobody loses access on cutover. The granularity only changes what *new* purchases and explicit opt-outs look like going forward.

---

## 6. Pricing — reconciling with the real `pricing-config.ts`

The live file already encodes several of these as flat strings inside each tier's `features` array: `table-management`, `menu-management`, `kitchen-display`, `online-ordering`, `delivery-management`, `appointments`, `service-catalog`, `queue-management`, `staff-scheduling`, `discounts` (→ `discounts-coupons`), `stock-records`, `finance`, `procurement`, `etims`, `payroll`, `assets`. **These map onto §1's feature keys — don't rename or duplicate.** What changes: each tier's array becomes shorthand for "grant these `TenantFeature` rows," and every one of them also becomes independently purchasable outside a tier.

À la carte pricing (placeholder KES — validate before publishing, standing caveat from every prior pricing table in this project):

| Feature | Price | Feature | Price |
|---|---|---|---|
| `payroll` | KES 2,500/mo + 400/employee | `price-override` | KES 500/mo |
| `attendance` | KES 1,000/mo | `discounts-coupons` | KES 500/mo |
| `leave-management` | KES 800/mo | `multi-till-cashier` | KES 1,200/mo |
| `loans-advances` | KES 800/mo | `barcode-scanning` | KES 800/mo |
| `ats-recruitment` | KES 1,500/mo | `table-management` | KES 1,500/mo |
| `general-ledger` | KES 3,000/mo | `menu-management` | KES 1,500/mo |
| `bank-reconciliation` | KES 1,200/mo | `kitchen-display` | KES 2,000/mo |
| `credit-debit-notes` | KES 800/mo | `online-ordering` | KES 2,500/mo |
| `financial-statements` | KES 1,500/mo | `delivery-management` | KES 2,000/mo |
| `purchase-orders` | KES 1,500/mo | `appointments` | KES 1,000/mo |
| `supplier-invoicing` | KES 1,500/mo | `service-catalog` | KES 800/mo |
| `depreciation` | KES 1,500/mo | `queue-management` | KES 800/mo |
| `maintenance-tracking` | KES 1,000/mo | `staff-scheduling` | KES 1,200/mo |
| `disposal-management` | KES 800/mo | `loyalty-program` (CRM) | KES 1,500/mo |
| `etims-submission` | KES 2,500/mo | `loyalty-program-pos` | included free with `loyalty-program` |
| `etims-compliance-dashboard` | KES 1,000/mo | `offline-mode` | KES 2,500/mo |
| `customer-statements` | KES 800/mo | `stock-records` | KES 1,000/mo |
| `withholding-tax-tracking` | KES 500/mo | `reorder-alerts` | KES 800/mo |
| | | `stock-valuation` | KES 1,200/mo |
| | | `multi-location-transfers` | KES 1,200/mo |
| | | `expiry-tracking` | KES 800/mo |
| | | `physical-stock-take` | KES 800/mo |

Core features (`employee-records`, `general-ledger`, `supplier-management`, `asset-register`, `customer-records`, `core-till`, `stock-tracking-basic`) are never priced — they're the free floor that makes any billable sibling usable.

---

## 7. Vertical relevance filtering

`applicableCategories?: BusinessCategory[]` on each `FEATURE_REGISTRY` entry (§3), omitted = applicable to all. The Apps feature picker and any marketing à la carte page filter against the tenant's `getBusinessCategory(tenantType)` so a Barbershop never sees "Kitchen Display," a Retail shop never sees "Appointments." One shared registry, read-time filter — never fork the registry per vertical.

---

## 8. UI changes

- **Odoo-style Apps screen** (`dashboard/modules/page.tsx`, already built) extends from flat module rows to App → Module → Feature tree: App as the top-level clickable card (matches what's already there), expandable to show its modules, each module expandable to show core (always-on, non-toggleable) + billable features as checkboxes.
- **Sidebar** (`src/components/sidebar.tsx`): nav items carry `feature: FeatureKey` instead of `module: ModuleKey`; a tenant with only `payroll` sees a "Payroll" nav item but no Attendance/Leave/ATS items, consistent with the client's actual purchase.
- **Marketing**: reconcile against the already-built `/industries/*` pages before adding a separate `/modules/[module]` section (flagged in the restored marketing-pricing spec) — the feature-level detail from §1/§6 is what a `/pricing` feature-comparison table needs regardless of which page structure wins.

---

## 10. Demo/seed tenants as a verification matrix for this spec

The skill file's §6 demo-tenant table is, read against this spec, a concrete acceptance test for the feature-granularity engine — each tenant should resolve to an exact, enumerable `TenantFeature` set:

| Demo tenant | Apps enabled | Expected `TenantFeature` grants | What it proves |
|---|---|---|---|
| `demo-pos-retail` | POS only | `core-till` + all Retail-relevant billable POS/Inventory features, per §7's vertical filter | Retail vertical, tier ladder visible |
| `demo-pos-restaurant` | POS only | `core-till` + Restaurant-relevant features (`table-management`, `menu-management`, `kitchen-display`, `online-ordering`, `delivery-management`, …) | Restaurant vertical |
| `demo-pos-barbershop` | POS only | `core-till` + Barbershop-relevant features (`appointments`, `service-catalog`, `queue-management`, …) | Barbershop vertical |
| `demo-finance-hr` | Finance + Payroll apps | `general-ledger`, `bank-reconciliation`, `credit-debit-notes`, `financial-statements`, `employee-records`, `payroll`, `leave-management` — **zero** `pos`/`inventory`/`assets` rows | Standalone back-office use with **no POS at all** — this is the direct proof case for the client who wanted Payroll without buying into POS/retail trappings |
| `demo-assets-only` | Assets app | `asset-register`, `depreciation`, `maintenance-tracking`, `disposal-management` — zero `pos`/`finance`/`payroll` rows, and `depreciation`/`disposal-management` should show their soft-dependency fallback (no GL posting, since `general-ledger` isn't present) | Standalone fixed-asset tracking; also the easiest tenant to manually verify the soft-dependency degrade path from §1 actually works |
| `demo-unified` | All apps | Every core feature + a representative spread of billable ones across all 6 Apps | Cross-module links are visible without extra clicks — a POS sale should post to GL, a payroll run should show in Finance, an asset purchase should show in both Assets and Finance. **This tenant is the one place the hard/soft dependency graph in §1 needs to be exercised end-to-end**, not just unit-tested in isolation |

`demo-finance-hr` and `demo-assets-only` are the two tenants that actually fail if this spec's sub-feature granularity isn't real — on the old whole-module gating, "Finance & HR only" and "Assets only" demo tenants were already possible (that's module-level, already built); what's new is that `demo-finance-hr` should be buildable with Payroll but *without* Attendance/ATS, which only this spec's granularity makes meaningful to demo. Consider adding a seventh demo tenant (`demo-payroll-only`: Payroll app, `payroll` feature only, no `attendance`/`leave-management`/`ats-recruitment`) specifically to showcase the client-driven case this whole spec exists for.

---

## 11. Reconciling pricing/onboarding with the skill's Odoo-style structure

The skill's §4.2 and §5 describe a **two-level** purchase experience that this spec's §6 pricing table needs to sit inside, not replace:

- **Main `/pricing` page** stays simple, per the skill: a row of **App cards** (POS / Finance / Payroll / Assets / eTIMS, and CRM pending the §0 resolution) each with one price and feature list, plus a visually distinct **"All Apps / Unified" bundle column** priced at a discount off the sum of the individual apps — the Odoo anchor-pricing pattern. The vertical × tier matrix (Retail/Restaurant/Barbershop × Starter/Professional/Enterprise) stays **nested inside the POS app's own card/page**, not spread across the main grid — the skill is explicit that this existing detail shouldn't be collapsed, just nested.
- **This spec's 41-feature à la carte table (§6 above)** is the *next* level down — not every feature needs its own card on the main pricing page. It surfaces in two places instead: (1) **onboarding step 1 (App selection, skill §5.1)** — expand each selected App card to reveal its sub-features with incremental pricing, so a prospect can pick "Payroll only" within the Payroll app at the exact moment of initial signup, which is the direct realization of the client's original ask; and (2) **the in-app "Add this app" / Apps screen (skill §4.1)**, where an existing tenant adjusts their sub-feature set after signup, reusing the Odoo-style Apps screen tree UI from §8 above.
- **FAQ/pricing copy** (skill §7) should answer "Can I buy just one app?" — true at the App level today — and, once this spec ships, should also be able to truthfully answer "Can I buy just part of an app, like only Payroll without the rest of HR?" That second question doesn't have a true "yes" until §1–§9 of this spec are built; don't let marketing copy get ahead of the entitlement engine.

---

## 9. Build order

1. `FEATURE_REGISTRY` (all 41 keys) + `TenantFeature` model + engine functions (§2–§3) — built and tested before touching a route.
2. Migration script (§5) — run against existing tenants, spot-check a few before/after.
3. Route guard swap (§4), Payroll/HR routes first — client-driven urgency.
4. Soft-dependency inline checks (`supplier-invoicing`, `depreciation`, `disposal-management`, `stock-valuation` → `general-ledger`; `staff-scheduling` → `employee-records`; `loyalty-program-pos` → `loyalty-program`).
5. Vertical filtering (§7) wired into the picker and any pricing page.
6. Apps screen tree UI + sidebar nav (§8).
7. Pricing table (§6) wired into `pricing-config.ts` / wherever à la carte purchase actually lives.
8. `offline-mode` — separately scoped, materially bigger than everything else on this list; don't let it block shipping the rest.
9. Resolve the CRM discrepancy (§0) — a five-minute product decision, but do it before §1's CRM rows get built, not after.
10. Rebuild/verify the demo tenants against §10's expected grant table, adding `demo-payroll-only` — this is the acceptance test for the whole spec, not optional polish at the end.
