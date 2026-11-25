import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, routeError } from "@/lib/api-guards";
import { requireActiveConnection } from "@/lib/connect/connections";
import { requireConnectAccess } from "@/lib/connect/guard";
import { enqueueJob } from "@/lib/connect/jobs";
import { isConnectEntity } from "@/lib/connect/types";

export const dynamic = "force-dynamic";

/**
 * Start a sync. The job is always persisted before any work happens, so the
 * UI has something to show even if the request dies. When this request wins
 * the claim it runs the job inline (small providers feel instant); otherwise
 * the scheduler picks it up on the next tick.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConnectAccess({ write: false });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const body = await parseBody<{ entity?: unknown }>(request).catch(() => ({} as { entity?: unknown }));
    if (body.entity !== undefined && !isConnectEntity(body.entity)) {
      return NextResponse.json({ error: "entity must be products or customers" }, { status: 400 });
    }

    const connection = await requireActiveConnection(user.tenantId, id);

    const config = body.entity
      ? await db.integrationSyncConfig.findFirst({
          where: { tenantId: user.tenantId, connectionId: connection.id, entity: body.entity },
        })
      : await db.integrationSyncConfig.findFirst({
          where: { tenantId: user.tenantId, connectionId: connection.id, enabled: true },
        });

    if (!config || !isConnectEntity(config.entity)) {
      return NextResponse.json({ error: "Configure a sync before running one" }, { status: 409 });
    }

    const job = await enqueueJob({
      tenantId: user.tenantId,
      connectionId: connection.id,
      syncConfigId: config.id,
      entity: config.entity,
      trigger: "MANUAL",
      requestedById: user.id,
    });

    // Only the claim winner runs it; a second click joins the existing job.
    const claim = await db.integrationJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        lockedAt: new Date(),
        attempt: { increment: 1 },
      },
    });

    let result = null;
    if (claim.count === 1) {
      const { runJob } = await import("@/lib/connect/sync");
      result = await runJob(job.id);
    }

    const current = await db.integrationJob.findUnique({
      where: { id: job.id },
      select: {
        id: true,
        status: true,
        entity: true,
        processedCount: true,
        appliedCount: true,
        rejectedCount: true,
        errorCode: true,
        errorDetail: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    return NextResponse.json({ job: current, ranInline: claim.count === 1, result }, { status: 202 });
  } catch (error) {
    return routeError("POST /api/connect/connections/[id]/sync", error);
  }
}
