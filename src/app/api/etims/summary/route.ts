import { NextRequest, NextResponse } from "next/server";
import { getEtimsStats, getVatReconciliation } from "@/lib/etims/submission";
import { requireUserWithModule, routeError } from "@/lib/api-guards";

/**
 * GET /api/etims/summary — compliance dashboard data (spec §4.8):
 * submission success rate plus month-by-month VAT output reconciliation
 * (declared-to-KRA vs the sales ledger), with mismatch flags.
 *
 * Query: months (default 6, max 24).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("etims");
    if (auth.response) return auth.response;
    const { user } = auth;

    const months = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("months") || "6", 10) || 6, 1),
      24
    );

    const [stats, vat] = await Promise.all([
      getEtimsStats(user.tenantId),
      getVatReconciliation(user.tenantId, months),
    ]);

    const mismatchedMonths = vat.filter((row) => row.variance !== 0).length;
    const totalVariance = vat.reduce((sum, row) => sum + row.variance, 0);

    return NextResponse.json({
      stats,
      vat,
      mismatchedMonths,
      // Positive = VAT collected on sales that never reached KRA.
      totalVariance: Math.round(totalVariance * 100) / 100,
    });
  } catch (error) {
    return routeError("GET /api/etims/summary", error);
  }
}
