import { db } from "@/lib/db";
import {
  DAY_MS,
  backtestWeeks,
  dailyTotals,
  mean,
  projectWeeks,
  recentDays,
  stdDev,
  weekdayBaseline,
  zScore,
  type WeekBucket,
} from "./forecast-math";

/**
 * Deterministic cash-flow projection and anomaly flags (Milestone 2).
 *
 * Every number comes from recorded orders, expenses and supplier invoices.
 * Nothing is extrapolated from a model, and no trend or seasonality is applied.
 */

export const FORECAST_LOOKBACK_DAYS = 28;
export const FORECAST_HISTORY_DAYS = 84;
export const FORECAST_HORIZON_DAYS = 28;

export interface ForecastAnomaly {
  id: string;
  type: "expense-spike" | "sales-drop";
  severity: "high" | "medium";
  title: string;
  detail: string;
  date: string;
  evidence: Record<string, number | string>;
}

export interface CashFlowForecast {
  currency: string;
  horizonDays: number;
  weeks: WeekBucket[];
  totals: { expectedInflow: number; expectedOutflow: number; net: number };
  assumptions: string[];
  warnings: string[];
  coverage: {
    salesDays: number;
    expenseDays: number;
    historyDays: number;
    unpaidInvoices: number;
    confidence: "low" | "medium" | "high";
  };
  anomalies: ForecastAnomaly[];
  generatedAt: string;
}

export interface ForecastAccuracyWeek {
  start: string;
  end: string;
  expectedInflow: number;
  expectedOutflow: number;
  actualInflow: number;
  actualOutflow: number;
  /** Supplier payments recorded in the week. Shown for context, not added to actualOutflow. */
  paidInvoiceOutflow: number;
  inflowErrorPercent: number | null;
  outflowErrorPercent: number | null;
  baselineSalesDays: number;
  baselineExpenseDays: number;
}

export interface ForecastAccuracy {
  /** Completed weeks, most recent first. */
  weeks: ForecastAccuracyWeek[];
  meanAbsoluteErrorPercent: { inflow: number | null; outflow: number | null };
  notes: string[];
}

export interface ForecastOptions {
  locationId?: string | null;
  currency?: string;
  today?: Date;
}

export async function buildForecast(
  tenantId: string,
  options: ForecastOptions = {}
): Promise<CashFlowForecast> {
  const today = options.today ?? new Date();
  const locationFilter = options.locationId ? { locationId: options.locationId } : {};
  const lookbackFrom = new Date(today.getTime() - FORECAST_LOOKBACK_DAYS * DAY_MS);
  const historyFrom = new Date(today.getTime() - FORECAST_HISTORY_DAYS * DAY_MS);
  const horizonEnd = new Date(today.getTime() + FORECAST_HORIZON_DAYS * DAY_MS);

  const completed = { tenantId, status: "COMPLETED", ...locationFilter } as const;

  const [orders, expenses, invoices] = await Promise.all([
    db.order.findMany({
      where: { ...completed, createdAt: { gte: historyFrom } },
      select: { total: true, createdAt: true },
    }),
    db.expense.findMany({
      where: { tenantId, date: { gte: historyFrom }, ...locationFilter },
      select: { amount: true, date: true, category: true },
    }),
    db.supplierInvoice.findMany({
      where: {
        tenantId,
        status: { not: "paid" },
        dueDate: { gte: today, lte: horizonEnd },
      },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
  ]);

  const salesDaily = dailyTotals(orders.map((o) => ({ date: o.createdAt, amount: o.total })));
  const expenseDaily = dailyTotals(expenses.map((e) => ({ date: e.date, amount: e.amount })));

  /* ---------------- trailing averages ---------------- */
  const lookbackOrders = orders.filter((o) => o.createdAt >= lookbackFrom);
  const lookbackExpenses = expenses.filter((e) => e.date >= lookbackFrom);

  const averageDailyInflow =
    lookbackOrders.reduce((total, order) => total + order.total, 0) / FORECAST_LOOKBACK_DAYS;
  const averageDailyOutflow =
    lookbackExpenses.reduce((total, expense) => total + expense.amount, 0) /
    FORECAST_LOOKBACK_DAYS;

  const salesDays = new Set(
    lookbackOrders.map((order) => order.createdAt.toISOString().slice(0, 10))
  ).size;
  const expenseDays = new Set(
    lookbackExpenses.map((expense) => expense.date.toISOString().slice(0, 10))
  ).size;

  /* ---------------- committed outflows ---------------- */
  const committed = invoices
    .filter((invoice) => invoice.dueDate !== null)
    .map((invoice) => ({
      date: invoice.dueDate as Date,
      amount: Math.max(0, invoice.amount - invoice.paidAmount),
    }))
    .filter((row) => row.amount > 0);

  const weeks = projectWeeks({
    today,
    weeks: FORECAST_HORIZON_DAYS / 7,
    averageDailyInflow,
    averageDailyOutflow,
    committed,
  });

  const totals = weeks.reduce(
    (acc, week) => ({
      expectedInflow: acc.expectedInflow + week.expectedInflow,
      expectedOutflow: acc.expectedOutflow + week.expectedOutflow,
      net: acc.net + week.net,
    }),
    { expectedInflow: 0, expectedOutflow: 0, net: 0 }
  );

  /* ---------------- warnings & confidence ---------------- */
  const warnings: string[] = [];
  if (salesDays === 0) {
    warnings.push("No completed sales in the last 28 days, so inflow is projected as zero.");
  } else if (salesDays < 14) {
    warnings.push(
      `Only ${salesDays} day${salesDays === 1 ? "" : "s"} with completed sales in the last 28 — the inflow estimate is weak.`
    );
  }
  if (expenseDays === 0) {
    warnings.push("No expenses recorded in the last 28 days, so outflows are understated.");
  } else if (expenseDays < 7) {
    warnings.push(
      `Expenses recorded on only ${expenseDays} of the last 28 days — irregular costs may be missing.`
    );
  }
  if (invoices.some((invoice) => invoice.dueDate === null)) {
    warnings.push("Some unpaid supplier invoices have no due date and are not in the projection.");
  }

  const confidence: CashFlowForecast["coverage"]["confidence"] =
    salesDays >= 21 && expenseDays >= 14
      ? "high"
      : salesDays >= 10 && expenseDays >= 5
        ? "medium"
        : "low";

  /* ---------------- anomalies ---------------- */
  const anomalies: ForecastAnomaly[] = [];

  // Expense spike: a recent day far above the trailing distribution.
  const expenseBaseline = Array.from(expenseDaily.entries())
    .filter(([key]) => {
      const date = new Date(`${key}T00:00:00.000Z`);
      return date.getTime() < startOfUtcDay(today) - 7 * DAY_MS;
    })
    .map(([, amount]) => amount);

  if (expenseBaseline.length >= 5) {
    const avg = mean(expenseBaseline);
    const sd = stdDev(expenseBaseline);
    for (const day of recentDays(expenseDaily, 5, today)) {
      const z = zScore(day.amount, avg, sd);
      if (z >= 3 && day.amount >= avg * 2) {
        anomalies.push({
          id: `expense-spike:${day.key}`,
          type: "expense-spike",
          severity: z >= 4 ? "high" : "medium",
          title: "Expense spike",
          detail:
            `Expenses on ${day.key} were ${round2(day.amount)}, about ` +
            `${(day.amount / Math.max(avg, 0.01)).toFixed(1)}× the trailing daily average of ${round2(avg)}.`,
          date: day.key,
          evidence: { amount: round2(day.amount), average: round2(avg), zScore: round2(z) },
        });
      }
    }
  }

  // Sales drop: recent day versus the same weekday over prior weeks.
  for (const day of recentDays(salesDaily, 3, today)) {
    const date = new Date(`${day.key}T00:00:00.000Z`);
    const baseline = weekdayBaseline(salesDaily, date.getUTCDay(), {
      today,
      excludeDays: 7,
    });
    if (baseline.samples < 3 || baseline.average <= 0) continue;
    const changePercent = ((day.amount - baseline.average) / baseline.average) * 100;
    if (changePercent <= -40) {
      anomalies.push({
        id: `sales-drop:${day.key}`,
        type: "sales-drop",
        severity: changePercent <= -60 ? "high" : "medium",
        title: "Sales below weekday baseline",
        detail:
          `Completed sales on ${day.key} were ${round2(day.amount)}, ` +
          `${Math.abs(Math.round(changePercent))}% below the ${baseline.average ? round2(baseline.average) : 0} ` +
          `average for that weekday over ${baseline.samples} prior weeks.`,
        date: day.key,
        evidence: {
          revenue: round2(day.amount),
          weekdayAverage: round2(baseline.average),
          changePercent: round2(changePercent),
          baselineWeeks: baseline.samples,
        },
      });
    }
  }

  return {
    currency: options.currency ?? "KES",
    horizonDays: FORECAST_HORIZON_DAYS,
    weeks,
    totals: {
      expectedInflow: round2(totals.expectedInflow),
      expectedOutflow: round2(totals.expectedOutflow),
      net: round2(totals.net),
    },
    assumptions: [
      `Inflow assumes the last ${FORECAST_LOOKBACK_DAYS} days' average daily completed-sales revenue.`,
      `Outflow assumes the last ${FORECAST_LOOKBACK_DAYS} days' average daily recorded expenses.`,
      "Unpaid supplier invoices due within the horizon are added on their due dates; they enter the expense average only once recorded as expenses.",
      "Payroll, tax and loan obligations appear only when recorded as expenses.",
      "No growth, seasonality or model-generated trend is applied.",
    ],
    warnings,
    coverage: {
      salesDays,
      expenseDays,
      historyDays: FORECAST_HISTORY_DAYS,
      unpaidInvoices: invoices.length,
      confidence,
    },
    anomalies,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Backtests the projection against weeks that have already elapsed.
 *
 * Each completed week is compared with the forecast the same rules would have
 * produced from the 28 days before that week started — so this measures the
 * method, not a stored prediction. Inflow is compared with completed orders
 * and outflow with recorded expenses, the same two sources the projection uses.
 */
export async function buildForecastAccuracy(
  tenantId: string,
  options: ForecastOptions & { weeksBack?: number } = {}
): Promise<ForecastAccuracy> {
  const today = options.today ?? new Date();
  const weeksBack = options.weeksBack ?? 4;
  const locationFilter = options.locationId ? { locationId: options.locationId } : {};
  const todayStart = startOfUtcDay(today);
  const oldestStart = todayStart - (weeksBack * 7 - 1) * DAY_MS;
  const fetchFrom = new Date(oldestStart - FORECAST_LOOKBACK_DAYS * DAY_MS);

  const [orders, expenses, payments] = await Promise.all([
    db.order.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: fetchFrom },
        ...locationFilter,
      },
      select: { total: true, createdAt: true },
    }),
    db.expense.findMany({
      where: { tenantId, date: { gte: fetchFrom }, ...locationFilter },
      select: { amount: true, date: true },
    }),
    db.supplierPayment.findMany({
      where: { tenantId, paidAt: { gte: fetchFrom } },
      select: { amount: true, paidAt: true },
    }),
  ]);

  const result = backtestWeeks({
    today,
    weeksBack,
    lookbackDays: FORECAST_LOOKBACK_DAYS,
    inflows: orders.map((order) => ({ date: order.createdAt, amount: order.total })),
    outflows: expenses.map((expense) => ({ date: expense.date, amount: expense.amount })),
    payments: payments.map((payment) => ({ date: payment.paidAt, amount: payment.amount })),
  });

  const notes = [
    "Each completed week is compared with the forecast the same rules would have produced from the 28 days before that week.",
    "Inflow is compared with completed orders and outflow with recorded expenses — the same sources the projection uses.",
  ];
  if (payments.length === 0) {
    notes.push("No supplier payments are recorded yet, so paid-invoice outflow is zero.");
  } else {
    notes.push(
      "Supplier payments in the week are listed separately and not added to actual outflow, because the same money may also be recorded as an expense."
    );
  }

  return { ...result, notes };
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
