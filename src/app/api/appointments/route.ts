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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const status = searchParams.get("status");
    const staffId = searchParams.get("staffId");

    // Default to today if no date provided
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    // Normalize to start of day UTC for @db.Date fields
    const dateStart = new Date(
      Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    );

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      date: dateStart,
    };

    if (status) {
      where.status = status;
    }
    if (staffId) {
      where.staffId = staffId;
    }

    const appointments = await db.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, price: true, duration: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("GET /api/appointments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
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

    const body = await request.json();
    const { date, startTime, serviceId, clientName, clientPhone, staffId, notes } = body;

    if (!date || !startTime || !serviceId || !clientName) {
      return NextResponse.json(
        { error: "Date, start time, service, and client name are required" },
        { status: 400 }
      );
    }

    // Validate service exists and belongs to tenant
    const service = await db.service.findFirst({
      where: { id: serviceId, tenantId: user.tenantId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Calculate end time from service duration
    const endTime = addMinutesToTime(startTime, service.duration);

    // Normalize date for @db.Date
    const parsedDate = new Date(date);
    const appointmentDate = new Date(
      Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate())
    );

    const appointment = await db.appointment.create({
      data: {
        date: appointmentDate,
        startTime,
        endTime,
        clientName,
        clientPhone: clientPhone || null,
        serviceId,
        staffId: staffId || null,
        notes: notes || null,
        tenantId: user.tenantId,
      },
      include: {
        service: { select: { id: true, name: true, price: true, duration: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments error:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
