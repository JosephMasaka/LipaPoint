import assert from "node:assert/strict";
import test from "node:test";
import { estimateCostUsd } from "../../src/lib/ai/usage";

test("zero tokens costs nothing", () => {
  assert.equal(estimateCostUsd({ totalTokens: 0 }), 0);
});

test("known model uses prompt/output list prices", () => {
  // 1M prompt at $0.30 + 1M output at $2.50 = $2.80
  const cost = estimateCostUsd({
    model: "gemini-2.5-flash",
    promptTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  assert.equal(cost, 2.8);
});

test("total-only usage is split 70/30", () => {
  const split = estimateCostUsd({ model: "gemini-2.5-flash", totalTokens: 1_000_000 });
  // 0.7 * 0.30 + 0.3 * 2.50 = 0.21 + 0.75
  assert.equal(split, 0.96);
});

test("unknown model falls back to a default price", () => {
  assert.ok(estimateCostUsd({ model: "unknown", totalTokens: 1_000_000 }) > 0);
});
