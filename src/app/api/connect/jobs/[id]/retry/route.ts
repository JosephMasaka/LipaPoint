import { NextResponse } from "next/server";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { routeError } from "@/lib/api-guards";
import { requireConnectAccess } from "@/lib/connect/guard";
import { retryJob } from "@/lib/connect/jobs";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConnectAccess({ write: true });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const job = await retryJob(user.tenantId, id);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.CONNECT.JOB_RETRIED,
      module: "connect",
      entity: "integrationJob",
      entityId: job.id,
      details: job.entity,
    });

    return NextResponse.json({ job });
  } catch (error) {
    return routeError("POST /api/connect/jobs/[id]/retry", error);
  }
}
