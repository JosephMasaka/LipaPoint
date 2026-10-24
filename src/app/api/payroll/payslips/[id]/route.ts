import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError } from "@/lib/api-guards";

/**
 * GET /api/payroll/payslips/[id] — one payslip with everything a printed
 * copy must show: the employee, the run's period/status, the statutory
 * rate table it was computed with, and the company name for the letterhead.
 * Backs the printable payslip page (/print/payslip/[id]).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const [payslip, tenant] = await Promise.all([
      db.payslip.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          employee: true,
          payrollRun: { select: { id: true, period: true, status: true } },
          rateTable: { select: { id: true, label: true, effectiveFrom: true } },
        },
      }),
      db.tenant.findUnique({
        where: { id: user.tenantId },
        select: { name: true, slug: true, receiptHeader: true, address: true, city: true, phone: true },
      }),
    ]);
    if (!payslip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    return NextResponse.json({
      payslip,
      company: {
        name: tenant?.name ?? "Company",
        slug: tenant?.slug ?? null,
        header: tenant?.receiptHeader ?? null,
        address: tenant?.address ?? null,
        city: tenant?.city ?? null,
        phone: tenant?.phone ?? null,
      },
    });
  } catch (error) {
    return routeError("GET /api/payroll/payslips/[id]", error);
  }
}
