import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAgentRun } from "@/lib/ai/runs";

/** One run with its tool calls, approvals and metered usage. */
export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Only an owner, admin or manager can view agent runs." }, { status: 403 });
    }

    const { runId } = await params;
    const detail = await getAgentRun(user.tenantId, runId);
    if (!detail) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    console.error("AI run GET error:", error);
    return NextResponse.json({ error: "Failed to load the run" }, { status: 500 });
  }
}
