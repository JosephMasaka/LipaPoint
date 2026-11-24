import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TARGET_COVER_DAYS,
  MAX_TARGET_COVER_DAYS,
  MIN_TARGET_COVER_DAYS,
  clampTargetCoverDays,
} from "../../src/lib/ai/restock-target";

test("uses the stored value when it is sensible", () => {
  assert.equal(clampTargetCoverDays(21), 21);
  assert.equal(clampTargetCoverDays("7"), 7);
});

test("falls back to the default for missing or non-numeric input", () => {
  assert.equal(clampTargetCoverDays(undefined), DEFAULT_TARGET_COVER_DAYS);
  assert.equal(clampTargetCoverDays(null), DEFAULT_TARGET_COVER_DAYS);
  assert.equal(clampTargetCoverDays("soon"), DEFAULT_TARGET_COVER_DAYS);
  assert.equal(clampTargetCoverDays(NaN), DEFAULT_TARGET_COVER_DAYS);
});

test("clamps to the allowed range instead of throwing", () => {
  assert.equal(clampTargetCoverDays(0), MIN_TARGET_COVER_DAYS);
  assert.equal(clampTargetCoverDays(-30), MIN_TARGET_COVER_DAYS);
  assert.equal(clampTargetCoverDays(9999), MAX_TARGET_COVER_DAYS);
});

test("rounds fractional days", () => {
  assert.equal(clampTargetCoverDays(14.4), 14);
  assert.equal(clampTargetCoverDays(14.6), 15);
});
