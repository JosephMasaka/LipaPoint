import assert from "node:assert/strict";
import test from "node:test";
import { AiScopeError, resolveAiScope, type AiScopeDeps } from "../../src/lib/ai/scope";

/**
 * Tenant isolation for AI reads.
 *
 * `resolveAiScope` is the only place a request's tenant is decided, and every
 * AI tool reads an already-scoped snapshot, so these tests cover the boundary
 * itself: the tenant comes from the session, and a branch id belonging to
 * another tenant must never resolve.
 *
 * A fake `findLocation` stands in for Prisma here — it reproduces the one thing
 * that matters for isolation, a case-sensitive match on id *and* tenantId — so
 * the suite runs without a database.
 */

const BRANCHES = [
  { id: "loc-a1", tenantId: "tenant-a", name: "A CBD" },
  { id: "loc-b1", tenantId: "tenant-b", name: "B CBD" },
];

/** Mirrors `db.location.findFirst({ where: { id, tenantId, isActive: true } })`. */
const fakeDeps = (seen: Array<Record<string, unknown>> = []): AiScopeDeps => ({
  findLocation: async (where) => {
    seen.push(where);
    const match = BRANCHES.find(
      (b) => b.id === where.id && b.tenantId === where.tenantId && where.isActive === true
    );
    return match ? { id: match.id, name: match.name } : null;
  },
});

const tenantA = { tenantId: "tenant-a", tenant: { currency: "KES" } };

test("a branch belonging to another tenant cannot be read", async () => {
  await assert.rejects(
    () => resolveAiScope(tenantA, { locationId: "loc-b1" }, fakeDeps()),
    (err: unknown) =>
      err instanceof AiScopeError && err.code === "LOCATION_NOT_FOUND" && err.status === 404
  );
});

test("the branch lookup is always filtered by the session tenant", async () => {
  const seen: Array<Record<string, unknown>> = [];
  await resolveAiScope(tenantA, { locationId: "loc-a1" }, fakeDeps(seen));
  assert.deepEqual(seen, [{ id: "loc-a1", tenantId: "tenant-a", isActive: true }]);
});

test("a client-supplied tenantId is ignored", async () => {
  const input = { tenantId: "tenant-b", locationId: undefined } as Record<string, unknown>;
  const { scope } = await resolveAiScope(tenantA, input, fakeDeps());
  assert.equal(scope.tenantId, "tenant-a");
  assert.equal((scope as unknown as Record<string, unknown>).tenantId, "tenant-a");
});

test("an owned branch is accepted and names only that branch", async () => {
  const { scope, locationName } = await resolveAiScope(tenantA, { locationId: "loc-a1" }, fakeDeps());
  assert.equal(scope.tenantId, "tenant-a");
  assert.equal(scope.locationId, "loc-a1");
  assert.equal(locationName, "A CBD");
  assert.ok(!scope.locationId?.includes("loc-b1"));
});

test("the default window is identical across calls, so cache keys stay stable", async () => {
  const first = await resolveAiScope(tenantA, {}, fakeDeps());
  const second = await resolveAiScope(tenantA, {}, fakeDeps());
  assert.equal(first.scope.from, second.scope.from);
  assert.equal(first.scope.to, second.scope.to);
  // End-of-day, not a millisecond-precise instant.
  assert.match(first.scope.to, /T23:59:59\.999Z$/);
});

test("unscoped reads still span the default analysis window", async () => {
  const { scope } = await resolveAiScope(tenantA, {}, fakeDeps());
  const days = (Date.parse(scope.to) - Date.parse(scope.from)) / (24 * 60 * 60 * 1000);
  assert.ok(days >= 29 && days <= 31, `expected ~30 days, got ${days}`);
});

test("future and oversized ranges are rejected", async () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  await assert.rejects(
    () => resolveAiScope(tenantA, { to: future }, fakeDeps()),
    (err: unknown) => err instanceof AiScopeError && err.code === "FUTURE_DATE"
  );

  const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  await assert.rejects(
    () => resolveAiScope(tenantA, { from }, fakeDeps()),
    (err: unknown) => err instanceof AiScopeError && err.code === "RANGE_TOO_LARGE"
  );
});

test("an inverted range is rejected", async () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  await assert.rejects(
    () => resolveAiScope(tenantA, { from: fiveDaysAgo, to: tenDaysAgo }, fakeDeps()),
    (err: unknown) => err instanceof AiScopeError && err.code === "INVALID_RANGE"
  );
});
