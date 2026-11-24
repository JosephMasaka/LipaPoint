import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AGENT_ID,
  agentAllowsTool,
  agentDeclarations,
  agentToolNames,
  getAgent,
  listAgents,
  monthlyRunLimitFor,
  resolveAgent,
} from "../../src/lib/ai/agents";
import { toolDeclarations } from "../../src/lib/ai/tools/registry";
import { actionDeclarations } from "../../src/lib/ai/actions";

/** The registry is the permission contract, so it is tested like one. */

const readNames = toolDeclarations().map((d) => d.name);
const actionNames = actionDeclarations().map((d) => d.name);

test("agent ids and versions are stable and unique", () => {
  const ids = listAgents().map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const agent of listAgents()) {
    assert.match(agent.id, /^[a-z][a-z0-9_]*$/);
    assert.ok(agent.version >= 1);
    assert.ok(agent.label.length > 0);
  }
  assert.ok(ids.includes(DEFAULT_AGENT_ID));
});

test("every granted tool exists and is in the right grant list", () => {
  const known = new Set([...readNames, ...actionNames]);
  for (const agent of listAgents()) {
    for (const tool of agent.readTools) {
      assert.ok(known.has(tool), `${agent.id} grants unknown read tool ${tool}`);
      assert.ok(readNames.includes(tool), `${agent.id} lists ${tool} as read but it is an action`);
    }
    for (const tool of agent.actionTools) {
      assert.ok(known.has(tool), `${agent.id} grants unknown action tool ${tool}`);
      assert.ok(actionNames.includes(tool), `${agent.id} lists ${tool} as an action but it is read-only`);
    }
    assert.equal(new Set(agentToolNames(agent)).size, agent.readTools.length + agent.actionTools.length);
  }
});

test("the general assistant is the broadest agent", () => {
  const assistant = getAgent(DEFAULT_AGENT_ID);
  assert.ok(assistant);
  for (const agent of listAgents()) {
    for (const tool of agentToolNames(agent)) {
      assert.ok(agentAllowsTool(assistant, tool), `assistant should also have ${tool}`);
    }
  }
});

test("declarations are filtered to the agent's grant", () => {
  const inventory = getAgent("inventory");
  assert.ok(inventory);
  const declared = agentDeclarations(inventory).map((d) => d.name).sort();
  assert.deepEqual(declared, ["create_purchase_order", "get_inventory_status", "get_product_performance", "get_sales_summary"]);

  const finance = getAgent("finance");
  assert.ok(finance);
  assert.deepEqual(agentDeclarations(finance).map((d) => d.name).sort(), ["get_product_performance", "get_sales_summary"]);
  assert.equal(agentDeclarations(finance).some((d) => actionNames.includes(d.name)), false);
});

test("read tools can be switched off without hiding actions", () => {
  const assistant = getAgent(DEFAULT_AGENT_ID);
  assert.ok(assistant);
  const names = agentDeclarations(assistant, { readToolsEnabled: false }).map((d) => d.name).sort();
  assert.deepEqual(names, [...actionNames].sort());
});

test("unknown and disabled agents are refused, not downgraded", () => {
  assert.equal(resolveAgent(null)?.id, DEFAULT_AGENT_ID);
  assert.equal(resolveAgent("")?.id, DEFAULT_AGENT_ID);
  assert.equal(resolveAgent(" nope "), null);

  process.env.AI_AGENTS_DISABLED = "finance, customer";
  try {
    assert.equal(resolveAgent("finance"), null);
    assert.equal(getAgent("customer"), null);
    assert.equal(resolveAgent("sales")?.id, "sales");
  } finally {
    delete process.env.AI_AGENTS_DISABLED;
  }
  assert.equal(resolveAgent("finance")?.id, "finance");
});

test("tool permission checks do not leak across agents", () => {
  const finance = getAgent("finance");
  const inventory = getAgent("inventory");
  assert.ok(finance && inventory);
  assert.equal(agentAllowsTool(inventory, "create_purchase_order"), true);
  assert.equal(agentAllowsTool(finance, "create_purchase_order"), false);
  assert.equal(agentAllowsTool(finance, "drop_database"), false);
});

test("per-agent limits have defaults and are env-overridable", () => {
  const professional = monthlyRunLimitFor("inventory", "PROFESSIONAL");
  assert.ok(professional > 0);
  assert.ok(monthlyRunLimitFor("inventory", "ENTERPRISE") >= professional);

  process.env.AI_AGENT_MONTHLY_LIMIT_INVENTORY = "7";
  try {
    assert.equal(monthlyRunLimitFor("inventory", "PROFESSIONAL"), 7);
    assert.equal(monthlyRunLimitFor("inventory", "ENTERPRISE"), 7);
  } finally {
    delete process.env.AI_AGENT_MONTHLY_LIMIT_INVENTORY;
  }

  process.env.AI_AGENT_MONTHLY_LIMIT_INVENTORY = "0";
  try {
    assert.equal(monthlyRunLimitFor("inventory", "PROFESSIONAL"), professional);
  } finally {
    delete process.env.AI_AGENT_MONTHLY_LIMIT_INVENTORY;
  }
});
