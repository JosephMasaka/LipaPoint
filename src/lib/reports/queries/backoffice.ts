import { db } from "@/lib/db";
import type { ReportQuery } from "../types";
import { dateFilter, round2 } from "../helpers";

/**
 * Back-office report queries (spec §9): Payroll, Asset Management, eTIMS.
 */

// ── Payroll Run Summary ─────────────────────────────────────────────────
const payrollRunSummary: ReportQuery = async (tenantId, params) => {
  const runs = await db.payrollRun.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    include: { payslips: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 200,
  });
  return {
    columns: [
      { key: "runId", label: "Run", kind: "text" },
      { key: "period", label: "Period", kind: "text" },
      { key: "employeeCount", label: "Employees", kind: "number" },
      { key: "payslipCount", label: "Payslips", kind: "number" },
      { key: "grossPay", label: "Gross Pay", kind: "currency" },
      { key: "totalDeductions", label: "Deductions", kind: "currency" },
      { key: "netPay", label: "Net Pay", kind: "currency" },
    ],
    rows: runs.map((r) => ({
      runId: r.id.slice(-6).toUpperCase(),
      period: r.period,
      employeeCount: r.payslips.length,
      payslipCount: r.payslips.length,
      grossPay: round2(r.grossPay),
      totalDeductions: round2(r.totalDeductions),
      netPay: round2(r.netPay),
    })),
    summary: {
      runs: runs.length,
      totalNetPay: round2(runs.reduce((s, r) => s + r.netPay, 0)),
    },
  };
};

// ── Statutory Deductions Summary ────────────────────────────────────────
const statutoryDeductions: ReportQuery = async (tenantId, params) => {
  const payslips = await db.payslip.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    include: { payrollRun: { select: { period: true } } },
  });

  const buckets = new Map<string, { paye: number; nssf: number; shif: number; ahl: number; nita: number }>();
  for (const p of payslips) {
    const period = p.payrollRun.period;
    const b = buckets.get(period) ?? { paye: 0, nssf: 0, shif: 0, ahl: 0, nita: 0 };
    b.paye += p.payePayable;
    b.nssf += p.nssfEmployee + p.nssfEmployer;
    b.shif += p.shif;
    b.ahl += p.housingLevyEmployee + p.housingLevyEmployer;
    b.nita += p.nitaLevy;
    buckets.set(period, b);
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, b]) => {
      const total = round2(b.paye + b.nssf + b.shif + b.ahl + b.nita);
      return {
        period,
        paye: round2(b.paye),
        nssf: round2(b.nssf),
        shif: round2(b.shif),
        housingLevy: round2(b.ahl),
        total,
      };
    });

  return {
    columns: [
      { key: "period", label: "Period", kind: "text" },
      { key: "paye", label: "PAYE", kind: "currency" },
      { key: "nssf", label: "NSSF", kind: "currency" },
      { key: "shif", label: "SHIF", kind: "currency" },
      { key: "housingLevy", label: "Housing Levy", kind: "currency" },
      { key: "total", label: "Total Statutory", kind: "currency" },
    ],
    rows,
  };
};

// ── Asset Register ──────────────────────────────────────────────────────
const assetRegister: ReportQuery = async (tenantId, params) => {
  const assets = await db.asset.findMany({
    where: { tenantId, ...dateFilter(params, "purchaseDate") },
    include: { location: { select: { name: true } } },
    orderBy: { assetCode: "asc" },
    take: params.limit ?? 500,
  });
  const rows = assets.map((a) => ({
    assetTag: a.assetCode,
    name: a.name,
    category: a.category,
    location: a.location?.name ?? "",
    cost: round2(a.purchaseCost),
    accumulatedDepreciation: round2(a.accumulatedDepreciation),
    bookValue: round2(a.purchaseCost - a.accumulatedDepreciation),
    status: a.lifecycleStatus,
  }));
  return {
    columns: [
      { key: "assetTag", label: "Asset Tag", kind: "text" },
      { key: "name", label: "Asset", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "location", label: "Location", kind: "text" },
      { key: "cost", label: "Cost", kind: "currency" },
      { key: "accumulatedDepreciation", label: "Accum. Depr.", kind: "currency" },
      { key: "bookValue", label: "Book Value", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows,
    summary: {
      assets: rows.length,
      totalCost: round2(rows.reduce((s, r) => s + (r.cost as number), 0)),
      totalBookValue: round2(rows.reduce((s, r) => s + (r.bookValue as number), 0)),
    },
  };
};

// ── Depreciation Schedule ───────────────────────────────────────────────
const depreciationSchedule: ReportQuery = async (tenantId, params) => {
  const entries = await db.assetDepreciationEntry.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    include: { asset: { select: { assetCode: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 1000,
  });
  return {
    columns: [
      { key: "assetTag", label: "Asset Tag", kind: "text" },
      { key: "name", label: "Asset", kind: "text" },
      { key: "period", label: "Period", kind: "text" },
      { key: "amount", label: "Depreciation", kind: "currency" },
      { key: "bookValueAfter", label: "Book Value After", kind: "currency" },
    ],
    rows: entries.map((e) => ({
      assetTag: e.asset.assetCode,
      name: e.asset.name,
      period: e.period,
      amount: round2(e.amount),
      bookValueAfter: round2(e.bookValueAfter),
    })),
    summary: {
      entries: entries.length,
      totalDepreciation: round2(entries.reduce((s, e) => s + e.amount, 0)),
    },
  };
};

// ── eTIMS Submission Log ────────────────────────────────────────────────
const etimsSubmissionLog: ReportQuery = async (tenantId, params) => {
  const invoices = await db.etimsInvoice.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
  const byStatus: Record<string, number> = {};
  for (const i of invoices) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;

  return {
    columns: [
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "submittedAt", label: "Submitted At", kind: "date" },
      { key: "status", label: "Status", kind: "text" },
      { key: "retries", label: "Retries", kind: "number" },
      { key: "lastError", label: "Last Error", kind: "text" },
    ],
    rows: invoices.map((i) => ({
      invoiceNumber: i.kraInvoiceNumber ?? i.sourceRef ?? i.sourceId,
      submittedAt: i.submittedAt ? i.submittedAt.toISOString() : "",
      status: i.status,
      retries: i.attempts,
      lastError: i.lastError ?? "",
    })),
    summary: byStatus,
  };
};

// ── VAT Output Reconciliation ───────────────────────────────────────────
const vatOutputReconciliation: ReportQuery = async (tenantId, params) => {
  const [orders, etims] = await Promise.all([
    db.order.findMany({
      where: { tenantId, ...dateFilter(params, "createdAt"), status: { notIn: ["CANCELLED", "REFUNDED"] } },
      select: { subtotal: true, taxAmount: true },
    }),
    db.etimsInvoice.aggregate({
      where: { tenantId, status: "accepted", ...dateFilter(params, "createdAt") },
      _sum: { taxAmount: true },
    }),
  ]);

  const taxableSales = round2(orders.reduce((s, o) => s + o.subtotal, 0));
  const vatOutput = round2(orders.reduce((s, o) => s + o.taxAmount, 0));
  const etimsSubmitted = round2(Number(etims._sum.taxAmount ?? 0));

  const period =
    params.from || params.to ? `${params.from ?? "…"} → ${params.to ?? "…"}` : "All time";

  return {
    columns: [
      { key: "period", label: "Period", kind: "text" },
      { key: "taxableSales", label: "Taxable Sales", kind: "currency" },
      { key: "vatOutput", label: "VAT Output", kind: "currency" },
      { key: "etimsSubmitted", label: "Submitted to eTIMS", kind: "currency" },
      { key: "variance", label: "Variance", kind: "currency" },
    ],
    rows: [
      {
        period,
        taxableSales,
        vatOutput,
        etimsSubmitted,
        variance: round2(vatOutput - etimsSubmitted),
      },
    ],
  };
};

// ── Payslip Register ───────────────────────────────────────────────────
const payslipRegister: ReportQuery = async (tenantId, params) => {
  const slips = await db.payslip.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    select: {
      grossPay: true,
      netPay: true,
      employee: { select: { staffNumber: true, firstName: true, lastName: true } },
      payrollRun: { select: { period: true, status: true } },
    },
    orderBy: [{ payrollRun: { period: "desc" } }, { employee: { staffNumber: "asc" } }],
    take: params.limit ?? 1000,
  });

  const rows = slips.map((s) => ({
    period: s.payrollRun.period,
    staffNumber: s.employee.staffNumber,
    employee: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
    grossPay: round2(s.grossPay),
    totalDeductions: round2(s.grossPay - s.netPay),
    netPay: round2(s.netPay),
    status: s.payrollRun.status,
  }));

  return {
    columns: [
      { key: "period", label: "Period", kind: "text" },
      { key: "staffNumber", label: "Staff No.", kind: "text" },
      { key: "employee", label: "Employee", kind: "text" },
      { key: "grossPay", label: "Gross Pay", kind: "currency" },
      { key: "totalDeductions", label: "Deductions", kind: "currency" },
      { key: "netPay", label: "Net Pay", kind: "currency" },
      { key: "status", label: "Run Status", kind: "text" },
    ],
    rows,
    summary: {
      payslips: rows.length,
      grossPay: round2(rows.reduce((s, r) => s + r.grossPay, 0)),
      netPay: round2(rows.reduce((s, r) => s + r.netPay, 0)),
    },
  };
};

// ── P9 Annual Export ───────────────────────────────────────────────────
// Per-employee statutory summary for KRA filing (spec §9). Uses the same
// Payslip figures `p9Csv`/`p9EmployeeSummary` report on, aggregated to the
// calendar year. Year comes from `from` (the report's year parameter);
// without one it falls back to the current year.
const p9AnnualExport: ReportQuery = async (tenantId, params) => {
  const year = params.from
    ? new Date(params.from).getUTCFullYear()
    : new Date().getUTCFullYear();

  const slips = await db.payslip.findMany({
    where: { tenantId, payrollRun: { period: { startsWith: `${year}-` } } },
    select: {
      taxablePay: true,
      payePayable: true,
      personalRelief: true,
      netPay: true,
      employee: {
        select: { staffNumber: true, firstName: true, lastName: true, kraPin: true },
      },
    },
  });

  const buckets = new Map<
    string,
    {
      staffNumber: string;
      employee: string;
      kraPin: string;
      months: number;
      taxable: number;
      paye: number;
      relief: number;
      net: number;
    }
  >();

  for (const s of slips) {
    const key = s.employee.staffNumber;
    const b = buckets.get(key) ?? {
      staffNumber: s.employee.staffNumber,
      employee: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
      kraPin: s.employee.kraPin || "",
      months: 0,
      taxable: 0,
      paye: 0,
      relief: 0,
      net: 0,
    };
    b.months += 1;
    b.taxable += s.taxablePay;
    b.paye += s.payePayable;
    b.relief += s.personalRelief;
    b.net += s.netPay;
    buckets.set(key, b);
  }

  const rows = [...buckets.values()]
    .map((b) => ({
      staffNumber: b.staffNumber,
      employee: b.employee,
      kraPin: b.kraPin,
      monthsWorked: b.months,
      annualTaxablePay: round2(b.taxable),
      annualPaye: round2(b.paye),
      personalRelief: round2(b.relief),
      annualNetPay: round2(b.net),
    }))
    .sort((a, b) => a.staffNumber.localeCompare(b.staffNumber));

  return {
    columns: [
      { key: "staffNumber", label: "Staff No.", kind: "text" },
      { key: "employee", label: "Employee", kind: "text" },
      { key: "kraPin", label: "KRA PIN", kind: "text" },
      { key: "monthsWorked", label: "Months", kind: "number" },
      { key: "annualTaxablePay", label: "Annual Taxable Pay", kind: "currency" },
      { key: "annualPaye", label: "PAYE Paid", kind: "currency" },
      { key: "personalRelief", label: "Personal Relief", kind: "currency" },
      { key: "annualNetPay", label: "Net Pay", kind: "currency" },
    ],
    rows,
    summary: {
      year,
      employees: rows.length,
      annualTaxablePay: round2(rows.reduce((s, r) => s + r.annualTaxablePay, 0)),
      annualPaye: round2(rows.reduce((s, r) => s + r.annualPaye, 0)),
    },
  };
};

// ── Asset Maintenance Cost ─────────────────────────────────────────────
// Aggregates AssetMaintenance rows written by the maintenance log route.
const maintenanceCostReport: ReportQuery = async (tenantId, params) => {
  const entries = await db.assetMaintenance.findMany({
    where: { tenantId, ...dateFilter(params, "date") },
    select: {
      date: true,
      cost: true,
      asset: { select: { assetCode: true, name: true, lifecycleStatus: true } },
    },
    orderBy: { date: "desc" },
  });

  const buckets = new Map<
    string,
    { name: string; status: string; count: number; total: number; last: Date }
  >();
  for (const e of entries) {
    const key = e.asset.assetCode;
    const b = buckets.get(key) ?? {
      name: e.asset.name,
      status: e.asset.lifecycleStatus,
      count: 0,
      total: 0,
      last: new Date(0),
    };
    b.count += 1;
    b.total += e.cost;
    if (e.date > b.last) b.last = e.date;
    buckets.set(key, b);
  }

  const rows = [...buckets.entries()]
    .map(([assetTag, b]) => ({
      assetTag,
      name: b.name,
      maintenanceCount: b.count,
      totalCost: round2(b.total),
      lastServiceDate: b.last.toISOString().slice(0, 10),
      status: b.status,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    columns: [
      { key: "assetTag", label: "Asset Tag", kind: "text" },
      { key: "name", label: "Asset", kind: "text" },
      { key: "maintenanceCount", label: "Services", kind: "number" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
      { key: "lastServiceDate", label: "Last Service", kind: "date" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows,
    summary: {
      assets: rows.length,
      events: entries.length,
      totalCost: round2(rows.reduce((s, r) => s + r.totalCost, 0)),
    },
  };
};

export const BACKOFFICE_QUERIES: Record<string, ReportQuery> = {
  payroll_run_summary: payrollRunSummary,
  statutory_deductions_summary: statutoryDeductions,
  payslip_register: payslipRegister,
  p9_annual_export: p9AnnualExport,
  asset_register: assetRegister,
  depreciation_schedule: depreciationSchedule,
  etims_submission_log: etimsSubmissionLog,
  vat_output_reconciliation: vatOutputReconciliation,
  maintenance_cost_report: maintenanceCostReport,
};