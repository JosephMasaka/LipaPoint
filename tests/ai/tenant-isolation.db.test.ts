import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../../src/lib/db";
import { buildIntelligence } from "../../src/lib/ai/intelligence";
import { AiScopeError, resolveAiScope } from "../../src/lib/ai/scope";

/**
 * Cross-tenant isolation against the real database.
 *
 * Opt-in, because it writes (and cleans up) rows: `RUN_DB_TESTS=1 npm test`.
 * It seeds two tenants that each own a branch and a customer, then proves that
 * one tenant's AI snapshot and branch lookups cannot see the other's.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const skip = RUN ? false : "set RUN_DB_TESTS=1 to run database tests";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const A = { id: `it-a-${stamp}`, slug: `it-a-${stamp}` };
const B = { id: `it-b-${stamp}`, slug: `it-b-${stamp}` };
const locations = { a: `it-la-${stamp}`, b: `it-lb-${stamp}` };

const tenantUser = (id: string) => ({ tenantId: id, tenant: { currency: "KES" } });

before(async () => {
  if (!RUN) return;
  for (const [t, locId, label] of [
    [A, locations.a, "A"],
    [B, locations.b, "B"],
  ] as const) {
    await db.tenant.create({
      data: {
        id: t.id,
        slug: t.slug,
        name: `Isolation Test ${label}`,
        type: "RETAIL",
        email: `${t.slug}@example.test`,
        locations: { create: { id: locId, name: `Branch ${label}` } },
        // Only tenant B gets customers: any count on A would be leakage.
        ...(t === B
          ? {
              customers: {
                create: [
                  { name: "Customer B1", phone: `0700B10000` },
                  { name: "Customer B2", phone: `0700B20000` },
                ],
              },
            }
          : {}),
      },
    });
  }
});

after(async () => {
  if (!RUN) return;
  // Tenant deletion cascades to locations and customers.
  await db.tenant.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  await db.$disconnect();
});

test("one tenant's intelligence excludes another tenant's customers", { skip }, async () => {
  const a = await buildIntelligence(A.id);
  const b = await buildIntelligence(B.id);

  assert.equal(a.tenant.id, A.id);
  assert.equal(b.tenant.id, B.id);
  assert.equal(a.customers.registeredCustomers, 0, "tenant A must not see tenant B's customers");
  assert.equal(b.customers.registeredCustomers, 2);
  assert.notEqual(a.tenant.name, b.tenant.name);
});

test("a branch owned by another tenant cannot be resolved", { skip }, async () => {
  await assert.rejects(
    () => resolveAiScope(tenantUser(A.id), { locationId: locations.b }),
    (err: unknown) =>
      err instanceof AiScopeError && err.code === "LOCATION_NOT_FOUND" && err.status === 404
  );
});

test("a tenant's own branch resolves, scoped to that tenant", { skip }, async () => {
  const { scope, locationName } = await resolveAiScope(tenantUser(A.id), { locationId: locations.a });
  assert.equal(scope.tenantId, A.id);
  assert.equal(scope.locationId, locations.a);
  assert.equal(locationName, "Branch A");
});
