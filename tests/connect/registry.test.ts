import { test } from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS, availableProviders, getProvider } from "../../src/lib/connect/registry";
import { connectorIds, getConnector } from "../../src/lib/connect/connectors";
import { CONNECT_ENTITIES } from "../../src/lib/connect/types";

test("every available provider has a connector", () => {
  for (const provider of availableProviders()) {
    assert.ok(getConnector(provider.id), `${provider.id} has no connector implementation`);
  }
});

test("no planned provider has a connector (nothing unsupported is advertised as usable)", () => {
  for (const provider of PROVIDERS.filter((entry) => entry.status === "planned")) {
    assert.equal(getConnector(provider.id), undefined, `${provider.id} is planned but has a connector`);
  }
});

test("every connector is in the catalogue", () => {
  for (const id of connectorIds()) {
    assert.ok(getProvider(id), `${id} has a connector but no catalogue entry`);
  }
});

test("providers only claim supported entities", () => {
  for (const provider of PROVIDERS) {
    assert.ok(provider.entities.length > 0, `${provider.id} claims no entities`);
    for (const entity of provider.entities) {
      assert.ok(
        (CONNECT_ENTITIES as readonly string[]).includes(entity),
        `${provider.id} claims unknown entity ${entity}`
      );
    }
  }
});

test("the sandbox provider is labelled as simulated", () => {
  const mock = getProvider("mock");
  assert.ok(mock);
  assert.match(mock!.label, /sandbox/i);
  assert.match(mock!.description, /simulated/i);
});

test("custom API supports key, bearer, basic and unauthenticated access", () => {
  const provider = getProvider("custom-api");
  assert.ok(provider);
  for (const authType of ["API_KEY", "BEARER", "BASIC", "NONE"]) {
    assert.ok(provider!.authTypes.includes(authType as never));
  }
  assert.equal(provider!.supportsWebhooks, true);
});
