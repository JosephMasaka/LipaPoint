import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const locationId = searchParams.get("locationId");

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      date: new Date(date),
    };
    if (locationId) where.locationId = locationId;

    const records = await db.stockRecord.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, price: true, cost: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { product: { name: "asc" } },
    });

    const recalculated = records.map((r) => ({
      ...r,
      closingStock: r.openingStock + r.addedStock - r.soldStock,
      variance: r.closingStock - (r.openingStock + r.addedStock - r.soldStock),
    }));

    return NextResponse.json(recalculated);
  } catch (error) {
    console.error("GET /api/stock error:", error);
    return NextResponse.json({ error: "Failed to fetch stock records" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, date, locationId, records } = body;

    if (!date || !locationId) {
      return NextResponse.json({ error: "Date and locationId required" }, { status: 400 });
    }

    const recordDate = new Date(date);

    if (action === "initialize") {
      const products = await db.product.findMany({
        where: { tenantId: user.tenantId, isActive: true, trackStock: true },
        include: { stocks: { where: { locationId } } },
      });

      // Get previous day's closing stock as today's opening
      const prevDate = new Date(recordDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevRecords = await db.stockRecord.findMany({
        where: { tenantId: user.tenantId, date: prevDate, locationId },
      });
      const prevClosingMap = new Map(prevRecords.map((r) => [r.productId, r.openingStock + r.addedStock - r.soldStock]));

      const upserts = products.map((product) => {
        // Opening = previous day's calculated closing, or current inventory stock if no previous record
        const opening = prevClosingMap.get(product.id) ?? (product.stocks[0]?.quantity || 0);
        return db.stockRecord.upsert({
          where: { productId_locationId_date: { productId: product.id, locationId, date: recordDate } },
          update: {},
          create: {
            date: recordDate,
            openingStock: opening,
            closingStock: opening,
            productId: product.id,
            locationId,
            tenantId: user.tenantId,
          },
        });
      });

      await db.$transaction(upserts);
      return NextResponse.json({ message: "Stock records initialized", count: upserts.length });
    }

    if (action === "update" && records) {
      // First apply addedStock updates
      const updates = records.map((r: { productId: string; addedStock?: number; notes?: string }) => {
        return db.stockRecord.update({
          where: { productId_locationId_date: { productId: r.productId, locationId, date: recordDate } },
          data: {
            ...(r.addedStock !== undefined && { addedStock: r.addedStock }),
            ...(r.notes !== undefined && { notes: r.notes }),
          },
        });
      });

      await db.$transaction(updates);

      // Recalculate closing stock and variance for all records on this day
      const updatedRecords = await db.stockRecord.findMany({
        where: { tenantId: user.tenantId, date: recordDate, locationId },
      });

      const recalcUpdates = updatedRecords.map((rec) => {
        const closingStock = rec.openingStock + rec.addedStock - rec.soldStock;
        return db.stockRecord.update({
          where: { id: rec.id },
          data: { closingStock, variance: 0 },
        });
      });

      await db.$transaction(recalcUpdates);

      // Also update the actual inventory stock to match closing
      const stockUpdates = updatedRecords.map((rec) => {
        const closingStock = rec.openingStock + rec.addedStock - rec.soldStock;
        return db.stock.upsert({
          where: { productId_locationId: { productId: rec.productId, locationId } },
          update: { quantity: closingStock },
          create: { productId: rec.productId, locationId, quantity: closingStock },
        });
      });

      await db.$transaction(stockUpdates);

      return NextResponse.json({ message: "Stock records updated" });
    }

    if (action === "addStock") {
      const { productId, quantity } = body;
      if (!productId || !quantity) {
        return NextResponse.json({ error: "productId and quantity required" }, { status: 400 });
      }

      // Update actual stock
      await db.stock.upsert({
        where: { productId_locationId: { productId, locationId } },
        update: { quantity: { increment: quantity } },
        create: { productId, locationId, quantity },
      });

      // Update stock record for today
      await db.stockRecord.upsert({
        where: { productId_locationId_date: { productId, locationId, date: recordDate } },
        update: { addedStock: { increment: quantity }, closingStock: { increment: quantity } },
        create: {
          date: recordDate,
          openingStock: quantity,
          addedStock: quantity,
          closingStock: quantity,
          productId,
          locationId,
          tenantId: user.tenantId,
        },
      });

      // Create stock movement record (SAP MSEG - Goods Receipt)
      await db.stockMovement.create({
        data: {
          type: "GOODS_RECEIPT",
          quantity,
          productId,
          locationId,
          reference: `GR-${date}`,
          notes: `Added ${quantity} units`,
          tenantId: user.tenantId,
          userId: user.id,
        },
      });

      return NextResponse.json({ message: "Stock added" });
    }

    if (action === "import") {
      const { items } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "Items array required" }, { status: 400 });
      }

      let created = 0;
      let updated = 0;

      for (const item of items) {
        const { name, sku, price, cost, quantity, category } = item;
        if (!name) continue;

        // Find or create product
        let product = sku
          ? await db.product.findFirst({ where: { sku, tenantId: user.tenantId } })
          : await db.product.findFirst({ where: { name, tenantId: user.tenantId } });

        let categoryObj = null;
        if (category) {
          categoryObj = await db.category.findFirst({ where: { name: category, tenantId: user.tenantId } });
          if (!categoryObj) {
            categoryObj = await db.category.create({ data: { name: category, tenantId: user.tenantId } });
          }
        }

        if (!product) {
          product = await db.product.create({
            data: {
              name,
              sku: sku || `SKU-${Date.now()}-${created}`,
              price: parseFloat(price) || 0,
              cost: parseFloat(cost) || 0,
              isActive: true,
              trackStock: true,
              tenantId: user.tenantId,
              ...(categoryObj && { categoryId: categoryObj.id }),
            },
          });
          created++;
        } else {
          await db.product.update({
            where: { id: product.id },
            data: {
              ...(price && { price: parseFloat(price) }),
              ...(cost && { cost: parseFloat(cost) }),
              ...(categoryObj && { categoryId: categoryObj.id }),
            },
          });
          updated++;
        }

        // Set inventory stock
        const qty = parseInt(quantity) || 0;
        await db.stock.upsert({
          where: { productId_locationId: { productId: product.id, locationId } },
          update: { quantity: qty },
          create: { productId: product.id, locationId, quantity: qty },
        });

        // Create stock record for today
        await db.stockRecord.upsert({
          where: { productId_locationId_date: { productId: product.id, locationId, date: recordDate } },
          update: { openingStock: qty, closingStock: qty },
          create: {
            date: recordDate,
            openingStock: qty,
            closingStock: qty,
            productId: product.id,
            locationId,
            tenantId: user.tenantId,
          },
        });
      }

      return NextResponse.json({ message: "Import complete", created, updated, total: items.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/stock error:", error);
    return NextResponse.json({ error: "Failed to process stock operation" }, { status: 500 });
  }
}
