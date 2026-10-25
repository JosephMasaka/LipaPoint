# LipaPoint ERP — Report Gap Analysis (code-level audit)

Source: `lipapoint-reports-gap-analysis.xlsx` (Oct 2026), re-extracted and summarized here.

**Methodology**
- The workbook lists 58 required reports split across 10 sections.
- Each row was cross-referenced against the codebase (route/route handler search, lib search, reported functions).
- **Reconciled against the built report engine**: statuses track whether a report is a real
  `ReportDefinition` row with a registered query behind the shared renderer (`lipapoint-reports-spec.md` §1), and
  whether anything writes its data. The workbook is regenerated from `report-engine.reconcile.js`.
- Status legend:
  - **Confirmed**: built — one catalog row plus one registered query, filterable by date range and exportable
    (CSV/PDF/print) through the shared renderer, with a write path for its data.
  - **Partial**: built and exportable, but nothing writes its data yet, so it renders empty.
  - **Not Confirmed**: a catalog row exists but returns `501 not_implemented` — blocked on a schema/data-model gap.

---

## Consolidated totals

| Status | Count |
|---|---|
| Confirmed | 58 |
| Partial | 0 |
| Not Confirmed | 0 |
| **Total** | **58** |

Report engine coverage: **59 of 59 catalog keys registered and executing without error** (the catalog carries 59
distinct keys because `gl-journal-register` is an extra beyond the 58 spec reports; `audit_trail`/`audit-trail`
style duplicates collapse under key normalization).

All 58 checkboxes in `lipapoint-reports-spec.md` are ticked.

---

## By section

| Section | Total | Confirmed | Partial | Not Confirmed |
|---|---|---|---|---|
| Sales Reports | 18 | 18 | 0 | 0 |
| Customer Reports | 4 | 4 | 0 | 0 |
| Cash / Bank / Cashier Reports | 8 | 8 | 0 | 0 |
| Stock Reports | 12 | 12 | 0 | 0 |
| Supplier Reports | 3 | 3 | 0 | 0 |
| Finance Reports | 3 | 3 | 0 | 0 |
| Maintenance Reports | 1 | 1 | 0 | 0 |
| Payroll Reports | 4 | 4 | 0 | 0 |
| Asset Reports | 3 | 3 | 0 | 0 |
| eTIMS Reports | 2 | 2 | 0 | 0 |

---

## Previously-open gaps, now closed

The five reports that were blocked on a schema/data-model gap are built and capture their own data:

- **Sales complementary report** — `PaymentMethod.COMPLIMENTARY` plus a POS "Comp" button; comps are identified by
  an explicit method, never inferred from a zero price.
- **Customer balance by department** — `Customer.department` on create/update and in the customer form; balances
  group by department, falling back to a name match for orders saved before `customerId` existed.
- **Withholding tax by customer** — `Customer.whtRate` snapshotted onto `Order.whtRate`/`whtAmount` when a sale is
  raised or a tab is settled; the report sums what was actually withheld, never re-deriving from today's rate.
- **Stock expiry report** — `StockBatch` lots written by the GRN receive flow (`batchNumber` + `expiryDate`);
  days-to-expiry goes negative for stock already past its date.
- **Asset maintenance cost report** — `AssetMaintenance` written by `POST/GET /api/assets/[id]/maintenance`
  (validated, audited); aggregates service count, cost and last service date per asset.

The two reports that were **Partial** (built but with no writer) now have their flows:

- **Stock transferred** — `POST /api/stock/transfer` and the Inventory → Transfer form write paired `TRANSFER`
  legs sharing one reference and move stock on both sides.
- **Physical stock-take** — `POST /api/stock/take` and the Inventory → Stock Take form persist `closingStock`
  (the counted figure) plus `countedAt` on every counted line, correct on-hand, and log a signed `ADJUSTMENT`
  movement for each discrepancy.

---

## Confirmed reports (58)

- **Sales (18)**: invoice; sales detailed; sales summary; unpaid bills; sales by hour/day/week/month; sales by sales
  rep; sales by sales rep per day; sales by item per day; items sold out of set price (derived by comparing
  `OrderItem.unitPrice` against the product/UoM set price — no `overridePrice` column needed); sales
  complementary; sales by till/mpesa/card/pdq/cash; sales by tax; sales by customer; discount report; sales
  return/credit sales.
- **Customer (4)**: customer statement (detailed & summary); customer balance (detailed & summary); customer
  balance by department; withholding tax by customer.
- **Cash / Bank / Cashier (8)**: cash/bank statements; cash/bank report; cashier cash/prints; cheques received
  (`BankTransaction.category='cheque'`); transfer reports (auto-classified when the counter-account is another
  wallet); cashier shortage; M-Pesa/card/PDQ; cash collection from cashiers.
- **Stock (12)**: stock report; stock by department; stock valuation (cost **and** selling price); re-order points;
  stock received; items not sold; stock transferred; stock adjustment; stock expiry; physical stock-take;
  purchased-by-item; price change (`ProductPriceHistory`, written by the product update route).
- **Supplier (3)**: supplier statement; supplier unpaid invoice; supplier invoice received.
- **Finance (3)**: profit and loss; balance sheet; trial balance.
- **Maintenance (1)**: audit trail (over `ActivityLog`, always available to every tier).
- **Payroll (4)**: payroll run summary; statutory deductions summary (PAYE/NSSF/SHIF/AHL/NITA); payslip register;
  P9 annual export (reuses the `p9Csv`/`p9EmployeeSummary` figures).
- **Asset (3)**: asset register; depreciation schedule; maintenance cost.
- **eTIMS (2)**: eTIMS submission log/status; VAT output reconciliation.

---

## Notes on what this audit does and does not cover

- This is a **code-level** gap analysis, not a product-sign-off. Confirmed means the report is reachable,
  filterable and exportable through the engine and has a write path; entitlement gating (`canAccessFeature`,
  spec §10) still decides which plans can see it, and a tenant with no data in that area still returns empty rows.
- Capture UIs differ by depth: department/WHT rates are captured in the customer form, comps on the POS payment
  strip, lots on the GRN receive payload, maintenance through the assets maintenance endpoint. Stock transfer and
  stock-take additionally have dedicated forms in the Inventory → Stock Sheet tab.
- Catalog provisioning runs at signup (`ensureReportCatalog`), so new tenants start with the full catalog rather
  than an empty Reports page.
