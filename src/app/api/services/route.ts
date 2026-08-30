import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const services = await db.service.findMany({
      where: { tenantId: user.tenantId },
      include: {
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("GET /api/services error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
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
    const { name, price, duration, description, categoryId, isActive } = body;

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || price < 0) {
      return NextResponse.json(
        { error: "Price must be a positive number" },
        { status: 400 }
      );
    }

    const service = await db.service.create({
      data: {
        name,
        price,
        duration: duration || 30,
        description: description || null,
        categoryId: categoryId || null,
        isActive: isActive !== undefined ? isActive : true,
        tenantId: user.tenantId,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { appointments: true } },
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("POST /api/services error:", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}
