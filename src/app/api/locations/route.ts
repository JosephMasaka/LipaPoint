import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locations = await db.location.findMany({
      where: { tenantId: user.tenantId },
      include: {
        registers: { select: { id: true, name: true, isActive: true } },
        _count: { select: { orders: true, stocks: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error("GET /api/locations error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const limits = getPlanLimits(user.tenant.tier);
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

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error("POST /api/locations error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id, name, address, phone, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: "Location ID is required" }, { status: 400 });

    const location = await db.location.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("PUT /api/locations error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}
