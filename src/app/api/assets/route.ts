import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAsset, AssetError, type CreateAssetInput } from "@/lib/assets";
import { requireUserWithFeature, routeError, pagination, parseBody } from "@/lib/api-guards";

/**
 * GET /api/assets — the register with book values plus portfolio totals
 * (cost / accumulated / book) for the summary cards.
 * Query: search, status, category, page, limit.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("asset-register");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(status && status !== "ALL" ? { lifecycleStatus: status } : {}),
      ...(category && category !== "ALL" ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { assetCode: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [assets, total, portfolio] = await Promise.all([
      db.asset.findMany({
        where,
        include: {
          location: { select: { name: true } },
          supplier: { select: { name: true } },
          assignedEmployee: { select: { firstName: true, lastName: true, staffNumber: true } },
        },
        orderBy: { assetCode: "asc" },
        skip,
        take: limit,
      }),
      db.asset.count({ where }),
      db.asset.aggregate({
        where: { tenantId: user.tenantId },
        _sum: { purchaseCost: true, accumulatedDepreciation: true },
        _count: { _all: true },
      }),
    ]);

    const cost = portfolio._sum.purchaseCost ?? 0;
    const accumulated = portfolio._sum.accumulatedDepreciation ?? 0;

    return NextResponse.json({
      assets: assets.map((a) => ({
        ...a,
        bookValue: Math.round((a.purchaseCost - a.accumulatedDepreciation) * 100) / 100,
        monthlyDepreciation:
          a.depreciationMethod === "straight_line" && a.usefulLifeMonths > 0
            ? Math.round(
                Math.min(
                  (a.purchaseCost - a.residualValue) / a.usefulLifeMonths,
                  Math.max(a.purchaseCost - a.residualValue - a.accumulatedDepreciation, 0)
                ) * 100
              ) / 100
            : 0,
      })),
      totals: {
        count: portfolio._count._all,
        cost,
        accumulated,
        bookValue: Math.round((cost - accumulated) * 100) / 100,
      },
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/assets", error);
  }
}

/** POST /api/assets — register an asset. Body: see createAsset in assets.ts. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("asset-register");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<CreateAssetInput>(request);
    const asset = await createAsset({
      ...body,
      tenantId: user.tenantId,
      createdBy: user.id,
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/assets", error);
  }
}
