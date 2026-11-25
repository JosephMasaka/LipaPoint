import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeError } from "@/lib/api-guards";
import { claimNextJobs, enqueueJob, recoverStuckJobs } from "@/lib/connect/jobs";
import { runClaimedJobs } from "@/lib/connect/sync";
import { isConnectEntity } from "@/lib/connect/types";

export const dynamic = "force-dynamic";

/**
 * Scheduler tick — the only "worker" the integration engine has.
 *
 * Authenticates with the existing `CRON_SECRET` pattern (see
 * /api/notifications/check): fail closed with 503 when unset, 401 on a
 * mismatch. Each run:
 *   1. re-queues jobs whose process died mid-run;
 *   2. enqueues every hourly sync that is due (deduplicated by the active-job
 *      unique index, so overlapping ticks cannot create two jobs);
 *   3. claims due jobs atomically and runs them.
 *
 * Logs one line per run with the counts, which is what the external
 * scheduler's alerting watches.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the Connect scheduler");
    return NextResponse.json({ error: "The scheduler is not configured" }, { status: 503 });
  }
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const batchRaw = Number(process.env.CONNECT_CRON_BATCH ?? 5);
    const batch = Number.isFinite(batchRaw) ? Math.min(25, Math.max(1, Math.floor(batchRaw))) : 5;

    const recovered = await recoverStuckJobs();

    const due = await db.integrationSyncConfig.findMany({
      where: {
        enabled: true,
        frequency: "HOURLY",
        connection: { status: "ACTIVE" },
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
      orderBy: { nextRunAt: "asc" },
      take: batch,
      select: { id: true, tenantId: true, connectionId: true, entity: true },
    });

    const enqueued: string[] = [];
    for (const config of due) {
      if (!isConnectEntity(config.entity)) continue;
      const job = await enqueueJob({
        tenantId: config.tenantId,
        connectionId: config.connectionId,
        syncConfigId: config.id,
        entity: config.entity,
        trigger: "SCHEDULE",
      });
      enqueued.push(job.id);
    }

    const claimed = await claimNextJobs(batch);
    const results = await runClaimedJobs(claimed);

    console.log(
      `[connect-cron] recovered=${recovered} due=${due.length} enqueued=${enqueued.length} ran=${results.length}`
    );

    return NextResponse.json({
      recovered,
      due: due.length,
      enqueued: enqueued.length,
      ran: results.length,
      results,
    });
  } catch (error) {
    return routeError("POST /api/connect/cron/tick", error);
  }
}
