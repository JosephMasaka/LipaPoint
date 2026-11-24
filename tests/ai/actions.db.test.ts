import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../../src/lib/db";
import { ApprovalError, createApprovalRequest, decideApproval } from "../../src/lib/ai/approvals";
import { executeApprovedAction, proposeAction } from "../../src/lib/ai/actions";

/**
 * Governed actions against a real database.
 *
 * Opt-in (`RUN_DB_TESTS=1 npm test`) because it writes and then deletes rows.
 * Proves the loop end to end: propose → nothing changes → approve → execute
 * once → second execution refused.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const skip = RUN ? false : "set RUN_DB_TESTS=1 to run database tests";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tenantId = `it-actions-${stamp}`;
const userId = `it-actions-user-${stamp}`;
const uomId = `it-actions-uom-${stamp}`;
const productId = `it-actions-product-${stamp}`;
const supplierId = `it-actions-supplier-${stamp}`;

before(async () => {
  if (!RUN) return;
  await db.tenant.create({
    data: {
      id: tenantId,
      slug: tenantId,
      name: "Actions Test",
      type: "RETAIL",
      email: `${tenantId}@example.test`,
      users: {
        create: { id: userId, email: `${userId}@example.test`, name: "Owner", password: "x", role: "OWNER" },
      },
      unitsOfMeasure: { create: { id: uomId, name: "Piece", abbreviation: "pc" } },
      products: {
        create: {
          id: productId,
          name: "Test Unga 2kg",
          sku: `SKU-${stamp}`,
          price: 200,
          cost: 150,
          baseUnitId: uomId,
        },
      },
      suppliers: { create: { id: supplierId, name: "Test Millers" } },
    },
  });
});

after(async () => {
  if (!RUN) return;
  // Tenant cascades cover approvals, products, suppliers and purchase orders.
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
});

test("unknown actions are rejected", { skip }, async () => {
  await assert.rejects(
    () => proposeAction({ tenantId, userId, toolName: "drop_database", args: {} }),
    (err: unknown) => err instanceof ApprovalError && err.code === "INVALID_INPUT"
  );
});

test("a proposed purchase order changes no business data", { skip }, async () => {
  const { approval, summary } = await proposeAction({
    tenantId,
    userId,
    toolName: "create_purchase_order",
    args: { productId, supplierId, quantity: 12 },
  });

  assert.equal(approval.status, "PENDING");
  assert.equal(approval.agent, "inventory");
  assert.match(summary, /12 × Test Unga 2kg/);
  assert.equal(await db.purchaseOrder.count({ where: { tenantId } }), 0);
});

test("an approved purchase order runs once", { skip }, async () => {
  const { approval } = await proposeAction({
    tenantId,
    userId,
    toolName: "create_purchase_order",
    args: { productId, supplierId, quantity: 12 },
  });

  await assert.rejects(
    () => executeApprovedAction({ tenantId, requestId: approval.id, actorId: userId }),
    (err: unknown) => err instanceof ApprovalError && err.code === "NOT_APPROVED"
  );

  await decideApproval({
    tenantId,
    requestId: approval.id,
    actorId: userId,
    actorRole: "OWNER",
    decision: "approve",
  });

  const outcome = await executeApprovedAction({ tenantId, requestId: approval.id, actorId: userId });
  assert.equal(outcome.toolName, "create_purchase_order");

  const orders = await db.purchaseOrder.findMany({
    where: { tenantId },
    include: { items: true },
  });
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, "draft");
  assert.equal(orders[0].items[0].quantity, 12);
  assert.equal(orders[0].items[0].unitCost, 150);

  await assert.rejects(
    () => executeApprovedAction({ tenantId, requestId: approval.id, actorId: userId }),
    (err: unknown) => err instanceof ApprovalError && err.code === "ALREADY_CONSUMED"
  );
});

test("a price below cost is never queued", { skip }, async () => {
  await assert.rejects(
    () =>
      proposeAction({
        tenantId,
        userId,
        toolName: "update_product_price",
        args: { productId, price: 100 },
      }),
    (err: unknown) => err instanceof ApprovalError && err.code === "INVALID_INPUT"
  );
  assert.equal(await db.aiApprovalRequest.count({ where: { tenantId, toolName: "update_product_price" } }), 0);
});

test("an approved price change applies and is audited", { skip }, async () => {
  const { approval } = await proposeAction({
    tenantId,
    userId,
    toolName: "update_product_price",
    args: { productId, price: 220 },
  });
  await decideApproval({
    tenantId,
    requestId: approval.id,
    actorId: userId,
    actorRole: "OWNER",
    decision: "approve",
  });
  await executeApprovedAction({ tenantId, requestId: approval.id, actorId: userId });

  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(product.price, 220);

  const history = await db.productPriceHistory.findMany({ where: { tenantId, productId } });
  assert.equal(history.length, 1);
  assert.equal(history[0].previousPrice, 200);
  assert.equal(history[0].newPrice, 220);
  assert.equal(history[0].changedById, userId);
});

test("an unvalidated request is refused without spending the approval", { skip }, async () => {
  // Requests queued straight through the API/DB seam bypass proposeAction, so
  // execution must re-validate before consuming the approval.
  const approval = await createApprovalRequest({
    tenantId,
    requestedById: userId,
    agent: "inventory",
    toolName: "create_purchase_order",
    summary: "Malformed legacy request",
    payload: { productId: "missing", supplierId: "missing", quantity: 1, unitCost: 1 },
  });
  await decideApproval({
    tenantId,
    requestId: approval.id,
    actorId: userId,
    actorRole: "OWNER",
    decision: "approve",
  });

  await assert.rejects(
    () => executeApprovedAction({ tenantId, requestId: approval.id, actorId: userId }),
    (err: unknown) => err instanceof ApprovalError && err.code === "INVALID_INPUT"
  );

  const stored = await db.aiApprovalRequest.findUniqueOrThrow({ where: { id: approval.id } });
  assert.equal(stored.consumedAt, null);
  assert.equal(stored.status, "APPROVED");
});

test("a price moved after approval cannot be overwritten", { skip }, async () => {
  const { approval } = await proposeAction({
    tenantId,
    userId,
    toolName: "update_product_price",
    args: { productId, price: 240 },
  });
  await decideApproval({
    tenantId,
    requestId: approval.id,
    actorId: userId,
    actorRole: "OWNER",
    decision: "approve",
  });

  // Someone edits the price in the meantime.
  await db.product.update({ where: { id: productId }, data: { price: 230 } });

  await assert.rejects(
    () => executeApprovedAction({ tenantId, requestId: approval.id, actorId: userId }),
    (err: unknown) => err instanceof ApprovalError && err.code === "PAYLOAD_MISMATCH"
  );
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(product.price, 230);
});
