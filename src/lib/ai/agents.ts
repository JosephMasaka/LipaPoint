import { toolDeclarations } from "./tools/registry";
import { actionDeclarations } from "./actions";
import type { AiToolDeclaration } from "./types";

/**
 * Versioned agent registry (Milestone 3).
 *
 * An agent is a *definition*, not a process: it declares which read tools and
 * which propose-only write tools it may use, and its own monthly run limit.
 * The chat route resolves one definition per run and advertises only that
 * agent's tools, so an agent cannot reach a capability it was not granted even
 * if the model asks for it.
 *
 * Changing what an agent can do means publishing a new `version`; old runs keep
 * the version they ran under (`AiAgentRun.agentVersion`).
 */

export const AGENT_FEATURE = "ai-assistant";
export const DEFAULT_AGENT_ID = "assistant";

export interface AgentDefinition {
  id: string;
  version: number;
  label: string;
  description: string;
  /** Read-only tool names from `tools/registry`. */
  readTools: readonly string[];
  /** Propose-only action tool names from `actions`. */
  actionTools: readonly string[];
}

const SALES = "get_sales_summary";
const PRODUCTS = "get_product_performance";
const INVENTORY = "get_inventory_status";
const CUSTOMERS = "get_customer_insights";
const PRICING = "get_pricing_signals";

const AGENTS: AgentDefinition[] = [
  {
    id: "assistant",
    version: 1,
    label: "General assistant",
    description: "Answers any business question across sales, stock, pricing and customers.",
    readTools: [SALES, PRODUCTS, INVENTORY, CUSTOMERS, PRICING],
    actionTools: ["create_purchase_order", "update_product_price"],
  },
  {
    id: "inventory",
    version: 1,
    label: "Inventory agent",
    description: "Stock cover, reorder quantities and slow-moving stock; can draft purchase orders.",
    readTools: [INVENTORY, SALES, PRODUCTS],
    actionTools: ["create_purchase_order"],
  },
  {
    id: "finance",
    version: 1,
    label: "Finance agent",
    description: "Revenue, margin and cost performance by product and period.",
    readTools: [SALES, PRODUCTS],
    actionTools: [],
  },
  {
    id: "sales",
    version: 1,
    label: "Sales agent",
    description: "Sales trends, best sellers and customer buying patterns.",
    readTools: [SALES, PRODUCTS, CUSTOMERS],
    actionTools: [],
  },
  {
    id: "customer",
    version: 1,
    label: "Customer agent",
    description: "Customer history, retention and follow-up opportunities.",
    readTools: [CUSTOMERS, SALES],
    actionTools: [],
  },
  {
    id: "operations",
    version: 1,
    label: "Operations agent",
    description: "Stock exceptions, pricing signals and day-to-day operational summaries.",
    readTools: [INVENTORY, PRICING, SALES],
    actionTools: [],
  },
];

const BY_ID = new Map(AGENTS.map((agent) => [agent.id, agent]));

/** Agents turned off by an operator via `AI_AGENTS_DISABLED=finance,customer`. */
function disabledAgentIds(): Set<string> {
  const raw = process.env.AI_AGENTS_DISABLED ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAgentEnabled(agentId: string): boolean {
  return !disabledAgentIds().has(agentId);
}

/** All agents, including disabled ones, for the admin registry view. */
export function listAgents(): AgentDefinition[] {
  return AGENTS;
}

/** Strict lookup: null for an unknown or disabled id. */
export function getAgent(agentId: string | null | undefined): AgentDefinition | null {
  if (!agentId) return null;
  const agent = BY_ID.get(agentId);
  if (!agent || !isAgentEnabled(agent.id)) return null;
  return agent;
}

/**
 * Resolves the agent for a request. Omitted means the general assistant;
 * an explicitly requested unknown or disabled agent is an error the caller
 * must report rather than silently downgrade.
 */
export function resolveAgent(agentId: string | null | undefined): AgentDefinition | null {
  const id = (agentId ?? "").trim().toLowerCase();
  if (!id) return getAgent(DEFAULT_AGENT_ID);
  return getAgent(id);
}

export function agentToolNames(agent: AgentDefinition): string[] {
  return [...agent.readTools, ...agent.actionTools];
}

export function agentAllowsTool(agent: AgentDefinition, toolName: string): boolean {
  return agent.readTools.includes(toolName) || agent.actionTools.includes(toolName);
}

/**
 * The tool declarations advertised to the model for this agent. Read tools are
 * optional (`toolsEnabled`) because they can be switched off globally; action
 * tools are filtered to the agent's grant either way.
 */
export function agentDeclarations(
  agent: AgentDefinition,
  options: { readToolsEnabled?: boolean } = {}
): AiToolDeclaration[] {
  const read = options.readToolsEnabled === false ? [] : toolDeclarations();
  const actions = actionDeclarations();
  return [
    ...read.filter((d) => agent.readTools.includes(d.name)),
    ...actions.filter((d) => agent.actionTools.includes(d.name)),
  ];
}

const DEFAULT_MONTHLY_RUNS: Record<string, number> = {
  PROFESSIONAL: 100,
  ENTERPRISE: 600,
};

/**
 * Per-agent monthly run ceiling, separate from the tenant-wide quota so one
 * noisy agent cannot exhaust the whole allowance. Overridable by env:
 * `AI_AGENT_MONTHLY_LIMIT_INVENTORY` (applies to every tier) or
 * `AI_AGENT_MONTHLY_LIMIT_ENTERPRISE` for tier-specific numbers.
 */
export function monthlyRunLimitFor(agentId: string, tier: string): number {
  const agentKey = `AI_AGENT_MONTHLY_LIMIT_${agentId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const tierKey = `AI_AGENT_MONTHLY_LIMIT_${tier}`;
  const base = DEFAULT_MONTHLY_RUNS[tier] ?? DEFAULT_MONTHLY_RUNS.PROFESSIONAL;

  for (const key of [agentKey, tierKey]) {
    const raw = process.env[key];
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return base;
}
