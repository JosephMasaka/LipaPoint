import { db } from "./db";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit";

/**
 * HR records (LipaPoint ERP spec §4.4/§6 — "full HR" scope for Phase 3):
 * employee files, leave, and staff loans/advances.
 *
 * Employee is not User: User is a login to this app, Employee is an HR
 * file (salary, KRA PIN, leave entitlement) — a casual worker can be on
 * the HR file without ever signing in. Staff loans are HR's side of the
 * same coin as payroll's otherDeductions: issued here, repaid through
 * payslip deductions (see payroll.ts).
 */

export class HrError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "HrError";
  }
}

const EMPLOYMENT_TYPES = ["permanent", "contract", "casual"] as const;
const LEAVE_TYPES = ["annual", "sick", "maternity", "paternity", "unpaid", "compassionate"] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];

// ────────────────────────────── employees ──────────────────────────────

export interface CreateEmployeeInput {
  tenantId: string;
  firstName: string;
  lastName: string;
  staffNumber?: string;
  locationId?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  kraPin?: string | null;
  nssfNumber?: string | null;
  shaNumber?: string | null;
  bankAccount?: string | null;
  mpesaNumber?: string | null;
  employmentType?: string;
  basicSalary?: number;
  annualLeaveDays?: number;
  startDate: Date | string;
  endDate?: Date | string | null;
  createdBy?: string | null;
}

/**
 * Next staff number for a tenant: EMP-0001, EMP-0002… Count+1 is
 * consistent with how this codebase numbers POs/CNs/GRNs; races are
 * resolved by the unique constraint (a rejected create fails loudly
 * rather than silently colliding).
 */
async function nextStaffNumber(tenantId: string): Promise<string> {
  const count = await db.employee.count({ where: { tenantId } });
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}

function toDate(value: Date | string | null | undefined, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) throw new HrError(`Invalid date for ${field}`);
  return d;
}

export async function createEmployee(input: CreateEmployeeInput) {
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    throw new HrError("firstName and lastName are required");
  }
  const startDate = toDate(input.startDate, "startDate");
  if (!startDate) throw new HrError("startDate is required");

  const employmentType = input.employmentType ?? "permanent";
  if (!EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYMENT_TYPES)[number])) {
    throw new HrError(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(", ")}`);
  }
  const basicSalary = Number(input.basicSalary ?? 0);
  if (!Number.isFinite(basicSalary) || basicSalary < 0) {
    throw new HrError("basicSalary must be a positive number");
  }

  const staffNumber = (input.staffNumber?.trim() || await nextStaffNumber(input.tenantId)).toUpperCase();
  const clash = await db.employee.findUnique({
    where: { tenantId_staffNumber: { tenantId: input.tenantId, staffNumber } },
    select: { id: true },
  });
  if (clash) throw new HrError(`Staff number ${staffNumber} is already in use`);

  const employee = await db.employee.create({
    data: {
      tenantId: input.tenantId,
      locationId: input.locationId ?? null,
      staffNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      jobTitle: input.jobTitle?.trim() || null,
      kraPin: input.kraPin?.trim() || null,
      nssfNumber: input.nssfNumber?.trim() || null,
      shaNumber: input.shaNumber?.trim() || null,
      bankAccount: input.bankAccount?.trim() || null,
      mpesaNumber: input.mpesaNumber?.trim() || null,
      employmentType,
      basicSalary,
      annualLeaveDays: input.annualLeaveDays ?? 21,
      startDate,
      endDate: toDate(input.endDate, "endDate"),
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.PAYROLL.EMPLOYEE_CREATED,
    module: "payroll",
    entity: "employee",
    entityId: employee.id,
    after: {
      staffNumber,
      name: `${employee.firstName} ${employee.lastName}`,
      employmentType,
      basicSalary,
    },
  });
  return employee;
}

/**
 * Updates an employee. Setting active=false archives them (they drop out
 * of future payroll runs but payslip history is untouched); Reactivating
 * is just another update. Salary changes only affect *future* runs —
 * approved/paid runs keep their frozen totals.
 */
export async function updateEmployee(
  tenantId: string,
  employeeId: string,
  changes: Partial<CreateEmployeeInput> & { active?: boolean },
  userId?: string | null
) {
  const existing = await db.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!existing) throw new HrError("Employee not found", 404);

  const data: Record<string, unknown> = {};
  if (changes.firstName !== undefined) data.firstName = String(changes.firstName).trim();
  if (changes.lastName !== undefined) data.lastName = String(changes.lastName).trim();
  if (changes.locationId !== undefined) data.locationId = changes.locationId;
  if (changes.email !== undefined) data.email = changes.email || null;
  if (changes.phone !== undefined) data.phone = changes.phone || null;
  if (changes.jobTitle !== undefined) data.jobTitle = changes.jobTitle || null;
  if (changes.kraPin !== undefined) data.kraPin = changes.kraPin || null;
  if (changes.nssfNumber !== undefined) data.nssfNumber = changes.nssfNumber || null;
  if (changes.shaNumber !== undefined) data.shaNumber = changes.shaNumber || null;
  if (changes.bankAccount !== undefined) data.bankAccount = changes.bankAccount || null;
  if (changes.mpesaNumber !== undefined) data.mpesaNumber = changes.mpesaNumber || null;
  if (changes.employmentType !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(changes.employmentType as (typeof EMPLOYMENT_TYPES)[number])) {
      throw new HrError(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(", ")}`);
    }
    data.employmentType = changes.employmentType;
  }
  if (changes.basicSalary !== undefined) {
    const salary = Number(changes.basicSalary);
    if (!Number.isFinite(salary) || salary < 0) throw new HrError("basicSalary must be a positive number");
    data.basicSalary = salary;
  }
  if (changes.annualLeaveDays !== undefined) data.annualLeaveDays = Number(changes.annualLeaveDays);
  if (changes.startDate !== undefined) {
    const d = toDate(changes.startDate, "startDate");
    if (!d) throw new HrError("startDate is required");
    data.startDate = d;
  }
  if (changes.endDate !== undefined) data.endDate = toDate(changes.endDate, "endDate");
  if (changes.active !== undefined) data.active = changes.active;
  if (changes.staffNumber !== undefined) {
    const staffNumber = String(changes.staffNumber).trim().toUpperCase();
    const clash = await db.employee.findUnique({
      where: { tenantId_staffNumber: { tenantId, staffNumber } },
      select: { id: true },
    });
    if (clash && clash.id !== employeeId) {
      throw new HrError(`Staff number ${staffNumber} is already in use`);
    }
    data.staffNumber = staffNumber;
  }

  if (Object.keys(data).length === 0) return existing;

  const updated = await db.employee.update({ where: { id: employeeId }, data });

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: changes.active === false
      ? AUDIT_ACTIONS.PAYROLL.EMPLOYEE_ARCHIVED
      : AUDIT_ACTIONS.PAYROLL.EMPLOYEE_UPDATED,
    module: "payroll",
    entity: "employee",
    entityId: employeeId,
    before: {
      active: existing.active,
      basicSalary: existing.basicSalary,
      employmentType: existing.employmentType,
    },
    after: { active: updated.active, basicSalary: updated.basicSalary },
  });
  return updated;
}

// ──────────────────────────────── leave ────────────────────────────────

export interface CreateLeaveInput {
  tenantId: string;
  employeeId: string;
  type?: string;
  startDate: Date | string;
  endDate: Date | string;
  reason?: string | null;
  createdBy?: string | null;
}

const DAY_MS = 86_400_000;

export async function createLeave(input: CreateLeaveInput) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, tenantId: input.tenantId },
    select: { id: true, active: true },
  });
  if (!employee) throw new HrError("Employee not found", 404);
  if (!employee.active) throw new HrError("Employee is archived");

  const startDate = toDate(input.startDate, "startDate");
  const endDate = toDate(input.endDate, "endDate");
  if (!startDate || !endDate) throw new HrError("startDate and endDate are required");
  if (endDate < startDate) throw new HrError("endDate must be on or after startDate");

  const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  const type = (input.type ?? "annual") as LeaveType;
  if (!LEAVE_TYPES.includes(type)) {
    throw new HrError(`leave type must be one of: ${LEAVE_TYPES.join(", ")}`);
  }

  const leave = await db.leaveRequest.create({
    data: {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      type,
      startDate,
      endDate,
      days,
      reason: input.reason?.trim() || null,
      status: "pending",
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.PAYROLL.LEAVE_REQUESTED,
    module: "payroll",
    entity: "leaveRequest",
    entityId: leave.id,
    after: { employeeId: input.employeeId, type, days, startDate, endDate },
  });
  return leave;
}

/** Approved annual leave already taken this year (the entitlement counter). */
export async function leaveUsedThisYear(tenantId: string, employeeId: string, year: number) {
  const rows = await db.leaveRequest.findMany({
    where: {
      tenantId,
      employeeId,
      type: "annual",
      status: "approved",
      startDate: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: { days: true },
  });
  return rows.reduce((sum, r) => sum + r.days, 0);
}

/**
 * Approves or rejects a pending request. Approving annual leave beyond
 * the remaining entitlement is refused — the balance check is the whole
 * point of tracking it (spec §6 HR expectations).
 */
export async function decideLeave(
  tenantId: string,
  leaveId: string,
  decision: "approved" | "rejected",
  approvedBy?: string | null
) {
  const leave = await db.leaveRequest.findFirst({ where: { id: leaveId, tenantId } });
  if (!leave) throw new HrError("Leave request not found", 404);
  if (leave.status !== "pending") throw new HrError(`Request is already ${leave.status}`);

  if (decision === "approved" && leave.type === "annual") {
    const employee = await db.employee.findFirst({
      where: { id: leave.employeeId, tenantId },
      select: { annualLeaveDays: true },
    });
    if (employee) {
      const year = leave.startDate.getFullYear();
      const used = await leaveUsedThisYear(tenantId, leave.employeeId, year);
      if (used + leave.days > employee.annualLeaveDays) {
        throw new HrError(
          `Only ${Math.max(employee.annualLeaveDays - used, 0)} of ${employee.annualLeaveDays} ` +
            `annual leave days remain for ${year} — request is for ${leave.days}`
        );
      }
    }
  }

  const updated = await db.leaveRequest.update({
    where: { id: leaveId },
    data: { status: decision, approvedBy: approvedBy ?? null },
  });

  await writeAuditLog({
    tenantId,
    userId: approvedBy ?? null,
    action: AUDIT_ACTIONS.PAYROLL.LEAVE_DECIDED,
    module: "payroll",
    entity: "leaveRequest",
    entityId: leaveId,
    before: { status: "pending" },
    after: { status: decision, type: leave.type, days: leave.days },
  });
  return updated;
}

// ─────────────────────────────── loans ─────────────────────────────────

export interface CreateLoanInput {
  tenantId: string;
  employeeId: string;
  principal: number;
  monthlyDeduction: number;
  reason?: string | null;
  startDate?: Date | string;
  createdBy?: string | null;
}

export async function createLoan(input: CreateLoanInput) {
  const principal = Number(input.principal);
  const monthlyDeduction = Number(input.monthlyDeduction);
  if (!Number.isFinite(principal) || principal <= 0) throw new HrError("principal must be > 0");
  if (!Number.isFinite(monthlyDeduction) || monthlyDeduction <= 0) {
    throw new HrError("monthlyDeduction must be > 0");
  }
  if (monthlyDeduction > principal) {
    throw new HrError("monthlyDeduction cannot exceed the principal");
  }

  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, tenantId: input.tenantId },
    select: { id: true, active: true, firstName: true, lastName: true },
  });
  if (!employee) throw new HrError("Employee not found", 404);
  if (!employee.active) throw new HrError("Cannot issue a loan to an archived employee");

  const loan = await db.employeeLoan.create({
    data: {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      principal,
      balance: principal,
      monthlyDeduction,
      reason: input.reason?.trim() || null,
      startDate: toDate(input.startDate, "startDate") ?? new Date(),
      createdBy: input.createdBy ?? null,
      status: "active",
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.PAYROLL.LOAN_ISSUED,
    module: "payroll",
    entity: "employeeLoan",
    entityId: loan.id,
    after: { employeeId: input.employeeId, principal, monthlyDeduction },
  });
  return loan;
}

/**
 * Settles a loan: "cleared" (repaid — used when the balance is written
 * off as settled outside payroll) or "written_off" (treated as a cost).
 * Payroll clears loans automatically as balances hit zero.
 */
export async function closeLoan(
  tenantId: string,
  loanId: string,
  status: "cleared" | "written_off",
  userId?: string | null
) {
  const loan = await db.employeeLoan.findFirst({ where: { id: loanId, tenantId } });
  if (!loan) throw new HrError("Loan not found", 404);
  if (loan.status !== "active") throw new HrError(`Loan is already ${loan.status}`);

  const updated = await db.employeeLoan.update({
    where: { id: loanId },
    data: { status, balance: status === "cleared" ? 0 : loan.balance },
  });

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.PAYROLL.LOAN_CLEARED,
    module: "payroll",
    entity: "employeeLoan",
    entityId: loanId,
    before: { status: "active", balance: loan.balance },
    after: { status, balance: updated.balance },
  });
  return updated;
}