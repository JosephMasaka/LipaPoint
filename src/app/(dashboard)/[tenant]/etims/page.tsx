"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Pagination } from "@/components/pagination";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CheckCircle, AlertCircle, RefreshCw, Send, ShieldCheck,
  Clock, Search, FileWarning, Receipt,
} from "lucide-react";

/**
 * eTIMS compliance dashboard (spec §4.8): submission success rate, the
 * rejected/pending queue with retry, and VAT output reconciliation against
 * the sales ledger.
 */

type Tab = "submissions" | "vat";
type StatusFilter = "ALL" | "pending" | "submitted" | "accepted" | "rejected";

interface EtimsInvoiceRow {
  id: string;
  sourceType: string;
  sourceRef: string | null;
  status: string;
  totalAmount: number;
  taxAmount: number;
  kraInvoiceNumber: string | null;
  qrCodeUrl: string | null;
  attempts: number;
  lastError: string | null;
  submittedAt: string | null;
  createdAt: string;
}

interface EtimsStats {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  rejected: number;
  successRate: number;
  acceptedTax: number;
  acceptedTotal: number;
}

interface VatRow {
  period: string;
  etimsVat: number;
  salesVat: number;
  variance: number;
  acceptedCount: number;
  salesCount: number;
}

interface SummaryData {
  stats: EtimsStats;
  vat: VatRow[];
  mismatchedMonths: number;
  totalVariance: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  accepted: "success",
  submitted: "default",
  pending: "warning",
  rejected: "destructive",
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  accepted: CheckCircle,
  submitted: Send,
  pending: Clock,
  rejected: AlertCircle,
};

const SOURCE_LABEL: Record<string, string> = {
  sale: "Sale",
  credit_note: "Credit note",
  supplier_invoice: "Supplier invoice",
};

const fmtPeriod = (p: string) => {
  const [year, month] = p.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-KE", {
    month: "short",
    year: "numeric",
  });
};

function StatCard({
  label, value, hint, icon: Icon, tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            tone === "success" && "bg-emerald-500/10 text-emerald-400",
            tone === "warning" && "bg-amber-500/10 text-amber-400",
            tone === "danger" && "bg-red-500/10 text-red-400",
            tone === "default" && "bg-gold/10 text-gold"
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">{label}</p>
          <p className="text-xl font-bold text-text-primary truncate">{value}</p>
          {hint && <p className="text-[11px] text-text-muted truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EtimsPage() {
  const [tab, setTab] = useState<Tab>("submissions");

  const [invoices, setInvoices] = useState<EtimsInvoiceRow[]>([]);
  const [stats, setStats] = useState<EtimsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchInvoices = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/etims/invoices?${params}`);
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices);
          setStats(data.stats);
          setPagination(data.pagination);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchInvoices(1), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchInvoices, search]);

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await fetch("/api/etims/summary?months=6");
      if (res.ok) setSummary(await res.json());
    } catch {
      // silent fail
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "vat") fetchSummary();
  }, [tab, fetchSummary]);

  const handleRetry = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/etims/invoices/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify("error", data.error || "Retry failed");
        return;
      }
      notify(
        data.status === "accepted" ? "success" : "error",
        data.status === "accepted"
          ? `Accepted by KRA — ${data.kraInvoiceNumber}`
          : data.lastError || `Status: ${data.status}`
      );
      fetchInvoices(pagination.page);
    } catch {
      notify("error", "Network error");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkRetry = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/etims/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("error", data.error || "Bulk retry failed");
        return;
      }
      notify(
        "success",
        data.attempted === 0
          ? "Nothing pending to retry"
          : `Retried ${data.attempted} — ${data.accepted} accepted, ${data.rejected} rejected, ${data.stillPending} still pending`
      );
      fetchInvoices(1);
    } catch {
      notify("error", "Network error");
    } finally {
      setBusy(false);
    }
  };

  const successPct = stats ? Math.round(stats.successRate * 100) : 100;

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div
          className={cn(
            "fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm",
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          )}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header
        title="eTIMS / Tax Compliance"
        subtitle="KRA OSCU invoice submissions, rejections and VAT output"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ── Status cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Submitted to KRA"
            value={stats?.total ?? "—"}
            icon={Send}
          />
          <StatCard
            label="Accepted"
            value={stats?.accepted ?? "—"}
            hint={stats ? `${formatCurrency(stats.acceptedTax)} VAT declared` : undefined}
            icon={CheckCircle}
            tone="success"
          />
          <StatCard
            label="Awaiting retry"
            value={stats?.pending ?? "—"}
            hint="OSCU unreachable — safe to resend"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Rejected"
            value={stats?.rejected ?? "—"}
            hint="Needs a fix before resending"
            icon={FileWarning}
            tone="danger"
          />
          <StatCard
            label="Success rate"
            value={stats ? `${successPct}%` : "—"}
            hint="accepted vs decided"
            icon={ShieldCheck}
            tone={successPct >= 95 ? "success" : successPct >= 80 ? "warning" : "danger"}
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "submissions", label: "Submissions", icon: Receipt },
            { key: "vat", label: "VAT Reconciliation", icon: ShieldCheck },
          ] as const).map((t) => (
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

        {/* ── Submissions ── */}
        {tab === "submissions" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(["ALL", "pending", "submitted", "accepted", "rejected"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                      statusFilter === s
                        ? "bg-gold/10 text-gold border-gold/30"
                        : "bg-surface-elevated text-text-secondary border-border hover:text-text-primary"
                    )}
                  >
                    {s === "ALL" ? "All" : s}
                    {stats && s !== "ALL" && (
                      <span className="ml-1.5 text-text-muted">
                        {stats[s as keyof EtimsStats] as number}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-surface-elevated text-sm text-text-primary placeholder:text-text-muted"
                  placeholder="Search reference or KRA number…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                className="gap-2 ml-auto"
                onClick={handleBulkRetry}
                disabled={busy || !stats || stats.pending === 0}
              >
                <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                Retry pending ({stats?.pending ?? 0})
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[820px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reference</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">KRA invoice</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">VAT</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Tries</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12">
                            <Loader label="Loading submissions..." className="py-4" />
                          </td>
                        </tr>
                      ) : invoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                            No eTIMS submissions yet. Sales and credit notes are submitted automatically
                            once this module is enabled.
                          </td>
                        </tr>
                      ) : (
                        invoices.map((row) => {
                          const Icon = STATUS_ICON[row.status] ?? Clock;
                          return (
                            <tr key={row.id} className="hover:bg-surface-hover/50">
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs text-text-primary">
                                  {row.sourceRef || "—"}
                                </span>
                                {row.lastError && (
                                  <p className="text-[11px] text-red-400/90 mt-0.5 max-w-[320px] truncate" title={row.lastError}>
                                    {row.lastError}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-text-secondary">
                                {SOURCE_LABEL[row.sourceType] ?? row.sourceType}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"} className="gap-1 capitalize">
                                  <Icon className="h-3 w-3" /> {row.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-text-primary">
                                {row.kraInvoiceNumber || "—"}
                              </td>
                              <td className="px-4 py-3 text-right text-text-secondary">
                                {formatCurrency(row.totalAmount)}
                              </td>
                              <td className="px-4 py-3 text-right text-text-secondary">
                                {formatCurrency(row.taxAmount)}
                              </td>
                              <td className="px-4 py-3 text-right text-text-muted">{row.attempts}</td>
                              <td className="px-4 py-3 text-right">
                                {(row.status === "pending" || row.status === "rejected") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-8"
                                    disabled={busy}
                                    onClick={() => handleRetry(row.id)}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              onPageChange={(page) => fetchInvoices(page)}
            />
          </>
        )}

        {/* ── VAT reconciliation ── */}
        {tab === "vat" && (
          <>
            <div
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border",
                summary && summary.totalVariance > 0
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-emerald-500/10 border-emerald-500/30"
              )}
            >
              {summary && summary.totalVariance > 0 ? (
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {summary && summary.totalVariance > 0
                    ? `${formatCurrency(summary.totalVariance)} of sales VAT has not reached KRA`
                    : summary
                      ? "Sales VAT and eTIMS declarations match"
                      : "Loading reconciliation…"}
                </p>
                {summary && summary.totalVariance > 0 && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    {summary.mismatchedMonths} month{summary.mismatchedMonths === 1 ? "" : "s"} out of
                    balance — check pending submissions, then re-check before filing.
                  </p>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Month</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Declared to KRA</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Sales VAT</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Variance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Invoices</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summaryLoading || !summary ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12">
                            <Loader label="Loading reconciliation..." className="py-4" />
                          </td>
                        </tr>
                      ) : summary.vat.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                            No data yet.
                          </td>
                        </tr>
                      ) : (
                        summary.vat.map((row) => (
                          <tr key={row.period} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-3 text-text-primary">{fmtPeriod(row.period)}</td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {formatCurrency(row.etimsVat)}
                            </td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {formatCurrency(row.salesVat)}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-medium",
                                row.variance > 0 ? "text-red-400" : row.variance < 0 ? "text-amber-400" : "text-emerald-400"
                              )}
                            >
                              {row.variance === 0 ? "✓" : formatCurrency(row.variance)}
                            </td>
                            <td className="px-4 py-3 text-right text-text-muted">
                              {row.acceptedCount} / {row.salesCount}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-text-muted">
              Variance = sales VAT − declared VAT. A positive figure is VAT collected on sales
              that KRA has not received yet (pending or rejected submissions).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
