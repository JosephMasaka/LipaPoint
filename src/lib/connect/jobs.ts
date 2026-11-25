import { db } from "../db";
import type { IntegrationJob } from "@prisma/client";
import type { ConnectEntity } from "./types";

/**
 * Sync job runner.
 *
 * There is no queue service in this application (no Redis, no BullMQ — see
 * REPOSITORY_AUDIT.md), so the queue is a table and the worker is the cron
 * tick plus the request that enqueued the work. Two rules make that safe:
 *
 * 1. **Exclusive claim.** A job is claimed with
 *    `updateMany({ where: { id, status: "QUEUED" }, … })` and the code requires
 *    `count === 1`. Two ticks racing on the same row cannot both win.
 * 2. **Bounded retries.** `attempt` is incremented at claim time; failures
 *    back off exponentially (capped at one hour) and become `DEAD` after
 *    `maxAttempts`, so a permanently broken provider cannot spin forever.
 *
 * Duplicate prevention is an application check: `enqueueJob` returns the
 * existing QUEUED/RUNNING job for the same connection+entity instead of
 * inserting a second one, and the P2002 catch covers a future database-level
 * constraint. The remaining race (two simultaneous inserts in the same
 * millisecond) would produce two queued jobs, not two writes — the claim still
 * runs them one at a time.
 */

const ACTIVE_STATUSES = ["QUEUED", "RUNNING"] as const;

export interface EnqueueInput {
  tenantId: string;
  connectionId: string;
  syncConfigId?: string | null;
  entity: ConnectEntity;
  trigger: "MANUAL" | "SCHEDULE" | "WEBHOOK" | "RETRY";
  requestedById?: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function enqueueJob(input: EnqueueInput): Promise<IntegrationJob> {
  const existing = await db.integrationJob.findFirst({
    where: {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      entity: input.entity,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  try {
    return await db.integrationJob.create({
      data: {
        tenantId: input.tenantId,
        connectionId: input.connectionId,
        syncConfigId: input.syncConfigId ?? null,
        entity: input.entity,
        trigger: input.trigger,
        requestedById: input.requestedById ?? null,
        status: "QUEUED",
        runAfter: new Date(),
      },
    });
  } catch (error) {
    // Lost the race against another request/tick — return the winner.
    if (isUniqueViolation(error)) {
      const winner = await db.integrationJob.findFirst({
        where: {
          tenantId: input.tenantId,
          connectionId: input.connectionId,
          entity: input.entity,
          status: { in: [...ACTIVE_STATUSES] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

/**
 * Claims up to `limit` due jobs. Each claim is an atomic conditional update;
 * an unsuccessful update moves on to the next candidate rather than retrying
 * the same row.
 */
export async function claimNextJobs(limit = 5): Promise<IntegrationJob[]> {
  const claimed: IntegrationJob[] = [];

  for (let index = 0; index < limit; index++) {
    const candidate = await db.integrationJob.findFirst({
      where: { status: "QUEUED", runAfter: { lte: new Date() } },
      orderBy: { runAfter: "asc" },
    });
    if (!candidate) break;

    const claim = await db.integrationJob.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        lockedAt: new Date(),
        attempt: { increment: 1 },
        errorCode: null,
        errorDetail: null,
      },
    });

    if (claim.count === 1) {
      claimed.push(await db.integrationJob.findUniqueOrThrow({ where: { id: candidate.id } }));
    }
  }

  return claimed;
}

export interface JobCounts {
  processed: number;
  applied: number;
  rejected: number;
}

export async function completeJob(jobId: string, counts: JobCounts): Promise<IntegrationJob> {
  const status = counts.rejected === 0 ? "SUCCEEDED" : counts.applied > 0 ? "PARTIAL" : "FAILED";
  return db.integrationJob.update({
    where: { id: jobId },
    data: {
      status,
      processedCount: counts.processed,
      appliedCount: counts.applied,
      rejectedCount: counts.rejected,
      finishedAt: new Date(),
      lockedAt: null,
    },
  });
}

export interface JobFailure {
  code: string;
  detail: string;
  retryable: boolean;
}

/** Backoff: 30s, 1m, 2m, 4m … capped at one hour. */
export function backoffMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(30_000 * 2 ** exponent, 3_600_000);
}

export async function failJob(job: IntegrationJob, failure: JobFailure): Promise<IntegrationJob> {
  const exhausted = !failure.retryable || job.attempt >= job.maxAttempts;
  return db.integrationJob.update({
    where: { id: job.id },
    data: exhausted
      ? {
          status: "DEAD",
          finishedAt: new Date(),
          lockedAt: null,
          errorCode: failure.code,
          errorDetail: failure.detail,
        }
      : {
          status: "QUEUED",
          runAfter: new Date(Date.now() + backoffMs(job.attempt)),
          lockedAt: null,
          errorCode: failure.code,
          errorDetail: failure.detail,
        },
  });
}

export async function retryJob(tenantId: string, jobId: string): Promise<IntegrationJob | null> {
  const job = await db.integrationJob.findFirst({ where: { id: jobId, tenantId } });
  if (!job) return null;
  if (job.status !== "FAILED" && job.status !== "DEAD" && job.status !== "PARTIAL") return job;

  return db.integrationJob.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      attempt: 0,
      runAfter: new Date(),
      lockedAt: null,
      finishedAt: null,
      errorCode: null,
      errorDetail: null,
      trigger: "RETRY",
    },
  });
}

/**
 * A process that dies mid-job leaves RUNNING rows behind. Anything locked for
 * longer than `minutes` is put back on the queue (the attempt already counted
 * at claim time, so recovery cannot loop forever).
 */
export async function recoverStuckJobs(minutes = 15): Promise<number> {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const result = await db.integrationJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: cutoff } },
    data: {
      status: "QUEUED",
      lockedAt: null,
      errorCode: "CONNECT_JOB_STALLED",
      errorDetail: `No completion within ${minutes} minutes; re-queued`,
      runAfter: new Date(),
    },
  });
  return result.count;
}

export async function listJobs(
  tenantId: string,
  options: { limit?: number; status?: string | null; connectionId?: string | null } = {}
): Promise<IntegrationJob[]> {
  return db.integrationJob.findMany({
    where: {
      tenantId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.connectionId ? { connectionId: options.connectionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, options.limit ?? 50)),
  });
}

export async function jobStats(tenantId: string): Promise<{
  queued: number;
  running: number;
  failed: number;
  succeeded: number;
  lastSuccessAt: Date | null;
}> {
  const [queued, running, failed, succeeded, lastSuccess] = await Promise.all([
    db.integrationJob.count({ where: { tenantId, status: "QUEUED" } }),
    db.integrationJob.count({ where: { tenantId, status: "RUNNING" } }),
    db.integrationJob.count({ where: { tenantId, status: { in: ["FAILED", "DEAD"] } } }),
    db.integrationJob.count({ where: { tenantId, status: { in: ["SUCCEEDED", "PARTIAL"] } } }),
    db.integrationJob.findFirst({
      where: { tenantId, status: "SUCCEEDED" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  return {
    queued,
    running,
    failed,
    succeeded,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
  };
}
