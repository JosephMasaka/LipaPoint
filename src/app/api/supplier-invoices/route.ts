import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordSupplierInvoice } from "@/lib/procurement";
import { requireUserWithFeature, routeError, parseBody, pagination } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("supplier-invoicing");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
    };

    const [invoices, total] = await Promise.all([
      db.supplierInvoice.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          payments: { select: { id: true, amount: true, paidAt: true, method: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.supplierInvoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/supplier-invoices", error);
  }
}

/**
 * Records a supplier invoice and posts DR Inventory / CR Accounts Payable.
 * Body: { supplierId, poId?, invoiceNumber, amount, dueDate?, etimsValidated? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("supplier-invoicing");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      supplierId?: string;
      poId?: string;
      invoiceNumber?: string;
      amount?: number;
      dueDate?: string;
      etimsValidated?: boolean;
    }>(request);

    if (!body.supplierId || !body.invoiceNumber || !body.amount) {
      return NextResponse.json(
        { error: "supplierId, invoiceNumber and amount are required" },
        { status: 400 }
      );
    }

    const invoice = await recordSupplierInvoice({
      tenantId: user.tenantId,
      supplierId: body.supplierId,
      poId: body.poId ?? null,
      invoiceNumber: body.invoiceNumber,
      amount: Number(body.amount),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      etimsValidated: body.etimsValidated ?? false,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return routeError("POST /api/supplier-invoices", error);
  }
}
