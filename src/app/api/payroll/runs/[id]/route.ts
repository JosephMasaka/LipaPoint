import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  approvePayrollRun,
  markPayrollRunPaid,
  filePayrollRun,
  deletePayrollRun,
  PayrollError,
} from "@/lib/payroll";
import { requireUserWithFeature, routeError, parseBody } from "@/lib/api-guards";

async function loadRun(tenantId: string, id: string) {
  return db.payrollRun.findFirst({
    where: { id, tenantId },
    include: {
      payslips: {
        include: {
          employee: {
            select: {
              id: true,
              staffNumber: true,
              firstName: true,
              lastName: true,
              employmentType: true,
              jobTitle: true,
              bankAccount: true,
              mpesaNumber: true,
            },
          },
        },
        orderBy: { employee: { staffNumber: "asc" } },
      },
      bankAccount: { select: { id: true, name: true } },
    },
  });
}

/** GET /api/payroll/runs/[id] — the run with its payslips. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const run = await loadRun(user.tenantId, id);
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (error) {
    return routeError("GET /api/payroll/runs/[id]", error);
  }
}

/**
 * PATCH /api/payroll/runs/[id] — state transitions:
 *   { action: "approve" }  draft → approved (payslips recomputed + frozen)
 *   { action: "pay" }      approved → paid (posts the GL entry, settles
 *                          loans, records the bank outflow)
 *   { action: "file" }     paid → filed (returns submitted)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{ action?: string; bankAccountId?: string }>(request);

    switch (body.action) {
      case "approve": {
        const run = await approvePayrollRun(user.tenantId, id, user.id);
        return NextResponse.json(run);
      }
      case "pay": {
        const run = await markPayrollRunPaid(user.tenantId, id, {
          userId: user.id,
          bankAccountId: body.bankAccountId ?? null,
        });
        return NextResponse.json(run);
      }
      case "file": {
        const run = await filePayrollRun(user.tenantId, id, user.id);
        return NextResponse.json(run);
      }
      default:
        return NextResponse.json(
          { error: "action must be one of: approve, pay, file" },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("PATCH /api/payroll/runs/[id]", error);
  }
}

/** DELETE /api/payroll/runs/[id] — draft runs only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const result = await deletePayrollRun(user.tenantId, id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("DELETE /api/payroll/runs/[id]", error);
  }
}