import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
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

    if (!["OWNER", "ADMIN", "MANAGER", "CASHIER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.appointment.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { service: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.staffId !== undefined) updateData.staffId = body.staffId || null;
    if (body.clientName !== undefined) updateData.clientName = body.clientName;
    if (body.clientPhone !== undefined) updateData.clientPhone = body.clientPhone || null;

    // Handle date change
    if (body.date !== undefined) {
      const parsedDate = new Date(body.date);
      updateData.date = new Date(
        Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate())
      );
    }

    // Handle startTime or serviceId change -> recalculate endTime
    let needsEndTimeRecalc = false;
    let newStartTime = existing.startTime;
    let serviceDuration = existing.service.duration;

    if (body.startTime !== undefined) {
      updateData.startTime = body.startTime;
      newStartTime = body.startTime;
      needsEndTimeRecalc = true;
    }

    if (body.serviceId !== undefined && body.serviceId !== existing.serviceId) {
      const newService = await db.service.findFirst({
        where: { id: body.serviceId, tenantId: user.tenantId },
      });
      if (!newService) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
      updateData.serviceId = body.serviceId;
      serviceDuration = newService.duration;
      needsEndTimeRecalc = true;
    }

    if (needsEndTimeRecalc) {
      updateData.endTime = addMinutesToTime(newStartTime, serviceDuration);
    }

    const updated = await db.appointment.update({
      where: { id },
      data: updateData,
      include: {
        service: { select: { id: true, name: true, price: true, duration: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/appointments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
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

    const existing = await db.appointment.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    await db.appointment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/appointments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete appointment" },
      { status: 500 }
    );
  }
}
