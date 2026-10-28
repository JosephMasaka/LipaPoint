import { requireUserWithFeature } from "@/lib/api-guards";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLinePrice, supplierCostPerUnit, type PricePolicy } from "@/lib/price-override";
import { isFeatureEnabled } from "@/lib/features";

/** The tenant's on-the-go pricing policy (src/lib/price-override.ts). */
async function pricePolicyFor(tenantId: string): Promise<PricePolicy> {
  const row = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { priceOverrideEnabled: true, priceFloorMode: true, priceFloorValue: true },
  });
  return {
    // The setting only counts while the tenant holds the "Price Override"
    // feature (sub-feature spec §1) — mirrors /api/orders.
    priceOverrideEnabled:
      (row?.priceOverrideEnabled ?? false) &&
      (await isFeatureEnabled(tenantId, "price-override")),
    priceFloorMode: row?.priceFloorMode ?? "PERCENT",
    priceFloorValue: row?.priceFloorValue ?? 0,
  };
}

export async function GET() {
  const auth = await requireUserWithFeature("core-till");
  if (auth.response) return auth.response;
  const { user } = auth;

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
  const auth = await requireUserWithFeature("core-till");
  if (auth.response) return auth.response;
  const { user } = auth;

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

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { taxRate: true } });
  const pricePolicy = await pricePolicyFor(user.tenantId);

  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, tenantId: user.tenantId },
    include: { productUoms: { where: { isActive: true } } },
  });

  let subtotal = 0;
  const orderItems: {
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    baseQuantity: number;
    productUomId: string | null;
  }[] = [];
  for (const item of items as {
    productId: string;
    quantity: number;
    productUomId?: string;
    unitPrice?: number;
  }[]) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Product not found: ${item.productId}`);

    let setPrice = product.price;
    let conversionFactor = 1;
    let productUomId: string | null = null;
    let uomCost: number | null = null;

    if (item.productUomId) {
      const uom = product.productUoms.find((u: { id: string }) => u.id === item.productUomId);
      if (uom) {
        setPrice = uom.price;
        uomCost = uom.cost;
        conversionFactor = uom.conversionFactor;
        productUomId = uom.id;
      }
    }

    // On-the-go pricing — same floor rule the till applies (supplier price
    // is hard floor for stock items, tolerance otherwise).
    const pricing = resolveLinePrice({
      itemName: product.name,
      setPrice,
      requestedPrice: typeof item.unitPrice === "number" ? item.unitPrice : null,
      trackStock: product.trackStock,
      supplierCost: supplierCostPerUnit(product.cost, conversionFactor, uomCost),
      policy: pricePolicy,
    });
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: 400 });
    }
    const unitPrice = pricing.unitPrice;

    const total = unitPrice * item.quantity;
    const baseQuantity = item.quantity * conversionFactor;
    subtotal += total;
    orderItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, total, baseQuantity, productUomId });
  }

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
  const auth = await requireUserWithFeature("core-till");
  if (auth.response) return auth.response;
  const { user } = auth;

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

    // Settling a tab turns it into a real invoice — that is when the
    // customer is linked (when identifiable) and their withholding rate is
    // snapshotted onto the sale (reports-spec §3 "Withholding tax by customer").
    let linkedCustomerId = order.customerId;
    let linkedWhtRate = order.whtRate;
    if (linkedCustomerId) {
      const linked = await db.customer.findUnique({
        where: { id: linkedCustomerId },
        select: { whtRate: true },
      });
      linkedWhtRate = linked?.whtRate ?? 0;
    } else {
      const matches = order.customerPhone
        ? await db.customer.findMany({
            where: { tenantId: user.tenantId, phone: order.customerPhone },
            select: { id: true, whtRate: true },
            take: 2,
          })
        : order.customerName
          ? await db.customer.findMany({
              where: { tenantId: user.tenantId, name: order.customerName },
              select: { id: true, whtRate: true },
              take: 2,
            })
          : [];
      if (matches.length === 1) {
        linkedCustomerId = matches[0].id;
        linkedWhtRate = matches[0].whtRate;
      }
    }
    const whtAmount = linkedWhtRate > 0 ? Math.round(order.total * linkedWhtRate) / 100 : 0;

    const updated = await db.$transaction(async (tx) => {
      const closedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "COMPLETED",
          paymentMethod: paymentMethod || "CASH",
          paymentStatus: "COMPLETED",
          customerId: linkedCustomerId,
          whtRate: linkedWhtRate,
          whtAmount,
        },
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

    const pricePolicy = await pricePolicyFor(user.tenantId);
    let addedSubtotal = 0;
    const newItems: {
      productId: string;
      quantity: number;
      unitPrice: number;
      total: number;
      baseQuantity: number;
      productUomId: string | null;
      orderId: string;
    }[] = [];
    for (const item of items as {
      productId: string;
      quantity: number;
      productUomId?: string;
      unitPrice?: number;
    }[]) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product not found`);

      let setPrice = product.price;
      let conversionFactor = 1;
      let productUomId: string | null = null;
      let uomCost: number | null = null;

      if (item.productUomId) {
        const uom = product.productUoms.find((u: { id: string }) => u.id === item.productUomId);
        if (uom) {
          setPrice = uom.price;
          uomCost = uom.cost;
          conversionFactor = uom.conversionFactor;
          productUomId = uom.id;
        }
      }

      // On-the-go pricing — identical floor rule to the sale path.
      const pricing = resolveLinePrice({
        itemName: product.name,
        setPrice,
        requestedPrice: typeof item.unitPrice === "number" ? item.unitPrice : null,
        trackStock: product.trackStock,
        supplierCost: supplierCostPerUnit(product.cost, conversionFactor, uomCost),
        policy: pricePolicy,
      });
      if (!pricing.ok) {
        return NextResponse.json({ error: pricing.error }, { status: 400 });
      }
      const unitPrice = pricing.unitPrice;

      const total = unitPrice * item.quantity;
      const baseQuantity = item.quantity * conversionFactor;
      addedSubtotal += total;
      newItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, total, baseQuantity, productUomId, orderId });
    }

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
