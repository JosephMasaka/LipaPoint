import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLoan, HrError } from "@/lib/hr";
import { requireUserWithFeature, routeError, pagination } from "@/lib/api-guards";

/**
 * GET /api/hr/loans — staff loans/advances with employee names.
 * Query: status (active|cleared|written_off), employeeId, page, limit.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("loans-advances");
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

    const [loans, total] = await Promise.all([
      db.employeeLoan.findMany({
        where,
        include: {
          employee: { select: { id: true, staffNumber: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.employeeLoan.count({ where }),
    ]);

    return NextResponse.json({ loans, pagination: pagination(page, limit, total) });
  } catch (error) {
    return routeError("GET /api/hr/loans", error);
  }
}

/** POST /api/hr/loans — issue a loan/advance. Body: { employeeId, principal, monthlyDeduction, reason? } */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("loans-advances");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await request.json();
    if (!body.employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    const loan = await createLoan({
      tenantId: user.tenantId,
      employeeId: body.employeeId,
      principal: body.principal,
      monthlyDeduction: body.monthlyDeduction,
      reason: body.reason,
      startDate: body.startDate,
      createdBy: user.id,
    });
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    if (error instanceof HrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/hr/loans", error);
  }
}