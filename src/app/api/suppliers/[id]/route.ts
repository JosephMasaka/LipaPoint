import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { requireUserWithFeature, routeError, parseBody } from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("supplier-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;

    const supplier = await db.supplier.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            poNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    return routeError("GET /api/suppliers/[id]", error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("supplier-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<Record<string, string>>(request);

    const existing = await db.supplier.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.kraPin !== undefined ? { kraPin: body.kraPin || null } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.address !== undefined ? { address: body.address || null } : {}),
        ...(body.paymentTerms !== undefined ? { paymentTerms: body.paymentTerms || null } : {}),
      },
    });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.PROCUREMENT.SUPPLIER_UPDATED,
      module: "procurement",
      entity: "supplier",
      entityId: id,
      after: { name: supplier.name },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    return routeError("PUT /api/suppliers/[id]", error);
  }
}

/**
 * Soft delete: suppliers with financial history keep their rows (the GL
 * references them), so we deactivate instead of destroying.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("supplier-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;

    const existing = await db.supplier.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, name: true, balance: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    if (existing.balance !== 0) {
      return NextResponse.json(
        { error: "Cannot deactivate a supplier with an outstanding balance" },
        { status: 409 }
      );
    }

    await db.supplier.update({ where: { id }, data: { isActive: false } });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PROCUREMENT.SUPPLIER_DEACTIVATED",
      module: "procurement",
      entity: "supplier",
      entityId: id,
      before: { isActive: true },
      after: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError("DELETE /api/suppliers/[id]", error);
  }
}
