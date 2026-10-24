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
import {
  Plus, X, CheckCircle, AlertCircle, Play, FileCheck2, Trash2,
  Download, ScrollText, Landmark, AlertTriangle, Printer,
} from "lucide-react";

type Tab = "runs" | "rates";

interface RunSummary {
  id: string;
  period: string;
  status: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  totalEmployerCost: number;
  bankAccount: { id: string; name: string } | null;
  _count: { payslips: number };
}

interface Payslip {
  id: string;
  grossPay: number;
  nssfEmployee: number;
  nssfEmployer: number;
  shif: number;
  housingLevyEmployee: number;
  housingLevyEmployer: number;
  taxablePay: number;
  paye: number;
  personalRelief: number;
  payePayable: number;
  otherDeductions: number;
  loanDeduction: number;
  netPay: number;
  nitaLevy: number;
  employee: {
    id: string;
    staffNumber: string;
    firstName: string;
    lastName: string;
    employmentType: string;
    jobTitle: string | null;
  };
}

interface RunDetail extends RunSummary {
  payslips: Payslip[];
  bankAccountId: string | null;
  journalEntryId: string | null;
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
}

interface PayeBand {
  upTo: number | null;
  rate: number;
}

interface RateVersion {
  id: string;
  label: string;
  effectiveFrom: string;
  isDefault: boolean;
  scope: "platform" | "tenant";
  payeBands: PayeBand[];
  personalRelief: number;
  nssfRateEmployee: number;
  nssfRateEmployer: number;
  nssfTier1Cap: number;
  nssfTier2Cap: number;
  shifRate: number;
  shifMinimum: number;
  housingLevyRate: number;
  nitaLevyPerEmployee: number;
}

interface RatesResponse {
  period: string;
  current: RateVersion;
  versions: RateVersion[];
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "runs", label: "Payroll Runs", icon: ScrollText },
  { key: "rates", label: "Statutory Rates", icon: Landmark },
];

const RUN_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "warning",
  approved: "default",
  paid: "success",
  filed: "secondary",
};

const fmtPeriod = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
};

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>("runs");

  // Runs list
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [runsPagination, setRunsPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [newPeriod, setNewPeriod] = useState("");
  const [creating, setCreating] = useState(false);
  const [p9Year, setP9Year] = useState(String(new Date().getFullYear()));

  // Run detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payBankId, setPayBankId] = useState("");

  // Rates
  const [rates, setRates] = useState<RatesResponse | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateFormError, setRateFormError] = useState("");
  const [rateForm, setRateForm] = useState<{
    label: string;
    effectiveFrom: string;
    bands: { upTo: string; rate: string }[];
    personalRelief: number;
    nssfRateEmployee: number;
    nssfRateEmployer: number;
    nssfTier1Cap: number;
    nssfTier2Cap: number;
    shifRate: number;
    shifMinimum: number;
    housingLevyRate: number;
    nitaLevyPerEmployee: number;
  } | null>(null);

  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Runs ──
  const fetchRuns = useCallback(
    async (page = 1) => {
      try {
        setRunsLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        const res = await fetch(`/api/payroll/runs?${params}`);
        if (res.ok) {
          const d = await res.json();
          setRuns(d.runs);
          setRunsPagination(d.pagination);
          setActiveEmployees(d.activeEmployees ?? 0);
        }
      } catch {
        // silent fail
      } finally {
        setRunsLoading(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    if (tab !== "runs") return;
    fetchRuns(1);
  }, [tab, fetchRuns]);

  // ── Detail ──
  const fetchDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/payroll/runs/${id}`);
      if (res.ok) setDetail(await res.json());
      else if (res.status === 404) setSelectedId(null);
    } catch {
      // silent fail
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  // Bank wallets for the pay dialog
  useEffect(() => {
    if (!showPayForm || bankAccounts.length > 0) return;
    fetch("/api/bank-accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Array.isArray(d) && setBankAccounts(d))
      .catch(() => {});
  }, [showPayForm, bankAccounts.length]);

  // ── Rates ──
  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await fetch("/api/payroll/rates");
      if (res.ok) setRates(await res.json());
    } catch {
      // silent fail
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "rates") fetchRates();
  }, [tab, fetchRates]);

  // Prefill the version form from the rates currently in force.
  const openRateForm = () => {
    const cur = rates?.current;
    setRateFormError("");
    setRateForm({
      label: `Kenya statutory correction — ${new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })}`,
      effectiveFrom: "",
      bands: cur
        ? cur.payeBands.map((b) => ({
            upTo: b.upTo === null ? "" : String(b.upTo),
            rate: String(b.rate),
          }))
        : [{ upTo: "", rate: "" }],
      personalRelief: cur?.personalRelief ?? 2400,
      nssfRateEmployee: cur?.nssfRateEmployee ?? 6,
      nssfRateEmployer: cur?.nssfRateEmployer ?? 6,
      nssfTier1Cap: cur?.nssfTier1Cap ?? 8000,
      nssfTier2Cap: cur?.nssfTier2Cap ?? 108000,
      shifRate: cur?.shifRate ?? 2.75,
      shifMinimum: cur?.shifMinimum ?? 300,
      housingLevyRate: cur?.housingLevyRate ?? 1.5,
      nitaLevyPerEmployee: cur?.nitaLevyPerEmployee ?? 50,
    });
    setShowRateForm(true);
  };

  const submitRateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateForm) return;
    setRateFormError("");
    try {
      const payload = {
        label: rateForm.label,
        effectiveFrom: rateForm.effectiveFrom,
        payeBands: rateForm.bands.map((b) => ({
          upTo: b.upTo.trim() === "" ? null : Number(b.upTo),
          rate: Number(b.rate),
        })),
        personalRelief: Number(rateForm.personalRelief),
        nssfRateEmployee: Number(rateForm.nssfRateEmployee),
        nssfRateEmployer: Number(rateForm.nssfRateEmployer),
        nssfTier1Cap: Number(rateForm.nssfTier1Cap),
        nssfTier2Cap: Number(rateForm.nssfTier2Cap),
        shifRate: Number(rateForm.shifRate),
        shifMinimum: Number(rateForm.shifMinimum),
        housingLevyRate: Number(rateForm.housingLevyRate),
        nitaLevyPerEmployee: Number(rateForm.nitaLevyPerEmployee),
      };
      const res = await fetch("/api/payroll/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setRateFormError(d.error || "Failed to add rate version");
        return;
      }
      setShowRateForm(false);
      notify(
        "success",
        `Rate version effective ${payload.effectiveFrom} added — future runs only, past payslips keep their original rates`
      );
      fetchRates();
    } catch {
      setRateFormError("Network error");
    }
  };

  // ── Actions ──
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriod) return;
    setCreating(true);
    try {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: newPeriod }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify("error", d.error || "Failed to create run");
        return;
      }
      notify("success", `Draft run for ${fmtPeriod(newPeriod)} created with ${d.payslips?.length ?? 0} payslip(s)`);
      setNewPeriod("");
      fetchRuns(1);
      setSelectedId(d.id);
    } catch {
      notify("error", "Network error");
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (action: "approve" | "pay" | "file", bankAccountId?: string) => {
    if (!selectedId) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, bankAccountId }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify("error", d.error || `Failed to ${action} run`);
        return;
      }
      const messages: Record<string, string> = {
        approve: "Run approved — payslips frozen for this period",
        pay: "Run marked paid — journal entry posted to the GL",
        file: "Run marked filed",
      };
      notify("success", messages[action]);
      setShowPayForm(false);
      fetchDetail(selectedId);
      fetchRuns(runsPagination.page);
    } catch {
      notify("error", "Network error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!selectedId) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${selectedId}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify("error", d.error || "Failed to delete run");
        return;
      }
      notify("success", "Draft run deleted");
      setSelectedId(null);
      fetchRuns(runsPagination.page);
    } catch {
      notify("error", "Network error");
    } finally {
      setActionBusy(false);
    }
  };

  const current = rates?.current;

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Payroll" subtitle="Kenya statutory payroll — PAYE, NSSF, SHIF and Housing Levy" />

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

        {/* ── Runs ── */}
        {tab === "runs" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <form onSubmit={handleCreateRun} className="flex items-end gap-2">
                <Input
                  label="Period"
                  type="month"
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  required
                  className="w-auto"
                />
                <Button type="submit" className="gap-2" disabled={creating}>
                  <Plus className="h-4 w-4" /> {creating ? "Creating…" : "New Run"}
                </Button>
              </form>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Status</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="filed">Filed</option>
                </select>
              </div>

              <div className="flex items-end gap-2 ml-auto">
                <Input
                  label="P9 year"
                  type="number"
                  min="2020"
                  max="2100"
                  value={p9Year}
                  onChange={(e) => setP9Year(e.target.value)}
                  className="w-auto"
                />
                <a href={`/api/payroll/p9?year=${p9Year}`} download>
                  <Button type="button" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> P9 Export
                  </Button>
                </a>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              {activeEmployees} active employee{activeEmployees === 1 ? "" : "s"} on file. Draft → approved → paid → filed:
              the GL entry posts when the run is marked <span className="text-text-secondary">paid</span>.
            </p>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[840px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Payslips</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Gross</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Deductions</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Net pay</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Employer cost</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Wallet</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {runsLoading ? (
                        <tr><td colSpan={9} className="px-4 py-12"><Loader label="Loading payroll runs..." className="py-4" /></td></tr>
                      ) : runs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-text-muted">
                            No payroll runs yet — create one for the current month to preview payslips.
                          </td>
                        </tr>
                      ) : runs.map((run) => (
                        <tr
                          key={run.id}
                          className={cn(
                            "hover:bg-surface-hover/50 cursor-pointer transition-colors",
                            selectedId === run.id && "bg-gold/5"
                          )}
                          onClick={() => setSelectedId(selectedId === run.id ? null : run.id)}
                        >
                          <td className="px-4 py-3 text-text-primary font-medium">{fmtPeriod(run.period)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={RUN_STATUS_VARIANT[run.status] ?? "secondary"}>{run.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">{run._count.payslips}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(run.grossPay)}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(run.totalDeductions)}</td>
                          <td className="px-4 py-3 text-right text-text-primary font-medium">{formatCurrency(run.netPay)}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(run.totalEmployerCost)}</td>
                          <td className="px-4 py-3 text-text-secondary">{run.bankAccount?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-xs text-gold">{selectedId === run.id ? "Close" : "View"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={runsPagination.page}
                  totalPages={runsPagination.totalPages}
                  totalItems={runsPagination.total}
                  pageSize={runsPagination.limit}
                  onPageChange={(page) => fetchRuns(page)}
                />
              </CardContent>
            </Card>

            {/* ── Run detail ── */}
            {selectedId && (
              detailLoading && !detail ? (
                <Card><CardContent className="p-8"><Loader label="Loading run..." className="py-4" /></CardContent></Card>
              ) : detail ? (
                <Card>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-text-primary">{fmtPeriod(detail.period)}</h2>
                        <Badge variant={RUN_STATUS_VARIANT[detail.status] ?? "secondary"}>{detail.status}</Badge>
                        <span className="text-xs text-text-muted">{detail.payslips.length} payslip(s)</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {detail.status === "draft" && (
                          <>
                            <Button size="sm" className="gap-2" disabled={actionBusy} onClick={() => runAction("approve")}>
                              <CheckCircle className="h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-2" disabled={actionBusy} onClick={handleDeleteRun}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          </>
                        )}
                        {detail.status === "approved" && (
                          <Button size="sm" className="gap-2" disabled={actionBusy} onClick={() => setShowPayForm(true)}>
                            <Play className="h-4 w-4" /> Mark Paid
                          </Button>
                        )}
                        {detail.status === "paid" && (
                          <Button size="sm" className="gap-2" disabled={actionBusy} onClick={() => runAction("file")}>
                            <FileCheck2 className="h-4 w-4" /> Mark Filed
                          </Button>
                        )}
                        <a href={`/api/payroll/runs/${detail.id}/export?format=register`} download>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Download className="h-4 w-4" /> Payslips CSV
                          </Button>
                        </a>
                        <a href={`/api/payroll/runs/${detail.id}/export?format=bank`} download>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Download className="h-4 w-4" /> Bank Batch
                          </Button>
                        </a>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs min-w-[960px]">
                        <thead>
                          <tr className="bg-surface-elevated/60">
                            <th className="px-3 py-2 text-left text-text-secondary uppercase">Employee</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">Gross</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">NSSF</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">SHIF</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">AHL</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">Taxable</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">PAYE</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">Other ded.</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase">Net pay</th>
                            <th className="px-3 py-2 text-right text-text-secondary uppercase w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {detail.payslips.map((p) => (
                            <tr key={p.id} className="hover:bg-surface-hover/50">
                              <td className="px-3 py-2 text-text-primary">
                                {p.employee.firstName} {p.employee.lastName}
                                <span className="ml-2 font-mono text-[10px] text-text-muted">{p.employee.staffNumber}</span>
                              </td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.grossPay)}</td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.nssfEmployee)}</td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.shif)}</td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.housingLevyEmployee)}</td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.taxablePay)}</td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.payePayable)}</td>
                              <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(p.otherDeductions)}</td>
                              <td className="px-3 py-2 text-right text-text-primary font-medium">{formatCurrency(p.netPay)}</td>
                              <td className="px-3 py-2 text-right">
                                <Link
                                  href={`/print/payslip/${p.id}`}
                                  target="_blank"
                                  title="Print payslip (Save as PDF)"
                                  className="text-text-muted hover:text-gold"
                                >
                                  <Printer className="h-3.5 w-3.5 inline" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-surface-elevated/60 font-medium">
                            <td className="px-3 py-2 text-text-secondary">Totals</td>
                            <td className="px-3 py-2 text-right text-text-primary">{formatCurrency(detail.grossPay)}</td>
                            <td className="px-3 py-2 text-right text-text-secondary">—</td>
                            <td className="px-3 py-2 text-right text-text-secondary">—</td>
                            <td className="px-3 py-2 text-right text-text-secondary">—</td>
                            <td className="px-3 py-2 text-right text-text-secondary">—</td>
                            <td className="px-3 py-2 text-right text-text-secondary">—</td>
                            <td className="px-3 py-2 text-right text-text-secondary">{formatCurrency(detail.totalDeductions)}</td>
                            <td className="px-3 py-2 text-right text-text-primary">{formatCurrency(detail.netPay)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <p className="text-[11px] text-text-muted">
                      PAYE shown is after personal relief (what is actually withheld). Source journal entry:{" "}
                      {detail.journalEntryId ? (
                        <span className="font-mono text-emerald-400">posted</span>
                      ) : (
                        <span>not yet posted — posted once on payment</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              ) : null
            )}

            {/* ── Pay dialog ── */}
            {showPayForm && detail && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">Mark {fmtPeriod(detail.period)} Paid</h3>
                    <button onClick={() => setShowPayForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Pay from wallet</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={payBankId}
                        onChange={(e) => setPayBankId(e.target.value)}
                      >
                        <option value="">Default bank account (1040)</option>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Net pay of <span className="text-text-primary font-medium">{formatCurrency(detail.netPay)}</span> leaves the
                      wallet. This posts DR Salaries / CR payables & wallet, settles active loans and records the bank outflow —
                      it cannot be undone, so check the figures first.
                    </p>
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPayForm(false)}>Cancel</Button>
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={actionBusy}
                        onClick={() => runAction("pay", payBankId || undefined)}
                      >
                        {actionBusy ? "Posting…" : "Mark Paid"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Statutory rates ── */}
        {tab === "rates" && (
          <>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Rates are versioned, never hardcoded: each payslip records the rate table it was computed with. Verify the table
                below against the latest KRA / NSSF / SHA notices before filing — correct a rate by adding a row with a later
                effective date, never by editing past runs.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-muted">
                Rate versions are scoped to this business: your overrides layer on top of the shared
                platform default and never change another tenant&apos;s payroll.
              </p>
              <Button size="sm" className="gap-2" onClick={openRateForm}>
                <Plus className="h-4 w-4" /> New Rate Version
              </Button>
            </div>

            {ratesLoading ? (
              <Card><CardContent className="p-8"><Loader label="Loading statutory rates..." className="py-4" /></CardContent></Card>
            ) : current ? (
              <>
                <Card>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-text-primary">
                        Rates in force — {fmtPeriod(rates!.period)}
                      </h2>
                      <Badge variant="secondary">{current.label}</Badge>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-medium text-text-secondary uppercase mb-2">PAYE bands (monthly)</h3>
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-border">
                            {current.payeBands.map((band, i) => (
                              <tr key={i}>
                                <td className="py-1.5 text-text-secondary">
                                  {band.upTo === null
                                    ? "Above"
                                    : i === 0
                                      ? `0 – ${formatCurrency(band.upTo)}`
                                      : `– ${formatCurrency(band.upTo)}`}
                                </td>
                                <td className="py-1.5 text-right text-text-primary font-medium">{band.rate}%</td>
                              </tr>
                            ))}
                            <tr>
                              <td className="py-1.5 text-text-secondary">Personal relief</td>
                              <td className="py-1.5 text-right text-text-primary font-medium">{formatCurrency(current.personalRelief)}/mo</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <h3 className="text-xs font-medium text-text-secondary uppercase mb-2">Contributions & levies</h3>
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="py-1.5 text-text-secondary">NSSF (employee + employer)</td>
                              <td className="py-1.5 text-right text-text-primary font-medium">
                                {current.nssfRateEmployee}% + {current.nssfRateEmployer}%
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-text-secondary">NSSF Tier I / Tier II ceilings</td>
                              <td className="py-1.5 text-right text-text-primary font-medium">
                                {formatCurrency(current.nssfTier1Cap)} / {formatCurrency(current.nssfTier2Cap)}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-text-secondary">SHIF (employee, min {formatCurrency(current.shifMinimum)})</td>
                              <td className="py-1.5 text-right text-text-primary font-medium">{current.shifRate}%</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-text-secondary">Housing Levy (each side)</td>
                              <td className="py-1.5 text-right text-text-primary font-medium">{current.housingLevyRate}%</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-text-secondary">NITA levy (employer)</td>
                              <td className="py-1.5 text-right text-text-primary font-medium">
                                {formatCurrency(current.nitaLevyPerEmployee)}/yr
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[600px]">
                        <thead>
                          <tr className="border-b border-border bg-surface-elevated/50">
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Effective from</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Label</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Source</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Relief</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">SHIF</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">NSSF cap</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rates!.versions.map((v) => (
                            <tr key={v.id} className="hover:bg-surface-hover/50">
                              <td className="px-4 py-3 text-text-primary">
                                {new Date(v.effectiveFrom).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                              </td>
                              <td className="px-4 py-3 text-text-secondary">{v.label}</td>
                              <td className="px-4 py-3">
                                <Badge variant={v.scope === "tenant" ? "default" : "secondary"}>
                                  {v.scope === "tenant" ? "your override" : "platform default"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(v.personalRelief)}</td>
                              <td className="px-4 py-3 text-right text-text-secondary">{v.shifRate}%</td>
                              <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(v.nssfTier2Cap)}</td>
                              <td className="px-4 py-3 text-right">
                                {v.isDefault && <Badge variant="secondary">default</Badge>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* ── New rate version ── */}
                {showRateForm && rateForm && (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRateForm(false)} />
                    <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                      <div className="flex items-center justify-between p-4 border-b border-border">
                        <h3 className="text-lg font-bold text-text-primary">New Statutory Rate Version</h3>
                        <button onClick={() => setShowRateForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <form onSubmit={submitRateVersion} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                        {rateFormError && (
                          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {rateFormError}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Label"
                            value={rateForm.label}
                            onChange={(e) => setRateForm({ ...rateForm, label: e.target.value })}
                            required
                          />
                          <Input
                            label="Effective from"
                            type="date"
                            value={rateForm.effectiveFrom}
                            onChange={(e) => setRateForm({ ...rateForm, effectiveFrom: e.target.value })}
                            required
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-text-secondary mb-1.5 block">PAYE bands (monthly)</label>
                          <div className="space-y-2">
                            {rateForm.bands.map((b, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-xs text-text-muted w-6 text-right">{i + 1}.</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder={i === rateForm.bands.length - 1 ? "open-ended" : "up to"}
                                  value={b.upTo}
                                  onChange={(e) =>
                                    setRateForm({
                                      ...rateForm,
                                      bands: rateForm.bands.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)),
                                    })
                                  }
                                  className="flex-1"
                                />
                                <span className="text-xs text-text-muted">at</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={b.rate}
                                  onChange={(e) =>
                                    setRateForm({
                                      ...rateForm,
                                      bands: rateForm.bands.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)),
                                    })
                                  }
                                  className="w-24"
                                />
                                <span className="text-xs text-text-muted">%</span>
                                {rateForm.bands.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label="Remove band"
                                    onClick={() =>
                                      setRateForm({ ...rateForm, bands: rateForm.bands.filter((_, j) => j !== i) })
                                    }
                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setRateForm({ ...rateForm, bands: [...rateForm.bands, { upTo: "", rate: "" }] })
                              }
                              className="text-xs text-gold hover:underline"
                            >
                              + Add band
                            </button>
                            <p className="text-[11px] text-text-muted">
                              Leave the cap empty on the last band for the open-ended top band.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <Input
                            label="Personal relief"
                            type="number"
                            min="0"
                            step="0.01"
                            value={rateForm.personalRelief}
                            onChange={(e) => setRateForm({ ...rateForm, personalRelief: Number(e.target.value) })}
                          />
                          <Input
                            label="NSSF EE %"
                            type="number"
                            min="0"
                            step="0.1"
                            value={rateForm.nssfRateEmployee}
                            onChange={(e) => setRateForm({ ...rateForm, nssfRateEmployee: Number(e.target.value) })}
                          />
                          <Input
                            label="NSSF ER %"
                            type="number"
                            min="0"
                            step="0.1"
                            value={rateForm.nssfRateEmployer}
                            onChange={(e) => setRateForm({ ...rateForm, nssfRateEmployer: Number(e.target.value) })}
                          />
                          <Input
                            label="Tier I cap"
                            type="number"
                            min="0"
                            value={rateForm.nssfTier1Cap}
                            onChange={(e) => setRateForm({ ...rateForm, nssfTier1Cap: Number(e.target.value) })}
                          />
                          <Input
                            label="Tier II cap"
                            type="number"
                            min="0"
                            value={rateForm.nssfTier2Cap}
                            onChange={(e) => setRateForm({ ...rateForm, nssfTier2Cap: Number(e.target.value) })}
                          />
                          <Input
                            label="SHIF %"
                            type="number"
                            min="0"
                            step="0.01"
                            value={rateForm.shifRate}
                            onChange={(e) => setRateForm({ ...rateForm, shifRate: Number(e.target.value) })}
                          />
                          <Input
                            label="SHIF min"
                            type="number"
                            min="0"
                            value={rateForm.shifMinimum}
                            onChange={(e) => setRateForm({ ...rateForm, shifMinimum: Number(e.target.value) })}
                          />
                          <Input
                            label="Housing Levy %"
                            type="number"
                            min="0"
                            step="0.01"
                            value={rateForm.housingLevyRate}
                            onChange={(e) => setRateForm({ ...rateForm, housingLevyRate: Number(e.target.value) })}
                          />
                          <Input
                            label="NITA /yr"
                            type="number"
                            min="0"
                            value={rateForm.nitaLevyPerEmployee}
                            onChange={(e) => setRateForm({ ...rateForm, nitaLevyPerEmployee: Number(e.target.value) })}
                          />
                        </div>

                        <p className="text-[11px] text-text-muted">
                          Takes effect for runs whose period starts on or after the effective date.
                          Payslips already computed keep the row they were calculated with, and other
                          businesses on the platform are unaffected. Verify against KRA / NSSF / SHA
                          notices before relying on it for filing.
                        </p>

                        <div className="flex gap-3 pt-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setShowRateForm(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">Add Version</Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card><CardContent className="p-8 text-center text-text-muted">No statutory rate table found.</CardContent></Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}