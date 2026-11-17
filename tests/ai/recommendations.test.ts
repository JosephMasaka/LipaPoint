import assert from "node:assert/strict";
import test from "node:test";
import {
  draftFromRestock,
  isRecommendationStatus,
  restockFingerprint,
} from "../../src/lib/ai/recommendations";
import type { AiScopeInfo, RestockSuggestion } from "../../src/lib/ai/types";

const scope: AiScopeInfo = {
  tenantId: "t1",
  from: "2026-10-18T00:00:00.000Z",
  to: "2026-11-17T23:59:59.999Z",
  locationId: null,
  locationName: null,
  currency: "KES",
};

const suggestion: RestockSuggestion = {
  productId: "p1",
  product: "Sugar 1kg",
  category: "Groceries",
  stock: 4,
  velocityPerDay: 2,
  daysOfCover: 2,
  suggestedQty: 26,
  targetDays: 15,
  urgency: "critical",
};

test("fingerprint is stable per product and branch", () => {
  assert.equal(restockFingerprint("p1", null), "restock:p1:all");
  assert.equal(restockFingerprint("p1", "loc1"), "restock:p1:loc1");
  assert.notEqual(restockFingerprint("p1", null), restockFingerprint("p2", null));
});

test("draft carries the exact inputs used to compute the suggestion", () => {
  const draft = draftFromRestock(suggestion, scope);
  assert.equal(draft.productId, "p1");
  assert.equal(draft.urgency, "critical");
  assert.equal(draft.confidence, 0.9);
  assert.equal(draft.evidence.stock, 4);
  assert.equal(draft.evidence.suggestedQty, 26);
  assert.equal(draft.evidence.targetDays, 15);
  assert.equal(draft.evidence.period.from, scope.from);
  assert.match(draft.evidence.formula, /velocityPerDay/);
  assert.match(draft.summary, /26 units/);
});

test("scoped drafts record the branch", () => {
  const draft = draftFromRestock(suggestion, { ...scope, locationId: "loc1" });
  assert.equal(draft.fingerprint, "restock:p1:loc1");
  assert.equal(draft.evidence.scope.locationId, "loc1");
});

test("only known statuses are accepted", () => {
  assert.ok(isRecommendationStatus("new"));
  assert.ok(isRecommendationStatus("done"));
  assert.equal(isRecommendationStatus("deleted"), false);
  assert.equal(isRecommendationStatus(42), false);
});
