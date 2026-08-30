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

    if (!["OWNER", "ADMIN", "MANAGER", "CASHIER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.queueEntry.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Queue entry not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "SERVING") {
        updateData.servedAt = new Date();
      }
      if (body.status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
    }

    if (body.staffId !== undefined) {
      updateData.staffId = body.staffId || null;
    }

    const updated = await db.queueEntry.update({
      where: { id },
      data: updateData,
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/queue/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update queue entry" },
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

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.queueEntry.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Queue entry not found" },
        { status: 404 }
      );
    }

    await db.queueEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/queue/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete queue entry" },
      { status: 500 }
    );
  }
}
