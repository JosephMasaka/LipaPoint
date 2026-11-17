/**
 * Pure date/money helpers for the cash-flow projection and anomaly flags.
 * No database or model access — kept separate so the arithmetic is testable.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function zScore(value: number, avg: number, sd: number): number {
  if (sd <= 0) return 0;
  return (value - avg) / sd;
}

/** UTC day key (`YYYY-MM-DD`) so grouping never depends on server timezone. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DatedAmount {
  date: Date;
  amount: number;
}

/** Adds amounts into UTC day buckets. */
export function dailyTotals(rows: DatedAmount[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(row.date);
    totals.set(key, (totals.get(key) ?? 0) + row.amount);
  }
  return totals;
}

/**
 * Average for one ISO weekday (0 = Sunday) over a set of daily totals,
 * optionally ignoring the most recent `excludeDays` calendar days.
 */
export function weekdayBaseline(
  daily: Map<string, number>,
  weekday: number,
  options: { today: Date; excludeDays?: number }
): { average: number; samples: number } {
  const excludeDays = options.excludeDays ?? 0;
  const cutoff = new Date(
    Date.UTC(
      options.today.getUTCFullYear(),
      options.today.getUTCMonth(),
      options.today.getUTCDate()
    ) - excludeDays * DAY_MS
  );
  const values: number[] = [];
  for (const [key, amount] of daily) {
    const date = new Date(`${key}T00:00:00.000Z`);
    if (date.getUTCDay() !== weekday) continue;
    if (date.getTime() >= cutoff.getTime()) continue;
    values.push(amount);
  }
  return { average: mean(values), samples: values.length };
}

/**
 * Recent daily amounts for which `test` returns true, most recent first.
 * Used for both expense spikes and sales drops.
 */
export function recentDays(
  daily: Map<string, number>,
  count: number,
  today: Date
): Array<{ key: string; amount: number }> {
  const rows: Array<{ key: string; amount: number }> = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - offset * DAY_MS
    );
    const key = dayKey(date);
    if (daily.has(key)) rows.push({ key, amount: daily.get(key) ?? 0 });
  }
  return rows;
}

export interface WeekBucket {
  start: string;
  end: string;
  expectedInflow: number;
  expectedOutflow: number;
  committedOutflow: number;
  net: number;
}

/**
 * Projects `weeks` buckets of 7 days starting the day after `today`.
 * `committed` amounts are allocated to the bucket containing their due date.
 */
export function projectWeeks(params: {
  today: Date;
  weeks: number;
  averageDailyInflow: number;
  averageDailyOutflow: number;
  committed: DatedAmount[];
}): WeekBucket[] {
  const { today, weeks, averageDailyInflow, averageDailyOutflow, committed } = params;
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const buckets: WeekBucket[] = [];

  for (let week = 0; week < weeks; week++) {
    const start = new Date(startOfToday + (week * 7 + 1) * DAY_MS);
    const end = new Date(start.getTime() + 6 * DAY_MS);
    let committedOutflow = 0;
    for (const row of committed) {
      const time = Date.UTC(
        row.date.getUTCFullYear(),
        row.date.getUTCMonth(),
        row.date.getUTCDate()
      );
      if (time >= start.getTime() && time <= end.getTime()) committedOutflow += row.amount;
    }
    const expectedInflow = averageDailyInflow * 7;
    const expectedOutflow = averageDailyOutflow * 7 + committedOutflow;
    buckets.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      expectedInflow: Math.round(expectedInflow * 100) / 100,
      expectedOutflow: Math.round(expectedOutflow * 100) / 100,
      committedOutflow: Math.round(committedOutflow * 100) / 100,
      net: Math.round((expectedInflow - expectedOutflow) * 100) / 100,
    });
  }
  return buckets;
}

export interface BacktestWeekRow {
  start: string;
  end: string;
  expectedInflow: number;
  expectedOutflow: number;
  actualInflow: number;
  actualOutflow: number;
  paidInvoiceOutflow: number;
  inflowErrorPercent: number | null;
  outflowErrorPercent: number | null;
  baselineSalesDays: number;
  baselineExpenseDays: number;
}

export interface BacktestResult {
  weeks: BacktestWeekRow[];
  meanAbsoluteErrorPercent: { inflow: number | null; outflow: number | null };
}

const utcDayStart = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const roundToCents = (value: number) => Math.round(value * 100) / 100;

const errorPercent = (actual: number, expected: number): number | null =>
  expected > 0 ? roundToCents(((actual - expected) / expected) * 100) : null;

/**
 * Compares completed weeks with the forecast the same rules would have produced
 * from the `lookbackDays` before each week. Pure: callers supply the rows.
 */
export function backtestWeeks(params: {
  today: Date;
  inflows: DatedAmount[];
  outflows: DatedAmount[];
  payments: DatedAmount[];
  weeksBack: number;
  lookbackDays: number;
}): BacktestResult {
  const { today, inflows, outflows, payments, weeksBack, lookbackDays } = params;
  const todayStart = utcDayStart(today);
  const weeks: BacktestWeekRow[] = [];

  for (let index = 0; index < weeksBack; index++) {
    const end = todayStart - (index * 7 + 1) * DAY_MS;
    const start = end - 6 * DAY_MS;
    const baselineFrom = start - lookbackDays * DAY_MS;
    const baselineTo = start - DAY_MS;

    const within = (rows: DatedAmount[], from: number, to: number) =>
      rows.filter((row) => {
        const time = utcDayStart(row.date);
        return time >= from && time <= to;
      });

    const baselineInflows = within(inflows, baselineFrom, baselineTo);
    const baselineOutflows = within(outflows, baselineFrom, baselineTo);
    const weekInflows = within(inflows, start, end);
    const weekOutflows = within(outflows, start, end);
    const weekPayments = within(payments, start, end);

    const total = (rows: DatedAmount[]) => rows.reduce((acc, row) => acc + row.amount, 0);

    const expectedInflow = roundToCents((total(baselineInflows) / lookbackDays) * 7);
    const expectedOutflow = roundToCents((total(baselineOutflows) / lookbackDays) * 7);
    const actualInflow = roundToCents(total(weekInflows));
    const actualOutflow = roundToCents(total(weekOutflows));

    weeks.push({
      start: new Date(start).toISOString().slice(0, 10),
      end: new Date(end).toISOString().slice(0, 10),
      expectedInflow,
      expectedOutflow,
      actualInflow,
      actualOutflow,
      paidInvoiceOutflow: roundToCents(total(weekPayments)),
      inflowErrorPercent: errorPercent(actualInflow, expectedInflow),
      outflowErrorPercent: errorPercent(actualOutflow, expectedOutflow),
      baselineSalesDays: new Set(baselineInflows.map((row) => dayKey(row.date))).size,
      baselineExpenseDays: new Set(baselineOutflows.map((row) => dayKey(row.date))).size,
    });
  }

  const meanAbs = (values: Array<number | null>) => {
    const usable = values.filter((value): value is number => value !== null);
    if (usable.length === 0) return null;
    return roundToCents(usable.reduce((acc, value) => acc + Math.abs(value), 0) / usable.length);
  };

  return {
    weeks,
    meanAbsoluteErrorPercent: {
      inflow: meanAbs(weeks.map((week) => week.inflowErrorPercent)),
      outflow: meanAbs(weeks.map((week) => week.outflowErrorPercent)),
    },
  };
}
