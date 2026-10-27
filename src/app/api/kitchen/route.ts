import { requireUserWithFeature } from "@/lib/api-guards";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireUserWithFeature("kitchen-display");
    if (auth.response) return auth.response;
    const { user } = auth;

    const orders = await db.order.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: ["PENDING", "PREPARING"] },
        items: {
          some: {
            kitchenStatus: { not: "SERVED" },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        table: { select: { id: true, name: true } },
        items: {
          where: {
            kitchenStatus: { not: "SERVED" },
          },
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/kitchen error:", error);
    return NextResponse.json(
      { error: "Failed to fetch kitchen orders" },
      { status: 500 }
    );
  }
}
