import { db } from "@/lib/db";
import { createPurchaseOrder } from "@/lib/procurement";
import { invalidateIntelligence } from "./intelligence-cache";
import {
  ApprovalError,
  consumeApproval,
  createApprovalRequest,
  type ApprovalRecord,
} from "./approvals";
import type { AiToolDeclaration } from "./types";

/**
 * Write actions the assistant may *propose*.
 *
 * Two rules keep this safe:
 * 1. proposing validates everything against the tenant and writes an approval
 *    request — it never touches business data;
 * 2. executing requires `consumeApproval`, which re-checks the payload hash,
 *    the expiry and that the approval is approved and unused.
 *
 * The chat model can call these as tools; it can never call `executeAction`,
 * which only the approval route reaches.
 */

export interface ActionProposal {
  approval: ApprovalRecord;
  summary: string;
}

interface ActionDefinition {
  name: string;
  agent: string;
  declaration: AiToolDeclaration;
  /** Checks tenant ownership and shapes the exact payload that will run. */
  validate(tenantId: string, args: Record<string, unknown>): Promise<{ payload: Record<string, unknown>; summary: string }>;
  /** Runs after the approval is consumed. Must be idempotent-safe and tenant-scoped. */
  execute(tenantId: string, payload: Record<string, unknown>, actorId: string): Promise<unknown>;
}

const MAX_QUANTITY = 100_000;

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApprovalError("INVALID_INPUT", `${field} is required.`, 400);
  }
  return value.trim();
}

function num(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new ApprovalError("INVALID_INPUT", `${field} must be a number.`, 400);
  }
  return n;
}

/** Drafts a purchase order for one product. Nothing is ordered until approved. */
const createPurchaseOrderAction: ActionDefinition = {
  name: "create_purchase_order",
  agent: "inventory",
  declaration: {
    name: "create_purchase_order",
    description:
      "Propose a draft purchase order for one product. This does NOT order anything: it queues a request the owner must approve under AI approvals. Use it only when the user asks to order stock, and tell them to approve it.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product id from the product list." },
        supplierId: { type: "string", description: "Supplier id from the supplier list." },
        quantity: { type: "integer", description: "Units to order (1-100000)." },
        unitCost: { type: "number", description: "Cost per unit. Defaults to the product's recorded cost." },
      },
    },
  },
  async validate(tenantId, args) {
    const productId = str(args.productId, "productId");
    const supplierId = str(args.supplierId, "supplierId");
    const quantity = Math.trunc(num(args.quantity, "quantity"));
    if (quantity < 1 || quantity > MAX_QUANTITY) {
      throw new ApprovalError("INVALID_INPUT", `Quantity must be between 1 and ${MAX_QUANTITY}.`, 400);
    }

    const [product, supplier] = await Promise.all([
      db.product.findFirst({
        where: { id: productId, tenantId, isActive: true },
        select: { id: true, name: true, cost: true },
      }),
      db.supplier.findFirst({
        where: { id: supplierId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    if (!product) throw new ApprovalError("INVALID_INPUT", "That product is not in this business.", 400);
    if (!supplier) throw new ApprovalError("INVALID_INPUT", "That supplier is not in this business.", 400);

    const unitCost = args.unitCost === undefined ? product.cost : num(args.unitCost, "unitCost");
    if (unitCost < 0) throw new ApprovalError("INVALID_INPUT", "Unit cost cannot be negative.", 400);

    const payload = { productId: product.id, supplierId: supplier.id, quantity, unitCost, description: product.name };
    return {
      payload,
      summary: `Purchase order: ${quantity} × ${product.name} from ${supplier.name} at ${unitCost.toFixed(2)} each`,
    };
  },
  async execute(tenantId, payload, actorId) {
    return createPurchaseOrder({
      tenantId,
      supplierId: String(payload.supplierId),
      createdBy: actorId,
      notes: "Draft created from an approved AI proposal.",
      items: [
        {
          productId: String(payload.productId),
          description: String(payload.description),
          quantity: Number(payload.quantity),
          unitCost: Number(payload.unitCost),
        },
      ],
    });
  },
};

/** Changes a selling price, recording the previous price in the audit trail. */
const updateProductPriceAction: ActionDefinition = {
  name: "update_product_price",
  // Must be an agent id that exists in `agents.ts`: only the general
  // assistant is granted this action, so that is who the approval credits.
  agent: "assistant",
  declaration: {
    name: "update_product_price",
    description:
      "Propose a new selling price for one product. This does NOT change the price: it queues a request the owner must approve under AI approvals. Use it only when the user asks to change a price, and tell them to approve it.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product id from the product list." },
        price: { type: "number", description: "New selling price, greater than 0." },
      },
    },
  },
  async validate(tenantId, args) {
    const productId = str(args.productId, "productId");
    const price = num(args.price, "price");
    if (price <= 0) throw new ApprovalError("INVALID_INPUT", "Price must be greater than 0.", 400);

    const product = await db.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
      select: { id: true, name: true, price: true, cost: true },
    });
    if (!product) throw new ApprovalError("INVALID_INPUT", "That product is not in this business.", 400);

    // A price below cost destroys margin silently; refuse rather than queue it.
    if (product.cost > 0 && price < product.cost) {
      throw new ApprovalError(
        "INVALID_INPUT",
        `${price.toFixed(2)} is below this product's cost of ${product.cost.toFixed(2)}.`,
        400
      );
    }

    const payload = { productId: product.id, price, previousPrice: product.price };
    return {
      payload,
      summary: `Change price of ${product.name} from ${product.price.toFixed(2)} to ${price.toFixed(2)}`,
    };
  },
  async execute(tenantId, payload, actorId) {
    const productId = String(payload.productId);
    const price = Number(payload.price);

    const product = await db.product.findFirst({ where: { id: productId, tenantId }, select: { price: true } });
    if (!product) throw new ApprovalError("INVALID_INPUT", "That product is no longer available.", 400);

    // The approval was for `previousPrice`; if someone else moved the price in
    // the meantime the approved number is stale, so refuse instead of guessing.
    if (product.price !== Number(payload.previousPrice)) {
      throw new ApprovalError(
        "PAYLOAD_MISMATCH",
        "This product's price changed after the approval was requested. Request the change again.",
        409
      );
    }

    const [, updated] = await db.$transaction([
      db.productPriceHistory.create({
        data: { tenantId, productId, previousPrice: product.price, newPrice: price, changedById: actorId },
      }),
      db.product.update({ where: { id: productId }, data: { price } }),
    ]);
    await invalidateIntelligence(tenantId);
    return updated;
  },
};

const ACTIONS: ActionDefinition[] = [createPurchaseOrderAction, updateProductPriceAction];
const BY_NAME = new Map(ACTIONS.map((a) => [a.name, a]));

export function actionDeclarations(): AiToolDeclaration[] {
  return ACTIONS.map((a) => a.declaration);
}

export function isActionTool(name: string): boolean {
  return BY_NAME.has(name);
}

export function actionToolNames(): string[] {
  return ACTIONS.map((a) => a.name);
}

/**
 * Validates the proposal and queues it for a human. Never writes business data.
 */
export async function proposeAction(input: {
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  /** Agent run that produced this proposal, for the run timeline. */
  runId?: string | null;
}): Promise<ActionProposal> {
  const action = BY_NAME.get(input.toolName);
  if (!action) throw new ApprovalError("INVALID_INPUT", `Unknown action "${input.toolName}".`, 400);

  const { payload, summary } = await action.validate(input.tenantId, input.args);
  const approval = await createApprovalRequest({
    tenantId: input.tenantId,
    requestedById: input.userId,
    agent: action.agent,
    toolName: action.name,
    summary,
    payload,
    runId: input.runId ?? null,
  });
  return { approval, summary };
}

/**
 * Consumes the approval, then performs the approved action exactly once.
 * The approval is spent before execution: if execution fails, the request must
 * be made again rather than risk a double write.
 */
export async function executeApprovedAction(input: {
  tenantId: string;
  requestId: string;
  actorId: string;
}) {
  const record = await db.aiApprovalRequest.findFirst({
    where: { id: input.requestId, tenantId: input.tenantId },
  });
  if (!record) throw new ApprovalError("NOT_FOUND", "Approval request not found.", 404);

  const action = BY_NAME.get(record.toolName);
  if (!action) throw new ApprovalError("INVALID_INPUT", "This request is not a supported action.", 400);

  const payload = JSON.parse(record.payloadJson) as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApprovalError("INVALID_INPUT", "This request's payload is not a valid action.", 400);
  }

  // Re-validate before spending the approval: requests queued through the API
  // are validated on creation, but an old or hand-edited row must not burn the
  // approval on an action that cannot run.
  const args = payload as Record<string, unknown>;
  await action.validate(input.tenantId, args);
  await consumeApproval({ tenantId: input.tenantId, requestId: record.id, payload: args });
  const result = await action.execute(input.tenantId, args, input.actorId);
  return {
    approvalId: record.id,
    toolName: record.toolName,
    summary: record.summary,
    runId: record.runId,
    result,
  };
}
