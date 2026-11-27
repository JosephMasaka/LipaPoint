import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RETENTION_DAYS,
  retentionCutoff,
  retentionDaysFromEnv,
} from "../../src/lib/connect/retention";

test("the default window is 90 days", () => {
  assert.equal(DEFAULT_RETENTION_DAYS, 90);
  assert.equal(retentionDaysFromEnv(undefined), 90);
});

test("the cutoff is the window back from now", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  assert.equal(retentionCutoff(90, now).toISOString(), "2026-08-29T12:00:00.000Z");
});

test("an unusable CONNECT_RETENTION_DAYS falls back instead of purging everything", () => {
  for (const value of ["", "0", "-5", "abc", "NaN"]) {
    assert.equal(retentionDaysFromEnv(value), DEFAULT_RETENTION_DAYS, `input: ${value}`);
  }
});

test("a configured window is clamped to ten years and floored to whole days", () => {
  assert.equal(retentionDaysFromEnv("30"), 30);
  assert.equal(retentionDaysFromEnv("45.9"), 45);
  assert.equal(retentionDaysFromEnv("99999"), 3650);
});
