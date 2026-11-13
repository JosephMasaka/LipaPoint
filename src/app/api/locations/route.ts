import { requireUserWithFeature } from "@/lib/api-guards";
import { recordSyncResponse, replaySyncResponse } from "@/lib/idempotency";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";

export async function GET() {
  try {
    const auth = await requireUserWithFeature("stock-tracking-basic");
    if (auth.response) return auth.response;
    const { user } = auth;

    const locations = await db.location.findMany({
      where: { tenantId: user.tenantId },
      include: {
        registers: { select: { id: true, name: true, isActive: true } },
        _count: { select: { orders: true, stocks: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Branch-level stock health for the location cards: value on hand and how
    // many tracked items are at or below their alert level.
    const stocks = await db.stock.findMany({
      where: { location: { tenantId: user.tenantId } },
      select: {
        locationId: true,
        quantity: true,
        product: { select: { cost: true, lowStockAlert: true, trackStock: true } },
      },
    });

    const summary = new Map<string, { stockValue: number; stockUnits: number; lowStockCount: number }>();
    for (const s of stocks) {
      const current = summary.get(s.locationId) ?? { stockValue: 0, stockUnits: 0, lowStockCount: 0 };
      current.stockValue += s.quantity * (s.product.cost || 0);
      current.stockUnits += s.quantity;
      if (s.product.trackStock && s.quantity <= s.product.lowStockAlert) current.lowStockCount += 1;
      summary.set(s.locationId, current);
    }

    return NextResponse.json(
      locations.map((l) => ({
        ...l,
        stockValue: summary.get(l.id)?.stockValue ?? 0,
        stockUnits: summary.get(l.id)?.stockUnits ?? 0,
        lowStockCount: summary.get(l.id)?.lowStockCount ?? 0,
      }))
    );
  } catch (error) {
    console.error("GET /api/locations error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("stock-tracking-basic");
    if (auth.response) return auth.response;
    const { user } = auth;
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const replay = await replaySyncResponse(request, user.tenantId);
    if (replay) return replay;

    const limits = getPlanLimits(user.tenant.tier, user.tenant.type);
    const count = await db.location.count({ where: { tenantId: user.tenantId, isActive: true } });
    if (count >= limits.locations) {
      return NextResponse.json({ error: `Your ${user.tenant.tier.toLowerCase()} plan allows up to ${limits.locations} location${limits.locations > 1 ? "s" : ""}. Upgrade to add more.` }, { status: 403 });
    }

    const { name, address, phone } = await request.json();
    if (!name) return NextResponse.json({ error: "Location name is required" }, { status: 400 });

    const location = await db.location.create({
      data: {
        name,
        address: address || null,
        phone: phone || null,
        tenantId: user.tenantId,
        registers: { create: { name: "Register 1" } },
      },
      include: { registers: { select: { id: true, name: true, isActive: true } } },
    });

    return recordSyncResponse(
      request,
      user.tenantId,
      NextResponse.json(location, { status: 201 })
    );
  } catch (error) {
    console.error("POST /api/locations error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("stock-tracking-basic");
    if (auth.response) return auth.response;
    const { user } = auth;
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const replay = await replaySyncResponse(request, user.tenantId);
    if (replay) return replay;

    const { id, name, address, phone, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: "Location ID is required" }, { status: 400 });

    const owned = await db.location.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Location not found" }, { status: 404 });

    const location = await db.location.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return recordSyncResponse(request, user.tenantId, NextResponse.json(location));
  } catch (error) {
    console.error("PUT /api/locations error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}
