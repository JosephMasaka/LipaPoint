import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDepreciation, AssetError, type RunDepreciationInput } from "@/lib/assets";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * GET /api/assets/depreciation?period=2026-11 — depreciation history:
 * one row per asset per period with its book value after and the journal
 * entry it posted into. Without a period, returns the most recent rows.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("assets");
    if (auth.response) return auth.response;
    const { user } = auth;

    const period = request.nextUrl.searchParams.get("period");

    const entries = await db.assetDepreciationEntry.findMany({
      where: { tenantId: user.tenantId, ...(period ? { period } : {}) },
      include: {
        asset: { select: { assetCode: true, name: true, purchaseCost: true } },
        journalEntry: { select: { id: true, reference: true } },
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const total = entries.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      period: period ?? null,
      entries,
      total: Math.round(total * 100) / 100,
    });
  } catch (error) {
    return routeError("GET /api/assets/depreciation", error);
  }
}

/**
 * POST /api/assets/depreciation — run depreciation for a period.
 * Body: { period: "2026-11" }. Idempotent: assets already booked for the
 * period are skipped, so re-running is safe. Future periods are refused.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("assets");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{ period?: string }>(request);
    if (!body.period) {
      return NextResponse.json({ error: "period (YYYY-MM) is required" }, { status: 400 });
    }

    const result = await runDepreciation({
      tenantId: user.tenantId,
      period: body.period,
      userId: user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/assets/depreciation", error);
  }
}
