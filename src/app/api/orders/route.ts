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
        items: { select: { id: true, quantity: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const ordersWithItemCount = orders.map((o) => ({
      ...o,
      itemsCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
    }));

    return NextResponse.json(ordersWithItemCount);
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

    // Calculate totals and perform atomic stock decrement
    const order = await db.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItems: { productId: string; quantity: number; unitPrice: number; total: number }[] = [];

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId: user.tenantId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
          total: itemTotal,
        });

        // Atomic stock decrement
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

      const taxRate = user.tenant.taxRate || 16;
      const taxAmount = subtotal * (taxRate / 100);
      const discountAmount = discount || 0;
      const total = subtotal + taxAmount - discountAmount;

      const newOrder = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          subtotal,
          taxAmount,
          discount: discountAmount,
          total,
          paymentMethod: paymentMethod || "CASH",
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
          items: true,
        },
      });

      return newOrder;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
