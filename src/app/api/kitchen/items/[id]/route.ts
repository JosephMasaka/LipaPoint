import { requireUserWithFeature } from "@/lib/api-guards";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("kitchen-display");
    if (auth.response) return auth.response;
    const { user } = auth;

    if (!["KITCHEN", "MANAGER", "ADMIN", "OWNER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { kitchenStatus } = body;

    if (!["PREPARING", "READY", "SERVED"].includes(kitchenStatus)) {
      return NextResponse.json(
        { error: "Invalid kitchen status" },
        { status: 400 }
      );
    }

    // Verify the item belongs to the tenant
    const item = await db.orderItem.findFirst({
      where: {
        id,
        order: { tenantId: user.tenantId },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      );
    }

    const updated = await db.orderItem.update({
      where: { id },
      data: { kitchenStatus },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/kitchen/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update kitchen item status" },
      { status: 500 }
    );
  }
}
