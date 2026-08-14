import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const categoriesOnly = searchParams.get("categories");

    if (categoriesOnly === "true") {
      const categories = await db.category.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true, color: true, parentId: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ categories });
    }

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.categoryId = category;
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, parentId: true } },
        baseUnit: { select: { id: true, name: true, abbreviation: true } },
        stocks: { select: { quantity: true } },
        productUoms: {
          where: { isActive: true },
          include: { unit: { select: { id: true, name: true, abbreviation: true } } },
          orderBy: { isDefault: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Flatten stock quantities
    const productsWithStock = products.map((p) => ({
      ...p,
      stock: p.stocks.reduce((sum, s) => sum + s.quantity, 0),
    }));

    return NextResponse.json(productsWithStock);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
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
    const { name, sku, price, cost, categoryId, unitId, image, lowStockAlert } = body;

    if (!name || !sku || price === undefined) {
      return NextResponse.json(
        { error: "Name, SKU, and price are required" },
        { status: 400 }
      );
    }

    // Resolve base unit - use provided or get first unit for tenant
    let baseUnitId = unitId;
    if (!baseUnitId) {
      const defaultUnit = await db.unitOfMeasure.findFirst({ where: { tenantId: user.tenantId } });
      if (!defaultUnit) {
        return NextResponse.json({ error: "No units of measure configured. Create one first." }, { status: 400 });
      }
      baseUnitId = defaultUnit.id;
    }

    // Check for duplicate SKU within tenant
    const existing = await db.product.findUnique({
      where: { tenantId_sku: { tenantId: user.tenantId, sku } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A product with this SKU already exists" },
        { status: 409 }
      );
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : 0,
        categoryId: categoryId || null,
        baseUnitId,
        image: image || null,
        lowStockAlert: lowStockAlert ? parseInt(lowStockAlert) : 10,
        tenantId: user.tenantId,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        baseUnit: { select: { id: true, name: true, abbreviation: true } },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
