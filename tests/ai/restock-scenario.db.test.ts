import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../../src/lib/db";
import { buildIntelligence } from "../../src/lib/ai/intelligence";

/**
 * Restock quantities against a real database.
 *
 * Opt-in (`RUN_DB_TESTS=1 npm test`) because it seeds and then deletes rows.
 * Scenario: 30 units sold over the 30-day window (velocity 1/day), 6 units on
 * hand (6 days of cover). So:
 *   target 5  → covered, no suggestion
 *   target 14 → 8 units to reach 14 days
 *   target 30 → 24 units to reach 30 days
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const skip = RUN ? false : "set RUN_DB_TESTS=1 to run database tests";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tenantId = `it-restock-${stamp}`;
const locationId = `it-restock-loc-${stamp}`;
const userId = `it-restock-user-${stamp}`;
const uomId = `it-restock-uom-${stamp}`;
const productId = `it-restock-product-${stamp}`;
const orderId = `it-restock-order-${stamp}`;

before(async () => {
  if (!RUN) return;
  await db.tenant.create({
    data: {
      id: tenantId,
      slug: tenantId,
      name: "Restock Scenario",
      type: "RETAIL",
      email: `${tenantId}@example.test`,
      locations: { create: { id: locationId, name: "Main" } },
      users: {
        create: { id: userId, email: `${userId}@example.test`, name: "Cashier", password: "x" },
      },
      unitsOfMeasure: { create: { id: uomId, name: "Piece", abbreviation: "pc" } },
      products: {
        create: {
          id: productId,
          name: "Test Sugar 1kg",
          sku: `SKU-${stamp}`,
          price: 150,
          cost: 120,
          baseUnitId: uomId,
        },
      },
    },
  });

  await db.stock.create({ data: { productId, locationId, quantity: 6 } });
  await db.order.create({
    data: {
      id: orderId,
      orderNo: `IT-${stamp}`,
      status: "COMPLETED",
      subtotal: 4500,
      taxAmount: 0,
      total: 4500,
      tenantId,
      locationId,
      userId,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      items: {
        create: { productId, quantity: 30, baseQuantity: 30, unitPrice: 150, total: 4500 },
      },
    },
  });
});

after(async () => {
  if (!RUN) return;
  // OrderItem → Product is RESTRICT, so orders go first and the tenant cascade
  // then clears the rest (locations, stock, products, users).
  await db.orderItem.deleteMany({ where: { order: { tenantId } } });
  await db.order.deleteMany({ where: { tenantId } });
  await db.product.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});

async function suggestionAt(targetDays: number) {
  await db.tenant.update({ where: { id: tenantId }, data: { restockTargetDays: targetDays } });
  const intel = await buildIntelligence(tenantId);
  return intel.restock.find((s) => s.productId === productId) ?? null;
}

test("restock quantity follows the tenant's target cover days", { skip }, async () => {
  const generous = await suggestionAt(30);
  assert.ok(generous, "expected a suggestion at a 30-day target");
  assert.equal(generous.targetDays, 30);
  assert.equal(generous.suggestedQty, 24);
  assert.equal(generous.stock, 6);

  const normal = await suggestionAt(14);
  assert.ok(normal, "expected a suggestion at a 14-day target");
  assert.equal(normal.targetDays, 14);
  assert.equal(normal.suggestedQty, 8);

  const covered = await suggestionAt(5);
  assert.equal(covered, null, "6 days of cover must not trigger a 5-day target");
});
