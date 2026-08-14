import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tabs = await db.order.findMany({
    where: { tenantId: user.tenantId, status: "TAB" },
    include: {
      items: { include: { product: { select: { name: true, price: true } } } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tabs);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { tabName, items, customerName, customerPhone } = body;

  if (!tabName || !items?.length) {
    return NextResponse.json({ error: "Tab name and items are required" }, { status: 400 });
  }

  const location = await db.location.findFirst({
    where: { tenantId: user.tenantId, isActive: true },
  });
  if (!location) {
    return NextResponse.json({ error: "No active location" }, { status: 400 });
  }

  const orderNo = `TAB-${Date.now().toString(36).toUpperCase()}`;

  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, tenantId: user.tenantId },
    include: { productUoms: { where: { isActive: true } } },
  });

  let subtotal = 0;
  const orderItems = items.map((item: { productId: string; quantity: number; productUomId?: string }) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Product not found: ${item.productId}`);

    let unitPrice = product.price;
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

    const total = unitPrice * item.quantity;
    const baseQuantity = item.quantity * conversionFactor;
    subtotal += total;
    return { productId: item.productId, quantity: item.quantity, unitPrice, total, baseQuantity, productUomId };
  });

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { taxRate: true } });
  const taxRate = tenant?.taxRate || 16;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const order = await db.order.create({
    data: {
      orderNo,
      status: "TAB",
      tabName,
      subtotal,
      taxAmount,
      total,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      tenantId: user.tenantId,
      locationId: location.id,
      userId: user.id,
      items: { create: orderItems },
    },
    include: { items: { include: { product: { select: { name: true } } } } },
  });

  return NextResponse.json(order, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { orderId, items, action } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: { id: orderId, tenantId: user.tenantId, status: "TAB" },
  });

  if (!order) {
    return NextResponse.json({ error: "Tab not found" }, { status: 404 });
  }

  // Close tab (settle)
  if (action === "close") {
    const { paymentMethod } = body;

    const updated = await db.$transaction(async (tx) => {
      const closedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "COMPLETED", paymentMethod: paymentMethod || "CASH", paymentStatus: "COMPLETED" },
        include: { items: { include: { product: { select: { name: true } } } } },
      });

      await tx.transaction.create({
        data: {
          type: "SALE",
          amount: closedOrder.total,
          method: paymentMethod || "CASH",
          status: "COMPLETED",
          reference: `TXN-${closedOrder.orderNo.replace("TAB-", "")}`,
          description: `Tab settled: ${order.tabName}`,
          tenantId: user.tenantId,
          orderId: closedOrder.id,
          userId: user.id,
        },
      });

      return closedOrder;
    });

    return NextResponse.json(updated);
  }

  // Add items to tab
  if (action === "add" && items?.length) {
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, tenantId: user.tenantId },
      include: { productUoms: { where: { isActive: true } } },
    });

    let addedSubtotal = 0;
    const newItems = items.map((item: { productId: string; quantity: number; productUomId?: string }) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product not found`);

      let unitPrice = product.price;
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

      const total = unitPrice * item.quantity;
      const baseQuantity = item.quantity * conversionFactor;
      addedSubtotal += total;
      return { productId: item.productId, quantity: item.quantity, unitPrice, total, baseQuantity, productUomId, orderId };
    });

    await db.orderItem.createMany({ data: newItems });

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { taxRate: true } });
    const taxRate = tenant?.taxRate || 16;
    const newSubtotal = order.subtotal + addedSubtotal;
    const newTax = newSubtotal * (taxRate / 100);
    const newTotal = newSubtotal + newTax;

    const updated = await db.order.update({
      where: { id: orderId },
      data: { subtotal: newSubtotal, taxAmount: newTax, total: newTotal },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
