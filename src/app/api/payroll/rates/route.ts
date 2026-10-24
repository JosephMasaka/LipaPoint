import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRatesForPeriod, ensureStatutoryRates, type PayeBand } from "@/lib/payroll";
import { requireUserWithModule, routeError } from "@/lib/api-guards";

/**
 * GET /api/payroll/rates — the statutory rate table (all versions) plus
 * the rates currently in force for this month. Surfaced on the Payroll
 * page so "which rates produced this payslip?" has an answer on screen,
 * with the review warning the spec requires (rates must be verified
 * against KRA/NSSF/SHA notices before filing).
 *
 * Query: period (YYYY-MM) to preview rates for a specific month.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;

    const period =
      request.nextUrl.searchParams.get("period") ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    await ensureStatutoryRates();
    const [current, versions] = await Promise.all([
      getRatesForPeriod(period),
      db.statutoryRateTable.findMany({ orderBy: { effectiveFrom: "desc" } }),
    ]);

    return NextResponse.json({
      period,
      current,
      versions: versions.map((v) => ({
        id: v.id,
        label: v.label,
        effectiveFrom: v.effectiveFrom,
        isDefault: v.isDefault,
        payeBands: v.payeBands as unknown as PayeBand[],
        personalRelief: v.personalRelief,
        nssfRateEmployee: v.nssfRateEmployee,
        nssfRateEmployer: v.nssfRateEmployer,
        nssfTier1Cap: v.nssfTier1Cap,
        nssfTier2Cap: v.nssfTier2Cap,
        shifRate: v.shifRate,
        shifMinimum: v.shifMinimum,
        housingLevyRate: v.housingLevyRate,
        nitaLevyPerEmployee: v.nitaLevyPerEmployee,
      })),
    });
  } catch (error) {
    return routeError("GET /api/payroll/rates", error);
  }
}