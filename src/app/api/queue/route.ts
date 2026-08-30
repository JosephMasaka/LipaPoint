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
    const statusFilter = searchParams.get("status");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      createdAt: { gte: todayStart },
    };

    if (statusFilter) {
      where.status = statusFilter;
    }

    const entries = await db.queueEntry.findMany({
      where,
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
      orderBy: { ticketNo: "asc" },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue entries" },
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
    const { clientName, clientPhone, serviceName } = body;

    if (!clientName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Find max ticketNo for today
    const maxEntry = await db.queueEntry.findFirst({
      where: {
        tenantId: user.tenantId,
        createdAt: { gte: todayStart },
      },
      orderBy: { ticketNo: "desc" },
      select: { ticketNo: true },
    });

    const ticketNo = (maxEntry?.ticketNo ?? 0) + 1;

    const entry = await db.queueEntry.create({
      data: {
        ticketNo,
        clientName,
        clientPhone: clientPhone || null,
        serviceName: serviceName || null,
        tenantId: user.tenantId,
      },
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("POST /api/queue error:", error);
    return NextResponse.json(
      { error: "Failed to create queue entry" },
      { status: 500 }
    );
  }
}
