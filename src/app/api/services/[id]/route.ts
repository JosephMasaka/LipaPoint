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

    const existing = await db.service.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const updated = await db.service.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { appointments: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/services/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update service" },
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

    const existing = await db.service.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { _count: { select: { appointments: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    if (existing._count.appointments > 0) {
      return NextResponse.json(
        { error: "Cannot delete service with existing appointments. Deactivate it instead." },
        { status: 409 }
      );
    }

    await db.service.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/services/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    );
  }
}
