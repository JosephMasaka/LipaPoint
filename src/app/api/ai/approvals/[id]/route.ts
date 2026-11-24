import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApprovalError, decideApproval } from "@/lib/ai/approvals";
import { resolveAwaitingRun } from "@/lib/ai/runs";

/** Approve or reject one requested action. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const decision = (body as { decision?: unknown } | null)?.decision;
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "decision must be \"approve\" or \"reject\"." }, { status: 400 });
    }
    const note = (body as { note?: unknown } | null)?.note;
    if (note !== undefined && note !== null && typeof note !== "string") {
      return NextResponse.json({ error: "note must be text." }, { status: 400 });
    }

    const approval = await decideApproval({
      tenantId: user.tenantId,
      requestId: id,
      actorId: user.id,
      actorRole: user.role,
      decision,
      note: (note as string | null | undefined) ?? null,
    });

    // A rejection ends the run that proposed it; an approval keeps the run
    // waiting until the approved action is actually executed.
    if (decision === "reject") {
      await resolveAwaitingRun(user.tenantId, approval.runId, "CANCELLED");
    }

    return NextResponse.json({ approval });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("AI approval decision error:", error);
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
}
