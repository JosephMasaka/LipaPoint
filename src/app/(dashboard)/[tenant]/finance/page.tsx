"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Pagination } from "@/components/pagination";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, X, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  ListTree, Receipt, ScrollText, Check,
} from "lucide-react";

type Tab = "ledger" | "accounts" | "credit" | "debit";

interface JournalLine {
  id: string;
  debit: string; // Prisma Decimal → JSON string
  credit: string;
  description: string | null;
  account: { code: string; name: string };
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  sourceModule: string;
  description: string | null;
  postedByUser: { name: string } | null;
  lines: JournalLine[];
}

interface CoaAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isSystem: boolean;
  isActive: boolean;
}

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  customer: { id: string; name: string };
}

interface DebitNote {
  id: string;
  debitNoteNumber: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  supplier: { id: string; name: string };
}

interface SelectOption {
  id: string;
  name: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const NOTE_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "warning",
  approved: "success",
  void: "destructive",
};

const ACCOUNT_TYPE_LABEL: Record<string, { label: string; className: string }> = {
  asset: { label: "Asset", className: "text-emerald-400" },
  liability: { label: "Liability", className: "text-red-400" },
  equity: { label: "Equity", className: "text-gold" },
  income: { label: "Income", className: "text-sky-400" },
  expense: { label: "Expense", className: "text-amber-400" },
};

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "ledger", label: "General Ledger", icon: ScrollText },
  { key: "accounts", label: "Chart of Accounts", icon: ListTree },
  { key: "credit", label: "Credit Notes", icon: Receipt },
  { key: "debit", label: "Debit Notes", icon: ScrollText },
];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("ledger");

  // Ledger
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerPagination, setLedgerPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Chart of accounts
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [coaLoading, setCoaLoading] = useState(true);
  const [coaType, setCoaType] = useState("all");

  // Notes
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [creditPagination, setCreditPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [debitPagination, setDebitPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showDebitForm, setShowDebitForm] = useState(false);
  const [creditForm, setCreditForm] = useState({ customerId: "", amount: 0, reason: "" });
  const [debitForm, setDebitForm] = useState({ supplierId: "", amount: 0, reason: "" });
  const [customers, setCustomers] = useState<SelectOption[]>([]);
  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);

  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Ledger ──
  const fetchLedger = useCallback(async (page = 1) => {
    try {
      setLedgerLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate).toISOString());
      if (sourceFilter !== "all") params.set("sourceModule", sourceFilter);
      const res = await fetch(`/api/finance/journal?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setLedgerPagination(data.pagination);
      }
    } catch {
      // silent fail
    } finally {
      setLedgerLoading(false);
    }
  }, [fromDate, toDate, sourceFilter]);

  useEffect(() => {
    if (tab === "ledger") {
      const timer = setTimeout(() => fetchLedger(1), 200);
      return () => clearTimeout(timer);
    }
  }, [tab, fetchLedger]);

  // ── Chart of accounts ──
  const fetchCoa = useCallback(async () => {
    try {
      setCoaLoading(true);
      const res = await fetch(`/api/finance/accounts${coaType !== "all" ? `?type=${coaType}` : ""}`);
      if (res.ok) setCoa(await res.json());
    } catch {
      // silent fail
    } finally {
      setCoaLoading(false);
    }
  }, [coaType]);

  useEffect(() => {
    if (tab === "accounts") fetchCoa();
  }, [tab, fetchCoa]);

  // ── Notes ──
  const fetchNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const [creditRes, debitRes] = await Promise.all([
        fetch("/api/credit-notes?page=1&limit=50"),
        fetch("/api/debit-notes?page=1&limit=50"),
      ]);
      if (creditRes.ok) {
        const d = await creditRes.json();
        setCreditNotes(d.creditNotes);
        setCreditPagination(d.pagination);
      }
      if (debitRes.ok) {
        const d = await debitRes.json();
        setDebitNotes(d.debitNotes);
        setDebitPagination(d.pagination);
      }
    } catch {
      // silent fail
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "credit" || tab === "debit") {
      fetchNotes();
      if (customers.length === 0) {
        fetch("/api/customers?limit=100")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setCustomers(d.customers))
          .catch(() => {});
      }
      if (suppliers.length === 0) {
        fetch("/api/suppliers?limit=100")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setSuppliers(d.suppliers))
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleCreateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: creditForm.customerId,
          amount: Number(creditForm.amount),
          reason: creditForm.reason,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Failed to create credit note");
        return;
      }
      setShowCreditForm(false);
      setCreditForm({ customerId: "", amount: 0, reason: "" });
      notify("success", "Credit note created (draft) — approve to post to the GL");
      fetchNotes();
    } catch {
      notify("error", "Network error");
    }
  };

  const handleCreateDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: debitForm.supplierId,
          amount: Number(debitForm.amount),
          reason: debitForm.reason,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Failed to create debit note");
        return;
      }
      setShowDebitForm(false);
      setDebitForm({ supplierId: "", amount: 0, reason: "" });
      notify("success", "Debit note created (draft) — approve to post to the GL");
      fetchNotes();
    } catch {
      notify("error", "Network error");
    }
  };

  const approveNote = async (kind: "credit" | "debit", id: string) => {
    try {
      const res = await fetch(kind === "credit" ? "/api/credit-notes" : "/api/debit-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve" }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Approval failed");
        return;
      }
      notify("success", `${kind === "credit" ? "Credit" : "Debit"} note approved — journal entry posted`);
      fetchNotes();
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

      <Header title="Finance" subtitle="General ledger, chart of accounts and credit/debit notes" />

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

        {/* ── General Ledger ── */}
        {tab === "ledger" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Input label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-auto" />
              <Input label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-auto" />
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Source</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="all">All sources</option>
                  <option value="pos">POS</option>
                  <option value="procurement">Procurement</option>
                  <option value="finance">Finance</option>
                  <option value="payroll">Payroll</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase w-8"></th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reference</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Source</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Debits</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledgerLoading ? (
                        <tr><td colSpan={7} className="px-4 py-12"><Loader label="Loading ledger..." className="py-4" /></td></tr>
                      ) : entries.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                          No journal entries yet. Sales, invoices, payments and notes post here automatically.
                        </td></tr>
                      ) : entries.map((entry) => {
                        const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                        const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
                        const isOpen = expanded === entry.id;
                        return (
                          <Fragment key={entry.id}>
                            <tr
                              className="hover:bg-surface-hover/50 cursor-pointer transition-colors"
                              onClick={() => setExpanded(isOpen ? null : entry.id)}
                            >
                              <td className="px-4 py-3 text-text-muted">
                                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </td>
                              <td className="px-4 py-3 text-xs text-text-muted">{fmtDate(entry.date)}</td>
                              <td className="px-4 py-3 font-mono text-xs text-text-primary">{entry.reference}</td>
                              <td className="px-4 py-3 text-text-primary">{entry.description || "—"}</td>
                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="capitalize">{entry.sourceModule}</Badge>
                              </td>
                              <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(totalDebit)}</td>
                              <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(totalCredit)}</td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-surface-elevated/40">
                                <td colSpan={7} className="px-6 py-3">
                                  <div className="rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-surface-elevated/60">
                                          <th className="px-3 py-2 text-left text-text-secondary uppercase">Account</th>
                                          <th className="px-3 py-2 text-left text-text-secondary uppercase">Line description</th>
                                          <th className="px-3 py-2 text-right text-text-secondary uppercase">Debit</th>
                                          <th className="px-3 py-2 text-right text-text-secondary uppercase">Credit</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border">
                                        {entry.lines.map((line) => (
                                          <tr key={line.id}>
                                            <td className="px-3 py-2 text-text-primary">
                                              <span className="font-mono text-text-muted mr-2">{line.account.code}</span>
                                              {line.account.name}
                                            </td>
                                            <td className="px-3 py-2 text-text-secondary">{line.description || "—"}</td>
                                            <td className="px-3 py-2 text-right text-text-primary">
                                              {Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right text-text-primary">
                                              {Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="flex justify-end gap-6 mt-2 text-[11px] text-text-muted">
                                    <span>Posted by {entry.postedByUser?.name ?? "system"}</span>
                                    <span className={cn(Math.abs(totalDebit - totalCredit) < 0.005 ? "text-emerald-400" : "text-red-400")}>
                                      {Math.abs(totalDebit - totalCredit) < 0.005 ? "Balanced ✓" : "OUT OF BALANCE"}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={ledgerPagination.page}
                  totalPages={ledgerPagination.totalPages}
                  totalItems={ledgerPagination.total}
                  pageSize={ledgerPagination.limit}
                  onPageChange={(page) => fetchLedger(page)}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Chart of Accounts ── */}
        {tab === "accounts" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {["all", "asset", "liability", "equity", "income", "expense"].map((type) => (
                <button
                  key={type}
                  onClick={() => setCoaType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                    coaType === type
                      ? "bg-gold/10 text-gold border-gold/30"
                      : "bg-surface-elevated text-text-secondary border-border hover:text-text-primary"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Account</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">System</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {coaLoading ? (
                        <tr><td colSpan={4} className="px-4 py-12"><Loader label="Loading chart of accounts..." className="py-4" /></td></tr>
                      ) : coa.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-12 text-center text-text-muted">No accounts found.</td></tr>
                      ) : coa.map((acct) => (
                        <tr key={acct.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-text-primary">{acct.code}</td>
                          <td className="px-4 py-3 text-text-primary">{acct.name}</td>
                          <td className={cn("px-4 py-3 text-xs font-medium capitalize", ACCOUNT_TYPE_LABEL[acct.type]?.className)}>
                            {acct.type}
                          </td>
                          <td className="px-4 py-3">
                            {acct.isSystem && <Badge variant="secondary">seeded</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Credit Notes ── */}
        {tab === "credit" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Credit notes reduce what a customer owes — approval posts DR Sales / CR Accounts Receivable.
              </p>
              <Button onClick={() => setShowCreditForm(true)} className="gap-2 w-fit">
                <Plus className="h-4 w-4" /> New Credit Note
              </Button>
            </div>

            {showCreditForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreditForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">New Credit Note</h3>
                    <button onClick={() => setShowCreditForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateCredit} className="p-4 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Customer</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={creditForm.customerId}
                        onChange={(e) => setCreditForm({ ...creditForm, customerId: e.target.value })}
                        required
                      >
                        <option value="">Select customer…</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={creditForm.amount || ""}
                      onChange={(e) => setCreditForm({ ...creditForm, amount: Number(e.target.value) })}
                      required
                    />
                    <Input
                      label="Reason"
                      placeholder="e.g. Wrong price on invoice #1042"
                      value={creditForm.reason}
                      onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                      required
                    />
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreditForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Create Draft</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Note</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Customer</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {notesLoading ? (
                        <tr><td colSpan={6} className="px-4 py-12"><Loader label="Loading credit notes..." className="py-4" /></td></tr>
                      ) : creditNotes.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted">No credit notes yet.</td></tr>
                      ) : creditNotes.map((note) => (
                        <tr key={note.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 font-mono text-xs text-text-primary">{note.creditNoteNumber}</td>
                          <td className="px-4 py-3 font-medium text-text-primary">{note.customer.name}</td>
                          <td className="px-4 py-3 text-right font-medium text-text-primary">{formatCurrency(note.amount)}</td>
                          <td className="px-4 py-3 text-xs text-text-secondary max-w-[240px] truncate" title={note.reason}>{note.reason}</td>
                          <td className="px-4 py-3">
                            <Badge variant={NOTE_STATUS_VARIANT[note.status] ?? "secondary"}>{note.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {note.status === "draft" && (
                              <Button size="sm" className="gap-1.5 h-7" onClick={() => approveNote("credit", note.id)}>
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={creditPagination.page}
                  totalPages={creditPagination.totalPages}
                  totalItems={creditPagination.total}
                  pageSize={creditPagination.limit}
                  onPageChange={() => fetchNotes()}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Debit Notes ── */}
        {tab === "debit" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Debit notes reduce what you owe a supplier — approval posts DR Accounts Payable / CR Inventory.
              </p>
              <Button onClick={() => setShowDebitForm(true)} className="gap-2 w-fit">
                <Plus className="h-4 w-4" /> New Debit Note
              </Button>
            </div>

            {showDebitForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDebitForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">New Debit Note</h3>
                    <button onClick={() => setShowDebitForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateDebit} className="p-4 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Supplier</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={debitForm.supplierId}
                        onChange={(e) => setDebitForm({ ...debitForm, supplierId: e.target.value })}
                        required
                      >
                        <option value="">Select supplier…</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={debitForm.amount || ""}
                      onChange={(e) => setDebitForm({ ...debitForm, amount: Number(e.target.value) })}
                      required
                    />
                    <Input
                      label="Reason"
                      placeholder="e.g. Damaged crates returned"
                      value={debitForm.reason}
                      onChange={(e) => setDebitForm({ ...debitForm, reason: e.target.value })}
                      required
                    />
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowDebitForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Create Draft</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Note</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {notesLoading ? (
                        <tr><td colSpan={6} className="px-4 py-12"><Loader label="Loading debit notes..." className="py-4" /></td></tr>
                      ) : debitNotes.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted">No debit notes yet.</td></tr>
                      ) : debitNotes.map((note) => (
                        <tr key={note.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 font-mono text-xs text-text-primary">{note.debitNoteNumber}</td>
                          <td className="px-4 py-3 font-medium text-text-primary">{note.supplier.name}</td>
                          <td className="px-4 py-3 text-right font-medium text-text-primary">{formatCurrency(note.amount)}</td>
                          <td className="px-4 py-3 text-xs text-text-secondary max-w-[240px] truncate" title={note.reason}>{note.reason}</td>
                          <td className="px-4 py-3">
                            <Badge variant={NOTE_STATUS_VARIANT[note.status] ?? "secondary"}>{note.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {note.status === "draft" && (
                              <Button size="sm" className="gap-1.5 h-7" onClick={() => approveNote("debit", note.id)}>
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={debitPagination.page}
                  totalPages={debitPagination.totalPages}
                  totalItems={debitPagination.total}
                  pageSize={debitPagination.limit}
                  onPageChange={() => fetchNotes()}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
