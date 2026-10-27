import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createEmployee, HrError } from "@/lib/hr";
import { requireUserWithFeature, routeError, pagination } from "@/lib/api-guards";

/**
 * GET /api/hr/employees — HR file list with per-employee overview:
 * annual leave used this year and outstanding loan balance (two grouped
 * queries, not N+1 per row).
 * Query: search, active ("true"|"false"), page, limit.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("employee-records");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search");
    const active = searchParams.get("active");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const skip = (page - 1) * limit;

    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const where = {
      tenantId: user.tenantId,
      ...(active === "true" ? { active: true } : active === "false" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { staffNumber: { contains: search, mode: "insensitive" as const } },
              { jobTitle: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [employees, total, leaveUsed, loanBalances] = await Promise.all([
      db.employee.findMany({
        where,
        include: { location: { select: { id: true, name: true } } },
        orderBy: { staffNumber: "asc" },
        skip,
        take: limit,
      }),
      db.employee.count({ where }),
      db.leaveRequest.groupBy({
        by: ["employeeId"],
        where: {
          tenantId: user.tenantId,
          type: "annual",
          status: "approved",
          startDate: { gte: yearStart },
        },
        _sum: { days: true },
      }),
      db.employeeLoan.groupBy({
        by: ["employeeId"],
        where: { tenantId: user.tenantId, status: "active", balance: { gt: 0 } },
        _sum: { balance: true },
      }),
    ]);

    const leaveByEmployee = new Map(leaveUsed.map((r) => [r.employeeId, r._sum.days ?? 0]));
    const loanByEmployee = new Map(loanBalances.map((r) => [r.employeeId, r._sum.balance ?? 0]));

    return NextResponse.json({
      employees: employees.map((e) => ({
        ...e,
        leaveUsedThisYear: leaveByEmployee.get(e.id) ?? 0,
        leaveRemaining: Math.max(e.annualLeaveDays - (leaveByEmployee.get(e.id) ?? 0), 0),
        loanBalance: loanByEmployee.get(e.id) ?? 0,
      })),
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/hr/employees", error);
  }
}

/** POST /api/hr/employees — create an employee file. Body: see hr.ts. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("employee-records");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await request.json();
    const employee = await createEmployee({
      ...body,
      tenantId: user.tenantId,
      createdBy: user.id,
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof HrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/hr/employees", error);
  }
}