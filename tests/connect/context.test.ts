import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConnectorContext } from "../../src/lib/connect/connections";
import type { IntegrationConnection } from "@prisma/client";

/**
 * Regression guard: a connector reads LipaPoint's own tables (eTIMS) through
 * `context.tenantId`. It used `connectionId` before, which is a different row —
 * the query then matched nothing, and a sync "succeeded" with zero records.
 */
function connection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "conn_123",
    tenantId: "tenant_abc",
    providerId: "etims",
    displayName: "eTIMS",
    status: "ACTIVE",
    authType: "NONE",
    baseUrl: null,
    config: {},
    credentialsEnc: null,
    webhookSecretEnc: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as IntegrationConnection;
}

test("the connector context carries the owning tenant, not the connection id", () => {
  const context = buildConnectorContext(connection(), "products");
  assert.equal(context.tenantId, "tenant_abc");
  assert.equal(context.connectionId, "conn_123");
  assert.notEqual(context.tenantId, context.connectionId);
});

test("the tenant follows the connection, whatever the id looks like", () => {
  const context = buildConnectorContext(
    connection({ id: "tenant_abc", tenantId: "tenant_xyz" }),
    "customers"
  );
  assert.equal(context.tenantId, "tenant_xyz");
});
