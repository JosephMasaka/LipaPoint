import { requireUserWithFeature } from "@/lib/api-guards";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireUserWithFeature("menu-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    const categories = await db.category.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        color: true,
        parentId: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/menu/categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("menu-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name within tenant
    const existing = await db.category.findUnique({
      where: {
        tenantId_name: { tenantId: user.tenantId, name: name.trim() },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        color: color || "#6366f1",
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        parentId: true,
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("POST /api/menu/categories error:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
