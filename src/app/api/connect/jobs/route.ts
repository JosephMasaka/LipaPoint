import { NextResponse } from "next/server";
import { routeError } from "@/lib/api-guards";
import { requireConnectAccess } from "@/lib/connect/guard";
import { jobStats, listJobs } from "@/lib/connect/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireConnectAccess();
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const connectionId = url.searchParams.get("connectionId");
    const limit = Number(url.searchParams.get("limit") ?? 50);

    const [jobs, stats] = await Promise.all([
      listJobs(user.tenantId, { status, connectionId, limit: Number.isFinite(limit) ? limit : 50 }),
      jobStats(user.tenantId),
    ]);

    return NextResponse.json({ jobs, stats });
  } catch (error) {
    return routeError("GET /api/connect/jobs", error);
  }
}
