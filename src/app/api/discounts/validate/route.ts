import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, orderTotal } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Discount code is required" },
        { status: 400 }
      );
    }

    if (orderTotal === undefined || orderTotal < 0) {
      return NextResponse.json(
        { error: "Valid order total is required" },
        { status: 400 }
      );
    }

    const discount = await db.discount.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId, code } },
    });

    if (!discount) {
      return NextResponse.json(
        { error: "Invalid discount code" },
        { status: 404 }
      );
    }

    if (!discount.isActive) {
      return NextResponse.json(
        { error: "This discount is no longer active" },
        { status: 400 }
      );
    }

    const now = new Date();

    if (discount.startsAt && now < discount.startsAt) {
      return NextResponse.json(
        { error: "This discount is not yet active" },
        { status: 400 }
      );
    }

    if (discount.expiresAt && now > discount.expiresAt) {
      return NextResponse.json(
        { error: "This discount has expired" },
        { status: 400 }
      );
    }

    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      return NextResponse.json(
        { error: "This discount has reached its maximum usage limit" },
        { status: 400 }
      );
    }

    if (discount.minOrder !== null && orderTotal < discount.minOrder) {
      return NextResponse.json(
        { error: `Minimum order of KSh ${discount.minOrder.toLocaleString()} required for this discount` },
        { status: 400 }
      );
    }

    // Calculate discount amount
    let discountAmount: number;
    if (discount.type === "PERCENTAGE") {
      discountAmount = (orderTotal * discount.value) / 100;
    } else {
      discountAmount = Math.min(discount.value, orderTotal);
    }

    return NextResponse.json({
      valid: true,
      discount: {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discount.value,
      },
      discountAmount: Math.round(discountAmount * 100) / 100,
      newTotal: Math.round((orderTotal - discountAmount) * 100) / 100,
    });
  } catch (error) {
    console.error("POST /api/discounts/validate error:", error);
    return NextResponse.json(
      { error: "Failed to validate discount" },
      { status: 500 }
    );
  }
}
