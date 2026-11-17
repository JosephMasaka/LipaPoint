import { db } from "@/lib/db";
import { estimateCostUsd } from "./usage";

/**
 * Monthly AI quota, enforced per tenant.
 *
 * The burst limiter in the chat route is per user and in-memory; this quota is
 * the authoritative, database-backed ceiling. Limits are configuration, not
 * pricing: raising them needs no code change.
 */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000; // EAT, UTC+3, no DST

const DEFAULT_LIMITS: Record<string, number> = {
  PROFESSIONAL: 300,
  ENTERPRISE: 2000,
};

function envLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function monthlyQuotaFor(tier: string): number {
  if (tier === "ENTERPRISE") {
    return envLimit("AI_MONTHLY_QUOTA_ENTERPRISE", DEFAULT_LIMITS.ENTERPRISE);
  }
  // Any granted tier that is not Enterprise (including an add-on grant on
  // Starter) gets the Professional allowance rather than being unlimited.
  return envLimit("AI_MONTHLY_QUOTA_PROFESSIONAL", DEFAULT_LIMITS.PROFESSIONAL);
}

/** Calendar month in Africa/Nairobi, as UTC instants. Exported for tests. */
export function monthWindow(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const local = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - NAIROBI_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - NAIROBI_OFFSET_MS),
    label: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  month: string;
}

/**
 * Counts metered runs this month. Fails open on a database error — an
 * analytics outage must not take the assistant down — and logs loudly so the
 * failure is visible rather than silently losing the limit.
 */
export async function checkQuota(tenantId: string, tier: string): Promise<QuotaStatus> {
  const { start, end, label } = monthWindow();
  const limit = monthlyQuotaFor(tier);

  try {
    const used = await db.aiUsageRecord.count({
      where: {
        tenantId,
        status: { not: "QUOTA_EXCEEDED" },
        createdAt: { gte: start, lt: end },
      },
    });
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt: end.toISOString(),
      month: label,
    };
  } catch (error) {
    console.error("AI quota check failed — allowing request:", error);
    return { allowed: true, used: 0, limit, remaining: limit, resetsAt: end.toISOString(), month: label };
  }
}

export interface UsageInput {
  tenantId: string;
  userId?: string | null;
  runId: string;
  surface: "chat" | "insights";
  provider: string;
  model?: string | null;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  status: string;
  errorCode?: string | null;
  toolCallCount?: number;
}

/**
 * Persists one metered run. Never throws: a telemetry failure must not turn a
 * successful answer into an error response.
 */
export async function recordUsage(input: UsageInput): Promise<void> {
  const promptTokens = input.promptTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const totalTokens = input.totalTokens ?? promptTokens + outputTokens;

  try {
    await db.aiUsageRecord.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        runId: input.runId,
        surface: input.surface,
        provider: input.provider,
        model: input.model ?? null,
        promptTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: estimateCostUsd({
          model: input.model,
          promptTokens,
          outputTokens,
          totalTokens,
        }),
        latencyMs: input.latencyMs ?? 0,
        status: input.status,
        errorCode: input.errorCode ?? null,
        toolCallCount: input.toolCallCount ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to persist AI usage record:", error);
  }
}

export async function recordToolInvocation(input: {
  tenantId: string;
  runId: string;
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean;
  errorCode?: string | null;
  resultRows?: number;
  latencyMs?: number;
}): Promise<void> {
  try {
    await db.aiToolInvocation.create({
      data: {
        tenantId: input.tenantId,
        runId: input.runId,
        toolName: input.toolName,
        argsJson: JSON.stringify(input.args).slice(0, 2000),
        ok: input.ok,
        errorCode: input.errorCode ?? null,
        resultRows: input.resultRows ?? 0,
        latencyMs: input.latencyMs ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to persist AI tool invocation:", error);
  }
}

export async function getUsageSummary(tenantId: string, tier: string) {
  const { start, end, label } = monthWindow();
  const limit = monthlyQuotaFor(tier);

  const [aggregate, recent] = await Promise.all([
    db.aiUsageRecord.aggregate({
      where: { tenantId, status: { not: "QUOTA_EXCEEDED" }, createdAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
    }),
    db.aiUsageRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        runId: true,
        surface: true,
        provider: true,
        totalTokens: true,
        estimatedCostUsd: true,
        latencyMs: true,
        status: true,
        errorCode: true,
        createdAt: true,
      },
    }),
  ]);

  const used = aggregate._count._all;

  return {
    month: label,
    requests: used,
    tokens: aggregate._sum.totalTokens ?? 0,
    estimatedCostUsd: Math.round((aggregate._sum.estimatedCostUsd ?? 0) * 1_000_000) / 1_000_000,
    quota: {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsAt: end.toISOString(),
    },
    recent,
  };
}
