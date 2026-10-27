import { NextRequest, NextResponse } from "next/server";
import { closeLoan, HrError } from "@/lib/hr";
import { requireUserWithFeature, routeError, parseBody } from "@/lib/api-guards";

/**
 * PATCH /api/hr/loans/[id] — settle a loan outside payroll.
 * Body: { action: "clear" | "write_off" }. Active loans normally clear
 * themselves as payroll deductions drain the balance.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("loans-advances");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{ action?: string }>(request);
    const status = body.action === "clear" ? "cleared" : body.action === "write_off" ? "written_off" : null;
    if (!status) {
      return NextResponse.json(
        { error: "action must be 'clear' or 'write_off'" },
        { status: 400 }
      );
    }

    const loan = await closeLoan(user.tenantId, id, status, user.id);
    return NextResponse.json(loan);
  } catch (error) {
    if (error instanceof HrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("PATCH /api/hr/loans/[id]", error);
  }
}