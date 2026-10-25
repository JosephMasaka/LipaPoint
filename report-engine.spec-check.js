const XLSX = require("xlsx");
const path = require("path");

const WORKBOOK_PATH = path.resolve(__dirname, "lipapoint-reports-gap-analysis.xlsx");

// Expected shape (source of truth for this project)
const EXPECTED_SHEETS = ["Report Status", "Summary"];

const EXPECTED_REPORT_STATUS_COLUMNS = ["#", "Section", "Report Name", "Status", "Evidence / Notes"];
const EXPECTED_SUMMARY_SECTIONS = [
  "Sales Reports",
  "Customer Reports",
  "Cash / Bank / Cashier Reports",
  "Stock Reports",
  "Supplier Reports",
  "Finance Reports",
  "Maintenance Reports",
  "Payroll Reports",
  "Asset Reports",
  "eTIMS Reports",
];

// Pinned workbook totals. Re-run `node report-engine.reconcile.js` after the
// report engine changes, then update these to match — the pair (reconcile,
// this file) is what keeps the workbook from drifting.
const EXPECTED_SUMMARY_TOTAL_ROWS = {
  Confirmed: 58,
  Partial: 0,
  "Not Confirmed": 0,
  Total: 58,
};

// Allowed statuses across the sheet
const ALLOWED_STATUSES = new Set(["Confirmed", "Partial", "Not Confirmed"]);

// Reports that MUST be present by section — used for completeness assertion
// (this is a representative cross-check; the file is the authority)
const EXPECTED_REPORTS_BY_SECTION = {
  "Sales Reports": new Set([
    "Invoice Report",
    "Sales detailed report",
    "Sales summary report",
    "Unpaid bills report",
    "Sales by hour report",
    "Sales by day report",
    "Sales by week report",
    "Sales by month report",
    "Sales by sales rep report",
    "Sales by sales rep per day report",
    "Sales by item per day report",
    "Items sold out of set price report",
    "Sales complementary report",
    "Sales by till/mpesa/card/pdq/cash report",
    "Sales by tax report",
    "Sales by customer report",
    "Discount report",
    "Sales return/credit sales report",
  ]),
  "Customer Reports": new Set([
    "Customer statement (detailed & summary)",
    "Customer balance (detailed & summary)",
    "Customer balance by department",
    "Withholding tax by customer",
  ]),
  "Cash / Bank / Cashier Reports": new Set([
    "Cash/bank statements (summary & detailed)",
    "Cash/Bank report (summary & detailed)",
    "Cashier cash/prints report",
    "Cheques received report/statement",
    "Transfer reports",
    "Cashier shortage report",
    "M-Pesa/card/PDQ report",
    "Cash collection from cashiers report",
  ]),
  "Stock Reports": new Set([
    "Stock report (detailed & summary)",
    "Stock report by department",
    "Stock valuation report (cost & selling price)",
    "Re-order points report",
    "Stock received report (detailed & summary)",
    "Items not sold report",
    "Stock transferred report",
    "Stock adjustment report",
    "Stock expiry report",
    "Physical stock-take report",
    "Purchased-by-item report",
    "Price change report",
  ]),
  "Supplier Reports": new Set([
    "Supplier statement",
    "Supplier unpaid invoice report",
    "Supplier invoice received report",
  ]),
  "Finance Reports": new Set([
    "Profit and Loss statement",
    "Balance Sheet",
    "Trial Balance",
  ]),
  "Maintenance Reports": new Set([
    "Audit trail report",
  ]),
  "Payroll Reports": new Set([
    "Payroll run summary",
    "Statutory deductions summary (PAYE/NSSF/SHIF/AHL)",
    "Payslip register",
    "P9 annual export",
  ]),
  "Asset Reports": new Set([
    "Asset register",
    "Depreciation schedule",
    "Maintenance cost report",
  ]),
  "eTIMS Reports": new Set([
    "eTIMS submission log/status report",
    "VAT output reconciliation report",
  ]),
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function readSheet(name) {
  const wb = XLSX.readFile(WORKBOOK_PATH);
  if (!wb.SheetNames.includes(name)) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
}

let errors = [];
let checks = 0;

// 1) Workbook-level
checks++;
const wb = XLSX.readFile(WORKBOOK_PATH);
const sheets = wb.SheetNames;
if (!EXPECTED_SHEETS.every((s) => sheets.includes(s))) {
  errors.push(["workbook", `Expected sheets ${EXPECTED_SHEETS.join(", ")} but got ${sheets.join(", ")}`]);
}

// 2) Report Status sheet
checks++;
const reportStatus = readSheet("Report Status");
if (!reportStatus) {
  errors.push(["Report Status", "Sheet missing"]);
} else {
  const header = reportStatus[0];
  if (header?.join(",") !== EXPECTED_REPORT_STATUS_COLUMNS.join(",")) {
    errors.push([
      "Report Status header",
      `Expected ${EXPECTED_REPORT_STATUS_COLUMNS.join(", ")} but got ${header?.join(", ")}`,
    ]);
  }

  const rows = reportStatus.slice(1).filter((r) => r && r[0] !== "");
  const rowMap = new Map();
  for (const r of rows) {
    const num = r[0];
    if (rowMap.has(num)) {
      errors.push(["Report Status duplicate #", `Duplicate row number ${num}`]);
    }
    rowMap.set(num, r);
  }

  // Status values
  for (const r of rows) {
    const status = r[3];
    if (!ALLOWED_STATUSES.has(status)) {
      errors.push(["Report Status invalid status", `Row #${r[0]}: status="${status}"`]);
    }
  }

  // Coverage by section (existence + status)
  const sectionRows = new Map();
  for (const r of rows) {
    const section = r[1];
    if (!sectionRows.has(section)) sectionRows.set(section, []);
    sectionRows.get(section).push(r);
  }

  for (const [section, expected] of Object.entries(EXPECTED_REPORTS_BY_SECTION)) {
    const present = sectionRows.get(section) || [];
    const presentNames = new Set(present.map((r) => r[2].trim()));
    for (const name of expected) {
      if (!presentNames.has(name)) {
        errors.push(["Report Status missing report", `${section}::${name}`]);
      }
    }
    // Cross-check counts
    const expectedCount = expected.size;
    const actualCount = present.length;
    if (expectedCount !== actualCount) {
      errors.push(["Report Status section count mismatch", `${section}: expected ${expectedCount}, got ${actualCount}`]);
    }
  }

  // Totals
  const counts = { Confirmed: 0, Partial: 0, "Not Confirmed": 0 };
  for (const r of rows) {
    counts[r[3]] = (counts[r[3]] || 0) + 1;
  }
  const total = rows.length;
  if (counts.Confirmed !== EXPECTED_SUMMARY_TOTAL_ROWS.Confirmed) {
    errors.push(["Report Status total Confirmed", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS.Confirmed}, got ${counts.Confirmed}`]);
  }
  if (counts.Partial !== EXPECTED_SUMMARY_TOTAL_ROWS.Partial) {
    errors.push(["Report Status total Partial", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS.Partial}, got ${counts.Partial}`]);
  }
  if (counts["Not Confirmed"] !== EXPECTED_SUMMARY_TOTAL_ROWS["Not Confirmed"]) {
    errors.push([
      "Report Status total Not Confirmed",
      `expected ${EXPECTED_SUMMARY_TOTAL_ROWS["Not Confirmed"]}, got ${counts["Not Confirmed"]}`,
    ]);
  }
  if (total !== EXPECTED_SUMMARY_TOTAL_ROWS.Total) {
    errors.push(["Report Status total", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS.Total}, got ${total}`]);
  }
}

// 3) Summary sheet
checks++;
const summary = readSheet("Summary");
if (!summary) {
  errors.push(["Summary", "Sheet missing"]);
} else {
  const header = summary[0];
  if (!header?.includes("#") && !header?.includes("Status")) {
    // loosely assert it's the summary sheet
  }

  // Find counts table
  const countsRow = summary.find((r) => r[0] === "Status");
  if (!countsRow) {
    errors.push(["Summary", "Missing Status counts table header row"]);
  } else {
    const rows = summary.slice(summary.indexOf(countsRow) + 1);
    const map = new Map();
    for (const r of rows) {
      if (r[0] && r[1]) map.set(r[0].toString(), r[1]);
    }
    for (const [status, expected] of Object.entries(EXPECTED_SUMMARY_TOTAL_ROWS)) {
      const actual = map.get(status);
      if (actual === undefined) {
        errors.push(["Summary missing count row", status]);
      } else if (Number(actual) !== expected) {
        errors.push(["Summary count mismatch", `${status}: expected ${expected}, got ${actual}`]);
      }
    }
  }

  // By-section table
  const sectionHeaderRow = summary.find((r) => r[0] === "Section");
  if (!sectionHeaderRow) {
    errors.push(["Summary", "Missing Section counts table header row"]);
  } else {
  const sectionRows2 = summary.slice(summary.indexOf(sectionHeaderRow) + 1);
  const sectionMap = new Map();
  const grand = { Total: 0, Confirmed: 0, Partial: 0, "Not Confirmed": 0 };
  for (const r of sectionRows2) {
    if (!r || !r[0]) continue;
    const label = String(r[0]).trim();
    if (label === "Total") {
      // capture grand total row for cross-check
      grand.Total = Number(r[1]) || 0;
      grand.Confirmed = Number(r[2]) || 0;
      grand.Partial = Number(r[3]) || 0;
      grand["Not Confirmed"] = Number(r[4]) || 0;
      continue;
    }
    if (r[1] === undefined || r[1] === null) continue;
    sectionMap.set(label, {
      total: Number(r[1]),
      confirmed: Number(r[2]),
      partial: Number(r[3]),
      notConfirmed: Number(r[4]),
    });
  }
    if (sectionMap.size !== EXPECTED_SUMMARY_SECTIONS.length) {
      errors.push(["Summary sections count", `expected ${EXPECTED_SUMMARY_SECTIONS.length}, got ${sectionMap.size}`]);
    }
    for (const sec of EXPECTED_SUMMARY_SECTIONS) {
      if (!sectionMap.has(sec)) {
        errors.push(["Summary missing section row", sec]);
      }
    }
    // Verify section counts vs workbook totals table (Status-counts block)
    let sectionTotalSum = 0,
      sectionConfirmedSum = 0,
      sectionPartialSum = 0,
      sectionNcSum = 0;
    for (const m of sectionMap.values()) {
      sectionTotalSum += m.total;
      sectionConfirmedSum += m.confirmed;
      sectionPartialSum += m.partial;
      sectionNcSum += m.notConfirmed;
    }
    if (sectionMap.size !== EXPECTED_SUMMARY_SECTIONS.length) {
      errors.push(["Summary sections count", `expected ${EXPECTED_SUMMARY_SECTIONS.length}, got ${sectionMap.size}`]);
    }
    for (const sec of EXPECTED_SUMMARY_SECTIONS) {
      if (!sectionMap.has(sec)) {
        errors.push(["Summary missing section row", sec]);
      }
    }

    // Grand total cross-checks (against both the totals block and the section sums)
    if (grand.Total !== EXPECTED_SUMMARY_TOTAL_ROWS.Total) {
      errors.push(["Summary grand total", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS.Total}, got ${grand.Total}`]);
    }
    if (grand.Confirmed !== EXPECTED_SUMMARY_TOTAL_ROWS.Confirmed) {
      errors.push(["Summary grand confirmed", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS.Confirmed}, got ${grand.Confirmed}`]);
    }
    if (grand.Partial !== EXPECTED_SUMMARY_TOTAL_ROWS.Partial) {
      errors.push(["Summary grand partial", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS.Partial}, got ${grand.Partial}`]);
    }
    if (grand["Not Confirmed"] !== EXPECTED_SUMMARY_TOTAL_ROWS["Not Confirmed"]) {
      errors.push(["Summary grand not-confirmed", `expected ${EXPECTED_SUMMARY_TOTAL_ROWS["Not Confirmed"]}, got ${grand["Not Confirmed"]}`]);
    }

    if (sectionTotalSum !== grand.Total) {
      errors.push(["Summary section sum vs grand", `expected ${grand.Total}, got ${sectionTotalSum}`]);
    }
    if (sectionConfirmedSum !== grand.Confirmed) {
      errors.push(["Summary section confirmed sum vs grand", `expected ${grand.Confirmed}, got ${sectionConfirmedSum}`]);
    }
    if (sectionPartialSum !== grand.Partial) {
      errors.push(["Summary section partial sum vs grand", `expected ${grand.Partial}, got ${sectionPartialSum}`]);
    }
    if (sectionNcSum !== grand["Not Confirmed"]) {
      errors.push(["Summary section not-confirmed sum vs grand", `expected ${grand["Not Confirmed"]}, got ${sectionNcSum}`]);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("Report engine spec check");
console.log("Workbook:", WORKBOOK_PATH);
console.log("Checks:", checks);
console.log(
  `Pinned totals:   Confirmed=${EXPECTED_SUMMARY_TOTAL_ROWS.Confirmed}, Partial=${EXPECTED_SUMMARY_TOTAL_ROWS.Partial}, Not Confirmed=${EXPECTED_SUMMARY_TOTAL_ROWS["Not Confirmed"]}, Total=${EXPECTED_SUMMARY_TOTAL_ROWS.Total}`
);
const actualCounts = { Confirmed: 0, Partial: 0, "Not Confirmed": 0 };
for (const r of (reportStatus || []).slice(1)) {
  if (r && r[0] !== "" && actualCounts[r[3]] !== undefined) actualCounts[r[3]]++;
}
console.log(
  `Workbook totals: Confirmed=${actualCounts.Confirmed}, Partial=${actualCounts.Partial}, Not Confirmed=${actualCounts["Not Confirmed"]}, Total=${actualCounts.Confirmed + actualCounts.Partial + actualCounts["Not Confirmed"]}`
);
console.log("Sheets present:", sheets.join(", "));
console.log("Report Status rows:", reportStatus ? reportStatus.slice(1).filter((r) => r && r[0] !== "").length : 0);
console.log("");
if (errors.length === 0) {
  console.log("RESULT: PASS — gap-analysis workbook matches expected shape, sections, counts, and report list.");
  process.exit(0);
} else {
  console.log(`RESULT: FAIL — ${errors.length} mismatch(es):`);
  errors.forEach(([ctx, msg]) => console.log(`- [${ctx}] ${msg}`));
  process.exit(1);
}
