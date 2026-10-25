import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";
import { writeAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

/**
 * POST /api/stock/take — records a physical stock count:
 *   { date: "YYYY-MM-DD", locationId, counts: [{ productId, countedQuantity, notes? }] }
 *
 * For each line the counted figure is written as `StockRecord.closingStock`
 * (so the stock sheet's variance = counted − book) and, when it differs from
 * what the shelf says, `Stock.quantity` is corrected and an ADJUSTMENT
 * movement records the signed difference. That pair of writes is what the
 * Physical Stock-Take report reads.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("inventory");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      date?: string;
      locationId?: string;
      counts?: Array<{ productId?: string; countedQuantity?: number; notes?: string }>;
    }>(request);

    const { date, locationId, counts } = body;
    if (!date || !locationId) {
      return NextResponse.json(
        { error: "date and locationId are required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(counts) || counts.length === 0) {
      return NextResponse.json(
        { error: "counts[] with at least one line is required" },
        { status: 400 }
      );
    }
    const countDate = new Date(date);
    if (Number.isNaN(countDate.getTime())) {
      return NextResponse.json({ error: "date must be an ISO date" }, { status: 400 });
    }

    const location = await db.location.findFirst({
      where: { id: locationId, tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const productIds = counts
      .map((c) => c.productId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, tenantId: user.tenantId },
      select: { id: true, name: true },
    });
    const productById = new Map(products.map((p) => [p.id, p.name]));

    const lines: Array<{ productId: string; countedQuantity: number; notes?: string }> = [];
    for (const [i, line] of counts.entries()) {
      const counted = Number(line.countedQuantity);
      if (!line.productId || !productById.has(line.productId)) {
        return NextResponse.json(
          { error: `Line ${i + 1}: product not found for this tenant` },
          { status: 400 }
        );
      }
      if (!Number.isInteger(counted) || counted < 0) {
        return NextResponse.json(
          { error: `Line ${i + 1}: countedQuantity must be a non-negative whole number` },
          { status: 400 }
        );
      }
      lines.push({
        productId: line.productId,
        countedQuantity: counted,
        ...(line.notes ? { notes: line.notes } : {}),
      });
    }

    const reference = `COUNT-${date}`;
    let recorded = 0;
    let corrected = 0;
    let variance = 0;

    await db.$transaction(async (tx) => {
      for (const line of lines) {
        const stock = await tx.stock.findUnique({
          where: {
            productId_locationId: { productId: line.productId, locationId },
          },
          select: { quantity: true },
        });
        const book = stock?.quantity ?? 0;
        const diff = line.countedQuantity - book;
        variance += diff;
        recorded += 1;

        const record = await tx.stockRecord.findUnique({
          where: {
            productId_locationId_date: {
              productId: line.productId,
              locationId,
              date: countDate,
            },
          },
          select: { id: true },
        });

        if (record) {
          // closingStock holds the counted figure; the sheet derives
          // variance = counted − (opening + added − sold).
          await tx.stockRecord.update({
            where: { id: record.id },
            data: {
              closingStock: line.countedQuantity,
              countedAt: new Date(),
              ...(line.notes ? { notes: line.notes } : {}),
            },
          });
        } else {
          await tx.stockRecord.create({
            data: {
              date: countDate,
              openingStock: book,
              addedStock: 0,
              soldStock: 0,
              closingStock: line.countedQuantity,
              countedAt: new Date(),
              notes: line.notes ?? null,
              productId: line.productId,
              locationId,
              tenantId: user.tenantId,
            },
          });
        }

        if (diff !== 0) {
          if (stock) {
            await tx.stock.update({
              where: {
                productId_locationId: { productId: line.productId, locationId },
              },
              data: { quantity: line.countedQuantity },
            });
          } else {
            await tx.stock.create({
              data: { productId: line.productId, locationId, quantity: line.countedQuantity },
            });
          }
          await tx.stockMovement.create({
            data: {
              type: "ADJUSTMENT",
              quantity: diff,
              productId: line.productId,
              locationId,
              reference,
              notes:
                line.notes ??
                `Physical stock-take — ${diff > 0 ? "+" : ""}${diff} unit${Math.abs(diff) === 1 ? "" : "s"}`,
              tenantId: user.tenantId,
              userId: user.id,
            },
          });
          corrected += 1;
        }
      }
    });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.INVENTORY.STOCK_TAKEN,
      module: "inventory",
      entity: "stockRecord",
      entityId: reference,
      after: {
        date,
        location: location.name,
        counted: recorded,
        corrected,
        variance,
      },
    });

    return NextResponse.json(
      { date, locationId, counted: recorded, corrected, variance },
      { status: 201 }
    );
  } catch (error) {
    return routeError("POST /api/stock/take", error);
  }
}
