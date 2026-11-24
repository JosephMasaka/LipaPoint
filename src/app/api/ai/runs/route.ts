import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAgentRuns } from "@/lib/ai/runs";

const APPROVER_ROLES = ["OWNER", "ADMIN", "MANAGER"];

/** Recent agent runs for this tenant. Read-only governance view. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVER_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Only an owner, admin or manager can view agent runs." }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const limit = Number.parseInt(params.get("limit") ?? "", 10);
    const runs = await listAgentRuns(user.tenantId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      agent: params.get("agent") ?? undefined,
    });
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("AI runs GET error:", error);
    return NextResponse.json({ error: "Failed to load agent runs" }, { status: 500 });
  }
}
