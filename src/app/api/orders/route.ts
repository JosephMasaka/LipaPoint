import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateOrderNo } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search) {
      where.orderNo = { contains: search, mode: "insensitive" };
    }

    const orders = await db.order.findMany({
      where,
      include: {
        items: {
          select: { id: true, quantity: true, unitPrice: true, total: true, product: { select: { name: true, sku: true } } },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
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
    const {
      items,
      paymentMethod,
      customerName,
      customerPhone,
      locationId,
      registerId,
      discount,
      notes,
    } = body;

    if (!items || !items.length) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    const resolvedLocationId = locationId || (await db.location.findFirst({ where: { tenantId: user.tenantId, isActive: true } }))?.id;
    if (!resolvedLocationId) {
      return NextResponse.json(
        { error: "No active location found" },
        { status: 400 }
      );
    }

    // Fetch products and validate stock outside the transaction
    const productIds = items.map((i: { productId: string }) => i.productId);
    const productsData = await db.product.findMany({
      where: { id: { in: productIds }, tenantId: user.tenantId },
    });

    const productMap = new Map(productsData.map(p => [p.id, p]));
    let subtotal = 0;
    const orderItems: { productId: string; quantity: number; unitPrice: number; total: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product not found` }, { status: 400 });
      }
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
        total: itemTotal,
      });
    }

    const taxRate = user.tenant.taxRate || 16;
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = discount || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Minimal transaction: stock decrement + order create
    const order = await db.$transaction(async (tx) => {
      for (const item of orderItems) {
        const product = productMap.get(item.productId)!;
        if (product.trackStock) {
          const stock = await tx.stock.findUnique({
            where: {
              productId_locationId: {
                productId: product.id,
                locationId: resolvedLocationId,
              },
            },
          });

          if (!stock || stock.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}`);
          }

          await tx.stock.update({
            where: {
              productId_locationId: {
                productId: product.id,
                locationId: resolvedLocationId,
              },
            },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          status: "COMPLETED",
          subtotal,
          taxAmount,
          discount: discountAmount,
          total,
          paymentMethod: paymentMethod || "CASH",
          paymentStatus: "COMPLETED",
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          notes: notes || null,
          tenantId: user.tenantId,
          locationId: resolvedLocationId,
          registerId: registerId || null,
          userId: user.id,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: { product: { select: { name: true, sku: true } } },
          },
          user: { select: { name: true } },
        },
      });

      return newOrder;
    }, { timeout: 30000 });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
