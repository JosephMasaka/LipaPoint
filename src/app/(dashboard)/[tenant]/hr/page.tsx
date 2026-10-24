"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Pagination } from "@/components/pagination";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, X, CheckCircle, AlertCircle, Users, CalendarDays, HandCoins } from "lucide-react";

type Tab = "employees" | "leave" | "loans";

interface Employee {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  kraPin: string | null;
  employmentType: string;
  basicSalary: number;
  annualLeaveDays: number;
  startDate: string;
  active: boolean;
  leaveUsedThisYear?: number;
  leaveRemaining?: number;
  loanBalance?: number;
}

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  createdAt: string;
  employee: { id: string; staffNumber: string; firstName: string; lastName: string; annualLeaveDays: number };
}

interface Loan {
  id: string;
  principal: number;
  balance: number;
  monthlyDeduction: number;
  reason: string | null;
  status: string;
  startDate: string;
  employee: { id: string; staffNumber: string; firstName: string; lastName: string };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "employees", label: "Employees", icon: Users },
  { key: "leave", label: "Leave", icon: CalendarDays },
  { key: "loans", label: "Loans & Advances", icon: HandCoins },
];

const EMPLOYMENT_TYPES = ["permanent", "contract", "casual"];

const LEAVE_TYPES = ["annual", "sick", "maternity", "paternity", "unpaid", "compassionate"];

const LEAVE_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
};

const LOAN_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  active: "default",
  cleared: "success",
  written_off: "destructive",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const empName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

const EMPTY_PAGE: PaginationData = { page: 1, limit: 20, total: 0, totalPages: 0 };

export default function HrPage() {
  const [tab, setTab] = useState<Tab>("employees");

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empSearch, setEmpSearch] = useState("");
  const [empActive, setEmpActive] = useState("all");
  const [empPagination, setEmpPagination] = useState<PaginationData>({ ...EMPTY_PAGE, limit: 20 });
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    email: "",
    phone: "",
    kraPin: "",
    employmentType: "permanent",
    basicSalary: 0,
    annualLeaveDays: 21,
    startDate: "",
    mpesaNumber: "",
    bankAccount: "",
  });
  const [empFormError, setEmpFormError] = useState("");

  // Leave
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveStatus, setLeaveStatus] = useState("ALL");
  const [leavePagination, setLeavePagination] = useState<PaginationData>({ ...EMPTY_PAGE, limit: 20 });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employeeId: "", type: "annual", startDate: "", endDate: "", reason: "" });
  const [leaveFormError, setLeaveFormError] = useState("");

  // Loans
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanLoading, setLoanLoading] = useState(true);
  const [loanStatus, setLoanStatus] = useState("ALL");
  const [loanPagination, setLoanPagination] = useState<PaginationData>({ ...EMPTY_PAGE, limit: 20 });
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanForm, setLoanForm] = useState({ employeeId: "", principal: 0, monthlyDeduction: 0, reason: "", startDate: "" });
  const [loanFormError, setLoanFormError] = useState("");

  // Shared: employee picker for leave/loan forms
  const [pickerEmployees, setPickerEmployees] = useState<Employee[]>([]);

  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Employees ──
  const fetchEmployees = useCallback(
    async (page = 1) => {
      try {
        setEmpLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (empSearch) params.set("search", empSearch);
        if (empActive !== "all") params.set("active", empActive);
        const res = await fetch(`/api/hr/employees?${params}`);
        if (res.ok) {
          const d = await res.json();
          setEmployees(d.employees);
          setEmpPagination(d.pagination);
        }
      } catch {
        // silent fail
      } finally {
        setEmpLoading(false);
      }
    },
    [empSearch, empActive]
  );

  useEffect(() => {
    if (tab !== "employees") return;
    const timer = setTimeout(() => fetchEmployees(1), 250);
    return () => clearTimeout(timer);
  }, [tab, fetchEmployees]);

  // ── Leave ──
  const fetchLeave = useCallback(
    async (page = 1) => {
      try {
        setLeaveLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (leaveStatus !== "ALL") params.set("status", leaveStatus);
        const res = await fetch(`/api/hr/leave?${params}`);
        if (res.ok) {
          const d = await res.json();
          setLeaveRequests(d.requests);
          setLeavePagination(d.pagination);
        }
      } catch {
        // silent fail
      } finally {
        setLeaveLoading(false);
      }
    },
    [leaveStatus]
  );

  useEffect(() => {
    if (tab === "leave") fetchLeave(1);
  }, [tab, fetchLeave]);

  // ── Loans ──
  const fetchLoans = useCallback(
    async (page = 1) => {
      try {
        setLoanLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (loanStatus !== "ALL") params.set("status", loanStatus);
        const res = await fetch(`/api/hr/loans?${params}`);
        if (res.ok) {
          const d = await res.json();
          setLoans(d.loans);
          setLoanPagination(d.pagination);
        }
      } catch {
        // silent fail
      } finally {
        setLoanLoading(false);
      }
    },
    [loanStatus]
  );

  useEffect(() => {
    if (tab === "loans") fetchLoans(1);
  }, [tab, fetchLoans]);

  // Employee picker (loaded once, on first form open)
  useEffect(() => {
    if (pickerEmployees.length > 0) return;
    if (!showLeaveForm && !showLoanForm) return;
    fetch("/api/hr/employees?limit=200&active=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPickerEmployees(d.employees))
      .catch(() => {});
  }, [showLeaveForm, showLoanForm, pickerEmployees.length]);

  // ── Actions ──
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpFormError("");
    try {
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setEmpFormError(d.error || "Failed to create employee");
        return;
      }
      setShowEmpForm(false);
      setEmpForm({
        firstName: "", lastName: "", jobTitle: "", email: "", phone: "", kraPin: "",
        employmentType: "permanent", basicSalary: 0, annualLeaveDays: 21,
        startDate: "", mpesaNumber: "", bankAccount: "",
      });
      notify("success", "Employee file created");
      fetchEmployees(1);
    } catch {
      setEmpFormError("Network error");
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Update failed");
        return;
      }
      notify("success", emp.active ? `${empName(emp)} archived` : `${empName(emp)} reactivated`);
      fetchEmployees(empPagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveFormError("");
    try {
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setLeaveFormError(d.error || "Failed to raise leave request");
        return;
      }
      setShowLeaveForm(false);
      setLeaveForm({ employeeId: "", type: "annual", startDate: "", endDate: "", reason: "" });
      notify("success", "Leave request raised (pending approval)");
      fetchLeave(1);
    } catch {
      setLeaveFormError("Network error");
    }
  };

  const handleDecideLeave = async (id: string, decision: "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/hr/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Decision failed");
        return;
      }
      notify("success", `Leave ${decision}`);
      fetchLeave(leavePagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanFormError("");
    try {
      const res = await fetch("/api/hr/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loanForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setLoanFormError(d.error || "Failed to issue loan");
        return;
      }
      setShowLoanForm(false);
      setLoanForm({ employeeId: "", principal: 0, monthlyDeduction: 0, reason: "", startDate: "" });
      notify("success", "Loan issued — repayments start with the next payroll run");
      fetchLoans(1);
    } catch {
      setLoanFormError("Network error");
    }
  };

  const handleCloseLoan = async (id: string, action: "clear" | "write_off") => {
    try {
      const res = await fetch(`/api/hr/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Update failed");
        return;
      }
      notify("success", action === "clear" ? "Loan cleared" : "Loan written off");
      fetchLoans(loanPagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Human Resources" subtitle="Employee files, leave and staff loans" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                tab === t.key
                  ? "bg-gold/10 text-gold border border-gold/30"
                  : "bg-surface-elevated text-text-secondary border border-border hover:text-text-primary"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ── Employees ── */}
        {tab === "employees" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Search"
                placeholder="Name, staff no., job title…"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="w-auto"
              />
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Status</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                  value={empActive}
                  onChange={(e) => setEmpActive(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="true">Active</option>
                  <option value="false">Archived</option>
                </select>
              </div>
              <Button onClick={() => setShowEmpForm(true)} className="gap-2 w-fit">
                <Plus className="h-4 w-4" /> New Employee
              </Button>
            </div>

            {showEmpForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEmpForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">New Employee File</h3>
                    <button onClick={() => setShowEmpForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateEmployee} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {empFormError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {empFormError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="First name" value={empForm.firstName} onChange={(e) => setEmpForm({ ...empForm, firstName: e.target.value })} required />
                      <Input label="Last name" value={empForm.lastName} onChange={(e) => setEmpForm({ ...empForm, lastName: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Job title" placeholder="e.g. Chef" value={empForm.jobTitle} onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })} />
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1.5 block">Employment type</label>
                        <select
                          className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                          value={empForm.employmentType}
                          onChange={(e) => setEmpForm({ ...empForm, employmentType: e.target.value })}
                        >
                          {EMPLOYMENT_TYPES.map((t) => (
                            <option key={t} value={t} className="capitalize">{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Email" type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
                      <Input label="Phone" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Input label="KRA PIN" value={empForm.kraPin} onChange={(e) => setEmpForm({ ...empForm, kraPin: e.target.value })} />
                      <Input label="M-Pesa no." value={empForm.mpesaNumber} onChange={(e) => setEmpForm({ ...empForm, mpesaNumber: e.target.value })} />
                      <Input label="Bank account" value={empForm.bankAccount} onChange={(e) => setEmpForm({ ...empForm, bankAccount: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        label="Basic salary (KES/mo)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={empForm.basicSalary || ""}
                        onChange={(e) => setEmpForm({ ...empForm, basicSalary: Number(e.target.value) })}
                      />
                      <Input
                        label="Annual leave days"
                        type="number"
                        min="0"
                        value={empForm.annualLeaveDays}
                        onChange={(e) => setEmpForm({ ...empForm, annualLeaveDays: Number(e.target.value) })}
                      />
                      <Input label="Start date" type="date" value={empForm.startDate} onChange={(e) => setEmpForm({ ...empForm, startDate: e.target.value })} required />
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Staff number is assigned automatically (EMP-0001…). Salary drives statutory payroll — it only affects future runs.
                    </p>
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEmpForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Create Employee</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Staff no.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Job title</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Salary</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Leave left</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Loan bal.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {empLoading ? (
                        <tr><td colSpan={9} className="px-4 py-12"><Loader label="Loading employees..." className="py-4" /></td></tr>
                      ) : employees.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-12 text-center text-text-muted">No employees found.</td></tr>
                      ) : employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 font-mono text-xs text-text-primary">{emp.staffNumber}</td>
                          <td className="px-4 py-3 text-text-primary">{empName(emp)}</td>
                          <td className="px-4 py-3 text-text-secondary">{emp.jobTitle || "—"}</td>
                          <td className="px-4 py-3 text-text-secondary capitalize">{emp.employmentType}</td>
                          <td className="px-4 py-3 text-right text-text-primary">{formatCurrency(emp.basicSalary)}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {emp.leaveRemaining ?? 0} / {emp.annualLeaveDays}
                          </td>
                          <td className={cn("px-4 py-3 text-right", (emp.loanBalance ?? 0) > 0 ? "text-amber-400" : "text-text-muted")}>
                            {(emp.loanBalance ?? 0) > 0 ? formatCurrency(emp.loanBalance!) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={emp.active ? "success" : "secondary"}>{emp.active ? "active" : "archived"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end items-center gap-1">
                              <Link
                                href={`/print/p9/${emp.id}`}
                                target="_blank"
                                title={`Print P9 for ${emp.firstName} ${emp.lastName}`}
                                className="px-2 py-1 rounded text-xs text-text-secondary hover:text-gold"
                              >
                                P9
                              </Link>
                              <Button variant="ghost" size="sm" onClick={() => handleToggleActive(emp)}>
                                {emp.active ? "Archive" : "Reactivate"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={empPagination.page}
                  totalPages={empPagination.totalPages}
                  totalItems={empPagination.total}
                  pageSize={empPagination.limit}
                  onPageChange={(page) => fetchEmployees(page)}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Leave ── */}
        {tab === "leave" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Status</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                  value={leaveStatus}
                  onChange={(e) => setLeaveStatus(e.target.value)}
                >
                  <option value="ALL">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <Button onClick={() => setShowLeaveForm(true)} className="gap-2 w-fit">
                <Plus className="h-4 w-4" /> New Request
              </Button>
            </div>

            {showLeaveForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLeaveForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">New Leave Request</h3>
                    <button onClick={() => setShowLeaveForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateLeave} className="p-4 space-y-4">
                    {leaveFormError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{leaveFormError}</div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Employee</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={leaveForm.employeeId}
                        onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}
                        required
                      >
                        <option value="">Select employee…</option>
                        {pickerEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.staffNumber} — {empName(emp)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Type</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary capitalize"
                        value={leaveForm.type}
                        onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                      >
                        {LEAVE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="From" type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
                      <Input label="To" type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
                    </div>
                    <Input label="Reason" placeholder="e.g. Annual leave" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowLeaveForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Raise Request</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[820px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">From</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">To</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Days</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leaveLoading ? (
                        <tr><td colSpan={8} className="px-4 py-12"><Loader label="Loading leave requests..." className="py-4" /></td></tr>
                      ) : leaveRequests.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">No leave requests found.</td></tr>
                      ) : leaveRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 text-text-primary">
                            {empName(req.employee)}
                            <span className="ml-2 font-mono text-[11px] text-text-muted">{req.employee.staffNumber}</span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary capitalize">{req.type}</td>
                          <td className="px-4 py-3 text-text-secondary">{fmtDate(req.startDate)}</td>
                          <td className="px-4 py-3 text-text-secondary">{fmtDate(req.endDate)}</td>
                          <td className="px-4 py-3 text-right text-text-primary">{req.days}</td>
                          <td className="px-4 py-3 text-text-secondary truncate max-w-[200px]">{req.reason || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={LEAVE_STATUS_VARIANT[req.status] ?? "secondary"}>{req.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {req.status === "pending" ? (
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300" onClick={() => handleDecideLeave(req.id, "approved")}>
                                  Approve
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDecideLeave(req.id, "rejected")}>
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={leavePagination.page}
                  totalPages={leavePagination.totalPages}
                  totalItems={leavePagination.total}
                  pageSize={leavePagination.limit}
                  onPageChange={(page) => fetchLeave(page)}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Loans ── */}
        {tab === "loans" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Status</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                  value={loanStatus}
                  onChange={(e) => setLoanStatus(e.target.value)}
                >
                  <option value="ALL">All</option>
                  <option value="active">Active</option>
                  <option value="cleared">Cleared</option>
                  <option value="written_off">Written off</option>
                </select>
              </div>
              <Button onClick={() => setShowLoanForm(true)} className="gap-2 w-fit">
                <Plus className="h-4 w-4" /> Issue Loan
              </Button>
            </div>

            {showLoanForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLoanForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">Issue Staff Loan / Advance</h3>
                    <button onClick={() => setShowLoanForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateLoan} className="p-4 space-y-4">
                    {loanFormError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loanFormError}</div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Employee</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={loanForm.employeeId}
                        onChange={(e) => setLoanForm({ ...loanForm, employeeId: e.target.value })}
                        required
                      >
                        <option value="">Select employee…</option>
                        {pickerEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.staffNumber} — {empName(emp)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Principal (KES)"
                        type="number"
                        min="1"
                        step="0.01"
                        value={loanForm.principal || ""}
                        onChange={(e) => setLoanForm({ ...loanForm, principal: Number(e.target.value) })}
                        required
                      />
                      <Input
                        label="Monthly deduction"
                        type="number"
                        min="1"
                        step="0.01"
                        value={loanForm.monthlyDeduction || ""}
                        onChange={(e) => setLoanForm({ ...loanForm, monthlyDeduction: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Start date" type="date" value={loanForm.startDate} onChange={(e) => setLoanForm({ ...loanForm, startDate: e.target.value })} />
                      <Input label="Reason" placeholder="e.g. School fees advance" value={loanForm.reason} onChange={(e) => setLoanForm({ ...loanForm, reason: e.target.value })} />
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Deductions are applied automatically at each payroll run until the balance clears.
                    </p>
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowLoanForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Issue Loan</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[820px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Issued</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Principal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Balance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Monthly</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loanLoading ? (
                        <tr><td colSpan={8} className="px-4 py-12"><Loader label="Loading loans..." className="py-4" /></td></tr>
                      ) : loans.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">No staff loans found.</td></tr>
                      ) : loans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 text-text-primary">
                            {empName(loan.employee)}
                            <span className="ml-2 font-mono text-[11px] text-text-muted">{loan.employee.staffNumber}</span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{fmtDate(loan.startDate)}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(loan.principal)}</td>
                          <td className={cn("px-4 py-3 text-right font-medium", loan.balance > 0 ? "text-amber-400" : "text-text-muted")}>
                            {formatCurrency(loan.balance)}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(loan.monthlyDeduction)}</td>
                          <td className="px-4 py-3 text-text-secondary truncate max-w-[180px]">{loan.reason || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={LOAN_STATUS_VARIANT[loan.status] ?? "secondary"}>{loan.status.replace("_", " ")}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {loan.status === "active" ? (
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300" onClick={() => handleCloseLoan(loan.id, "clear")}>
                                  Clear
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleCloseLoan(loan.id, "write_off")}>
                                  Write off
                                </Button>
                              </div>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={loanPagination.page}
                  totalPages={loanPagination.totalPages}
                  totalItems={loanPagination.total}
                  pageSize={loanPagination.limit}
                  onPageChange={(page) => fetchLoans(page)}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}