# LipaPoint ERP — AI Build Specification

**Purpose of this file:** feed this to Claude CLI (or any coding agent) as the authoritative spec when generating code for the LipaPoint → LipaPoint ERP expansion. It defines scope, data model, module behavior, integration contracts, and the pricing/plan gating that the code must enforce. Treat every "MUST" as a hard requirement and every "SHOULD" as a strong default that needs an explicit reason to skip.

**Source context:** LipaPoint is a live restaurant POS (Next.js 15 / Prisma / NextAuth v5, Kenya-focused, KES, M-Pesa). This spec extends it into a modular ERP — POS + Payroll + Asset Management + Finance + eTIMS compliance — positioned against Odoo, Zoho, SimbaPOS/Kenyan POS vendors and generic QuickBooks-style tools, while staying hospitality/retail-first rather than becoming a generic ERP.

---

## 1. Product Positioning

- **Anchor product:** POS (restaurants first, extensible to retail/dukas).
- **Bundle strategy:** sell POS standalone, then upsell Payroll, Asset Management, and Finance as attachable modules under one tenant — not separate logins. One `Organization`, many enabled `Module`s.
- **Differentiator vs Odoo/Zoho:** Kenya-native out of the box — KES, M-Pesa (Daraja + manual paybill/till), eTIMS/OSCU invoicing, NSSF/SHIF/Housing Levy payroll — instead of a generic ERP the user has to localize themselves.
- **Module independence:** every module MUST be toggleable per tenant (`OrganizationModule { moduleKey, enabled, enabledAt, planTier }`) so a pure-POS customer never sees Payroll/Assets in their nav, and billing can meter per module.

---

## 2. Module Map

| Module | Status | Notes |
|---|---|---|
| POS | exists | add on-the-fly price override, dual cost tracking |
| Inventory & Stock | exists, extend | re-order alerts, valuation, transfers, expiry |
| Finance / Accounting | **new** | COA, GL, journals, debit/credit notes, bank & cash |
| Payroll | **new** | Kenya statutory engine (PAYE/NSSF/SHIF/Housing Levy/NITA) |
| Asset Management | **new** | lightweight version of AssetIQ's model, embedded in this tenant (not a separate AssetIQ login) |
| Procurement / Supplier | **new** | PO → GRN → supplier invoice → payment |
| CRM / Customer | extend | statements, balances, loyalty |
| eTIMS / Tax Compliance | **new** | OSCU invoicing + KRA compliance, reuses TimsIQ's middleware design where useful |
| Reporting Engine | **new, cross-cutting** | all reports in §6 run off one query/report-definition layer, not bespoke pages per report |
| Admin / RBAC / Audit | extend | role hierarchy, audit trail, multi-branch |

---

## 3. Core Data Model (Prisma sketch)

Only new/changed models; assume existing `Organization`, `Branch`, `User`, `Product`, `Sale`, `SaleItem` from current LipaPoint schema.

```prisma
model OrganizationModule {
  id             String   @id @default(cuid())
  organizationId String
  moduleKey      String   // "pos" | "inventory" | "finance" | "payroll" | "assets" | "procurement" | "crm" | "etims"
  enabled        Boolean  @default(false)
  planTier       String   // "starter" | "growth" | "erp" | "erp_plus"
  enabledAt      DateTime?
  @@unique([organizationId, moduleKey])
}

// ---- Finance ----
model ChartOfAccount {
  id             String   @id @default(cuid())
  organizationId String
  code           String   // e.g. "4000"
  name           String
  type           String   // asset | liability | equity | income | expense
  parentId       String?
  isSystem       Boolean  @default(false) // seeded accounts, non-deletable
}

model JournalEntry {
  id             String   @id @default(cuid())
  organizationId String
  branchId       String?
  date           DateTime
  reference      String   // e.g. SALE-0001, PAY-0003, PO-0002
  sourceModule   String   // pos | payroll | procurement | manual
  sourceId       String?
  lines          JournalLine[]
  postedBy       String
  createdAt      DateTime @default(now())
}

model JournalLine {
  id             String   @id @default(cuid())
  journalEntryId String
  accountId      String
  debit          Decimal  @default(0)
  credit         Decimal  @default(0)
  description    String?
}

model CreditNote { id String @id @default(cuid()); organizationId String; customerId String; amount Decimal; reason String; saleId String?; status String }
model DebitNote  { id String @id @default(cuid()); organizationId String; supplierId String; amount Decimal; reason String; status String }

model BankAccount { id String @id @default(cuid()); organizationId String; name String; type String /* bank|mpesa_till|mpesa_paybill|cash */; accountNumber String?; openingBalance Decimal }
model BankTransaction { id String @id @default(cuid()); bankAccountId String; date DateTime; amount Decimal; direction String /* in|out */; reconciled Boolean @default(false); matchedJournalLineId String? }

// ---- Payroll ----
model Employee {
  id             String   @id @default(cuid())
  organizationId String
  branchId       String?
  staffNumber    String
  firstName      String
  lastName       String
  kraPin         String?
  nssfNumber     String?
  shaNumber      String?
  bankAccount    String?
  mpesaNumber    String?
  employmentType String   // permanent | contract | casual
  basicSalary    Decimal
  startDate      DateTime
  endDate        DateTime?
  active         Boolean  @default(true)
}

model PayrollRun {
  id             String   @id @default(cuid())
  organizationId String
  period         String   // "2026-11"
  status         String   // draft | approved | paid | filed
  payslips       Payslip[]
  createdAt      DateTime @default(now())
}

model Payslip {
  id             String   @id @default(cuid())
  payrollRunId   String
  employeeId     String
  grossPay       Decimal
  nssfEmployee   Decimal
  nssfEmployer   Decimal
  shif           Decimal
  housingLevyEmployee Decimal
  housingLevyEmployer Decimal
  taxablePay     Decimal
  paye           Decimal
  personalRelief Decimal
  otherDeductions Decimal @default(0) // loans, sacco, union, HELB
  netPay         Decimal
  nitaLevy       Decimal @default(0) // employer-only, annual
}

model StatutoryRateTable {
  id         String   @id @default(cuid())
  effectiveFrom DateTime
  payeBands  Json     // [{upTo, rate}], rates for 10/25/30/32.5/35%
  personalRelief Decimal
  nssfRateEmployee Decimal // 6%
  nssfRateEmployer Decimal // 6%
  nssfTier1Cap Decimal
  nssfTier2Cap Decimal
  shifRate   Decimal   // 2.75%
  shifMinimum Decimal  // KES 300
  housingLevyRate Decimal // 1.5% each side
}

// ---- Asset Management (lightweight, tenant-scoped) ----
model Asset {
  id             String   @id @default(cuid())
  organizationId String
  branchId       String?
  name           String
  category       String
  purchaseCost   Decimal
  purchaseDate   DateTime
  supplierId     String?
  depreciationMethod String // straight_line | reducing_balance | none
  usefulLifeMonths Int?
  residualValue  Decimal  @default(0)
  lifecycleStatus String  // in_service | under_maintenance | disposed | lost
  assignedTo     String?  // employeeId
  linkedInvoiceId String? // for PDF-invoice onboarding, reuse AssetIQ's parser pattern
}

model AssetMaintenance { id String @id @default(cuid()); assetId String; date DateTime; cost Decimal; description String; performedBy String? }
model AssetDepreciationEntry { id String @id @default(cuid()); assetId String; period String; amount Decimal; bookValueAfter Decimal; journalEntryId String? }

// ---- Procurement / Supplier ----
model Supplier { id String @id @default(cuid()); organizationId String; name String; kraPin String?; paymentTerms String?; balance Decimal @default(0) }
model PurchaseOrder { id String @id @default(cuid()); organizationId String; supplierId String; status String /* draft|sent|partially_received|received|closed */; items Json; expectedDate DateTime? }
model GoodsReceivedNote { id String @id @default(cuid()); purchaseOrderId String; receivedDate DateTime; items Json; receivedBy String }
model SupplierInvoice { id String @id @default(cuid()); supplierId String; poId String?; amount Decimal; dueDate DateTime; status String /* unpaid|partial|paid */; etimsValidated Boolean @default(false) }

// ---- eTIMS ----
model EtimsInvoice {
  id             String   @id @default(cuid())
  organizationId String
  sourceType     String   // sale | credit_note | supplier_invoice
  sourceId       String
  oscuStatus     String   // pending | submitted | accepted | rejected
  kraInvoiceNumber String?
  qrCodeUrl      String?
  submittedAt    DateTime?
  rawResponse    Json?
}

// ---- Audit ----
model AuditLog { id String @id @default(cuid()); organizationId String; userId String; action String; entityType String; entityId String; before Json?; after Json?; createdAt DateTime @default(now()) }
```

**MUST:** every model above carries `organizationId` and all queries scope by it (existing LipaPoint multi-tenant convention). Finance's `JournalEntry` is the single source of truth every other module posts to — POS sales, payroll runs, asset depreciation, and supplier payments all create journal entries rather than mutating balances directly.

---

## 4. Module Specs

### 4.1 POS (extend existing)
- **On-the-go price override:** `SaleItem.overridePrice` (nullable). When set, record `originalPrice`, `overridePrice`, `overrideReason` (free text, e.g. "bargain"), and `overriddenBy` (userId). MUST NOT write back to `Product.price` or inventory valuation — it is sale-scoped only, per the client's explicit requirement.
- **Dual cost tracking:** `Product` needs both `supplierCost` (cost from supplier/last GRN) and `sellingCost` already implied by `price`. Every `SaleItem` snapshots `costAtSale` from the product's current `supplierCost` at time of sale, so margin reports are accurate even if cost changes later.
- Till/paybill, cash, card/PDQ, and "complementary" (comped) sales all need a `paymentMethod` enum value so Sales-by-till/mpesa/card/pdq/cash and Sales-complementary reports (§6) can run off one field.

### 4.2 Inventory & Stock
- Stock movements table (`StockMovement`: in/out/transfer/adjustment/expiry-writeoff) feeds all stock reports — don't compute from `Sale` alone.
- Re-order points: `Product.reorderPoint`, `Product.reorderQty`; a scheduled job flags items below threshold and SHOULD push a notification (email/SMS/WhatsApp — reuse the bulk-sender pattern already built for LipaPoint marketing).
- Stock valuation report MUST support both cost-basis and selling-price-basis, computed from `StockMovement` running balance, not a point-in-time snapshot.

### 4.3 Finance
- Seed a default Kenyan SME chart of accounts on tenant creation (editable). Core types: Asset, Liability, Equity, Income, Expense, with COGS and VAT/eTIMS-output-tax as sub-accounts.
- **MUST** auto-post journal entries for: every POS sale (DR Cash/Till/Receivable, CR Sales Income, CR VAT payable, DR COGS / CR Inventory), every payroll run (DR Salary Expense, CR Statutory Payable accounts, CR Net Pay Payable), every asset depreciation run, every supplier invoice and payment.
- Bank/cash reconciliation: `BankTransaction` import (CSV/Daraja statement) matched against `JournalLine`s; unmatched items flagged for manual review (feeds Cashier shortage report).
- Debit/credit notes reduce/increase the relevant customer or supplier balance and MUST post an offsetting journal entry.

### 4.4 Payroll (Kenya statutory engine — verify rates each tax year against KRA/NSSF/SHA before go-live)
Current 2026 reference rates to seed `StatutoryRateTable` (confirm against official sources at build time, do not hardcode without a review step):
- **PAYE bands:** progressive 10% / 25% / 30% / 32.5% / 35%, first KES 24,000 at 10%; personal relief KES 2,400/month.
- **NSSF (Year 4 / Tier I+II):** 6% employee + 6% employer, capped around KES 6,480/month each side — pull the exact tier caps from NSSF's current notice at implementation time since they step up annually.
- **SHIF:** 2.75% of gross pay, minimum KES 300/month, employee-only.
- **Affordable Housing Levy (AHL):** 1.5% employee + 1.5% employer-matched, on gross pay.
- **NITA training levy:** small flat employer-only annual levy per employee.
- Calculation order per payslip: Gross → subtract NSSF, SHIF, AHL (all "allowable" pre-PAYE deductions) → taxable pay → PAYE via bands → subtract personal relief → subtract other deductions (loans, SACCO, union dues, HELB) → net pay.
- **Casual workers:** same statutory deductions apply — do not special-case them out; this is a common compliance mistake per Kenyan HR guidance.
- Payroll run states: `draft → approved → paid → filed`. On `paid`, auto-post journal entry and mark eligible for M-Pesa bulk payout (B2C via Daraja) or bank batch file export.
- Generate P9 (annual) and payslip PDFs; statutory returns export formatted for iTax filing.

### 4.5 Asset Management (embedded, lighter than full AssetIQ)
- Reuse AssetIQ's proven patterns at a lighter weight: `lifecycleStatus` state machine (`in_service → under_maintenance → disposed/lost`), PDF-invoice-based onboarding via cost-effective parsing + LLM extraction (same approach as AssetIQ's `smalot/pdfparser` + Groq flow), and `company_id`/`organizationId` scoping on every call.
- Depreciation: straight-line MUST be supported at minimum; reducing-balance SHOULD be supported. Monthly scheduled job computes `AssetDepreciationEntry` and posts the journal entry.
- Assign assets to employees/branches; maintenance log feeds a simple maintenance-cost report.
- This module does NOT need AssetIQ's full component/consumables/SAP-PM depth — keep it POS-tenant-appropriate (till machines, delivery bikes, kitchen equipment, furniture) unless a client explicitly needs the heavier model.

### 4.6 Procurement / Supplier
- PO → GRN → Supplier Invoice → Payment lifecycle. GRN receipt updates `StockMovement` and `Product.supplierCost`.
- Supplier invoice MUST be eTIMS-cross-checked where the supplier is also eTIMS-registered (purchase-side compliance), flagged via `SupplierInvoice.etimsValidated`.

### 4.7 CRM / Customer
- Customer ledger (statement + balance, detailed and summary), balance-by-department, withholding-tax-by-customer.
- SHOULD add a simple loyalty/points module and customer tiers — common Odoo/competitor feature not in the client's original list.

### 4.8 eTIMS / Tax Compliance
- Integrate OSCU middleware for real-time invoice submission to KRA on every qualifying sale and credit note. Architecture should mirror the already-scoped TimsIQ product: hosted integration layer + compliance dashboard flagging invoice-vs-expected mismatches.
- `EtimsInvoice` tracks submission status, KRA invoice number, and QR code for the printed/digital receipt.
- Dashboard view: submission success rate, rejected invoices queue with retry, VAT output summary reconciled against Sales-by-tax report.
- **Decision point:** build this as an internal module of LipaPoint ERP, or call into TimsIQ as an internal service if that product reaches production first — avoid building the OSCU integration twice. Flag this explicitly in the Phase 1 kickoff (§8).

---

## 5. Reporting Engine

Build ONE generic report layer, not 40+ bespoke pages. Each report = a `ReportDefinition` (name, module, SQL/Prisma query template, parameters, output columns) rendered through a shared table/export component (CSV/PDF/print).

Report catalog to implement (grouped; each item below is one `ReportDefinition`):

**Sales:** invoice, sales detailed, sales summary, unpaid bills, sales by hour/day/week/month, sales by sales-rep (+ per day), sales by item (per day), items sold out of set price, complementary sales, sales by payment method (till/mpesa/card/pdq/cash), sales by tax, sales by customer, discount report, sales returns/credit sales.

**Customer:** statement (detailed/summary), balance (detailed/summary), balance by department, withholding tax by customer.

**Cash/Bank:** cash/bank statement (summary/detailed), cash/bank report (summary/detailed), cashier cash/prints report, cheques received, transfer reports, cashier shortage, mpesa/card/pdq report, cash collection from cashiers.

**Stock:** stock report (detailed/summary, by department), stock valuation (cost & selling price), re-order points, stock received, items not sold, stock transferred, stock adjustment, stock expiry, physical stock-take, purchased-by-item, price change.

**Supplier:** statement, unpaid invoices, invoices received.

**Finance:** Profit & Loss, Balance Sheet, Trial Balance (named "Prior Balance" in the client's notes).

**Payroll (new, not in original notes but required for an ERP):** payroll summary, statutory deductions summary (PAYE/NSSF/SHIF/AHL), payslip register, P9 export.

**Assets (new):** asset register, depreciation schedule, maintenance cost report.

**Maintenance/Compliance:** audit trail; eTIMS submission log.

---

## 6. Competitive Gap Features (not in client's notes, commonly expected vs Odoo/Zoho/Sage-class competitors)

- **Multi-branch / multi-location** consolidated + per-branch reporting (client already has `branchId` fields seeded above for this).
- **Role-based approval workflows** — e.g. PO above a threshold needs manager approval, credit notes need approval, large payroll runs need a second sign-off.
- **Barcode/QR scanning** at POS and for stock-take.
- **Offline-first POS mode** with sync-on-reconnect (common pain point in Kenyan retail given connectivity gaps) — flag as a larger engineering effort, scope separately.
- **Budgeting module** — department/branch budgets vs actuals, feeding the Finance reports.
- **Fixed-asset disposal workflow** (gain/loss on disposal journal entry) — pairs with Asset Management.
- **Multi-currency** (lower priority given KES focus, but useful for import-heavy suppliers).
- **API / webhooks** for third-party integrations (accounting export, e-commerce, delivery apps) — matches the client's own "developer/partner API" instinct from the TimsIQ work.
- **Document attachments** on POs, invoices, assets (receipts, warranty docs).
- **Mobile app / PWA** for managers to check dashboards and approve workflows on the go.
- **Payroll loan/advance tracking** (staff loans deducted over multiple pay periods) — very common in Kenyan SME payroll and not in the client's notes.
- **WIBA (Work Injury Benefits Act) compliance flag** for payroll, alongside NSSF/SHIF/AHL.

---

## 7. Pricing & Plan Restructuring

Reflect module gating from §1 directly in plan tiers. Suggested structure — **adjust actual KES figures to the client's market testing, these are placeholders for structure only**:

| Tier | Modules included | Target customer |
|---|---|---|
| **POS Starter** | POS, Inventory (basic), core Sales/Stock reports | single-branch restaurant, current LipaPoint customer |
| **POS Growth** | + full reporting suite, multi-branch, CRM/loyalty | multi-branch or higher-volume operator |
| **ERP** | + Finance (COA/GL/bank recon), Procurement/Supplier, eTIMS | operator ready to drop a separate accounting tool |
| **ERP Plus** | + Payroll, Asset Management, approval workflows, API access | full back-office replacement, competes directly with Odoo bundle |

- Gate at the `OrganizationModule` level (§3) so upgrades are additive, not a re-onboarding.
- Price eTIMS/OSCU submission either bundled into ERP tiers or as a metered add-on (per-invoice cost) if KRA/OSCU integration carries a per-transaction cost — confirm actual OSCU fee structure before finalizing.
- Payroll SHOULD be priced per-active-employee on top of the tier, matching how HR/payroll SaaS (Faidi HR, etc.) typically price in this market.

---

## 8. Phased Build Plan

1. **Phase 0 — Foundation:** `OrganizationModule` gating, `ChartOfAccount`/`JournalEntry` skeleton, `AuditLog`. Nothing user-facing yet; everything else posts through this.
2. **Phase 1 — Finance + Procurement:** COA, GL, bank/cash, supplier/PO/GRN lifecycle, debit/credit notes. Unlocks Finance reports.
3. **Phase 2 — eTIMS:** OSCU submission on POS sales first (highest-value compliance win), then credit notes and supplier invoices. Decide build-vs-reuse-TimsIQ here.
4. **Phase 3 — Payroll:** statutory engine + `StatutoryRateTable`, payslip generation, M-Pesa B2C payout, P9 export.
5. **Phase 4 — Asset Management:** lightweight asset register + depreciation, reusing AssetIQ's onboarding pattern.
6. **Phase 5 — Reporting engine + full report catalog** (§5), built against the data already flowing from Phases 1–4 rather than bespoke per-report code.
7. **Phase 6 — Competitive gap features** (§6), prioritized by sales feedback once ERP tiers are live.

Each phase SHOULD ship as its own markdown spec file for Claude CLI (e.g. `lipapoint-finance.md`, `lipapoint-payroll.md`) scoped from this master doc, matching the existing `asset-iq-lifecycle.md` pattern.

---

## 9. Non-Functional Requirements

- Every new table scoped by `organizationId`; no cross-tenant queries without an explicit superadmin context.
- Every financial-impact action (sale, payroll run, asset disposal, credit note) MUST write to `AuditLog` with before/after state.
- Statutory rate changes (PAYE bands, NSSF caps, SHIF, AHL) MUST be versioned via `StatutoryRateTable.effectiveFrom`, never hardcoded in calculation logic — Kenya's rates have changed yearly.
- Reuse existing NextAuth v5 session/role patterns; extend role hierarchy to cover Payroll (HR role), Finance (Accountant role), and Assets (Operations role) separately from POS cashier/manager roles.
