import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";
import { writeAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

/**
 * POST /api/stock/transfer — moves stock between locations:
 *   { productId, quantity, fromLocationId, toLocationId, reference?, notes? }
 *
 * Writes two `StockMovement` rows of type TRANSFER sharing one reference —
 * out at the source, in at the destination — which is exactly what the
 * Stock Transferred report pairs back together, and moves the Stock
 * quantities on both sides.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("inventory");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      productId?: string;
      quantity?: number;
      fromLocationId?: string;
      toLocationId?: string;
      reference?: string;
      notes?: string;
    }>(request);

    const { productId, fromLocationId, toLocationId } = body;
    const quantity = Number(body.quantity);

    if (!productId || !fromLocationId || !toLocationId) {
      return NextResponse.json(
        { error: "productId, fromLocationId and toLocationId are required" },
        { status: 400 }
      );
    }
    if (fromLocationId === toLocationId) {
      return NextResponse.json(
        { error: "Source and destination must be different locations" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive whole number" },
        { status: 400 }
      );
    }

    const product = await db.product.findFirst({
      where: { id: productId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const locations = await db.location.findMany({
      where: {
        id: { in: [fromLocationId, toLocationId] },
        tenantId: user.tenantId,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    if (locations.length !== 2) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    const source = locations.find((l) => l.id === fromLocationId)!;

    const sourceStock = await db.stock.findUnique({
      where: { productId_locationId: { productId, locationId: fromLocationId } },
      select: { quantity: true },
    });
    if (!sourceStock || sourceStock.quantity < quantity) {
      return NextResponse.json(
        {
          error: `Insufficient stock at ${source.name} — ${
            sourceStock?.quantity ?? 0
          } on hand, ${quantity} requested`,
        },
        { status: 400 }
      );
    }

    const reference =
      body.reference?.trim() || `TRF-${Date.now().toString(36).toUpperCase()}`;
    const notes = body.notes?.trim() || null;
    const legAt = new Date();
    // The destination leg is stamped 1ms later so the report's paired legs
    // always read source-first, destination-second.
    const legIn = new Date(legAt.getTime() + 1);

    const movements = await db.$transaction(async (tx) => {
      const outLeg = await tx.stockMovement.create({
        data: {
          type: "TRANSFER",
          quantity,
          productId,
          locationId: fromLocationId,
          reference,
          notes: notes ?? `Transfer out to ${locations.find((l) => l.id === toLocationId)!.name}`,
          tenantId: user.tenantId,
          userId: user.id,
          createdAt: legAt,
        },
      });
      const inLeg = await tx.stockMovement.create({
        data: {
          type: "TRANSFER",
          quantity,
          productId,
          locationId: toLocationId,
          reference,
          notes: notes ?? `Transfer in from ${source.name}`,
          tenantId: user.tenantId,
          userId: user.id,
          createdAt: legIn,
        },
      });

      await tx.stock.update({
        where: { productId_locationId: { productId, locationId: fromLocationId } },
        data: { quantity: { decrement: quantity } },
      });
      await tx.stock.upsert({
        where: { productId_locationId: { productId, locationId: toLocationId } },
        update: { quantity: { increment: quantity } },
        create: { productId, locationId: toLocationId, quantity },
      });

      return [outLeg, inLeg];
    });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.INVENTORY.STOCK_TRANSFERRED,
      module: "inventory",
      entity: "stockMovement",
      entityId: movements[0].id,
      after: {
        product: product.name,
        quantity,
        from: source.name,
        to: locations.find((l) => l.id === toLocationId)!.name,
        reference,
      },
    });

    return NextResponse.json({ reference, movements }, { status: 201 });
  } catch (error) {
    return routeError("POST /api/stock/transfer", error);
  }
}
