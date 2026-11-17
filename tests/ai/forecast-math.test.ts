import assert from "node:assert/strict";
import test from "node:test";
import {
  dailyTotals,
  dayKey,
  mean,
  projectWeeks,
  stdDev,
  weekdayBaseline,
  zScore,
} from "../../src/lib/ai/forecast-math";

const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

test("daily totals bucket by UTC day", () => {
  const totals = dailyTotals([
    { date: at("2026-11-16"), amount: 100 },
    { date: at("2026-11-16"), amount: 50 },
    { date: at("2026-11-17"), amount: 25 },
  ]);
  assert.equal(totals.get("2026-11-16"), 150);
  assert.equal(totals.get("2026-11-17"), 25);
  assert.equal(dayKey(at("2026-11-16")), "2026-11-16");
});

test("mean and standard deviation are sample-safe", () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(mean([]), 0);
  assert.equal(stdDev([5]), 0);
  assert.equal(stdDev([2, 4, 6]), Math.sqrt(8 / 3));
  assert.equal(zScore(10, 5, 0), 0);
});

test("weekday baseline ignores the exclusion window and other weekdays", () => {
  // 2026-11-16 is a Monday (weekday 1).
  const daily = new Map([
    ["2026-11-02", 100],
    ["2026-11-09", 300],
    ["2026-11-16", 900],
    ["2026-11-17", 50],
  ]);
  const baseline = weekdayBaseline(daily, 1, {
    today: new Date("2026-11-17T12:00:00.000Z"),
    excludeDays: 2,
  });
  // 16 Nov sits inside the last 2 days, so only 2 and 9 Nov count.
  assert.equal(baseline.samples, 2);
  assert.equal(baseline.average, 200);
});

test("projection allocates committed invoices to the bucket containing the due date", () => {
  const weeks = projectWeeks({
    today: new Date("2026-11-17T12:00:00.000Z"),
    weeks: 2,
    averageDailyInflow: 100,
    averageDailyOutflow: 40,
    committed: [
      { date: new Date("2026-11-19T00:00:00.000Z"), amount: 500 },
      { date: new Date("2026-11-30T00:00:00.000Z"), amount: 200 },
    ],
  });
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].start, "2026-11-18");
  assert.equal(weeks[0].end, "2026-11-24");
  assert.equal(weeks[0].committedOutflow, 500);
  assert.equal(weeks[0].expectedInflow, 700);
  assert.equal(weeks[0].expectedOutflow, 780);
  assert.equal(weeks[0].net, -80);
  assert.equal(weeks[1].committedOutflow, 200);
});
