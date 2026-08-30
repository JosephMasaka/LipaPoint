import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      // Default to current week (Monday-Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    const schedules = await db.staffSchedule.findMany({
      where: {
        tenantId: user.tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        staff: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: [{ date: "asc" }, { staff: { name: "asc" } }],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("GET /api/schedules error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
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
    const { staffId, date, startTime, endTime, isOff, notes } = body;

    if (!staffId || !date) {
      return NextResponse.json(
        { error: "Staff and date are required" },
        { status: 400 }
      );
    }

    if (!isOff && (!startTime || !endTime)) {
      return NextResponse.json(
        { error: "Start time and end time are required when not a day off" },
        { status: 400 }
      );
    }

    // Verify staff belongs to tenant
    const staff = await db.user.findFirst({
      where: { id: staffId, tenantId: user.tenantId },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    const scheduleDate = new Date(date);

    const schedule = await db.staffSchedule.upsert({
      where: {
        staffId_date: {
          staffId,
          date: scheduleDate,
        },
      },
      update: {
        startTime: isOff ? "" : startTime,
        endTime: isOff ? "" : endTime,
        isOff: isOff || false,
        notes: notes || null,
      },
      create: {
        staffId,
        date: scheduleDate,
        startTime: isOff ? "" : startTime,
        endTime: isOff ? "" : endTime,
        isOff: isOff || false,
        notes: notes || null,
        tenantId: user.tenantId,
      },
      include: {
        staff: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("POST /api/schedules error:", error);
    return NextResponse.json(
      { error: "Failed to save schedule" },
      { status: 500 }
    );
  }
}
