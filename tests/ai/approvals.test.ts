import assert from "node:assert/strict";
import test from "node:test";
import {
  ApprovalError,
  canonicalJson,
  consumeApproval,
  createApprovalRequest,
  decideApproval,
  type ApprovalRecord,
  type ApprovalStore,
} from "../../src/lib/ai/approvals";

class MemoryApprovalStore implements ApprovalStore {
  rows: ApprovalRecord[] = [];
  private seq = 0;

  async findByFingerprint(tenantId: string, fingerprint: string) {
    return this.rows.find((r) => r.tenantId === tenantId && r.fingerprint === fingerprint) ?? null;
  }
  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async create(data: Omit<ApprovalRecord, "id" | "createdAt">) {
    const row: ApprovalRecord = { ...data, id: `apr_${++this.seq}`, createdAt: new Date() };
    this.rows.push(row);
    return row;
  }
  async update(id: string, data: Partial<ApprovalRecord>) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error("missing");
    Object.assign(row, data);
    return row;
  }
}

const base = {
  tenantId: "tenant-a",
  requestedById: "user-1",
  agent: "inventory",
  toolName: "create_purchase_order",
  summary: "Order 20 bags of sugar",
  payload: { productId: "p1", quantity: 20, locationId: "loc1" },
};

async function approved(store: MemoryApprovalStore, now = new Date()) {
  const request = await createApprovalRequest({ ...base, store, now });
  await decideApproval({
    tenantId: base.tenantId,
    requestId: request.id,
    actorId: "owner-1",
    actorRole: "OWNER",
    decision: "approve",
    store,
    now,
  });
  return request;
}

test("canonical JSON ignores key order", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
});

test("re-requesting the same proposal reuses the open request", async () => {
  const store = new MemoryApprovalStore();
  const first = await createApprovalRequest({ ...base, store });
  const again = await createApprovalRequest({ ...base, payload: { locationId: "loc1", quantity: 20, productId: "p1" }, store });
  assert.equal(again.id, first.id);
  assert.equal(store.rows.length, 1);
});

test("a changed payload is a new request, not a reuse", async () => {
  const store = new MemoryApprovalStore();
  const first = await createApprovalRequest({ ...base, store });
  const second = await createApprovalRequest({ ...base, payload: { ...base.payload, quantity: 200 }, store });
  assert.notEqual(second.id, first.id);
  assert.equal(store.rows.length, 2);
});

test("only an owner, admin or manager can decide", async () => {
  const store = new MemoryApprovalStore();
  const request = await createApprovalRequest({ ...base, store });
  for (const role of ["CASHIER", "STOCK_KEEPER", "KITCHEN"]) {
    await assert.rejects(
      () => decideApproval({ tenantId: base.tenantId, requestId: request.id, actorId: "u", actorRole: role, decision: "approve", store }),
      (err: unknown) => err instanceof ApprovalError && err.code === "FORBIDDEN" && err.status === 403
    );
  }
  assert.equal(store.rows[0].status, "PENDING");
});

test("another tenant's request is not visible", async () => {
  const store = new MemoryApprovalStore();
  const request = await createApprovalRequest({ ...base, store });
  await assert.rejects(
    () => decideApproval({ tenantId: "tenant-b", requestId: request.id, actorId: "u", actorRole: "OWNER", decision: "approve", store }),
    (err: unknown) => err instanceof ApprovalError && err.code === "NOT_FOUND"
  );
});

test("deciding after expiry records EXPIRED and refuses", async () => {
  const store = new MemoryApprovalStore();
  const created = new Date("2026-01-01T00:00:00Z");
  const request = await createApprovalRequest({ ...base, store, now: created, ttlMinutes: 15 });
  await assert.rejects(
    () =>
      decideApproval({
        tenantId: base.tenantId,
        requestId: request.id,
        actorId: "owner-1",
        actorRole: "OWNER",
        decision: "approve",
        store,
        now: new Date("2026-01-01T00:16:00Z"),
      }),
    (err: unknown) => err instanceof ApprovalError && err.code === "EXPIRED"
  );
  assert.equal(store.rows[0].status, "EXPIRED");
});

test("an approval can be consumed exactly once", async () => {
  const store = new MemoryApprovalStore();
  const request = await approved(store);

  const used = await consumeApproval({ tenantId: base.tenantId, requestId: request.id, payload: base.payload, store });
  assert.ok(used.consumedAt);

  await assert.rejects(
    () => consumeApproval({ tenantId: base.tenantId, requestId: request.id, payload: base.payload, store }),
    (err: unknown) => err instanceof ApprovalError && err.code === "ALREADY_CONSUMED"
  );
});

test("an altered action cannot use the approval", async () => {
  const store = new MemoryApprovalStore();
  const request = await approved(store);
  await assert.rejects(
    () =>
      consumeApproval({
        tenantId: base.tenantId,
        requestId: request.id,
        payload: { ...base.payload, quantity: 200 },
        store,
      }),
    (err: unknown) => err instanceof ApprovalError && err.code === "PAYLOAD_MISMATCH"
  );
  // Still usable for the payload that was actually approved.
  const used = await consumeApproval({ tenantId: base.tenantId, requestId: request.id, payload: base.payload, store });
  assert.ok(used.consumedAt);
});

test("pending and rejected requests cannot be consumed", async () => {
  const store = new MemoryApprovalStore();
  const pending = await createApprovalRequest({ ...base, store });
  await assert.rejects(
    () => consumeApproval({ tenantId: base.tenantId, requestId: pending.id, payload: base.payload, store }),
    (err: unknown) => err instanceof ApprovalError && err.code === "NOT_APPROVED"
  );

  const other = await createApprovalRequest({ ...base, payload: { ...base.payload, quantity: 5 }, store });
  await decideApproval({
    tenantId: base.tenantId, requestId: other.id, actorId: "owner-1", actorRole: "ADMIN", decision: "reject", note: "no cash", store,
  });
  await assert.rejects(
    () => consumeApproval({ tenantId: base.tenantId, requestId: other.id, payload: { ...base.payload, quantity: 5 }, store }),
    (err: unknown) => err instanceof ApprovalError && err.code === "NOT_APPROVED"
  );
});

test("an approval expires before use", async () => {
  const store = new MemoryApprovalStore();
  const created = new Date("2026-01-01T00:00:00Z");
  const request = await approved(store, created);
  await assert.rejects(
    () =>
      consumeApproval({
        tenantId: base.tenantId,
        requestId: request.id,
        payload: base.payload,
        store,
        now: new Date("2026-01-01T01:00:00Z"),
      }),
    (err: unknown) => err instanceof ApprovalError && err.code === "EXPIRED"
  );
});
