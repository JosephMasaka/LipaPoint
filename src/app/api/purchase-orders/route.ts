import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPurchaseOrder } from "@/lib/procurement";
import { requireUserWithModule, routeError, parseBody, pagination } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("procurement");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(status ? { status } : {}),
    };

    const [purchaseOrders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      purchaseOrders,
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/purchase-orders", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("procurement");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      supplierId?: string;
      locationId?: string;
      expectedDate?: string;
      notes?: string;
      items?: Array<{
        productId?: string;
        description?: string;
        quantity?: number;
        unitCost?: number;
      }>;
    }>(request);

    if (!body.supplierId || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "supplierId and items[] are required" },
        { status: 400 }
      );
    }

    const po = await createPurchaseOrder({
      tenantId: user.tenantId,
      supplierId: body.supplierId,
      locationId: body.locationId ?? null,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      notes: body.notes ?? null,
      createdBy: user.id,
      items: body.items.map((item) => ({
        productId: item.productId ?? null,
        description: item.description ?? "",
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error) {
    return routeError("POST /api/purchase-orders", error);
  }
}
