import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, minOrder, deliveryFee, estimatedTime, isActive } = body;

    const existing = await db.deliveryZone.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Delivery zone not found" },
        { status: 404 }
      );
    }

    // If renaming, check for duplicate name within tenant
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.deliveryZone.findUnique({
        where: {
          tenantId_name: { tenantId: user.tenantId, name: name.trim() },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A delivery zone with this name already exists" },
          { status: 409 }
        );
      }
    }

    const zone = await db.deliveryZone.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(minOrder !== undefined && { minOrder: parseFloat(minOrder) }),
        ...(deliveryFee !== undefined && {
          deliveryFee: parseFloat(deliveryFee),
        }),
        ...(estimatedTime !== undefined && {
          estimatedTime: parseInt(estimatedTime),
        }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(zone);
  } catch (error) {
    console.error("PUT /api/delivery-zones/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update delivery zone" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.deliveryZone.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Delivery zone not found" },
        { status: 404 }
      );
    }

    await db.deliveryZone.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/delivery-zones/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete delivery zone" },
      { status: 500 }
    );
  }
}
