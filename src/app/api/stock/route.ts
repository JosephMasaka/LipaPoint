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

    return NextResponse.json(records);
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

      const upserts = products.map((product) => {
        const currentStock = product.stocks[0]?.quantity || 0;
        return db.stockRecord.upsert({
          where: { productId_locationId_date: { productId: product.id, locationId, date: recordDate } },
          update: {},
          create: {
            date: recordDate,
            openingStock: currentStock,
            closingStock: currentStock,
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
      const updates = records.map((r: { productId: string; addedStock?: number; closingStock?: number; notes?: string }) => {
        return db.stockRecord.update({
          where: { productId_locationId_date: { productId: r.productId, locationId, date: recordDate } },
          data: {
            ...(r.addedStock !== undefined && { addedStock: r.addedStock }),
            ...(r.closingStock !== undefined && { closingStock: r.closingStock }),
            ...(r.notes !== undefined && { notes: r.notes }),
          },
        });
      });

      await db.$transaction(updates);

      // Recalculate variance for updated records
      const updatedRecords = await db.stockRecord.findMany({
        where: { tenantId: user.tenantId, date: recordDate, locationId },
      });

      const varianceUpdates = updatedRecords.map((rec) => {
        const expected = rec.openingStock + rec.addedStock - rec.soldStock;
        const variance = rec.closingStock - expected;
        return db.stockRecord.update({
          where: { id: rec.id },
          data: { variance },
        });
      });

      await db.$transaction(varianceUpdates);

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

      return NextResponse.json({ message: "Stock added" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/stock error:", error);
    return NextResponse.json({ error: "Failed to process stock operation" }, { status: 500 });
  }
}
