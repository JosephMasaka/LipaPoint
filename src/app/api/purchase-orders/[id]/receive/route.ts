import { NextRequest, NextResponse } from "next/server";
import { receiveGoods } from "@/lib/procurement";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * POST /api/purchase-orders/[id]/receive
 * Records a GRN against the PO. Body:
 *   { locationId?, notes?, items: [{ poItemId, quantity, unitCost? }] }
 * Partial receipts are allowed; over-receiving a line is rejected.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("procurement");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{
      locationId?: string;
      notes?: string;
      items?: Array<{ poItemId?: string; quantity?: number; unitCost?: number }>;
    }>(request);

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items[] with at least one line is required" },
        { status: 400 }
      );
    }

    const grn = await receiveGoods({
      tenantId: user.tenantId,
      purchaseOrderId: id,
      locationId: body.locationId ?? null,
      receivedBy: user.id,
      notes: body.notes ?? null,
      items: body.items.map((line) => ({
        poItemId: line.poItemId ?? "",
        quantity: Number(line.quantity),
        unitCost: line.unitCost ?? null,
      })),
    });

    return NextResponse.json(grn, { status: 201 });
  } catch (error) {
    return routeError("POST /api/purchase-orders/[id]/receive", error);
  }
}
