import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tables = await db.table.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      include: {
        location: { select: { id: true, name: true } },
        orders: {
          where: {
            status: { in: ["PENDING", "PREPARING"] },
          },
          select: {
            id: true,
            orderNo: true,
            status: true,
            total: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
          take: 1,
        },
      },
    });

    // Flatten: attach activeOrder as a single object (or null)
    const result = tables.map((table) => ({
      ...table,
      activeOrder: table.orders[0] || null,
      orders: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tables error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
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
    const { name, capacity, locationId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 }
      );
    }

    // Check name uniqueness within tenant
    const existing = await db.table.findUnique({
      where: { tenantId_name: { tenantId: user.tenantId, name: name.trim() } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A table with this name already exists" },
        { status: 409 }
      );
    }

    // Resolve locationId: use provided or first active location
    let resolvedLocationId = locationId;
    if (!resolvedLocationId) {
      const firstLocation = await db.location.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true },
      });
      if (!firstLocation) {
        return NextResponse.json(
          { error: "No active location found. Please create a location first." },
          { status: 400 }
        );
      }
      resolvedLocationId = firstLocation.id;
    }

    const table = await db.table.create({
      data: {
        name: name.trim(),
        capacity: capacity || 4,
        locationId: resolvedLocationId,
        tenantId: user.tenantId,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    console.error("POST /api/tables error:", error);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}
