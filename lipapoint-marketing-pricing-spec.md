# LipaPoint ERP — Marketing, Pricing & Remaining Build Spec

**Feeds into:** `lipapoint-erp-spec.md` (data model, module logic). This file covers what that one didn't: marketing-site structure, pricing-page content (marketing + admin), and the development backlog still needed from the original Gemini demo notes. Hand this to Claude CLI alongside the dev log excerpt it was written against.

---

## 0. Current Build Status (read before anything else)

Per the latest dev log: module gating (`TenantModule`), Finance/GL, Payroll, Assets, Procurement, and eTIMS are implemented and route-guarded with `requireUserWithModule`. Good foundation — the marketing/pricing work below assumes these are real, working entitlements, not vaporware copy.

**One hard blocker precedes everything in this file:** `npm run build` fails because `src/lib/auth.ts` imports `cookies()` from `next/headers` at module scope, and that file gets pulled into a Client Component bundle (the admin modules page) via `getCurrentUser`. This is a project-wide Next.js 15 Server/Client boundary violation, not a module-page bug.

**Fix before building anything in this spec:**
- Split `src/lib/auth.ts` into a server-only module (keep `cookies()` there, mark it `import "server-only"`) and a client-safe `getSessionUser()` that calls an API route (`/api/auth/session`) instead of touching `next/headers` directly.
- Re-run `npm run build` clean before starting §1–§4 below. Marketing and pricing pages are read by prospects; shipping them on a repo with a known broken production build is a bigger risk than the pages themselves.

Secondary, non-blocking cleanup (do opportunistically, not before the above): the three pre-existing `possibly 'null'` route handler warnings, add a minimal test suite (currently zero test files), commit the untracked module-feature files.

---

## 1. Marketing Site — "Modular or Unified" Positioning

Core message: **LipaPoint ERP is bought one module at a time or as one bundle — never a monolith you have to adopt all at once.** This is the actual differentiator vs Odoo (per-user, all-apps-or-nothing licensing) and vs single-purpose Kenyan POS vendors (no finance/payroll/assets path to grow into).

### 1.1 Site structure

| Page | Purpose | Key content |
|---|---|---|
| `/` (home) | Position as "POS that grows into your back office" | Hero: POS front-and-center (existing product), secondary CTA "See the full ERP" |
| `/modules` | Module directory — the "buy individually" proof | Card grid: POS, Inventory, Finance, Payroll, Assets, Procurement, CRM, eTIMS. Each card: one-line value prop, "Works standalone" badge, "Included in ERP" badge, link to module page |
| `/modules/[module]` | One landing page per module (8 pages) | Problem → feature list (pulled from the same feature source as pricing, §2.3, so copy never drifts from what's actually shippable) → "Add to your LipaPoint" CTA if already a POS customer, or "Start with just this module" CTA if new |
| `/erp` | The unified pitch | "All 8 modules, one login, one bill" — comparison framing against running separate point tools (a POS + a payroll vendor + a bookkeeping tool) |
| `/pricing` | Tier + à la carte pricing | See §2 |
| `/compare` | Honest comparison table vs Odoo, local POS vendors, and single-purpose payroll tools | See §2.4 |

### 1.2 Module page template (applies to all 8 `/modules/[module]` pages)

```
H1: {Module name} — {one-line value prop}
Subhead: Works on its own, or plugged into the rest of LipaPoint ERP.

[Standalone] [Part of ERP]  ← toggle/badges, not separate pages

Section: What it does (3-5 feature bullets, Kenya-specific framing)
Section: What it connects to (e.g. Payroll → "posts straight to your
         Finance ledger if you have that module too — no CSV exports")
Section: Pricing for this module alone, with a line to "save by bundling"
         linking to /pricing
CTA: Start free trial / Talk to sales
```

**MUST:** every module page's feature list is generated from the same `ModuleFeatureCatalog` data source used on `/pricing` (§2.3) — never hand-maintained copy duplicated in two places, or the pricing page and module page will drift and misstate what a tier includes (which is explicitly the omission problem the client flagged).

### 1.3 Build note
Marketing pages are static/marketing content, not gated by `TenantModule` — they describe what's purchasable, they don't check entitlement. Keep them in a public route group separate from `(dashboard)`.

---

## 2. Pricing — Marketing Page

### 2.1 Competitive benchmark (researched, Oct 2026 — reverify before publishing, these move)

| Competitor | Model | Approx. cost |
|---|---|---|
| Odoo (Kenya pricelist) | Per user/month, all apps bundled, no module-level gating | Standard ≈ $8.95–13.60/user/mo; Custom ≈ $13.60–20/user/mo (billed yearly) |
| Local Kenyan POS vendors (SokoniPOS, RACK, generic restaurant POS) | Per outlet/month, POS-only | KES 1,500–12,000/month per outlet depending on feature tier |
| Workpay (Kenya payroll/HR) | Per employee/month | ≈ $4–5/employee/month for local HR+payroll |
| QuickBooks Payroll / ADP (international, sold into Kenya) | Base fee + per-employee | $39–50 base + $5–6.50/employee/month |

**Implication for LipaPoint ERP pricing:** Odoo's per-user model gets expensive fast for a restaurant with many cashiers/waiters who each need a login but don't need "a full seat" of software value. LipaPoint ERP SHOULD price **per outlet/tenant with module add-ons**, not per user — undercutting Odoo for multi-staff, low-office-headcount businesses (restaurants, retail) while staying payroll-per-employee where that's the market norm (matching Workpay's model, since per-employee is what Kenyan buyers already expect for payroll specifically).

### 2.2 Proposed tier structure

*Figures below are a placeholder structure for engineering and copy purposes — validate against real willingness-to-pay before publishing live prices.*

| Tier | Price | Modules included | Positioned against |
|---|---|---|---|
| **POS Starter** | KES 3,500/month per outlet | POS, Inventory (basic) | Local single-purpose POS vendors (undercuts the KES 4,000–10,000/month restaurant POS range) |
| **POS Growth** | KES 7,500/month per outlet | + full Reporting suite, multi-branch, CRM/loyalty | Mid-tier Kenyan POS + a separate reporting tool |
| **ERP** | KES 16,000/month per tenant (up to 3 outlets) | + Finance, Procurement, eTIMS | Odoo Standard for a ~10-staff operation (≈KES 11,500–17,500/mo at Odoo's per-user Kenya rate), but zero Kenya-localization work required |
| **ERP Plus** | KES 27,500/month per tenant + KES 400/employee/month for Payroll | + Payroll, Asset Management, approval workflows, API access | Odoo Custom + a separate payroll vendor (Odoo Custom alone ≈ KES 20–26/user/mo, plus a $4–5/employee payroll tool on top) |

**À la carte (module add-ons, for existing POS customers who want one more module without a full tier jump):**

| Module | Standalone add-on price |
|---|---|
| Finance (COA/GL/bank recon) | KES 5,000/month |
| Procurement/Supplier | KES 3,500/month |
| eTIMS/OSCU compliance | KES 3,000/month *(confirm against actual OSCU per-transaction cost before publishing — if KRA/OSCU charges per invoice, this may need a metered component)* |
| Payroll | KES 3,500/month + KES 400/employee/month |
| Asset Management | KES 4,000/month |
| CRM/Loyalty | KES 2,000/month |

Bundling into a tier SHOULD always be cheaper than summing the à la carte add-ons — that gap is the actual upsell argument on the page ("adding Finance + Payroll + Assets separately costs KES X/mo; ERP Plus is KES Y/mo").

### 2.3 Feature table — no omissions

Build this as data (`ModuleFeatureCatalog` — module → feature → tiers it's included in), rendered as one full comparison table, not tier-by-tier summaries that quietly drop detail. Columns: Starter / Growth / ERP / ERP Plus. Rows grouped by module, every feature from the technical spec represented — including the full report catalog (§4 below), not a "40+ reports" placeholder line. This is a direct response to the requirement that pricing show everything "without omission" — a vague bullet like "advanced reporting included" is exactly what must not ship.

Minimum row groups required: POS (incl. price-override/bargain pricing, dual cost tracking, payment-method breakdown), Inventory (incl. re-order alerts, valuation basis), Finance (incl. which reports — P&L, Balance Sheet, Trial Balance, bank recon), Procurement (PO→GRN→Invoice→Payment lifecycle), Payroll (statutory engine, P9, M-Pesa B2C payout), Assets (depreciation methods, disposal workflow), eTIMS (OSCU submission, retry/rejection handling), CRM (statements, loyalty), every report group from §4.

### 2.4 `/compare` page
Honest, specific comparison rows — not generic "better value" claims (keeps this evenhanded and defensible, and avoids the kind of vague marketing claim that later undermines trust if a prospect checks). Suggested rows: pricing model (per-user vs per-outlet), Kenya payroll statutory engine out of the box, eTIMS/OSCU native integration, M-Pesa native (Daraja + manual till/paybill), implementation time, module-level purchase (yes for LipaPoint/no for Odoo's all-apps-per-user model).

---

## 3. Pricing — Admin Page (internal plan management)

The admin-side pricing page is for LipaPoint's own team to manage tiers/pricing, and for tenant admins to see what they're entitled to and upgrade. Two distinct surfaces:

### 3.1 Internal: Plan & Pricing Management (`/admin/pricing`, LipaPoint staff only)
- CRUD over `PlanTier` (name, base price, billing cycle) and `PlanTierModule` (which `ModuleKey`s a tier grants — must match `TIER_MODULES` in `src/lib/modules.ts` exactly; this page SHOULD write to the same source of truth `modulesForTier` reads from, not a parallel config).
- CRUD over à la carte `ModuleAddonPrice` per `ModuleKey`.
- Changelog/audit trail on price changes (reuse `AuditLog`) — pricing changes are exactly the kind of action that needs before/after tracking.

### 3.2 Tenant-facing: "Your Plan" (`/[tenant]/admin/billing` or alongside the existing `/[tenant]/admin/modules` page)
- Shows current tier + any à la carte modules enabled outside the tier (reuse the existing `ModuleList`/`ModuleBadge` components already built for the modules page — don't rebuild this UI twice).
- Shows the SAME full feature table as the marketing `/pricing` page (§2.3), scoped to what this tenant currently has vs. what upgrading would add — so a tenant admin can self-serve the upgrade decision without a sales call.
- Upgrade/downgrade actions flow through the existing `grantModule`/`revokeModule`/`provisionTenantModules` functions already built — this page is a UI on top of logic that already exists, not new entitlement logic.

---

## 4. Remaining Development — From the Original PDF Notes

**See `lipapoint-reports-spec.md` for the authoritative, exhaustive, checkbox-tracked list of all 58 required reports — this section is a summary; that file is the acceptance bar.**

The dev log confirms module gating, Finance/GL, Payroll, Assets, Procurement, and eTIMS plumbing are built. It does **not** mention the reporting engine or the full report catalog from the original demo notes (`lipapoint-erp-spec.md` §5) — that's the largest remaining gap between "modules exist" and "the client's actual requested feature set is delivered." Prioritize in this order:

1. **Reporting engine skeleton** — `ReportDefinition` model + one shared query/export component (table view, CSV, PDF, print), per the original spec. Build this before individual reports so report #2 onward is config, not new code.
2. **Sales reports** (highest usage, POS module already has the underlying data): invoice, sales detailed/summary, unpaid bills, sales by hour/day/week/month, by sales-rep, by item, items sold out of set price, complementary sales, sales by payment method, sales by tax, sales by customer, discount report, sales returns/credit sales.
3. **Stock reports** (data exists via `StockMovement` per original spec §4.2, needs the report layer): stock detailed/summary, by department, valuation at cost and selling price, re-order points, stock received, items not sold, transferred, adjustment, expiry, physical stock-take, purchased-by-item, price change.
4. **Finance reports**: confirm P&L, Balance Sheet, and Trial Balance ("Prior Balance" in the client's original notes) are built off `JournalEntry`/`JournalLine` now that GL posting exists — the dev log shows the GL route (`/api/finance/journal`) but not these three statement reports specifically.
5. **Cash/Bank reports**: cash/bank statement and report (summary/detailed), cashier cash/prints, cheques received, transfer reports, cashier shortage, mpesa/card/pdq report, cash collection from cashiers — needs `BankTransaction` reconciliation UI, which isn't confirmed built yet.
6. **Customer and Supplier reports**: customer statement/balance (detailed/summary), balance by department, withholding tax by customer; supplier statement, unpaid invoices, invoices received.
7. **Payroll and Asset reports** (new vs. original notes, but required for ERP parity per `lipapoint-erp-spec.md` §5): payroll summary, statutory deductions summary, payslip register (P9 export already confirmed built per dev log), asset register, depreciation schedule, maintenance cost report.
8. **Audit trail report** — surfacing `AuditLog` (already populated per dev log) as a filterable report, not just raw rows.
9. **ERP packaging requirement from the notes** ("package this system as an ERP... bundle POS with Payroll and Asset Management... compete with Odoo") — this is the module-gating + pricing work in §1–3 above; cross-reference so it isn't tracked as a separate, duplicate backlog item.

Competitive-gap items from the original spec §6 that remain unbuilt (role-based approval workflows beyond the `RolePermission` model, barcode/QR, offline-first POS, budgeting, multi-currency, public API/webhooks, mobile/PWA) stay in Phase 6 as originally scoped — don't pull them forward ahead of the reporting engine, since the reporting gap is what's actually blocking the client's original requirement from being met.

---

## 5. Sequencing

1. Fix the `next/headers` build blocker (§0) — nothing else ships until `npm run build` is clean.
2. Reporting engine + report catalog (§4.1–4.8) — closes the gap between "modules built" and "the PDF's actual ask delivered."
3. `ModuleFeatureCatalog` data source (§1.2, §2.3) — single source of truth feeding both marketing module pages and the pricing feature table, built once so neither page can drift from the other.
4. Marketing site (§1) and pricing pages, marketing + admin (§2–3) — these consume the catalog from step 3, so they come after it, not in parallel with it.
5. Admin plan management (§3.1) can ship alongside the marketing pricing page since it's internal tooling with no dependency on public copy being finalized.
