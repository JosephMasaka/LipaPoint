import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const zones = await db.deliveryZone.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error("GET /api/delivery-zones error:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery zones" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, minOrder, deliveryFee, estimatedTime } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Zone name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name within tenant
    const existing = await db.deliveryZone.findUnique({
      where: {
        tenantId_name: { tenantId: user.tenantId, name: name.trim() },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A delivery zone with this name already exists" },
        { status: 409 }
      );
    }

    const zone = await db.deliveryZone.create({
      data: {
        name: name.trim(),
        minOrder: minOrder ? parseFloat(minOrder) : 0,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : 0,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : 30,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error("POST /api/delivery-zones error:", error);
    return NextResponse.json(
      { error: "Failed to create delivery zone" },
      { status: 500 }
    );
  }
}
