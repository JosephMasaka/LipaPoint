import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMapping,
  defaultMapping,
  normaliseMapping,
  readPath,
  validateMapping,
} from "../../src/lib/connect/mapping";

test("rejects a mapping that does not map the required product fields", () => {
  const result = validateMapping("products", { fields: { name: "title" } });
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.errors.join(" ") : "", /SKU/);
  assert.match(result.ok === false ? result.errors.join(" ") : "", /price/i);
});

test("maps nested paths and coerces numbers and booleans", () => {
  const record = {
    attributes: { sku: "A-1", title: "Widget", price: "KES 1,250.50" },
    active: "yes",
    stock: 1,
  };
  const mapping = {
    fields: { sku: "attributes.sku", name: "attributes.title", price: "attributes.price", isActive: "active", trackStock: "stock" },
  };

  const result = applyMapping("products", normaliseMapping("products", mapping), record);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    sku: "A-1",
    name: "Widget",
    price: 1250.5,
    isActive: true,
    trackStock: true,
  });
});

test("collects every bad field in one pass", () => {
  const mapping = defaultMapping("products");
  const result = applyMapping("products", mapping, { sku: "", name: "", price: "not-a-number" });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.some((error) => /SKU/.test(error)));
  assert.ok(result.errors.some((error) => /price/i.test(error)));
});

test("applies defaults when the source is empty", () => {
  const mapping = { fields: { sku: "sku", name: "name", price: "price" }, defaults: { trackStock: true } };
  const result = applyMapping("products", normaliseMapping("products", mapping), {
    sku: "B-2",
    name: "Bolt",
    price: 10,
    track_stock: "",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.trackStock, true);
});

test("drops unknown fields from a stored mapping", () => {
  const normalised = normaliseMapping("customers", {
    fields: { name: "full_name", tenantId: "hack", phone: "phone" },
  });
  assert.equal(normalised.fields.tenantId, undefined);
  assert.equal(normalised.fields.name, "full_name");
  assert.equal(normalised.fields.phone, "phone");
});

test("readPath walks dot paths and array indexes", () => {
  const payload = { data: { items: [{ sku: "X" }] } };
  assert.equal(readPath(payload, "data.items.0.sku"), "X");
  assert.equal(readPath(payload, "data.missing.value"), undefined);
});

test("requires a customer name", () => {
  const result = applyMapping("customers", normaliseMapping("customers", null), { email: "a@b.com" });
  assert.equal(result.ok, false);
});
