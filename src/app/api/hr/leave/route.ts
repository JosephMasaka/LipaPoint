import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLeave, HrError } from "@/lib/hr";
import { requireUserWithModule, routeError, pagination } from "@/lib/api-guards";

/**
 * GET /api/hr/leave — leave requests with employee names.
 * Query: status, employeeId, page, limit.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(status && status !== "ALL" ? { status } : {}),
      ...(employeeId ? { employeeId } : {}),
    };

    const [requests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: {
          employee: { select: { id: true, staffNumber: true, firstName: true, lastName: true, annualLeaveDays: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.leaveRequest.count({ where }),
    ]);

    return NextResponse.json({ requests, pagination: pagination(page, limit, total) });
  } catch (error) {
    return routeError("GET /api/hr/leave", error);
  }
}

/** POST /api/hr/leave — raise a leave request. Body: { employeeId, type?, startDate, endDate, reason? } */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await request.json();
    if (!body.employeeId || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "employeeId, startDate and endDate are required" },
        { status: 400 }
      );
    }

    const leave = await createLeave({
      tenantId: user.tenantId,
      employeeId: body.employeeId,
      type: body.type,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
      createdBy: user.id,
    });
    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    if (error instanceof HrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/hr/leave", error);
  }
}