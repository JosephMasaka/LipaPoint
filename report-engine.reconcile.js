/**
 * Reconciles `lipapoint-reports-gap-analysis.xlsx` with the built state of the
 * report engine (LipaPoint ERP spec §5 / reports-spec).
 *
 * The statuses below are the source of truth; the workbook is regenerated from
 * them so the two can never drift. Structure (sheets, header, sections, row
 * order) is preserved — only Status, Evidence/Notes and the Summary counts
 * change. Run `node report-engine.spec-check.js` afterwards to assert the
 * workbook still matches the pinned expectations.
 *
 * Usage: node report-engine.reconcile.js
 */
const XLSX = require("xlsx");

const PATH = "lipapoint-reports-gap-analysis.xlsx";

/**
 * Per-report outcome, keyed by the workbook's `#` column (1..58).
 * "Confirmed"     = named, filterable, exportable report, query registered.
 * "Partial"       = report built, but its data source has no writer yet.
 * "Not Confirmed" = report row exists (501) pending a schema/data-model gap.
 */
const REPORTS = {
  1: ["Confirmed", "ReportDefinition invoice-report + registered query; CSV/PDF export via the shared renderer."],
  2: ["Confirmed", "ReportDefinition sales-detailed + registered query (line-level)."],
  3: ["Confirmed", "ReportDefinition sales-summary + registered query (day/week/month buckets)."],
  4: ["Confirmed", "ReportDefinition unpaid-bills + registered query over open orders, with aging."],
  5: ["Confirmed", "ReportDefinition sales-by-hour + registered query."],
  6: ["Confirmed", "ReportDefinition sales-by-day + registered query."],
  7: ["Confirmed", "ReportDefinition sales-by-week + registered query (ISO week bucketing)."],
  8: ["Confirmed", "ReportDefinition sales-by-month + registered query."],
  9: ["Confirmed", "ReportDefinition sales-by-sales-rep; aggregates Order.userId -> User.name."],
  10: ["Confirmed", "ReportDefinition sales-by-sales-rep-per-day; per-rep daily buckets."],
  11: ["Confirmed", "ReportDefinition sales-by-item (per-day item sales)."],
  12: ["Confirmed", "ReportDefinition items-sold-out-of-set-price; derived by comparing OrderItem.unitPrice against Product/UnitOfMeasure price — no overridePrice column required."],
  13: ["Confirmed", "COMPLIMENTARY PaymentMethod plus a POS \"Comp\" button; the query filters that explicit method (never inferred from a zero price)."],
  14: ["Confirmed", "ReportDefinition sales-by-payment-method; one report grouped by paymentMethod."],
  15: ["Confirmed", "ReportDefinition sales-by-tax; taxable sales and tax per rate."],
  16: ["Confirmed", "ReportDefinition sales-by-customer + registered query."],
  17: ["Confirmed", "ReportDefinition discount-report + registered query."],
  18: ["Confirmed", "ReportDefinition sales-return-report over the credit-note engine."],

  19: ["Confirmed", "ReportDefinition customer-statement; ledger with opening/closing balance."],
  20: ["Confirmed", "ReportDefinition customer-balance + registered query with aging."],
  21: ["Confirmed", "Customer.department captured on create/update and in the customer form; the query groups outstanding balances by department, falling back to a name match for orders saved before customerId existed."],
  22: ["Confirmed", "Customer.whtRate is snapshotted onto Order.whtRate/whtAmount when a sale is raised or a tab is settled; the query sums what was actually withheld per customer, never re-deriving from today's rate."],

  23: ["Confirmed", "GET /api/reports/cash-bank-statement over BankTransaction, in date order."],
  24: ["Confirmed", "GET /api/reports/cash-bank-summary — opening, receipts, payments, closing per wallet."],
  25: ["Confirmed", "ReportDefinition cashier-cash-print-report over DailySummary."],
  26: ["Confirmed", "BankTransaction.category='cheque' (chequeNumber/counterparty) recorded from the Banking page; query wired."],
  27: ["Confirmed", "Auto-classified as 'transfer' when the counter-account is another cash/bank wallet; query resolves both wallet names."],
  28: ["Confirmed", "ReportDefinition cashier-shortage-report over DailySummary short/excess."],
  29: ["Confirmed", "ReportDefinition mpesa-card-pdq-report over gateway transactions."],
  30: ["Confirmed", "ReportDefinition cash-collection-from-cashiers over DailySummary cash surrendered."],

  31: ["Confirmed", "ReportDefinition stock-report + registered query over Product/Stock."],
  32: ["Confirmed", "ReportDefinition stock-by-department (grouped by category)."],
  33: ["Confirmed", "ReportDefinition stock-valuation at cost AND selling price, with margin."],
  34: ["Confirmed", "ReportDefinition reorder-points + registered query; items at/below reorder level with suggested qty."],
  35: ["Confirmed", "ReportDefinition stock-received over GRN receipts."],
  36: ["Confirmed", "ReportDefinition items-not-sold + registered query."],
  37: ["Confirmed", "Built against paired StockMovement legs sharing a reference; POST /api/stock/transfer and the Inventory → Transfer form write them (out leg, in leg, stock moved on both sides) — verified returning rows."],
  38: ["Confirmed", "ReportDefinition stock-adjustment over StockMovement type=ADJUSTMENT."],
  39: ["Confirmed", "StockBatch lots (batchNumber + expiryDate) written by the GRN receive flow; the query lists lots with days-to-expiry, negatives for stock already past its date."],
  40: ["Confirmed", "POST /api/stock/take and the Inventory → Stock Take form persist the counted figure as closingStock plus countedAt on every counted line, and correct on-hand with a signed ADJUSTMENT; verified returning the full count sheet."],
  41: ["Confirmed", "ReportDefinition purchased-by-item over GRN items, aggregated per item with supplier."],
  42: ["Confirmed", "ProductPriceHistory written by the product update route on every price move; query wired this pass."],

  43: ["Confirmed", "ReportDefinition supplier-statement over invoices and payments."],
  44: ["Confirmed", "ReportDefinition supplier-unpaid-invoices with aging and days outstanding."],
  45: ["Confirmed", "ReportDefinition supplier-invoice-received against GRNs, with matching status."],

  46: ["Confirmed", "GET /api/reports/profit-and-loss built on JournalLine/ChartOfAccount."],
  47: ["Confirmed", "GET /api/reports/balance-sheet built on JournalLine/ChartOfAccount."],
  48: ["Confirmed", "GET /api/reports/trial-balance (the PDF's \"Prior Balance\")."],

  49: ["Confirmed", "GET /api/reports/audit-trail over ActivityLog, filterable by user/module/action/date; always available to every tier."],

  50: ["Confirmed", "ReportDefinition payroll-run-summary over PayrollRun with frozen run totals."],
  51: ["Confirmed", "ReportDefinition statutory-deductions-summary — PAYE/NSSF/SHIF/AHL/NITA broken out per period."],
  52: ["Confirmed", "GET /api/payroll/runs/[id]/export?format=register, plus the payslip-register report query."],
  53: ["Confirmed", "GET /api/payroll/p9?year=..., plus the p9-annual-export report query reusing the same Payslip figures."],

  54: ["Confirmed", "ReportDefinition asset-register — cost, accumulated depreciation, book value, status, assigned-to."],
  55: ["Confirmed", "ReportDefinition depreciation-schedule over AssetDepreciationEntry."],
  56: ["Confirmed", "AssetMaintenance model with POST/GET /api/assets/[id]/maintenance (validated, audited); the query aggregates service count, cost and last service date per asset."],

  57: ["Confirmed", "getEtimsStats() exposed through GET /api/reports/etims-submission-log with retry visibility."],
  58: ["Confirmed", "getVatReconciliation() exposed through GET /api/reports/vat-output-reconciliation against sales-by-tax."],
};

const SECTION_OF_ROW = {
  1: "Sales Reports", 19: "Customer Reports", 23: "Cash / Bank / Cashier Reports",
  31: "Stock Reports", 43: "Supplier Reports", 46: "Finance Reports",
  49: "Maintenance Reports", 50: "Payroll Reports", 54: "Asset Reports",
  57: "eTIMS Reports",
};
const SECTION_TOTALS = {
  "Sales Reports": 18, "Customer Reports": 4, "Cash / Bank / Cashier Reports": 8,
  "Stock Reports": 12, "Supplier Reports": 3, "Finance Reports": 3,
  "Maintenance Reports": 1, "Payroll Reports": 4, "Asset Reports": 3,
  "eTIMS Reports": 2,
};
const PCT = (n) => `${Math.round((n / 58) * 1000) / 10}%`;

function rowSection(n) {
  const starts = Object.keys(SECTION_OF_ROW).map(Number).sort((a, b) => b - a);
  for (const s of starts) if (n >= s) return SECTION_OF_ROW[s];
  throw new Error(`No section for row ${n}`);
}

function rebuildSheet(wb, name, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const old = wb.Sheets[name];
  if (old) {
    if (old["!cols"]) ws["!cols"] = old["!cols"];
    if (old["!merges"]) ws["!merges"] = old["!merges"];
  }
  wb.Sheets[name] = ws;
}

function main() {
  const wb = XLSX.readFile(PATH);
  const statusRows = XLSX.utils.sheet_to_json(wb.Sheets["Report Status"], {
    header: 1,
    raw: false,
    defval: "",
  });

  const header = statusRows[0];
  const out = [header];
  const totals = { Confirmed: 0, Partial: 0, "Not Confirmed": 0 };
  const bySection = new Map();

  for (const row of statusRows.slice(1)) {
    const n = Number(row[0]);
    if (!n) continue;
    const entry = REPORTS[n];
    if (!entry) throw new Error(`No status entry for report #${n} (${row[2]})`);
    const [status, evidence] = entry;
    if (!(status in totals)) throw new Error(`Bad status "${status}" for #${n}`);

    totals[status] += 1;
    const section = rowSection(n);
    const bucket = bySection.get(section) || { Confirmed: 0, Partial: 0, "Not Confirmed": 0 };
    bucket[status] += 1;
    bySection.set(section, bucket);

    out.push([row[0], row[1], row[2], status, evidence]);
  }

  const total = totals.Confirmed + totals.Partial + totals["Not Confirmed"];
  if (total !== 58) throw new Error(`Expected 58 reports, got ${total}`);
  if (out.length !== 59) throw new Error(`Expected 59 rows incl. header, got ${out.length}`);

  const summary = [
    ["LipaPoint ERP — Reports Spec Gap Analysis"],
    [],
    ["Overall totals (of 58 required reports)"],
    ["Status", "Count", "% of 58"],
    ["Confirmed", String(totals.Confirmed), PCT(totals.Confirmed)],
    ["Partial", String(totals.Partial), PCT(totals.Partial)],
    ["Not Confirmed", String(totals["Not Confirmed"]), PCT(totals["Not Confirmed"])],
    ["Total", String(total), "100.0%"],
    [],
    ["By report-group section"],
    ["Section", "Total", "Confirmed", "Partial", "Not Confirmed"],
  ];
  for (const section of Object.keys(SECTION_TOTALS)) {
    const b = bySection.get(section) || { Confirmed: 0, Partial: 0, "Not Confirmed": 0 };
    summary.push([
      section,
      String(SECTION_TOTALS[section]),
      String(b.Confirmed),
      String(b.Partial),
      String(b["Not Confirmed"]),
    ]);
  }
  summary.push([
    "Total",
    String(total),
    String(totals.Confirmed),
    String(totals.Partial),
    String(totals["Not Confirmed"]),
  ]);
  summary.push([], []);
  summary.push(["Confirmed = report built: a ReportDefinition row plus a registered query, filterable by date and exportable per lipapoint-reports-spec.md §1."]);
  summary.push(["Partial = report built and exportable, but its data source has no writer yet, so it renders empty until that flow exists."]);
  summary.push(["Not Confirmed = catalog row exists but returns 501 — blocked on a schema/data-model gap."]);

  rebuildSheet(wb, "Report Status", out);
  rebuildSheet(wb, "Summary", summary);
  XLSX.writeFile(wb, PATH);

  console.log(
    `Reconciled ${PATH}: Confirmed=${totals.Confirmed} Partial=${totals.Partial} NotConfirmed=${totals["Not Confirmed"]} Total=${total}`
  );
}

main();
