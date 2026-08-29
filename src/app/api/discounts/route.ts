import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const discounts = await db.discount.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(discounts);
  } catch (error) {
    console.error("GET /api/discounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch discounts" },
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
    const { name, code, type, value, minOrder, maxUses, startsAt, expiresAt } = body;

    if (!name || !type || value === undefined) {
      return NextResponse.json(
        { error: "Name, type, and value are required" },
        { status: 400 }
      );
    }

    if (!["PERCENTAGE", "FIXED_AMOUNT"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be PERCENTAGE or FIXED_AMOUNT" },
        { status: 400 }
      );
    }

    if (type === "PERCENTAGE" && (value < 0 || value > 100)) {
      return NextResponse.json(
        { error: "Percentage value must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Check for duplicate code within tenant
    if (code) {
      const existing = await db.discount.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A discount with this code already exists" },
          { status: 409 }
        );
      }
    }

    const discount = await db.discount.create({
      data: {
        name,
        code: code || null,
        type,
        value,
        minOrder: minOrder || null,
        maxUses: maxUses || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(discount, { status: 201 });
  } catch (error) {
    console.error("POST /api/discounts error:", error);
    return NextResponse.json(
      { error: "Failed to create discount" },
      { status: 500 }
    );
  }
}
