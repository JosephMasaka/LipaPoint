import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { p9EmployeeSummary, PayrollError } from "@/lib/payroll";
import { requireUserWithModule, routeError } from "@/lib/api-guards";

/**
 * GET /api/payroll/p9/[employeeId]?year=2026 — per-month P9 figures for
 * one employee, backing the printable P9 page (/print/p9/[employeeId]).
 * The CSV route (/api/payroll/p9) remains the whole-company export.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { employeeId } = await params;
    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const summary = await p9EmployeeSummary(user.tenantId, year, employeeId);
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, slug: true, address: true, city: true, phone: true },
    });

    return NextResponse.json({
      ...summary,
      company: {
        name: tenant?.name ?? "Company",
        slug: tenant?.slug ?? null,
        address: tenant?.address ?? null,
        city: tenant?.city ?? null,
        phone: tenant?.phone ?? null,
      },
    });
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("GET /api/payroll/p9/[employeeId]", error);
  }
}
