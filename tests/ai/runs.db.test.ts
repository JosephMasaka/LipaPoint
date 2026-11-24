import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../../src/lib/db";
import { createApprovalRequest } from "../../src/lib/ai/approvals";
import { getAgent } from "../../src/lib/ai/agents";
import {
  checkAgentQuota,
  finishAgentRun,
  getAgentRun,
  listAgentRuns,
  resolveAwaitingRun,
  startAgentRun,
} from "../../src/lib/ai/runs";
import { recordToolInvocation } from "../../src/lib/ai/quota";

/**
 * Agent-run lifecycle against a real database. Opt-in (`RUN_DB_TESTS=1 npm
 * test`) because it writes rows; the tenant delete cascades them away.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const skip = RUN ? false : "set RUN_DB_TESTS=1 to run database tests";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tenantId = `it-runs-${stamp}`;
const otherTenantId = `it-runs-other-${stamp}`;
const userId = `it-runs-user-${stamp}`;

const inventory = getAgent("inventory")!;
const assistant = getAgent("assistant")!;

function newRunId(label: string) {
  return `it-run-${stamp}-${label}`;
}

before(async () => {
  if (!RUN) return;
  await db.tenant.create({
    data: {
      id: tenantId,
      slug: tenantId,
      name: "Runs Test",
      type: "RETAIL",
      email: `${tenantId}@example.test`,
      users: { create: { id: userId, email: `${userId}@example.test`, name: "Owner", password: "x", role: "OWNER" } },
    },
  });
  await db.tenant.create({
    data: { id: otherTenantId, slug: otherTenantId, name: "Runs Other", type: "RETAIL", email: `${otherTenantId}@example.test` },
  });
});

after(async () => {
  if (!RUN) return;
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
});

test("a run opens as RUNNING and closes with its counts", { skip }, async () => {
  const runId = newRunId("close");
  const opened = await startAgentRun({
    tenantId,
    userId,
    runId,
    agent: inventory,
    surface: "chat",
    trigger: "chat",
  });
  assert.ok(opened?.id);

  const running = await db.aiAgentRun.findUnique({ where: { runId } });
  assert.equal(running?.status, "RUNNING");
  assert.equal(running?.agent, "inventory");
  assert.equal(running?.agentVersion, inventory.version);
  assert.equal(running?.finishedAt, null);

  await finishAgentRun({
    tenantId,
    runId,
    status: "AWAITING_APPROVAL",
    toolCallCount: 3,
    approvalCount: 1,
  });
  const closed = await db.aiAgentRun.findUnique({ where: { runId } });
  assert.equal(closed?.status, "AWAITING_APPROVAL");
  assert.equal(closed?.toolCallCount, 3);
  assert.equal(closed?.approvalCount, 1);
  assert.ok(closed?.finishedAt);
});

test("one run's detail carries only its own timeline", { skip }, async () => {
  const mine = newRunId("mine");
  const theirs = newRunId("theirs");
  await startAgentRun({ tenantId, userId, runId: mine, agent: assistant, surface: "chat", trigger: "chat" });
  await startAgentRun({ tenantId, userId, runId: theirs, agent: assistant, surface: "chat", trigger: "chat" });

  await recordToolInvocation({ tenantId, runId: mine, toolName: "get_sales_summary", args: {}, ok: true, resultRows: 1 });
  await recordToolInvocation({ tenantId, runId: theirs, toolName: "get_inventory_status", args: {}, ok: false, errorCode: "TOOL_FAILED" });
  await finishAgentRun({ tenantId, runId: mine, status: "COMPLETED", toolCallCount: 1 });
  await finishAgentRun({ tenantId, runId: theirs, status: "FAILED", errorCode: "TOOL_FAILED" });

  const detail = await getAgentRun(tenantId, mine);
  assert.ok(detail);
  assert.equal(detail.tools.length, 1);
  assert.equal(detail.tools[0].toolName, "get_sales_summary");
  assert.equal(detail.run.status, "COMPLETED");

  // Same run id under another tenant must not be visible.
  assert.equal(await getAgentRun(otherTenantId, mine), null);
  assert.equal(await getAgentRun(otherTenantId, "does-not-exist"), null);
});

test("run lists are tenant-scoped and filterable by agent", { skip }, async () => {
  const finance = getAgent("finance")!;
  const runId = newRunId("finance");
  await startAgentRun({ tenantId, userId, runId, agent: finance, surface: "chat", trigger: "chat" });
  await finishAgentRun({ tenantId, runId, status: "COMPLETED" });

  const all = await listAgentRuns(tenantId, { limit: 50 });
  assert.ok(all.length >= 3);
  assert.ok(all.every((r) => r.runId.startsWith(`it-run-${stamp}-`)));
  assert.equal(await listAgentRuns(otherTenantId, { limit: 50 }).then((r) => r.length), 0);

  const financeOnly = await listAgentRuns(tenantId, { agent: "finance" });
  assert.ok(financeOnly.length >= 1);
  assert.ok(financeOnly.every((r) => r.agent === "finance"));
});

test("per-agent quota counts this month's runs and honours its limit", { skip }, async () => {
  const quota = await checkAgentQuota(tenantId, "inventory", "PROFESSIONAL");
  assert.equal(quota.allowed, true);
  assert.ok(quota.used >= 1);

  process.env.AI_AGENT_MONTHLY_LIMIT_INVENTORY = String(quota.used);
  try {
    const exhausted = await checkAgentQuota(tenantId, "inventory", "PROFESSIONAL");
    assert.equal(exhausted.allowed, false);
    assert.equal(exhausted.remaining, 0);
  } finally {
    delete process.env.AI_AGENT_MONTHLY_LIMIT_INVENTORY;
  }

  // Another agent has its own budget.
  assert.equal((await checkAgentQuota(tenantId, "sales", "PROFESSIONAL")).allowed, true);
});

test("resolving from an approval only closes runs still waiting", { skip }, async () => {
  const waiting = newRunId("waiting");
  const done = newRunId("done");
  await startAgentRun({ tenantId, userId, runId: waiting, agent: assistant, surface: "chat", trigger: "chat" });
  await startAgentRun({ tenantId, userId, runId: done, agent: assistant, surface: "chat", trigger: "chat" });
  await finishAgentRun({ tenantId, runId: waiting, status: "AWAITING_APPROVAL", approvalCount: 1 });
  await finishAgentRun({ tenantId, runId: done, status: "COMPLETED" });

  // The proposal is linked to its run, so the run timeline shows the decision.
  const approval = await createApprovalRequest({
    tenantId,
    requestedById: userId,
    agent: assistant.id,
    toolName: "update_product_price",
    summary: "Test proposal",
    payload: { productId: "p1", price: 10, previousPrice: 9 },
    runId: waiting,
  });
  assert.equal(approval.runId, waiting);
  const linked = await getAgentRun(tenantId, waiting);
  assert.equal(linked?.approvals.length, 1);
  assert.equal(linked?.approvals[0].summary, "Test proposal");

  await resolveAwaitingRun(tenantId, waiting, "COMPLETED");
  await resolveAwaitingRun(tenantId, done, "CANCELLED");
  await resolveAwaitingRun(tenantId, null, "COMPLETED");

  assert.equal((await db.aiAgentRun.findUnique({ where: { runId: waiting } }))?.status, "COMPLETED");
  assert.equal((await db.aiAgentRun.findUnique({ where: { runId: done } }))?.status, "COMPLETED");
  // Another tenant cannot close this tenant's run by id.
  const other = newRunId("other-waiting");
  await startAgentRun({ tenantId, userId, runId: other, agent: assistant, surface: "chat", trigger: "chat" });
  await finishAgentRun({ tenantId, runId: other, status: "AWAITING_APPROVAL" });
  await resolveAwaitingRun(otherTenantId, other, "COMPLETED");
  assert.equal((await db.aiAgentRun.findUnique({ where: { runId: other } }))?.status, "AWAITING_APPROVAL");
});
