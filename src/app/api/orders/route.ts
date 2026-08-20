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
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            baseQuantity: true,
            product: { select: { name: true, sku: true } },
            productUom: { select: { unit: { select: { abbreviation: true } } } },
          },
        },
        user: { select: { name: true } },
        transactions: { select: { id: true, method: true, status: true, amount: true } },
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

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { trialEndsAt: true, isActive: true } });
    if (tenant?.trialEndsAt && new Date() > tenant.trialEndsAt && !tenant.isActive) {
      return NextResponse.json({ error: "Your plan has expired. Please renew to continue processing sales." }, { status: 403 });
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

    const productIds = items.map((i: { productId: string }) => i.productId);
    const productsData = await db.product.findMany({
      where: { id: { in: productIds }, tenantId: user.tenantId },
      include: {
        productUoms: { where: { isActive: true }, include: { unit: true } },
      },
    });

    const productMap = new Map(productsData.map(p => [p.id, p]));
    let subtotal = 0;

    interface OrderItemData {
      productId: string;
      quantity: number;
      unitPrice: number;
      total: number;
      baseQuantity: number;
      productUomId: string | null;
    }

    const orderItems: OrderItemData[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product not found` }, { status: 400 });
      }

      let unitPrice = item.unitPrice || product.price;
      let conversionFactor = 1;
      let productUomId: string | null = null;

      if (item.productUomId) {
        const uom = product.productUoms.find((u: { id: string }) => u.id === item.productUomId);
        if (uom) {
          unitPrice = uom.price;
          conversionFactor = uom.conversionFactor;
          productUomId = uom.id;
        }
      }

      const baseQuantity = item.quantity * conversionFactor;
      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal,
        baseQuantity,
        productUomId,
      });
    }

    const taxRate = user.tenant.taxRate || 16;
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = discount || 0;
    const total = subtotal + taxAmount - discountAmount;
    const orderNo = generateOrderNo();
    const txRef = `TXN-${orderNo.replace("ORD-", "")}`;

    const order = await db.$transaction(async (tx) => {
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];
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

          if (!stock || stock.quantity < item.baseQuantity) {
            throw new Error(`Insufficient stock for ${product.name}`);
          }

          await tx.stock.update({
            where: {
              productId_locationId: {
                productId: product.id,
                locationId: resolvedLocationId,
              },
            },
            data: { quantity: { decrement: item.baseQuantity } },
          });

          await tx.stockMovement.create({
            data: {
              type: "GOODS_ISSUE",
              quantity: item.baseQuantity,
              productId: product.id,
              locationId: resolvedLocationId,
              reference: orderNo,
              notes: `Sale - ${item.quantity} units`,
              tenantId: user.tenantId,
              userId: user.id,
            },
          });
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNo,
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
            create: orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              baseQuantity: item.baseQuantity,
              productUomId: item.productUomId,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              productUom: { select: { unit: { select: { abbreviation: true, name: true } } } },
            },
          },
          user: { select: { name: true } },
        },
      });

      await tx.transaction.create({
        data: {
          type: "SALE",
          amount: total,
          method: paymentMethod || "CASH",
          status: "COMPLETED",
          reference: txRef,
          description: `Sale ${orderNo}`,
          tenantId: user.tenantId,
          orderId: newOrder.id,
          userId: user.id,
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
