import { db } from "@/lib/db";
import { monthWindow } from "./quota";
import { monthlyRunLimitFor, type AgentDefinition } from "./agents";

/**
 * Agent-run lifecycle and history (Milestone 3).
 *
 * One row per run, keyed by the same `runId` used for metered usage and tool
 * invocations, so a run's timeline is a plain join rather than a second log.
 * Telemetry must never take the assistant down: writes log and return null on
 * failure instead of throwing into a request handler.
 */

export type AgentRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "AWAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AgentRunInput {
  tenantId: string;
  userId?: string | null;
  runId: string;
  agent: AgentDefinition;
  surface: "chat" | "approval";
  trigger: "chat" | "approval";
}

/** Opens a run. Returns null if telemetry cannot be written. */
export async function startAgentRun(input: AgentRunInput): Promise<{ id: string } | null> {
  try {
    return await db.aiAgentRun.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        runId: input.runId,
        agent: input.agent.id,
        agentVersion: input.agent.version,
        surface: input.surface,
        trigger: input.trigger,
        status: "RUNNING",
        startedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("Failed to open AI agent run:", error);
    return null;
  }
}

export interface FinishRunInput {
  tenantId: string;
  runId: string;
  status: AgentRunStatus;
  errorCode?: string | null;
  toolCallCount?: number;
  approvalCount?: number;
}

/** Closes a run. Safe to call twice; a missing run is ignored. */
export async function finishAgentRun(input: FinishRunInput): Promise<void> {
  try {
    await db.aiAgentRun.updateMany({
      where: { tenantId: input.tenantId, runId: input.runId },
      data: {
        status: input.status,
        errorCode: input.errorCode ?? null,
        toolCallCount: input.toolCallCount ?? 0,
        approvalCount: input.approvalCount ?? 0,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to close AI agent run:", error);
  }
}

/**
 * Closes a run from the approval side. Only touches runs still waiting, so a
 * decision on a stale request cannot rewrite a finished run.
 */
export async function resolveAwaitingRun(
  tenantId: string,
  runId: string | null | undefined,
  status: Extract<AgentRunStatus, "COMPLETED" | "CANCELLED"> = "COMPLETED"
): Promise<void> {
  if (!runId) return;
  try {
    await db.aiAgentRun.updateMany({
      where: { tenantId, runId, status: "AWAITING_APPROVAL" },
      data: { status, finishedAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to resolve AI agent run from approval:", error);
  }
}

export interface AgentQuota {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

/** Per-agent monthly run ceiling. Fails open on a database error. */
export async function checkAgentQuota(
  tenantId: string,
  agentId: string,
  tier: string
): Promise<AgentQuota> {
  const { start, end } = monthWindow();
  const limit = monthlyRunLimitFor(agentId, tier);
  try {
    const used = await db.aiAgentRun.count({
      where: { tenantId, agent: agentId, createdAt: { gte: start, lt: end } },
    });
    return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used), resetsAt: end.toISOString() };
  } catch (error) {
    console.error("AI agent quota check failed — allowing request:", error);
    return { allowed: true, used: 0, limit, remaining: limit, resetsAt: end.toISOString() };
  }
}

const RUN_SELECT = {
  id: true,
  runId: true,
  agent: true,
  agentVersion: true,
  surface: true,
  trigger: true,
  status: true,
  errorCode: true,
  toolCallCount: true,
  approvalCount: true,
  startedAt: true,
  finishedAt: true,
  userId: true,
} as const;

export async function listAgentRuns(
  tenantId: string,
  opts: { limit?: number; agent?: string } = {}
) {
  const agent = opts.agent?.trim().toLowerCase();
  return db.aiAgentRun.findMany({
    where: { tenantId, ...(agent ? { agent } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, opts.limit ?? 25)),
    select: RUN_SELECT,
  });
}

/** One run with its tool/action timeline. Tenant-scoped by the query. */
export async function getAgentRun(tenantId: string, runId: string) {
  const run = await db.aiAgentRun.findFirst({ where: { tenantId, runId }, select: RUN_SELECT });
  if (!run) return null;

  const [tools, approvals, usage] = await Promise.all([
    db.aiToolInvocation.findMany({
      where: { tenantId, runId },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        toolName: true,
        ok: true,
        errorCode: true,
        resultRows: true,
        latencyMs: true,
        createdAt: true,
      },
    }),
    db.aiApprovalRequest.findMany({
      where: { tenantId, runId },
      orderBy: { createdAt: "asc" },
      take: 25,
      select: {
        id: true,
        agent: true,
        toolName: true,
        summary: true,
        status: true,
        expiresAt: true,
        decidedAt: true,
        consumedAt: true,
        createdAt: true,
      },
    }),
    db.aiUsageRecord.findFirst({
      where: { tenantId, runId },
      select: {
        provider: true,
        model: true,
        totalTokens: true,
        estimatedCostUsd: true,
        latencyMs: true,
        status: true,
        errorCode: true,
      },
    }),
  ]);

  return { run, tools, approvals, usage };
}
