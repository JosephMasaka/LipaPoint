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

    const existing = await db.table.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // If name is changing, check uniqueness
    if (body.name && body.name.trim() !== existing.name) {
      const duplicate = await db.table.findUnique({
        where: {
          tenantId_name: { tenantId: user.tenantId, name: body.name.trim() },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A table with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db.table.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
        ...(body.status !== undefined && { status: body.status }),
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/tables/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
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

    const existing = await db.table.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Check for active orders on this table
    const activeOrders = await db.order.count({
      where: {
        tableId: id,
        status: { in: ["PENDING", "PREPARING"] },
      },
    });

    if (activeOrders > 0) {
      return NextResponse.json(
        { error: "Cannot delete table with active orders" },
        { status: 400 }
      );
    }

    await db.table.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tables/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete table" },
      { status: 500 }
    );
  }
}
