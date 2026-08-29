import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            orderNo: true,
            total: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("GET /api/customers/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.customer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check for duplicate phone if phone is being changed
    if (body.phone && body.phone !== existing.phone) {
      const duplicate = await db.customer.findUnique({
        where: { tenantId_phone: { tenantId: user.tenantId, phone: body.phone } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A customer with this phone number already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.loyaltyPoints !== undefined && { loyaltyPoints: body.loyaltyPoints }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/customers/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.customer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await db.customer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
