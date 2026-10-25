# LipaPoint ERP — Reports Checklist (Authoritative, No Omissions)

**This file is the single source of truth for what "reporting" means on this project.** `lipapoint-erp-spec.md` §5 and `lipapoint-marketing-pricing-spec.md` §4 both summarized this list — this file is the unabridged version and overrides both on report scope if they ever drift. Every report below is a hard requirement, not a representative sample. **49 reports are listed from the client's own PDF notes, plus 9 more required for the ERP modules the client is adding (Payroll, Assets, eTIMS) that the PDF predates.** Build all 58. None are optional, none are "nice to have," none get silently merged into a vaguer "analytics dashboard" instead of shipping as the named report.

If a report is implemented as a view inside a broader dashboard instead of its own named, filterable, exportable report, that does NOT satisfy this spec — each line below must be independently reachable, filterable by date range/branch at minimum, and exportable (CSV + PDF, per §4).

---

## 1. Architecture (build once, reuse 58 times)

Per `lipapoint-erp-spec.md` §5: one `ReportDefinition` model (name, module, query template, parameters, output columns) + one shared rendering component (table view, CSV export, PDF export, print). **Do not hand-build 58 bespoke pages.** Each report in the checklist below becomes one `ReportDefinition` row plus its query — that's the unit of "done" referenced in §4.

Every report MUST support, at minimum:
- Date range filter
- Branch/outlet filter (where the tenant has >1 branch)
- CSV export and PDF export
- Tenant-scoped (never cross-tenant data, no exceptions)

---

## 2. Sales Reports — 18 (from PDF, verbatim list)

- [x] Invoice Report
- [x] Sales detailed report
- [x] Sales Summary report
- [x] Unpaid bills report
- [x] Sales by hour report
- [x] Sales by day report
- [x] Sales by week report
- [x] Sales by month report
- [x] Sales by sales rep report
- [x] Sales by sales rep per day report
- [x] Sales by item per day report
- [x] Items sold out of set price report *(flags sales where `SaleItem.overridePrice` was used — the "bargain pricing" feature — so management can see every discount/override, not just the discount-field ones)*
- [x] Sales complementary report *(comped/free sales — needs a `paymentMethod` or `saleType` value for "complementary", not inferred from a zero price)*
- [x] Sales by till/mpesa/card/pdq/cash report *(one report, grouped by `paymentMethod`)*
- [x] Sales by tax report
- [x] Sales by customer report
- [x] Discount report
- [x] Sales return/credit sales report

## 3. Customer Reports — 4 (from PDF)

- [x] Customer statement (detailed and summary — two output modes of one report)
- [x] Customer balance (detailed and summary — two output modes of one report)
- [x] Customer balance by department
- [x] Withholding tax by customer

## 4. Cash / Bank / Cashier Reports — 8 (from PDF, "Return/Bank Statements")

- [x] Cash/bank statements (summary and detailed)
- [x] Cash/Bank report (summary and detailed)
- [x] Cashier cash/prints report
- [x] Cheques received report/statement
- [x] Transfer reports (fund/money transfers)
- [x] Cashier shortage report
- [x] M-Pesa/card/PDQ report
- [x] Cash collection from cashiers report

## 5. Stock Reports — 12 (from PDF)

- [x] Stock report (detailed and summary)
- [x] Stock report by department
- [x] Stock valuation report (at cost AND at selling price — both bases required, per client's explicit wording)
- [x] Re-order points report *(client explicitly flagged: "make sure stock alerts work perfectly" — treat the alerting, not just the report view, as part of this requirement)*
- [x] Stock received report (detailed and summary)
- [x] Items not sold report
- [x] Stock transferred report
- [x] Stock adjustment report
- [x] Stock expiry report
- [x] Physical stock-take report
- [x] Purchased-by-item report
- [x] Price change report

## 6. Supplier Reports — 3 (from PDF)

- [x] Supplier statement
- [x] Supplier unpaid invoice report
- [x] Supplier invoice received report

## 7. Finance Reports — 3 (from PDF)

- [x] Profit and Loss statement
- [x] Balance Sheet
- [x] Trial Balance *(the PDF's notes call this "Prior Balance" — same report, build it as a standard Trial Balance since that's the accounting term the P&L/Balance Sheet pairing implies)*

## 8. Maintenance Reports — 1 (from PDF)

- [x] Audit trail report *(surfaces `AuditLog`, filterable by user/module/date/action — not raw table rows)*

**PDF subtotal: 18 + 4 + 8 + 12 + 3 + 3 + 1 = 49 reports.**

---

## 9. Additional Reports Required for the ERP Modules (not in the PDF — the PDF predates the Payroll/Assets/eTIMS expansion, but these are load-bearing for the ERP positioning and MUST be built to the same standard)

### Payroll — 4
- [x] Payroll run summary (per `PayrollRun`: gross, statutory totals, net, headcount)
- [x] Statutory deductions summary (PAYE / NSSF / SHIF / Housing Levy / NITA, each broken out — this is what an employer hands to a compliance review)
- [x] Payslip register (list view across employees for a period, not just individual payslip PDFs)
- [x] P9 annual export *(per-employee statutory summary for KRA filing — distinct from the payslip register)*

### Asset Management — 3
- [x] Asset register (full list, cost, lifecycle status, assigned-to, current book value)
- [x] Depreciation schedule (per asset, per period, projected and posted)
- [x] Maintenance cost report (per asset and aggregated, from `AssetMaintenance`)

### eTIMS / Tax Compliance — 2
- [x] eTIMS submission log/status report (pending/submitted/accepted/rejected, with retry queue visibility — not just a raw `EtimsInvoice` table)
- [x] VAT output reconciliation report (reconciles `EtimsInvoice`-submitted totals against the Sales-by-tax report in §2, so discrepancies are visible before a filing deadline, not after)

**ERP-module subtotal: 4 + 3 + 2 = 9 reports.**

**Grand total: 58 reports.** This number is the acceptance bar — if the build ships with fewer named, filterable, exportable reports than this, the reports requirement is not done, regardless of how comprehensive the underlying "analytics" dashboard looks.

---

## 10. Mapping to pricing entitlements (so reports ship behind the right flag)

Cross-reference `pricing-config.ts`:

| Report group | Feature flag | Tier it unlocks at |
|---|---|---|
| §2 Sales Reports | `sales-reports` | Professional (all verticals) |
| §5 Stock Reports | `stock-reports` | Professional (Retail, Restaurant); Enterprise (Barbershop) |
| §3 Customer Reports | `customer-reports` | Enterprise |
| §4 Cash/Bank/Cashier Reports | `cashier-reports` | Enterprise |
| §6 Supplier Reports | `procurement` | Enterprise |
| §7 Finance Reports | `finance` | Enterprise |
| §8 Audit trail | *(always available — not gated; every tier needs to see its own audit trail)* | all tiers |
| §9 Payroll reports | `payroll` | Enterprise |
| §9 Asset reports | `assets` | Enterprise |
| §9 eTIMS reports | `etims` | Enterprise |

**MUST:** a report's visibility in the UI is driven by `canAccessFeature()` against this table — never a separate, hand-maintained report-permissions list that can drift from `pricing-config.ts`.

---

## 11. Build order

1. Reporting engine skeleton (§1) — do this before report #1, not after a few reports are already hand-built.
2. §2 Sales Reports (18) — POS data already exists; highest immediate value; unlocks the `sales-reports` flag meaningfully.
3. §5 Stock Reports (12) — Inventory data already exists.
4. §7 Finance Reports (3) + §4 Cash/Bank Reports (8) — depend on the Finance module's `JournalEntry`/`BankTransaction` data being populated, so sequence after Finance module posting is confirmed working end-to-end.
5. §3 Customer Reports (4) + §6 Supplier Reports (3) — depend on CRM/Procurement data.
6. §9 Payroll Reports (4) — depend on `PayrollRun`/`Payslip` data; P9 export specifically should reuse/verify against the `p9Csv`/`p9EmployeeSummary` functions already noted as built in the dev log, not rebuilt from scratch.
7. §9 Asset Reports (3) — depend on `AssetDepreciationEntry`/`AssetMaintenance`.
8. §9 eTIMS Reports (2) — depend on `EtimsInvoice` data; build last since it also needs the Sales-by-tax report (§2) to exist first for the reconciliation report to have something to reconcile against.
9. §8 Audit trail (1) — can be built any time after `AuditLog` exists; low dependency, low risk, don't deprioritize it just because it's one line.

Track progress against this file's 58 checkboxes directly — check one off per report as it ships, so "reporting is done" has an unambiguous, countable definition rather than a subjective one.
