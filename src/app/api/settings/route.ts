import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// app/api/settings/route.ts
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        name: true, slug: true, type: true, tier: true, currency: true,
        taxRate: true, receiptHeader: true, receiptFooter: true, isActive: true,
        mpesaPaybill: true, mpesaTill: true, mpesaAccountName: true,
        paymentGateways: {
          select: { provider: true, isActive: true, merchantRef: true },
        },
      },
    });
    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const body = await request.json();
    const {
      name, type, currency, taxRate, receiptHeader, receiptFooter,
      mpesaPaybill, mpesaTill, mpesaAccountName,
    } = body;

    const tenant = await db.tenant.update({
      where: { id: user.tenantId },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(currency && { currency }),
        ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
        ...(receiptHeader !== undefined && { receiptHeader }),
        ...(receiptFooter !== undefined && { receiptFooter }),
        ...(mpesaPaybill !== undefined && { mpesaPaybill }),
        ...(mpesaTill !== undefined && { mpesaTill }),
        ...(mpesaAccountName !== undefined && { mpesaAccountName }),
      },
    });
    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
