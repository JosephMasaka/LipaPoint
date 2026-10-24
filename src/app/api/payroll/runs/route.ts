import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayrollRun, PayrollError } from "@/lib/payroll";
import { requireUserWithModule, routeError, pagination } from "@/lib/api-guards";

/**
 * GET /api/payroll/runs — payroll run history with payslip counts.
 * Query: status, page, limit.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(status && status !== "ALL" ? { status } : {}),
    };

    const [runs, total, activeEmployees] = await Promise.all([
      db.payrollRun.findMany({
        where,
        include: {
          _count: { select: { payslips: true } },
          bankAccount: { select: { id: true, name: true } },
        },
        orderBy: { period: "desc" },
        skip,
        take: limit,
      }),
      db.payrollRun.count({ where }),
      db.employee.count({ where: { tenantId: user.tenantId, active: true } }),
    ]);

    return NextResponse.json({
      runs,
      activeEmployees,
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/payroll/runs", error);
  }
}

/**
 * POST /api/payroll/runs — create a draft run with provisional payslips.
 * Body: { period: "2026-11", employeeIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await request.json().catch(() => ({}));
    if (!body.period) {
      return NextResponse.json({ error: "period (YYYY-MM) is required" }, { status: 400 });
    }

    const run = await createPayrollRun({
      tenantId: user.tenantId,
      period: body.period,
      employeeIds: Array.isArray(body.employeeIds) ? body.employeeIds : undefined,
      createdBy: user.id,
    });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/payroll/runs", error);
  }
}