import assert from "node:assert/strict";
import test from "node:test";
import { backtestWeeks } from "../../src/lib/ai/forecast-math";

const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

// Today is Wednesday 18 Nov 2026, so the completed weeks are:
//   11–17 Nov (most recent) and 4–10 Nov.
const today = at("2026-11-18");

const inflows = [
  { date: at("2026-10-20"), amount: 2800 }, // baseline for both completed weeks
  { date: at("2026-11-11"), amount: 100 }, // first day of the recent week
  { date: at("2026-11-15"), amount: 1400 },
  { date: at("2026-11-17"), amount: 100 }, // last day of the recent week
  { date: at("2026-11-18"), amount: 9999 }, // today: not a completed week
];

const outflows = [
  { date: at("2026-10-25"), amount: 560 }, // baseline: 20/day
  { date: at("2026-11-12"), amount: 70 },
];

const payments = [
  { date: at("2026-11-13"), amount: 300 },
  { date: at("2026-11-16"), amount: 200 },
];

const result = backtestWeeks({
  today,
  inflows,
  outflows,
  payments,
  weeksBack: 2,
  lookbackDays: 28,
});

test("completed weeks are the ones that ended before today", () => {
  assert.deepEqual(
    result.weeks.map((week) => [week.start, week.end]),
    [
      ["2026-11-11", "2026-11-17"],
      ["2026-11-04", "2026-11-10"],
    ]
  );
});

test("expected values use the 28-day trailing average and actuals stay in-week", () => {
  const [recent, earlier] = result.weeks;
  // 2800 over 28 days = 100/day, so a week should project 700.
  assert.equal(recent.expectedInflow, 700);
  // Boundaries are inclusive: 11 Nov and 17 Nov both count; today does not.
  assert.equal(recent.actualInflow, 1600);
  // No order falls inside the earlier week at all.
  assert.equal(earlier.actualInflow, 0);
  assert.equal(earlier.expectedInflow, 700);
  assert.equal(recent.baselineSalesDays, 1);
});

test("outflow is compared against expenses only, not supplier payments", () => {
  const [recent] = result.weeks;
  assert.equal(recent.expectedOutflow, 140);
  assert.equal(recent.actualOutflow, 70);
  // Payments are surfaced separately and must not inflate actual outflow.
  assert.equal(recent.paidInvoiceOutflow, 500);
  assert.ok(!outflows.some((row) => row.amount === 300));
});

test("error percentages are signed relative to the forecast", () => {
  const [recent, earlier] = result.weeks;
  assert.equal(recent.inflowErrorPercent, 128.57); // (1600 - 700) / 700
  assert.equal(recent.outflowErrorPercent, -50); // (70 - 140) / 140
  assert.equal(earlier.inflowErrorPercent, -100);
});

test("mean absolute error ignores weeks without a baseline", () => {
  assert.equal(result.meanAbsoluteErrorPercent.inflow, 114.29); // (128.57 + 100) / 2
  assert.equal(result.meanAbsoluteErrorPercent.outflow, 75); // (50 + 100) / 2

  const empty = backtestWeeks({
    today,
    inflows: [],
    outflows: [],
    payments: [],
    weeksBack: 2,
    lookbackDays: 28,
  });
  assert.equal(empty.weeks[0].expectedInflow, 0);
  assert.equal(empty.weeks[0].inflowErrorPercent, null);
  assert.equal(empty.meanAbsoluteErrorPercent.inflow, null);
  assert.equal(empty.meanAbsoluteErrorPercent.outflow, null);
});
