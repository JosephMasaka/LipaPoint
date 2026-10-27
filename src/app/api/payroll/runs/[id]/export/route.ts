import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payslipRegisterCsv, bankBatchCsv, PayrollError, type PayrollRunWithPayslips } from "@/lib/payroll";
import { requireUserWithFeature, routeError } from "@/lib/api-guards";

async function loadRun(tenantId: string, id: string) {
  return db.payrollRun.findFirst({
    where: { id, tenantId },
    include: {
      payslips: { include: { employee: true }, orderBy: { employee: { staffNumber: "asc" } } },
      bankAccount: { select: { name: true } },
    },
  });
}

function csvResponse(filename: string, csv: string) {
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * GET /api/payroll/runs/[id]/export — payslip register CSV
 * (?format=register | ?format=bank). The bank variant is the batch
 * disbursement file (destination account/M-Pesa number + net amount).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const run = (await loadRun(user.tenantId, id)) as PayrollRunWithPayslips | null;
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    if (run.payslips.length === 0) {
      throw new PayrollError("Run has no payslips to export");
    }

    const format = request.nextUrl.searchParams.get("format") || "register";
    const csv = format === "bank" ? bankBatchCsv(run) : payslipRegisterCsv(run);
    const suffix = format === "bank" ? "payments" : "payslips";
    return csvResponse(`payroll-${run.period}-${suffix}.csv`, csv);
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("GET /api/payroll/runs/[id]/export", error);
  }
}