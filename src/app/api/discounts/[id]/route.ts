import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
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

    const discount = await db.discount.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!discount) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    return NextResponse.json(discount);
  } catch (error) {
    console.error("GET /api/discounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch discount" },
      { status: 500 }
    );
  }
}

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

    const existing = await db.discount.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    // Check for duplicate code if code is being changed
    if (body.code && body.code !== existing.code) {
      const duplicate = await db.discount.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code: body.code } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A discount with this code already exists" },
          { status: 409 }
        );
      }
    }

    if (body.type && !["PERCENTAGE", "FIXED_AMOUNT"].includes(body.type)) {
      return NextResponse.json(
        { error: "Type must be PERCENTAGE or FIXED_AMOUNT" },
        { status: 400 }
      );
    }

    if (body.type === "PERCENTAGE" && body.value !== undefined && (body.value < 0 || body.value > 100)) {
      return NextResponse.json(
        { error: "Percentage value must be between 0 and 100" },
        { status: 400 }
      );
    }

    const updated = await db.discount.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.code !== undefined && { code: body.code || null }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.value !== undefined && { value: body.value }),
        ...(body.minOrder !== undefined && { minOrder: body.minOrder || null }),
        ...(body.maxUses !== undefined && { maxUses: body.maxUses || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/discounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update discount" },
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

    const existing = await db.discount.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    await db.discount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/discounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete discount" },
      { status: 500 }
    );
  }
}
