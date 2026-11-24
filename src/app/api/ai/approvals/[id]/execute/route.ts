import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { ApprovalError } from "@/lib/ai/approvals";
import { executeApprovedAction } from "@/lib/ai/actions";
import { resolveAwaitingRun } from "@/lib/ai/runs";

/**
 * Runs an approved action. The approval is checked again here (approved, not
 * expired, not already used, payload unchanged), so a stolen request id is not
 * enough on its own.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Only an owner or admin can run an approved action." }, { status: 403 });
    }

    const { id } = await params;
    const outcome = await executeApprovedAction({
      tenantId: user.tenantId,
      requestId: id,
      actorId: user.id,
    });
    // The run that proposed this is now finished.
    await resolveAwaitingRun(user.tenantId, outcome.runId, "COMPLETED");
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("AI action execution error:", error);
    return NextResponse.json({ error: "Failed to run the approved action" }, { status: 500 });
  }
}
