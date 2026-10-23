import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setPurchaseOrderStatus } from "@/lib/procurement";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("procurement");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;

    const po = await db.purchaseOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true } } } },
        grns: {
          orderBy: { receivedDate: "desc" },
          include: { items: true },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    return NextResponse.json(po);
  } catch (error) {
    return routeError("GET /api/purchase-orders/[id]", error);
  }
}

/** Status transitions: sent | closed | cancelled (receive lives on /receive). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("procurement");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{ status?: string }>(request);

    if (!["sent", "closed", "cancelled"].includes(body.status ?? "")) {
      return NextResponse.json(
        { error: "status must be one of: sent, closed, cancelled" },
        { status: 400 }
      );
    }

    const po = await setPurchaseOrderStatus(
      user.tenantId,
      id,
      body.status as "sent" | "closed" | "cancelled",
      user.id
    );

    return NextResponse.json(po);
  } catch (error) {
    return routeError("PATCH /api/purchase-orders/[id]", error);
  }
}
