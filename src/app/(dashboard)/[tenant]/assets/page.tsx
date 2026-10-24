"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Pagination } from "@/components/pagination";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, X, CheckCircle, AlertCircle, Boxes, TrendingDown, Wrench, Trash2, Play,
} from "lucide-react";

type Tab = "register" | "depreciation";

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  description: string | null;
  purchaseCost: number;
  purchaseDate: string;
  depreciationMethod: string;
  usefulLifeMonths: number;
  residualValue: number;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  lifecycleStatus: string;
  disposalProceeds: number | null;
  location: { name: string } | null;
  supplier: { name: string } | null;
  assignedEmployee: { firstName: string; lastName: string; staffNumber: string } | null;
}

interface AssetTotals {
  count: number;
  cost: number;
  accumulated: number;
  bookValue: number;
}

interface DepEntry {
  id: string;
  period: string;
  amount: number;
  bookValueAfter: number;
  asset: { assetCode: string; name: string; purchaseCost: number };
  journalEntry: { id: string; reference: string } | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SelectOption {
  id: string;
  name: string;
}

interface EmployeeOption {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
}

const CATEGORIES = ["equipment", "it", "kitchen", "furniture", "vehicle", "other"];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  in_service: "success",
  under_maintenance: "warning",
  disposed: "secondary",
  lost: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  in_service: "In service",
  under_maintenance: "Maintenance",
  disposed: "Disposed",
  lost: "Lost",
};

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "register", label: "Asset Register", icon: Boxes },
  { key: "depreciation", label: "Depreciation", icon: TrendingDown },
];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const EMPTY_PAGE: PaginationData = { page: 1, limit: 20, total: 0, totalPages: 0 };

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>("register");
  // The page lives at /<tenant>/assets — slug first segment, for links out.
  const tenantSlug = usePathname().split("/")[1] || "";

  // Register
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totals, setTotals] = useState<AssetTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [pagination, setPagination] = useState<PaginationData>({ ...EMPTY_PAGE });

  // Dropdowns
  const [locations, setLocations] = useState<SelectOption[]>([]);
  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [wallets, setWallets] = useState<SelectOption[]>([]);

  // Create modal
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "equipment",
    description: "",
    purchaseCost: 0,
    purchaseDate: "",
    depreciationMethod: "straight_line",
    usefulLifeMonths: 60,
    residualValue: 0,
    locationId: "",
    supplierId: "",
    assignedTo: "",
  });

  // Dispose modal
  const [disposeTarget, setDisposeTarget] = useState<Asset | null>(null);
  const [disposeForm, setDisposeForm] = useState({ proceeds: 0, bankAccountId: "", lost: false });
  const [disposeError, setDisposeError] = useState("");

  // Depreciation tab
  const [entries, setEntries] = useState<DepEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesPeriod, setEntriesPeriod] = useState("");
  const [runPeriod, setRunPeriod] = useState("");
  const [runBusy, setRunBusy] = useState(false);

  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // ── Register ──
  const fetchAssets = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        const res = await fetch(`/api/assets?${params}`);
        if (res.ok) {
          const d = await res.json();
          setAssets(d.assets);
          setTotals(d.totals);
          setPagination(d.pagination);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, categoryFilter]
  );

  useEffect(() => {
    if (tab !== "register") return;
    const timer = setTimeout(() => fetchAssets(1), 250);
    return () => clearTimeout(timer);
  }, [tab, fetchAssets]);

  // Dropdown data (once, on first need)
  useEffect(() => {
    if (locations.length === 0) {
      fetch("/api/locations")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => Array.isArray(d) && setLocations(d))
        .catch(() => {});
    }
    if (suppliers.length === 0) {
      fetch("/api/suppliers?limit=100")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.suppliers && setSuppliers(d.suppliers))
        .catch(() => {});
    }
    if (employees.length === 0) {
      // Payroll module may be off for this tenant — an empty list is fine.
      fetch("/api/hr/employees?limit=200&active=true")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.employees && setEmployees(d.employees))
        .catch(() => {});
    }
    if (wallets.length === 0) {
      fetch("/api/bank-accounts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => Array.isArray(d) && setWallets(d))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Depreciation history ──
  const fetchEntries = useCallback(async () => {
    try {
      setEntriesLoading(true);
      const params = entriesPeriod ? `?period=${entriesPeriod}` : "";
      const res = await fetch(`/api/assets/depreciation${params}`);
      if (res.ok) {
        const d = await res.json();
        setEntries(d.entries);
      }
    } catch {
      // silent fail
    } finally {
      setEntriesLoading(false);
    }
  }, [entriesPeriod]);

  useEffect(() => {
    if (tab === "depreciation") fetchEntries();
  }, [tab, fetchEntries]);

  // ── Actions ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          locationId: form.locationId || null,
          supplierId: form.supplierId || null,
          assignedTo: form.assignedTo || null,
          description: form.description || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to register asset");
        return;
      }
      const created = await res.json();
      setShowForm(false);
      setForm({
        name: "", category: "equipment", description: "", purchaseCost: 0, purchaseDate: "",
        depreciationMethod: "straight_line", usefulLifeMonths: 60, residualValue: 0,
        locationId: "", supplierId: "", assignedTo: "",
      });
      notify("success", `Asset ${created.assetCode} registered`);
      fetchAssets(1);
    } catch {
      setFormError("Network error");
    }
  };

  const patchAsset = async (id: string, body: Record<string, unknown>, successMessage: string) => {
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Update failed");
        return;
      }
      notify("success", successMessage);
      fetchAssets(pagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposeTarget) return;
    setDisposeError("");
    try {
      const res = await fetch(`/api/assets/${disposeTarget.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proceeds: disposeForm.lost ? 0 : Number(disposeForm.proceeds),
          bankAccountId: disposeForm.bankAccountId || null,
          lost: disposeForm.lost,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setDisposeError(d.error || "Disposal failed");
        return;
      }
      setDisposeTarget(null);
      setDisposeForm({ proceeds: 0, bankAccountId: "", lost: false });
      notify(
        "success",
        `${disposeForm.lost ? "Write-off" : "Disposal"} posted to the GL — book value ${formatCurrency(d.bookValue)} cleared`
      );
      fetchAssets(pagination.page);
    } catch {
      setDisposeError("Network error");
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Delete ${asset.assetCode} — ${asset.name}? Only assets with no GL history can be removed.`)) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        notify("error", d.error || "Delete failed");
        return;
      }
      notify("success", "Asset deleted");
      fetchAssets(pagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  const handleRunDepreciation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runPeriod) return;
    setRunBusy(true);
    try {
      const res = await fetch("/api/assets/depreciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: runPeriod }),
      });
      const d = await res.json();
      if (!res.ok) {
        notify("error", d.error || "Depreciation run failed");
        return;
      }
      notify(
        "success",
        d.count === 0
          ? `${runPeriod}: nothing to depreciate — everything is already booked`
          : `${runPeriod}: ${d.count} asset(s) depreciated, ${formatCurrency(d.total)} posted to the GL`
      );
      fetchEntries();
    } catch {
      notify("error", "Network error");
    } finally {
      setRunBusy(false);
    }
  };

  const isOpen = (a: Asset) => a.lifecycleStatus === "in_service" || a.lifecycleStatus === "under_maintenance";

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Assets" subtitle="Fixed asset register, depreciation and disposals" />

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

        {/* ── Register ── */}
        {tab === "register" && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Assets on register", value: totals ? String(totals.count) : "—" },
                { label: "Total cost", value: totals ? formatCurrency(totals.cost) : "—" },
                { label: "Accumulated depreciation", value: totals ? formatCurrency(totals.accumulated) : "—" },
                { label: "Book value", value: totals ? formatCurrency(totals.bookValue) : "—" },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-border bg-surface-elevated/50 p-4">
                  <p className="text-xs text-text-muted">{card.label}</p>
                  <p className="text-lg font-bold text-text-primary mt-1">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Search"
                placeholder="Name, code, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-auto"
              />
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Status</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  <option value="in_service">In service</option>
                  <option value="under_maintenance">Maintenance</option>
                  <option value="disposed">Disposed</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Category</label>
                <select
                  className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary capitalize"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <Button onClick={() => setShowForm(true)} className="gap-2 w-fit ml-auto">
                <Plus className="h-4 w-4" /> Register Asset
              </Button>
            </div>

            {showForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">Register Asset</h3>
                    <button onClick={() => setShowForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreate} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                    {formError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</div>
                    )}
                    <Input label="Name" placeholder="e.g. Coca-Cola fridge 300L" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1.5 block">Category</label>
                        <select
                          className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary capitalize"
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <Input label="Acquired" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Input label="Cost (KES)" type="number" min="0.01" step="0.01" value={form.purchaseCost || ""} onChange={(e) => setForm({ ...form, purchaseCost: Number(e.target.value) })} required />
                      <Input label="Residual value" type="number" min="0" step="0.01" value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: Number(e.target.value) })} />
                      <Input label="Life (months)" type="number" min="1" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1.5 block">Depreciation</label>
                      <select
                        className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                        value={form.depreciationMethod}
                        onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value })}
                      >
                        <option value="straight_line">Straight-line (monthly)</option>
                        <option value="none">No depreciation</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1.5 block">Location</label>
                        <select
                          className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                          value={form.locationId}
                          onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                        >
                          <option value="">—</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1.5 block">Supplier</label>
                        <select
                          className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                          value={form.supplierId}
                          onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                        >
                          <option value="">—</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1.5 block">Assigned to</label>
                        <select
                          className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                          value={form.assignedTo}
                          onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                        >
                          <option value="">—</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Input label="Description" placeholder="Optional notes, serial number…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Register Asset</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Dispose modal */}
            {disposeTarget && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDisposeTarget(null)} />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">
                      Dispose — {disposeTarget.assetCode}
                    </h3>
                    <button onClick={() => setDisposeTarget(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleDispose} className="p-4 space-y-4">
                    {disposeError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{disposeError}</div>
                    )}
                    <p className="text-xs text-text-secondary">
                      {disposeTarget.name} — cost {formatCurrency(disposeTarget.purchaseCost)}, accumulated
                      depreciation {formatCurrency(disposeTarget.accumulatedDepreciation)}, book value{" "}
                      <span className="text-text-primary font-medium">{formatCurrency(disposeTarget.bookValue)}</span>.
                      Disposal posts DR accumulated depreciation &amp; proceeds / CR asset cost, with the
                      difference as gain or loss.
                    </p>
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={disposeForm.lost}
                        onChange={(e) => setDisposeForm({ ...disposeForm, lost: e.target.checked, proceeds: 0 })}
                        className="rounded border-border"
                      />
                      Written off as lost (no proceeds)
                    </label>
                    {!disposeForm.lost && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Proceeds (KES)"
                          type="number"
                          min="0"
                          step="0.01"
                          value={disposeForm.proceeds || ""}
                          onChange={(e) => setDisposeForm({ ...disposeForm, proceeds: Number(e.target.value) })}
                        />
                        <div>
                          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Paid into</label>
                          <select
                            className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                            value={disposeForm.bankAccountId}
                            onChange={(e) => setDisposeForm({ ...disposeForm, bankAccountId: e.target.value })}
                          >
                            <option value="">Default bank (1040)</option>
                            {wallets.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setDisposeTarget(null)}>Cancel</Button>
                      <Button type="submit" className="flex-1" variant={disposeForm.lost ? "destructive" : "default"}>
                        {disposeForm.lost ? "Write Off" : "Dispose"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1040px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Asset</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Acquired</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Cost</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Monthly dep.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Accumulated</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Book value</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? (
                        <tr><td colSpan={9} className="px-4 py-12"><Loader label="Loading assets..." className="py-4" /></td></tr>
                      ) : assets.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-text-muted">
                            No assets registered yet — add your till machines, fridges and equipment.
                          </td>
                        </tr>
                      ) : assets.map((a) => (
                        <tr key={a.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 font-mono text-xs text-text-primary">{a.assetCode}</td>
                          <td className="px-4 py-3">
                            <span className="text-text-primary">{a.name}</span>
                            <span className="ml-2 text-xs text-text-muted capitalize">{a.category}</span>
                            {a.assignedEmployee && (
                              <span className="block text-[11px] text-text-muted">
                                → {a.assignedEmployee.firstName} {a.assignedEmployee.lastName} ({a.assignedEmployee.staffNumber})
                              </span>
                            )}
                            {a.location && !a.assignedEmployee && (
                              <span className="block text-[11px] text-text-muted">@ {a.location.name}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{fmtDate(a.purchaseDate)}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(a.purchaseCost)}</td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {a.monthlyDepreciation > 0 ? formatCurrency(a.monthlyDepreciation) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(a.accumulatedDepreciation)}</td>
                          <td className="px-4 py-3 text-right text-text-primary font-medium">{formatCurrency(a.bookValue)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[a.lifecycleStatus] ?? "secondary"}>
                              {STATUS_LABEL[a.lifecycleStatus] ?? a.lifecycleStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end items-center gap-1">
                              {isOpen(a) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title={a.lifecycleStatus === "in_service" ? "Send for maintenance" : "Back in service"}
                                    onClick={() =>
                                      patchAsset(
                                        a.id,
                                        {
                                          lifecycleStatus:
                                            a.lifecycleStatus === "in_service" ? "under_maintenance" : "in_service",
                                        },
                                        a.lifecycleStatus === "in_service"
                                          ? `${a.name} marked under maintenance`
                                          : `${a.name} back in service`
                                      )
                                    }
                                  >
                                    <Wrench className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300"
                                    title="Dispose / write off"
                                    onClick={() => {
                                      setDisposeError("");
                                      setDisposeForm({ proceeds: 0, bankAccountId: "", lost: false });
                                      setDisposeTarget(a);
                                    }}
                                  >
                                    Dispose
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-text-muted hover:text-red-400"
                                    title="Delete (only if never depreciated)"
                                    onClick={() => handleDelete(a)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  pageSize={pagination.limit}
                  onPageChange={(page) => fetchAssets(page)}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Depreciation ── */}
        {tab === "depreciation" && (
          <>
            <form onSubmit={handleRunDepreciation} className="flex flex-wrap items-end gap-3">
              <Input
                label="Period"
                type="month"
                value={runPeriod}
                onChange={(e) => setRunPeriod(e.target.value)}
                required
                className="w-auto"
              />
              <Button type="submit" className="gap-2" disabled={runBusy || !runPeriod}>
                <Play className="h-4 w-4" /> {runBusy ? "Running…" : "Run Depreciation"}
              </Button>
              <div className="flex items-end gap-2 ml-auto">
                <Input
                  label="Filter period"
                  type="month"
                  value={entriesPeriod}
                  onChange={(e) => setEntriesPeriod(e.target.value)}
                  className="w-auto"
                />
                <Button type="button" variant="outline" onClick={() => setEntriesPeriod("")}>
                  Show recent
                </Button>
              </div>
            </form>

            <p className="text-xs text-text-muted">
              Straight-line monthly charge: (cost − residual) ÷ life months, capped so book value never
              drops below residual. One balanced journal entry per run (DR Depreciation Expense /
              CR Accumulated Depreciation) — re-running is safe, assets already booked for the period
              are skipped. Future periods are refused.
            </p>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Asset</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Book value after</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Journal entry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {entriesLoading ? (
                        <tr><td colSpan={5} className="px-4 py-12"><Loader label="Loading depreciation..." className="py-4" /></td></tr>
                      ) : entries.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">No depreciation entries yet.</td></tr>
                      ) : entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-3 text-text-secondary">{entry.period}</td>
                          <td className="px-4 py-3 text-text-primary">
                            {entry.asset.name}
                            <span className="ml-2 font-mono text-[11px] text-text-muted">{entry.asset.assetCode}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(entry.amount)}</td>
                          <td className="px-4 py-3 text-right text-text-primary">{formatCurrency(entry.bookValueAfter)}</td>
                          <td className="px-4 py-3">
                            {entry.journalEntry ? (
                              <Link
                                href={`/${tenantSlug}/finance`}
                                className="font-mono text-xs text-gold hover:underline"
                                title="View in the general ledger"
                              >
                                {entry.journalEntry.reference}
                              </Link>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
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
      </div>
    </div>
  );
}
