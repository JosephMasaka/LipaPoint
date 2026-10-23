"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, X, CheckCircle, AlertCircle, ArrowLeft, Landmark,
  ArrowDownLeft, ArrowUpRight, CheckCheck, Wallet, Smartphone, Banknote,
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  type: string;
  accountNumber: string | null;
  openingBalance: number;
  balance: number;
  isActive: boolean;
  createdAt: string;
  coaAccount: { code: string; name: string } | null;
}

interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  amount: number;
  direction: string;
  description: string | null;
  reference: string | null;
  reconciled: boolean;
  reconciledAt: string | null;
  matchedJournalLineId: string | null;
  createdAt: string;
}

interface CoaAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  bank: "Bank",
  mpesa_till: "M-Pesa Till",
  mpesa_paybill: "M-Pesa Paybill",
  cash: "Cash Drawer",
};

const TYPE_BADGE: Record<string, "default" | "secondary" | "success" | "warning"> = {
  bank: "default",
  mpesa_till: "success",
  mpesa_paybill: "success",
  cash: "secondary",
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  bank: Landmark,
  mpesa_till: Smartphone,
  mpesa_paybill: Smartphone,
  cash: Banknote,
};

const TYPE_OPTIONS = ["bank", "mpesa_till", "mpesa_paybill", "cash"];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

export default function BankingPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash", accountNumber: "", openingBalance: 0 });
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);
  const [accountsCoa, setAccountsCoa] = useState<CoaAccount[]>([]);
  const [showRecord, setShowRecord] = useState(false);
  const [record, setRecord] = useState({
    direction: "in",
    amount: 0,
    date: "",
    description: "",
    reference: "",
    counterAccountCode: "",
  });

  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bank-accounts");
      if (res.ok) setAccounts(await res.json());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchTransactions = useCallback(
    async (accountId: string, unreconciled = false) => {
      try {
        setTxLoading(true);
        const res = await fetch(
          `/api/bank-accounts/${accountId}/transactions${unreconciled ? "?unreconciled=true" : ""}`
        );
        if (res.ok) setTransactions(await res.json());
      } catch {
        // silent fail
      } finally {
        setTxLoading(false);
      }
    },
    []
  );

  const openDetail = async (account: BankAccount, unreconciled = false) => {
    setDetail(account);
    setUnreconciledOnly(unreconciled);
    await fetchTransactions(account.id, unreconciled);
    if (accountsCoa.length === 0) {
      fetch("/api/finance/accounts")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => Array.isArray(d) && setAccountsCoa(d))
        .catch(() => {});
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Wallet name is required");
      return;
    }
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          accountNumber: form.accountNumber || undefined,
          openingBalance: Number(form.openingBalance) || 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error");
        return;
      }
      setForm({ name: "", type: "cash", accountNumber: "", openingBalance: 0 });
      setShowForm(false);
      fetchAccounts();
      notify("success", "Wallet created — opening balance posted to the GL");
    } catch {
      setError("Network error");
    }
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      const res = await fetch(`/api/bank-accounts/${detail.id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(record.amount),
          direction: record.direction,
          date: record.date ? new Date(record.date).toISOString() : undefined,
          description: record.description || undefined,
          reference: record.reference || undefined,
          counterAccountCode: record.counterAccountCode || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Failed to record transaction");
        return;
      }
      setShowRecord(false);
      setRecord({ direction: "in", amount: 0, date: "", description: "", reference: "", counterAccountCode: "" });
      notify("success", "Transaction recorded — journal entry posted");
      fetchTransactions(detail.id, unreconciledOnly);
      fetchAccounts();
    } catch {
      notify("error", "Network error");
    }
  };

  const handleReconcile = async (txn: BankTransaction) => {
    try {
      const res = await fetch(`/api/bank-transactions/${txn.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Failed to reconcile");
        return;
      }
      notify("success", "Transaction reconciled");
      if (detail) fetchTransactions(detail.id, unreconciledOnly);
    } catch {
      notify("error", "Network error");
    }
  };

  // ── Account detail ──
  if (detail) {
    const Icon = TYPE_ICON[detail.type] ?? Landmark;
    return (
      <div className="min-h-screen bg-surface">
        <Header title="Wallet" subtitle={detail.name} />
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <Button variant="outline" onClick={() => { setDetail(null); fetchAccounts(); }} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Banking
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{detail.name}</h3>
                    <Badge variant={TYPE_BADGE[detail.type] ?? "secondary"}>{TYPE_LABEL[detail.type] ?? detail.type}</Badge>
                  </div>
                </div>
                <div className="pt-3 border-t border-border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Current balance</span>
                    <span className="font-bold text-text-primary">{formatCurrency(detail.balance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Opening balance</span>
                    <span className="text-text-primary">{formatCurrency(detail.openingBalance)}</span>
                  </div>
                  {detail.accountNumber && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Account no.</span>
                      <span className="font-mono text-xs text-text-primary">{detail.accountNumber}</span>
                    </div>
                  )}
                  {detail.coaAccount && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">GL account</span>
                      <span className="text-xs text-text-primary">{detail.coaAccount.code} — {detail.coaAccount.name}</span>
                    </div>
                  )}
                </div>
                <Button className="w-full gap-2" onClick={() => setShowRecord(true)}>
                  <Plus className="h-4 w-4" /> Record Transaction
                </Button>

                {showRecord && (
                  <form onSubmit={handleRecord} className="pt-3 border-t border-border space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {["in", "out"].map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => setRecord({ ...record, direction: dir })}
                          className={cn(
                            "h-9 rounded-lg border text-xs capitalize flex items-center justify-center gap-1.5 transition-colors",
                            record.direction === dir
                              ? dir === "in"
                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                                : "border-red-500/50 bg-red-500/10 text-red-400"
                              : "border-border bg-surface-elevated text-text-secondary"
                          )}
                        >
                          {dir === "in" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          Money {dir}
                        </button>
                      ))}
                    </div>
                    <Input
                      label="Amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={record.amount || ""}
                      onChange={(e) => setRecord({ ...record, amount: Number(e.target.value) })}
                      required
                    />
                    <Input
                      label="Date"
                      type="date"
                      value={record.date}
                      onChange={(e) => setRecord({ ...record, date: e.target.value })}
                    />
                    <Input
                      label="Description"
                      placeholder="e.g. Coca-Cola restock payment"
                      value={record.description}
                      onChange={(e) => setRecord({ ...record, description: e.target.value })}
                    />
                    <Input
                      label="Reference"
                      placeholder="M-Pesa ref / cheque no."
                      value={record.reference}
                      onChange={(e) => setRecord({ ...record, reference: e.target.value })}
                    />
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                        Counter account <span className="text-text-muted">(other side of the GL entry)</span>
                      </label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={record.counterAccountCode}
                        onChange={(e) => setRecord({ ...record, counterAccountCode: e.target.value })}
                      >
                        <option value="">Default (4200 — Other Income)</option>
                        {accountsCoa.map((acct) => (
                          <option key={acct.id} value={acct.code}>
                            {acct.code} — {acct.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowRecord(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Record</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-text-primary">
                      Transactions {unreconciledOnly && <span className="text-amber-400 font-normal">— unreconciled only</span>}
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setUnreconciledOnly(!unreconciledOnly); fetchTransactions(detail.id, !unreconciledOnly); }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          unreconciledOnly
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-surface-elevated border-border text-text-secondary hover:text-text-primary"
                        )}
                      >
                        Unreconciled
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Description</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Reference</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {txLoading ? (
                          <tr><td colSpan={6} className="px-4 py-10"><Loader label="Loading transactions..." className="py-4" /></td></tr>
                        ) : transactions.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                            {unreconciledOnly ? "Everything is reconciled. " : "No transactions yet. "}
                            Record money in or out to start the cash book.
                          </td></tr>
                        ) : transactions.map((txn) => (
                          <tr key={txn.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 text-xs text-text-muted">{fmtDate(txn.date)}</td>
                            <td className="px-4 py-2.5 text-text-primary">{txn.description || "—"}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{txn.reference || "—"}</td>
                            <td className={cn("px-4 py-2.5 text-right font-medium", txn.direction === "in" ? "text-emerald-400" : "text-red-400")}>
                              {txn.direction === "in" ? "+" : "−"}{formatCurrency(txn.amount)}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={txn.reconciled ? "success" : "warning"}>
                                {txn.reconciled ? "reconciled" : "review"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {!txn.reconciled && (
                                <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => handleReconcile(txn)}>
                                  <CheckCheck className="h-3 w-3" /> Reconcile
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Wallets grid ──
  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Banking" subtitle="Bank accounts, M-Pesa tills and cash drawers — with live GL balances" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {accounts.length} wallet{accounts.length === 1 ? "" : "s"}
          </p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Wallet
          </Button>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-bold text-text-primary">New Wallet</h3>
                <button onClick={() => setShowForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-4 space-y-4">
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                <Input
                  label="Name"
                  placeholder="KCB Current Account / Till 0722…"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TYPE_OPTIONS.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm({ ...form, type })}
                        className={cn(
                          "h-9 rounded-lg border text-xs transition-colors",
                          form.type === type
                            ? "border-gold/50 bg-gold/10 text-gold"
                            : "border-border bg-surface-elevated text-text-secondary hover:text-text-primary"
                        )}
                      >
                        {TYPE_LABEL[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Account / till number"
                    placeholder="Optional"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  />
                  <Input
                    label="Opening balance"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.openingBalance || ""}
                    onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Opening balance posts DR wallet / CR owner&apos;s equity automatically.
                </p>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 gap-1.5">
                    <Wallet className="h-4 w-4" /> Create Wallet
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <Card><CardContent className="p-12"><Loader label="Loading wallets..." /></CardContent></Card>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-3">
              <Landmark className="h-10 w-10 text-text-muted mx-auto" />
              <p className="text-sm text-text-muted">No wallets yet. Add your bank account, M-Pesa till or cash drawer to start the cash book.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => {
              const Icon = TYPE_ICON[account.type] ?? Landmark;
              return (
                <Card
                  key={account.id}
                  className="hover:border-gold/30 transition-colors cursor-pointer"
                  onClick={() => openDetail(account)}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-gold" />
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary text-sm">{account.name}</p>
                          <p className="text-[11px] text-text-muted">{account.coaAccount ? `${account.coaAccount.code} — ${account.coaAccount.name}` : TYPE_LABEL[account.type]}</p>
                        </div>
                      </div>
                      <Badge variant={TYPE_BADGE[account.type] ?? "secondary"}>{TYPE_LABEL[account.type]}</Badge>
                    </div>
                    <div className="pt-2 border-t border-border flex items-end justify-between">
                      <div>
                        <p className="text-[11px] text-text-muted uppercase tracking-wider">Balance</p>
                        <p className="text-xl font-bold text-text-primary">{formatCurrency(account.balance)}</p>
                      </div>
                      {account.accountNumber && (
                        <p className="font-mono text-[10px] text-text-muted">{account.accountNumber}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
