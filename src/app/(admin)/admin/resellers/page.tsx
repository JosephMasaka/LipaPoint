"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, ChevronLeft, ChevronRight, Plus, X, Users, Pencil, Power, Trash2, Copy,
} from "lucide-react";

interface Reseller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  code: string;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  _count?: { tenants: number };
  totalRevenue?: number;
  totalCommission?: number;
}

interface ResellerDetail extends Reseller {
  tenants: Array<{
    id: string; name: string; slug: string; type: string; tier: string;
    isActive: boolean; createdAt: string;
  }>;
  payments: Array<{
    id: string; amount: number; commission: number; type: string;
    description: string | null; createdAt: string;
    tenant: { id: string; name: string; slug: string } | null;
  }>;
}

interface ResellerForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  code: string;
  commissionPercent: string;
  isActive: boolean;
}

const emptyForm: ResellerForm = {
  name: "", email: "", phone: "", password: "", code: "", commissionPercent: "10", isActive: true,
};

function formatKes(amount: number | undefined) {
  return `KSh ${(amount ?? 0).toLocaleString()}`;
}

export default function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState<null | { mode: "create" } | { mode: "edit"; reseller: Reseller }>(null);
  const [form, setForm] = useState<ResellerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const [detail, setDetail] = useState<ResellerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchResellers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", "20");
    const res = await fetch(`/api/admin/resellers?${params}`);
    if (res.ok) {
      const data = await res.json();
      setResellers(data.resellers);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchResellers(); }, [fetchResellers]);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setModalOpen({ mode: "create" });
  }

  function openEdit(reseller: Reseller) {
    setForm({
      name: reseller.name,
      email: reseller.email,
      phone: reseller.phone ?? "",
      password: "",
      code: reseller.code,
      commissionPercent: String(reseller.commissionPercent),
      isActive: reseller.isActive,
    });
    setFormError("");
    setModalOpen({ mode: "edit", reseller });
  }

  async function openDetail(reseller: Reseller) {
    setDetailLoading(true);
    setDetail(null);
    const res = await fetch(`/api/admin/resellers/${reseller.id}`);
    if (res.ok) {
      const data = await res.json();
      setDetail(data.reseller);
    }
    setDetailLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      commissionPercent: Number(form.commissionPercent),
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;
    if (modalOpen?.mode === "create" || form.code) payload.code = form.code;

    try {
      const isEdit = modalOpen?.mode === "edit";
      const res = await fetch(
        isEdit ? `/api/admin/resellers/${(modalOpen as { mode: "edit"; reseller: Reseller }).reseller.id}` : "/api/admin/resellers",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save reseller");
        return;
      }
      setModalOpen(null);
      fetchResellers();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(reseller: Reseller) {
    const res = await fetch(`/api/admin/resellers/${reseller.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !reseller.isActive }),
    });
    if (res.ok) fetchResellers();
  }

  async function handleDelete(reseller: Reseller) {
    if (!confirm(`Delete reseller "${reseller.name}"?`)) return;
    setDeleting(reseller.id);
    const res = await fetch(`/api/admin/resellers/${reseller.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Couldn't delete this reseller.");
    }
    setDeleting(null);
    fetchResellers();
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Resellers</h1>
          <p className="text-text-secondary text-sm mt-1">
            Partners who refer tenants and earn commission on their subscriptions
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Reseller
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search by name, email or code..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 bg-surface-elevated border-border"
        />
      </div>

      <Card className="bg-surface-elevated border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Code</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Commission</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Tenants</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Earnings</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-text-muted">Loading...</td></tr>
                ) : resellers.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-text-muted">No resellers yet — create your first one.</td></tr>
                ) : (
                  resellers.map((reseller) => (
                    <tr key={reseller.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-3 px-4 text-text-primary font-medium">{reseller.name}</td>
                      <td className="py-3 px-4 text-text-secondary">{reseller.email}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => copyCode(reseller.code)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs bg-surface px-2 py-1 rounded-md border border-border text-gold hover:bg-surface-hover"
                          title="Copy code"
                        >
                          {reseller.code} <Copy className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">{reseller.commissionPercent}%</td>
                      <td className="py-3 px-4 text-text-secondary">{reseller._count?.tenants ?? 0}</td>
                      <td className="py-3 px-4">
                        <div className="text-text-primary">{formatKes(reseller.totalRevenue)}</div>
                        <div className="text-xs text-gold">+{formatKes(reseller.totalCommission)} comm.</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={reseller.isActive
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"}>
                          {reseller.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDetail(reseller)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                            title="View referred tenants"
                          >
                            <Users className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(reseller)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(reseller)}
                            className={`p-1.5 rounded-lg hover:bg-surface-hover ${reseller.isActive ? "text-amber-500" : "text-green-500"}`}
                            title={reseller.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(reseller)}
                            disabled={deleting === reseller.id}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-red-400 hover:text-red-500 disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOpen(null)}>
          <div
            className="bg-surface-elevated border border-border rounded-xl p-6 max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">
                {modalOpen.mode === "edit" ? "Edit Reseller" : "New Reseller"}
              </h2>
              <button onClick={() => setModalOpen(null)} className="p-1 rounded-lg hover:bg-surface-hover text-text-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {formError}
                </div>
              )}

              <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input label="Phone (optional)" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input
                label={modalOpen.mode === "edit" ? "New Password (leave blank to keep)" : "Password"}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
                minLength={modalOpen.mode === "create" ? 8 : undefined}
                required={modalOpen.mode === "create"}
              />
              <Input
                label="Signup Code (blank to auto-generate)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. JOHN2026"
              />
              <Input
                label="Commission (%)"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                required
              />

              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-border"
                />
                Active (code accepted at signup, portal access enabled)
              </label>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setModalOpen(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="lg" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : modalOpen.mode === "edit" ? "Save Changes" : "Create Reseller"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modalOpen === null && (detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetail(null)}>
          <div
            className="bg-surface-elevated border border-border rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">
                {detail ? `${detail.name} — ${detail.code}` : "Loading..."}
              </h2>
              <button onClick={() => setDetail(null)} className="p-1 rounded-lg hover:bg-surface-hover text-text-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading && !detail && <p className="text-text-muted text-sm">Loading details...</p>}

            {detail && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-surface border-border">
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-text-primary">{detail.tenants.length}</p>
                      <p className="text-xs text-text-muted">Referred Tenants</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-surface border-border">
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-text-primary">{formatKes(detail.totalRevenue)}</p>
                      <p className="text-xs text-text-muted">Revenue Brought</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-surface border-border">
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-gold">{formatKes(detail.totalCommission)}</p>
                      <p className="text-xs text-text-muted">Commission ({detail.commissionPercent}%)</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-2">Referred Tenants</h3>
                  {detail.tenants.length === 0 ? (
                    <p className="text-sm text-text-muted">No tenants referred yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Tenant</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Tier</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Status</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.tenants.map((t) => (
                            <tr key={t.id} className="border-b border-border/50">
                              <td className="py-2 px-3 text-text-primary">{t.name}</td>
                              <td className="py-2 px-3 text-text-secondary">{t.tier}</td>
                              <td className="py-2 px-3">
                                <Badge variant={t.isActive ? "success" : "secondary"}>
                                  {t.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-2">Recent Subscription Payments</h3>
                  {detail.payments.length === 0 ? (
                    <p className="text-sm text-text-muted">No subscription payments yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Date</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Tenant</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Type</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Amount</th>
                            <th className="text-left py-2 px-3 text-text-secondary font-medium">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.payments.map((p) => (
                            <tr key={p.id} className="border-b border-border/50">
                              <td className="py-2 px-3 text-text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                              <td className="py-2 px-3 text-text-primary">{p.tenant?.name ?? "—"}</td>
                              <td className="py-2 px-3 text-text-secondary">
                                {p.type.startsWith("UPGRADE:") ? "Upgrade" : "Subscription"}
                              </td>
                              <td className="py-2 px-3 text-text-secondary">{formatKes(p.amount)}</td>
                              <td className="py-2 px-3 text-gold">{formatKes(p.commission)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
