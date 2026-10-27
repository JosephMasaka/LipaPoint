import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAssetMaintenance, AssetError } from "@/lib/assets";
import { requireUserWithFeature, routeError, parseBody } from "@/lib/api-guards";

/**
 * GET  /api/assets/[id]/maintenance — maintenance history for one asset.
 * POST /api/assets/[id]/maintenance — log a maintenance event:
 *   { date, description, cost, performedBy?, nextDueDate?, notes? }
 *
 * These rows are what the Maintenance Cost report (reports-spec §9)
 * aggregates; logging does not touch the GL or the asset's book value.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("maintenance-tracking");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const asset = await db.asset.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const rows = await db.assetMaintenance.findMany({
      where: { assetId: id, tenantId: user.tenantId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json(rows);
  } catch (error) {
    return routeError("GET /api/assets/[id]/maintenance", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("maintenance-tracking");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{
      date?: string;
      description?: string;
      cost?: number;
      performedBy?: string;
      nextDueDate?: string;
      notes?: string;
    }>(request);

    if (!body.date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const row = await recordAssetMaintenance({
      tenantId: user.tenantId,
      assetId: id,
      date: body.date,
      description: body.description,
      cost: Number(body.cost ?? 0),
      performedBy: body.performedBy ?? null,
      nextDueDate: body.nextDueDate ?? null,
      notes: body.notes ?? null,
      userId: user.id,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/assets/[id]/maintenance", error);
  }
}
