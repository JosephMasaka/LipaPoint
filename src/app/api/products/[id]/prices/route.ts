import { requireUserWithFeature } from "@/lib/api-guards";
import { recordSyncResponse, replaySyncResponse } from "@/lib/idempotency";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PRICING_ROLES = ["OWNER", "ADMIN", "MANAGER"];

/**
 * Per-branch price overrides for one product.
 *
 * GET  — every override for the product, with the branch and unit.
 * PUT  — set (or clear) the price for one branch and unit. Sending a
 *        null/empty price removes the override, so that unit falls back to
 *        its catalogue price. Omit productUomId to target the base unit.
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
      include: {
        location: { select: { id: true, name: true, isActive: true } },
        productUom: { select: { id: true, unit: { select: { id: true, name: true, abbreviation: true } } } },
      },
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
    const { locationId, price, productUomId } = await request.json();

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }
    const uomId: string | null = productUomId || null;

    const product = await db.product.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const location = await db.location.findFirst({
      where: { id: locationId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    if (uomId) {
      const uom = await db.productUoM.findFirst({
        where: { id: uomId, productId: id },
        select: { id: true },
      });
      if (!uom) {
        return NextResponse.json({ error: "Selling unit not found for this product" }, { status: 404 });
      }
    }

    const cleared = price === null || price === undefined || price === "";
    const parsed = cleared ? NaN : Number(price);
    if (!cleared && (!Number.isFinite(parsed) || parsed < 0)) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }

    if (cleared) {
      await db.productLocationPrice.deleteMany({
        where: { productId: id, locationId, productUomId: uomId },
      });
      return recordSyncResponse(
        request,
        user.tenantId,
        NextResponse.json({ success: true, removed: true })
      );
    }

    // Two partial unique indexes cover base/unit rows, which Prisma cannot
    // express as a compound upsert key, so find the row first.
    const existing = await db.productLocationPrice.findFirst({
      where: { productId: id, locationId, productUomId: uomId },
      select: { id: true },
    });
    const saved = existing
      ? await db.productLocationPrice.update({
          where: { id: existing.id },
          data: { price: parsed },
          include: {
            location: { select: { id: true, name: true, isActive: true } },
            productUom: { select: { id: true, unit: { select: { id: true, name: true, abbreviation: true } } } },
          },
        })
      : await db.productLocationPrice.create({
          data: { productId: id, locationId, productUomId: uomId, price: parsed },
          include: {
            location: { select: { id: true, name: true, isActive: true } },
            productUom: { select: { id: true, unit: { select: { id: true, name: true, abbreviation: true } } } },
          },
        });

    return recordSyncResponse(request, user.tenantId, NextResponse.json(saved));
  } catch (error) {
    console.error("PUT /api/products/[id]/prices error:", error);
    return NextResponse.json({ error: "Failed to save branch price" }, { status: 500 });
  }
}
