import { requireUserWithFeature } from "@/lib/api-guards";
import { recordSyncResponse, replaySyncResponse } from "@/lib/idempotency";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PRICING_ROLES = ["OWNER", "ADMIN", "MANAGER"];

/**
 * Per-branch price overrides for one product.
 *
 * GET  — every override for the product, with the branch name.
 * PUT  — set (or clear) the price for one branch. Sending a null/empty price
 *        removes the override, so the branch falls back to the base price.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("stock-tracking-basic");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const product = await db.product.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const prices = await db.productLocationPrice.findMany({
      where: { productId: id, location: { tenantId: user.tenantId } },
      include: { location: { select: { id: true, name: true, isActive: true } } },
      orderBy: { location: { name: "asc" } },
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error("GET /api/products/[id]/prices error:", error);
    return NextResponse.json({ error: "Failed to fetch branch prices" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("stock-tracking-basic");
    if (auth.response) return auth.response;
    const { user } = auth;
    if (!PRICING_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const replay = await replaySyncResponse(request, user.tenantId);
    if (replay) return replay;

    const { id } = await params;
    const { locationId, price } = await request.json();

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    const [product, location] = await Promise.all([
      db.product.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } }),
      db.location.findFirst({
        where: { id: locationId, tenantId: user.tenantId },
        select: { id: true },
      }),
    ]);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const cleared = price === null || price === undefined || price === "";
    const parsed = cleared ? NaN : Number(price);
    if (!cleared && (!Number.isFinite(parsed) || parsed < 0)) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }

    if (cleared) {
      await db.productLocationPrice.deleteMany({ where: { productId: id, locationId } });
      return recordSyncResponse(
        request,
        user.tenantId,
        NextResponse.json({ success: true, removed: true })
      );
    }

    const saved = await db.productLocationPrice.upsert({
      where: { productId_locationId: { productId: id, locationId } },
      update: { price: parsed },
      create: { productId: id, locationId, price: parsed },
      include: { location: { select: { id: true, name: true, isActive: true } } },
    });

    return recordSyncResponse(request, user.tenantId, NextResponse.json(saved));
  } catch (error) {
    console.error("PUT /api/products/[id]/prices error:", error);
    return NextResponse.json({ error: "Failed to save branch price" }, { status: 500 });
  }
}
