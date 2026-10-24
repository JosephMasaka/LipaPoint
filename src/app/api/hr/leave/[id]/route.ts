import { NextRequest, NextResponse } from "next/server";
import { decideLeave, HrError } from "@/lib/hr";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * PATCH /api/hr/leave/[id] — decide a pending request.
 * Body: { decision: "approved" | "rejected" }. Approving annual leave
 * beyond the remaining entitlement is refused with the balance.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{ decision?: string }>(request);
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return NextResponse.json(
        { error: "decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const leave = await decideLeave(user.tenantId, id, body.decision, user.id);
    return NextResponse.json(leave);
  } catch (error) {
    if (error instanceof HrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("PATCH /api/hr/leave/[id]", error);
  }
}