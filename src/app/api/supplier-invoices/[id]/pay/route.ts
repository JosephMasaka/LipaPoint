import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordSupplierPayment, ProcurementError } from "@/lib/procurement";
import { requireUserWithFeature, routeError, parseBody } from "@/lib/api-guards";

/**
 * POST /api/supplier-invoices/[id]/pay
 * Settles (part of) an invoice: DR Accounts Payable / CR cash-or-bank.
 * Body: { amount, method: cash|mpesa|bank|cheque, bankAccountId?, reference? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("supplier-invoicing");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{
      amount?: number;
      method?: string;
      bankAccountId?: string;
      reference?: string;
    }>(request);

    if (!body.amount || !body.method) {
      return NextResponse.json(
        { error: "amount and method are required" },
        { status: 400 }
      );
    }
    if (!["cash", "mpesa", "bank", "cheque"].includes(body.method)) {
      return NextResponse.json(
        { error: "method must be one of: cash, mpesa, bank, cheque" },
        { status: 400 }
      );
    }

    const invoice = await db.supplierInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { supplierId: true },
    });
    if (!invoice) throw new ProcurementError("Invoice not found", 404);

    const result = await recordSupplierPayment({
      tenantId: user.tenantId,
      supplierId: invoice.supplierId,
      invoiceId: id,
      amount: Number(body.amount),
      method: body.method as "cash" | "mpesa" | "bank" | "cheque",
      bankAccountId: body.bankAccountId ?? null,
      reference: body.reference ?? null,
      createdBy: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return routeError("POST /api/supplier-invoices/[id]/pay", error);
  }
}
