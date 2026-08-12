import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "demo-tenant";
    const categoryId = searchParams.get("categoryId");

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: true,
        stocks: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sku, price, cost, tenantId, categoryId, locationId, quantity } = body;

    if (!name || !sku || !price) {
      return NextResponse.json(
        { error: "Name, SKU, and price are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        price,
        cost: cost || 0,
        tenantId: tenantId || "demo-tenant",
        categoryId,
        ...(locationId
          ? {
              stocks: {
                create: {
                  quantity: quantity || 0,
                  locationId,
                },
              },
            }
          : {}),
      },
      include: { category: true, stocks: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
