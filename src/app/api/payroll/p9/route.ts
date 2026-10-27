import { NextRequest, NextResponse } from "next/server";
import { p9Csv, PayrollError } from "@/lib/payroll";
import { requireUserWithFeature, routeError } from "@/lib/api-guards";

/**
 * GET /api/payroll/p9?year=2026 — annual P9 filing extract: per-employee
 * YTD gross, tax before relief, relief and PAYE withheld, ready to drop
 * into the KRA P9 form or a payroll bureau template.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const csv = await p9Csv(user.tenantId, year);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="p9-${year}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("GET /api/payroll/p9", error);
  }
}