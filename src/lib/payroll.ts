import { db } from "./db";
import type { Prisma } from "@prisma/client";
import { postJournalEntry } from "./journal";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit";

/**
 * Kenya statutory payroll engine + payroll run lifecycle
 * (LipaPoint ERP spec §4.4, §9).
 *
 * Rates are NEVER hardcoded in calculation logic: every payslip is computed
 * from the StatutoryRateTable row in force for the run's period, selected
 * by effectiveFrom. Kenya's rates change yearly (PAYE bands, NSSF caps,
 * SHIF), so a rate change is one new row — historical runs keep rateTableId
 * pointing at what was actually applied.
 *
 * Calculation order per spec §4.4:
 *   gross → subtract NSSF, SHIF, AHL (allowable pre-PAYE) → taxable pay →
 *   PAYE via bands → subtract personal relief → subtract other deductions
 *   (loans) → net pay.
 * Casual workers get exactly the same treatment — special-casing them out
 * is a common compliance mistake the spec calls out explicitly.
 *
 * Run states: draft → approved → paid → filed. Posting the journal entry
 * happens once, on `paid`, because that is when the money actually moved.
 */

export class PayrollError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "PayrollError";
  }
}

function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

type Db = typeof db | Prisma.TransactionClient;

// ─────────────────────────── statutory rates ───────────────────────────

export type PayeBand = {
  /** Upper bound of the band in KES/month; null = open-ended top band. */
  upTo: number | null;
  rate: number; // percent
};

export interface StatutoryRates {
  id: string;
  label: string;
  effectiveFrom: Date;
  payeBands: PayeBand[];
  personalRelief: number;
  nssfRateEmployee: number;
  nssfRateEmployer: number;
  nssfTier1Cap: number;
  nssfTier2Cap: number;
  shifRate: number;
  shifMinimum: number;
  housingLevyRate: number;
  nitaLevyPerEmployee: number;
}

/**
 * The reference rates seeded when no row exists yet. Values follow the
 * spec's 2026 reference set (PAYE 10/25/30/32.5/35 with relief 2,400;
 * NSSF 6%+6% capped by Tier I 8,000 / Tier II 108,000 → 6,480/mo each
 * side; SHIF 2.75% min 300; AHL 1.5% each side).
 *
 * MUST be verified against the current KRA/NSSF/SHA notices before
 * filing — that is exactly why they live in a versioned table: correct a
 * rate by inserting a row with a new effectiveFrom, never by editing the
 * calculation code.
 */
const DEFAULT_RATES = {
  label: "Kenya 2026 reference — verify against KRA/NSSF/SHA before filing",
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  payeBands: [
    { upTo: 24000, rate: 10 },
    { upTo: 32333, rate: 25 },
    { upTo: 500000, rate: 30 },
    { upTo: 800000, rate: 32.5 },
    { upTo: null, rate: 35 },
  ] as PayeBand[],
  personalRelief: 2400,
  nssfRateEmployee: 6,
  nssfRateEmployer: 6,
  nssfTier1Cap: 8000,
  nssfTier2Cap: 108000,
  shifRate: 2.75,
  shifMinimum: 300,
  housingLevyRate: 1.5,
  nitaLevyPerEmployee: 50,
  isDefault: true,
};

/**
 * Seeds the shared (platform) default rate row if none exists (idempotent).
 * Tenant overrides are never seeded — they only exist when a tenant adds one.
 */
export async function ensureStatutoryRates(): Promise<void> {
  const count = await db.statutoryRateTable.count({ where: { tenantId: null } });
  if (count > 0) return;
  await db.statutoryRateTable.create({ data: DEFAULT_RATES });
  console.log("  ✓ seeded default statutory rate table");
}

/**
 * Rates in force for a period ("2026-11"): the latest row whose
 * effectiveFrom is on or before the period start — a tenant's own override
 * row wins over the shared platform default for that tenant, so a tenant's
 * rate correction never leaks into another tenant's payslips.
 * Self-healing — seeds the default first if nothing exists, so no call path
 * can crash on an empty table (signup, backfill, direct API use).
 */
export async function getRatesForPeriod(period: string, tenantId?: string | null): Promise<StatutoryRates> {
  await ensureStatutoryRates();
  const monthStart = periodStart(period);

  const override = tenantId
    ? await db.statutoryRateTable.findFirst({
        where: { tenantId, effectiveFrom: { lte: monthStart } },
        orderBy: { effectiveFrom: "desc" },
      })
    : null;
  const row =
    override ??
    (await db.statutoryRateTable.findFirst({
      where: { tenantId: null, effectiveFrom: { lte: monthStart } },
      orderBy: { effectiveFrom: "desc" },
    }));
  if (!row) {
    // Only reachable if every shared row is future-dated — fall back to the
    // earliest available rather than refusing to run payroll.
    const earliest = await db.statutoryRateTable.findFirst({
      where: { tenantId: null },
      orderBy: { effectiveFrom: "asc" },
    });
    if (!earliest) throw new PayrollError("No statutory rate table rows found", 500);
    return toRates(earliest);
  }
  return toRates(row);
}

function toRates(row: {
  id: string;
  label: string;
  effectiveFrom: Date;
  payeBands: Prisma.JsonValue;
  personalRelief: number;
  nssfRateEmployee: number;
  nssfRateEmployer: number;
  nssfTier1Cap: number;
  nssfTier2Cap: number;
  shifRate: number;
  shifMinimum: number;
  housingLevyRate: number;
  nitaLevyPerEmployee: number;
}): StatutoryRates {
  return {
    id: row.id,
    label: row.label,
    effectiveFrom: row.effectiveFrom,
    payeBands: (row.payeBands as unknown as PayeBand[]) ?? DEFAULT_RATES.payeBands,
    personalRelief: row.personalRelief,
    nssfRateEmployee: row.nssfRateEmployee,
    nssfRateEmployer: row.nssfRateEmployer,
    nssfTier1Cap: row.nssfTier1Cap,
    nssfTier2Cap: row.nssfTier2Cap,
    shifRate: row.shifRate,
    shifMinimum: row.shifMinimum,
    housingLevyRate: row.housingLevyRate,
    nitaLevyPerEmployee: row.nitaLevyPerEmployee,
  };
}

/** "2026-11" → first instant of that month (UTC), for rate selection. */
export function periodStart(period: string): Date {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new PayrollError(`Invalid period "${period}" — expected YYYY-MM`);
  }
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

// ────────────────────────── payslip calculation ────────────────────────

export interface PayslipCalculation {
  grossPay: number;
  nssfEmployee: number;
  nssfEmployer: number;
  shif: number;
  housingLevyEmployee: number;
  housingLevyEmployer: number;
  taxablePay: number;
  paye: number; // before relief
  personalRelief: number;
  payePayable: number; // max(0, paye - relief) — what's withheld
  otherDeductions: number;
  loanDeduction: number;
  netPay: number;
  nitaLevy: number; // employer-only, accrued monthly
  rateTableId: string;
}

/**
 * NSSF Tier I + Tier II: 6% of the first tier1Cap, then 6% of earnings
 * between tier1Cap and tier2Cap — capped at 6% of tier2Cap (6,480 at the
 * seeded Year-4 caps).
 */
function nssfContribution(gross: number, caps: { tier1: number; tier2: number }, ratePercent: number): number {
  const tier1 = Math.min(gross, caps.tier1);
  const tier2 = Math.max(0, Math.min(gross, caps.tier2) - caps.tier1);
  return toCents(((tier1 + tier2) * ratePercent) / 100);
}

/** Progressive PAYE on taxable pay, before personal relief. */
export function calculatePaye(taxablePay: number, bands: PayeBand[]): number {
  let remaining = Math.max(taxablePay, 0);
  let previousCap = 0;
  let tax = 0;
  for (const band of bands) {
    const ceiling = band.upTo ?? Number.POSITIVE_INFINITY;
    const width = ceiling - previousCap;
    if (width <= 0) continue;
    const taxed = Math.min(remaining, width);
    tax += (taxed * band.rate) / 100;
    remaining -= taxed;
    previousCap = ceiling;
    if (remaining <= 0) break;
  }
  return toCents(tax);
}

export interface CalculatePayslipInput {
  grossPay: number;
  /** Active loan deductions for this employee this period. */
  loanDeduction?: number;
  /** Non-loan deductions (union dues, SACCO, HELB…). */
  otherDeductions?: number;
  rates: StatutoryRates;
}

/**
 * Computes one payslip. Total deductions are floored at gross so an
 * over-committed employee can never produce a negative net pay — excess
 * loan deductions simply carry to the next period (balance untouched).
 */
export function calculatePayslip(input: CalculatePayslipInput): PayslipCalculation {
  const { rates } = input;
  const gross = Math.max(toCents(input.grossPay), 0);

  const nssfEmployee = nssfContribution(gross, { tier1: rates.nssfTier1Cap, tier2: rates.nssfTier2Cap }, rates.nssfRateEmployee);
  const nssfEmployer = nssfContribution(gross, { tier1: rates.nssfTier1Cap, tier2: rates.nssfTier2Cap }, rates.nssfRateEmployer);
  const shif = toCents(Math.max((gross * rates.shifRate) / 100, gross > 0 ? rates.shifMinimum : 0));
  const housingLevyEmployee = toCents((gross * rates.housingLevyRate) / 100);
  const housingLevyEmployer = toCents((gross * rates.housingLevyRate) / 100);

  // Allowable pre-PAYE deductions (spec §4.4 order).
  const taxablePay = toCents(Math.max(0, gross - nssfEmployee - shif - housingLevyEmployee));
  const paye = calculatePaye(taxablePay, rates.payeBands);
  const personalRelief = toCents(Math.min(rates.personalRelief, paye));
  const payePayable = toCents(Math.max(0, paye - personalRelief));

  const netBeforeOther = toCents(gross - nssfEmployee - shif - housingLevyEmployee - payePayable);
  const requestedOther = toCents((input.loanDeduction ?? 0) + (input.otherDeductions ?? 0));
  const otherDeductions = Math.min(requestedOther, netBeforeOther);
  const loanDeduction = Math.min(toCents(input.loanDeduction ?? 0), otherDeductions);
  const netPay = toCents(netBeforeOther - otherDeductions);

  // Employer-only NITA training levy, accrued monthly (annual/12).
  const nitaLevy = toCents(rates.nitaLevyPerEmployee / 12);

  return {
    grossPay: gross,
    nssfEmployee,
    nssfEmployer,
    shif,
    housingLevyEmployee,
    housingLevyEmployer,
    taxablePay,
    paye,
    personalRelief,
    payePayable,
    otherDeductions,
    loanDeduction,
    netPay,
    nitaLevy,
    rateTableId: rates.id,
  };
}

// ─────────────────────────── run lifecycle ─────────────────────────────

export interface CreateRunInput {
  tenantId: string;
  period: string;
  createdBy?: string | null;
  /** Restrict to specific employees; defaults to all active ones. */
  employeeIds?: string[];
}

async function activeLoanDeduction(
  tx: Db,
  tenantId: string,
  employeeId: string
): Promise<number> {
  const loans = await tx.employeeLoan.findMany({
    where: { tenantId, employeeId, status: "active", balance: { gt: 0 } },
    select: { balance: true, monthlyDeduction: true },
  });
  return toCents(
    loans.reduce((sum, loan) => sum + Math.min(loan.monthlyDeduction, loan.balance), 0)
  );
}

/** Builds (or rebuilds) payslip rows for a run's period. */
async function buildPayslips(tx: Db, run: { id: string; tenantId: string; period: string }, employeeIds?: string[]) {
  const employees = await tx.employee.findMany({
    where: {
      tenantId: run.tenantId,
      active: true,
      ...(employeeIds && employeeIds.length > 0 ? { id: { in: employeeIds } } : {}),
    },
    select: { id: true, firstName: true, lastName: true, basicSalary: true },
    orderBy: { staffNumber: "asc" },
  });
  if (employees.length === 0) {
    throw new PayrollError("No active employees to pay for this period");
  }

  const rates = await getRatesForPeriod(run.period, run.tenantId);

  const rows: PayslipCalculation[] = [];
  for (const emp of employees) {
    const loanDeduction = await activeLoanDeduction(tx, run.tenantId, emp.id);
    rows.push(calculatePayslip({ grossPay: emp.basicSalary, loanDeduction, rates }));
  }

  await tx.payslip.deleteMany({ where: { payrollRunId: run.id } });
  await tx.payslip.createMany({
    data: employees.map((emp, i) => ({
      tenantId: run.tenantId,
      payrollRunId: run.id,
      employeeId: emp.id,
      ...rows[i],
    })),
  });

  return { employees, rates, rows };
}

function totalsOf(rows: PayslipCalculation[]) {
  const sum = (pick: (r: PayslipCalculation) => number) => toCents(rows.reduce((s, r) => s + pick(r), 0));
  const grossPay = sum((r) => r.grossPay);
  const totalDeductions = sum((r) => r.nssfEmployee + r.shif + r.housingLevyEmployee + r.payePayable + r.otherDeductions);
  const netPay = sum((r) => r.netPay);
  const totalEmployerCost = sum((r) => r.grossPay + r.nssfEmployer + r.housingLevyEmployer + r.nitaLevy);
  return { grossPay, totalDeductions, netPay, totalEmployerCost };
}

/**
 * Creates a draft run with provisional payslips. Drafts are recomputed on
 * approval, so salary changes made in between are picked up.
 */
export async function createPayrollRun(input: CreateRunInput) {
  periodStart(input.period); // validates format

  const existing = await db.payrollRun.findUnique({
    where: { tenantId_period: { tenantId: input.tenantId, period: input.period } },
  });
  if (existing) {
    throw new PayrollError(`A payroll run for ${input.period} already exists (${existing.status})`);
  }

  const run = await db.payrollRun.create({
    data: {
      tenantId: input.tenantId,
      period: input.period,
      status: "draft",
      createdBy: input.createdBy ?? null,
    },
  });

  try {
    const { rows } = await buildPayslips(db, run, input.employeeIds);
    const totals = totalsOf(rows);
    const updated = await db.payrollRun.update({ where: { id: run.id }, data: totals });

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.createdBy ?? null,
      action: AUDIT_ACTIONS.PAYROLL.RUN_CREATED,
      module: "payroll",
      entity: "payrollRun",
      entityId: run.id,
      after: { period: input.period, employees: rows.length, ...totals },
    });
    return updated;
  } catch (error) {
    // A run nobody can see is worse than no run — clean up on failure.
    await db.payrollRun.delete({ where: { id: run.id } }).catch(() => undefined);
    throw error;
  }
}

/** Recomputes payslips + totals and moves draft → approved (locked). */
export async function approvePayrollRun(tenantId: string, runId: string, userId?: string | null) {
  const run = await db.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new PayrollError("Payroll run not found", 404);
  if (run.status !== "draft") throw new PayrollError(`Run is already ${run.status}`);

  const { rows } = await buildPayslips(db, run);
  const totals = totalsOf(rows);

  const approved = await db.payrollRun.update({
    where: { id: run.id },
    data: { status: "approved", approvedBy: userId ?? null, ...totals },
  });

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.PAYROLL.RUN_APPROVED,
    module: "payroll",
    entity: "payrollRun",
    entityId: run.id,
    before: { status: "draft" },
    after: { status: "approved", employees: rows.length, ...totals },
  });
  return approved;
}

/**
 * approved → paid: posts the single payroll journal entry, settles staff
 * loan balances, and (when a bank wallet is linked) drops the matching
 * reconciled BankTransaction so the Banking page still reconciles.
 *
 * Journal shape (per payslip sums):
 *   DR 6000 Salaries & Wages              gross
 *   DR 6100 Statutory (Employer)          employer NSSF + AHL + NITA
 *   CR 2200 PAYE Payable                  Σ payePayable
 *   CR 2300 NSSF Payable                  employee + employer NSSF
 *   CR 2400 SHIF Payable                  Σ SHIF
 *   CR 2500 Housing Levy Payable          employee + employer AHL
 *   CR 2700 NITA Payable                  Σ NITA
 *   CR 1400 Staff Loans & Advances        loan repayments (receivable down)
 *   CR 2710 Other Deductions Payable      non-loan withholdings
 *   CR <wallet>                           Σ netPay   (balancing)
 */
type PaidRun = Prisma.PayrollRunGetPayload<{
  include: {
    payslips: {
      include: { employee: { select: { id: true; firstName: true; lastName: true } } };
    };
  };
}>;

export async function markPayrollRunPaid(
  tenantId: string,
  runId: string,
  opts: { userId?: string | null; bankAccountId?: string | null } = {}
) {
  const run = (await db.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: {
      payslips: {
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  })) as PaidRun | null;
  if (!run) throw new PayrollError("Payroll run not found", 404);
  if (run.status !== "approved") {
    throw new PayrollError(`Run must be approved before payment (is ${run.status})`);
  }
  if (run.payslips.length === 0) throw new PayrollError("Run has no payslips");

  const sum = (pick: (p: PaidRun["payslips"][number]) => number) =>
    toCents(run.payslips.reduce((s, p) => s + pick(p), 0));

  const gross = sum((p) => p.grossPay);
  const employer = sum((p) => p.nssfEmployer + p.housingLevyEmployer + nitaOf(p));
  const payePayable = sum((p) => p.payePayable);
  const nssf = sum((p) => p.nssfEmployee + p.nssfEmployer);
  const shif = sum((p) => p.shif);
  const ahl = sum((p) => p.housingLevyEmployee + p.housingLevyEmployer);
  const nita = sum((p) => nitaOf(p));
  const loanRepayments = sum((p) => p.loanDeduction);
  const otherDeductions = sum((p) => p.otherDeductions - p.loanDeduction);
  const netPay = sum((p) => p.netPay);

  // Wallet: the linked bank account's GL account, else generic Bank (1040).
  let walletCode = "1040";
  const bankAccountId: string | null = opts.bankAccountId ?? run.bankAccountId ?? null;
  if (bankAccountId) {
    const bank = await db.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId, isActive: true },
      include: { coaAccount: { select: { code: true } } },
    });
    if (!bank) throw new PayrollError("Bank account not found for this tenant", 404);
    if (!bank.coaAccount?.code) {
      throw new PayrollError(`Bank account ${bank.name} has no linked GL account`);
    }
    walletCode = bank.coaAccount.code;
  }

  const lines = [
    { accountCode: "6000", debit: gross, description: `Gross salaries — ${run.period}` },
    ...(employer > 0
      ? [{ accountCode: "6100", debit: employer, description: "Employer NSSF/AHL/NITA" }]
      : []),
    { accountCode: "2200", credit: payePayable, description: "PAYE withheld" },
    { accountCode: "2300", credit: nssf, description: "NSSF employee + employer" },
    { accountCode: "2400", credit: shif, description: "SHIF withheld" },
    { accountCode: "2500", credit: ahl, description: "Housing Levy both sides" },
    ...(nita > 0 ? [{ accountCode: "2700", credit: nita, description: "NITA levy" }] : []),
    ...(loanRepayments > 0
      ? [{ accountCode: "1400", credit: loanRepayments, description: "Staff loan repayments" }]
      : []),
    ...(otherDeductions > 0
      ? [{ accountCode: "2710", credit: otherDeductions, description: "Other withholdings" }]
      : []),
    { accountCode: walletCode, credit: netPay, description: `Net pay — ${run.period}` },
  ];

  const result = await db.$transaction(async (tx) => {
    const entry = await postJournalEntry(
      {
        tenantId,
        reference: `PAY-${run.period}`,
        sourceModule: "payroll",
        sourceId: run.id,
        description: `Payroll ${run.period} — ${run.payslips.length} employees`,
        postedBy: opts.userId ?? null,
        lines,
      },
      tx
    );

    // Settle staff loans: the forfeited pay portion is now collected.
    for (const slip of run.payslips) {
      if (slip.loanDeduction <= 0) continue;
      const loans = await tx.employeeLoan.findMany({
        where: { tenantId, employeeId: slip.employeeId, status: "active", balance: { gt: 0 } },
        orderBy: { startDate: "asc" },
      });
      let remaining = slip.loanDeduction;
      for (const loan of loans) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, loan.balance);
        const newBalance = toCents(loan.balance - applied);
        await tx.employeeLoan.update({
          where: { id: loan.id },
          data: { balance: newBalance, status: newBalance <= 0 ? "cleared" : "active" },
        });
        remaining = toCents(remaining - applied);
      }
    }

    // Banking module: record the outflow so wallet balances stay true.
    // The payroll journal already credited the wallet's GL account, so this
    // row is matched-to-that-entry bookkeeping, not a second posting.
    let bankTxnId: string | null = null;
    if (bankAccountId && netPay > 0) {
      const netLine = entry.lines.find((l) => l.accountId && l.credit.toNumber() === netPay);
      const txn = await tx.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          date: run.paidAt ?? new Date(),
          amount: netPay,
          direction: "out",
          description: `Payroll ${run.period} net pay`,
          reference: `PAY-${run.period}`,
          reconciled: true,
          reconciledAt: new Date(),
          matchedJournalLineId: netLine?.id ?? null,
        },
      });
      bankTxnId = txn.id;
    }

    const updated = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        bankAccountId,
        journalEntryId: entry.id,
      },
    });

    return { updated, entry, bankTxnId };
  }, { timeout: 30000 });

  await writeAuditLog({
    tenantId,
    userId: opts.userId ?? null,
    action: AUDIT_ACTIONS.PAYROLL.RUN_PAID,
    module: "payroll",
    entity: "payrollRun",
    entityId: run.id,
    before: { status: "approved" },
    after: {
      status: "paid",
      netPay,
      journalEntryId: result.entry.id,
      bankAccountId,
    },
  });

  return { ...result.updated, journalEntryId: result.entry.id, bankTxnId: result.bankTxnId };
}

/** NITA on a payslip: stored explicitly, fall back to zero for old rows. */
function nitaOf(p: { nitaLevy: number }): number {
  return p.nitaLevy ?? 0;
}

/** paid → filed: statutory returns have been submitted. */
export async function filePayrollRun(tenantId: string, runId: string, userId?: string | null) {
  const run = await db.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new PayrollError("Payroll run not found", 404);
  if (run.status !== "paid") throw new PayrollError(`Run must be paid before filing (is ${run.status})`);

  const filed = await db.payrollRun.update({
    where: { id: run.id },
    data: { status: "filed", filedAt: new Date() },
  });
  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.PAYROLL.RUN_FILED,
    module: "payroll",
    entity: "payrollRun",
    entityId: run.id,
    before: { status: "paid" },
    after: { status: "filed" },
  });
  return filed;
}

/** Draft runs are provisional — only they can be deleted. */
export async function deletePayrollRun(tenantId: string, runId: string, userId?: string | null) {
  const run = await db.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new PayrollError("Payroll run not found", 404);
  if (run.status !== "draft") {
    throw new PayrollError(`Only draft runs can be deleted (is ${run.status})`);
  }
  await db.payrollRun.delete({ where: { id: run.id } }); // cascades payslips
  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.PAYROLL.RUN_DELETED,
    module: "payroll",
    entity: "payrollRun",
    entityId: run.id,
    before: { period: run.period, status: run.status },
  });
  return { id: run.id };
}

// ─────────────────────────────── exports ──────────────────────────────

/** RFC-4180 escaping: quotes, commas and newlines inside fields. */
export function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((f) => {
      const s = f === null || f === undefined ? "" : String(f);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

export type PayrollRunWithPayslips = Prisma.PayrollRunGetPayload<{
  include: { payslips: { include: { employee: true } }; bankAccount: { select: { name: true } } };
}>;

/** Payslip register CSV (one row per employee per run). */
export function payslipRegisterCsv(run: PayrollRunWithPayslips): string {
  const header = csvRow([
    "Staff No", "Name", "Type", "Gross", "NSSF (EE)", "SHIF", "AHL (EE)",
    "Taxable Pay", "PAYE", "Relief", "PAYE Withheld", "Other Deductions",
    "Net Pay", "NSSF (ER)", "AHL (ER)", "NITA",
  ]);
  const rows = run.payslips.map((p) =>
    csvRow([
      p.employee.staffNumber,
      `${p.employee.firstName} ${p.employee.lastName}`,
      p.employee.employmentType,
      p.grossPay,
      p.nssfEmployee,
      p.shif,
      p.housingLevyEmployee,
      p.taxablePay,
      p.paye,
      p.personalRelief,
      p.payePayable,
      p.otherDeductions,
      p.netPay,
      p.nssfEmployer,
      p.housingLevyEmployer,
      p.nitaLevy,
    ])
  );
  return [header, ...rows].join("\r\n");
}

/**
 * Bank batch file for the disbursement: names, accounts, net amounts —
 * what a bank upload template (or an M-Pesa B2C batch) needs. Employees
 * paid without a bank account fall back to their M-Pesa number.
 */
export function bankBatchCsv(run: PayrollRunWithPayslips): string {
  const header = csvRow(["Staff No", "Name", "Method", "Destination", "Amount", "Reference"]);
  const rows = run.payslips.map((p) => {
    const bank = p.employee.bankAccount;
    const mpesa = p.employee.mpesaNumber;
    return csvRow([
      p.employee.staffNumber,
      `${p.employee.firstName} ${p.employee.lastName}`,
      bank ? "BANK" : mpesa ? "M-PESA" : "NONE",
      bank || mpesa || "",
      p.netPay,
      `PAY-${run.period}`,
    ]);
  });
  return [header, ...rows].join("\r\n");
}

/**
 * Per-month P9 figures for one employee (tax-year summary backing the
 * printable P9 view). Keyed off the run's period, not payslip creation
 * time: a December run approved in January still belongs to December's
 * tax year.
 */
export interface P9MonthRow {
  period: string;
  grossPay: number;
  nssf: number;
  shif: number;
  payeBeforeRelief: number;
  personalRelief: number;
  payeAfterRelief: number;
}

export async function p9EmployeeSummary(tenantId: string, year: number, employeeId: string) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new PayrollError(`Invalid year ${year}`);
  }
  const employee = await db.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: {
      id: true, staffNumber: true, firstName: true, lastName: true,
      jobTitle: true, kraPin: true, nssfNumber: true, shaNumber: true,
    },
  });
  if (!employee) throw new PayrollError("Employee not found", 404);

  const slips = await db.payslip.findMany({
    where: { tenantId, employeeId, payrollRun: { period: { startsWith: `${year}-` } } },
    include: { payrollRun: { select: { period: true } } },
    orderBy: { payrollRun: { period: "asc" } },
  });

  const months: P9MonthRow[] = slips.map((s) => ({
    period: s.payrollRun.period,
    grossPay: s.grossPay,
    nssf: s.nssfEmployee,
    shif: s.shif,
    payeBeforeRelief: s.paye,
    personalRelief: s.personalRelief,
    payeAfterRelief: s.payePayable,
  }));
  const sum = (pick: (r: P9MonthRow) => number) => toCents(months.reduce((acc, r) => acc + pick(r), 0));

  return {
    employee,
    year,
    months,
    totals: {
      grossPay: sum((r) => r.grossPay),
      nssf: sum((r) => r.nssf),
      shif: sum((r) => r.shif),
      payeBeforeRelief: sum((r) => r.payeBeforeRelief),
      personalRelief: sum((r) => r.personalRelief),
      payeAfterRelief: sum((r) => r.payeAfterRelief),
    },
  };
}

/**
 * P9 extract (annual): YTD gross, tax before/after relief per employee.
 * The full statutory P9 form layout is an export-format concern — this is
 * the filing data, ready to paste into the KRA form or a payroll bureau's
 * template. Rows are keyed off each run's period (tax year = period
 * year), so a December run approved in January stays in December.
 */
export async function p9Csv(tenantId: string, year: number): Promise<string> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new PayrollError(`Invalid year ${year}`);
  }
  const slips = await db.payslip.findMany({
    where: { tenantId, payrollRun: { period: { startsWith: `${year}-` } } },
    include: { employee: true },
    orderBy: { createdAt: "asc" },
  });

  const byEmployee = new Map<string, { employee: (typeof slips)[number]["employee"]; gross: number; paye: number; relief: number; withheld: number; nssf: number; shif: number }>();
  for (const slip of slips) {
    const acc = byEmployee.get(slip.employeeId) ?? {
      employee: slip.employee,
      gross: 0,
      paye: 0,
      relief: 0,
      withheld: 0,
      nssf: 0,
      shif: 0,
    };
    acc.gross = toCents(acc.gross + slip.grossPay);
    acc.paye = toCents(acc.paye + slip.paye);
    acc.relief = toCents(acc.relief + slip.personalRelief);
    acc.withheld = toCents(acc.withheld + slip.payePayable);
    acc.nssf = toCents(acc.nssf + slip.nssfEmployee);
    acc.shif = toCents(acc.shif + slip.shif);
    byEmployee.set(slip.employeeId, acc);
  }

  const header = csvRow([
    `P9 ${year}`, "Staff No", "Name", "KRA PIN", "Gross Pay", "NSSF",
    "SHIF", "Taxable Pay", "PAYE (before relief)", "Personal Relief",
    "PAYE (after relief)",
  ]);
  const rows = [...byEmployee.values()].map((acc) =>
    csvRow([
      "",
      acc.employee.staffNumber,
      `${acc.employee.firstName} ${acc.employee.lastName}`,
      acc.employee.kraPin || "",
      acc.gross,
      acc.nssf,
      acc.shif,
      "", // taxable pay is per-period, not additive across bands
      acc.paye,
      acc.relief,
      acc.withheld,
    ])
  );
  return [header, ...rows].join("\r\n");
}