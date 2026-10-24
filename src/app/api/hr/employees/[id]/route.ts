import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateEmployee, HrError } from "@/lib/hr";
import { requireUserWithModule, routeError } from "@/lib/api-guards";

/**
 * PATCH /api/hr/employees/[id] — update fields, or archive/reactivate via
 * { active: false|true }. Salary changes affect future runs only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const employee = await updateEmployee(user.tenantId, id, body, user.id);
    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof HrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("PATCH /api/hr/employees/[id]", error);
  }
}

/**
 * DELETE /api/hr/employees/[id] — only for employees with no payroll
 * history and no open loans; anyone else must be archived instead so
 * payslips and repayments keep their referent.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const employee = await db.employee.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const [payslips, openLoans] = await Promise.all([
      db.payslip.count({ where: { employeeId: id } }),
      db.employeeLoan.count({ where: { employeeId: id, status: "active", balance: { gt: 0 } } }),
    ]);

    if (payslips > 0) {
      return NextResponse.json(
        { error: `Has ${payslips} payslip(s) on record — archive them instead (PATCH { active: false })` },
        { status: 409 }
      );
    }
    if (openLoans > 0) {
      return NextResponse.json(
        { error: "Has an outstanding loan balance — settle it before deleting" },
        { status: 409 }
      );
    }

    await db.employee.delete({ where: { id } });
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return routeError("DELETE /api/hr/employees/[id]", error);
  }
}