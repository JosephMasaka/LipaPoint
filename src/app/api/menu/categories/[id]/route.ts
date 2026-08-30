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
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, color } = body;

    const existing = await db.category.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check for duplicate name (excluding current category)
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.category.findUnique({
        where: {
          tenantId_name: { tenantId: user.tenantId, name: name.trim() },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }
    }

    const category = await db.category.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color && { color }),
      },
      select: {
        id: true,
        name: true,
        color: true,
        parentId: true,
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("PUT /api/menu/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
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
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.category.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (existing._count.products > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${existing._count.products} product(s). Move or remove them first.`,
        },
        { status: 400 }
      );
    }

    await db.category.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/menu/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
