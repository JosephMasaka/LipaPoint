"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, ChevronLeft, ChevronRight, Plus, X, Ticket, Pencil, Power, Trash2,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  name: string | null;
  type: "PERCENT" | "FIXED";
  value: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  _count?: { redemptions: number };
}

interface CouponForm {
  code: string;
  name: string;
  type: "PERCENT" | "FIXED";
  value: string;
  maxUses: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const emptyForm: CouponForm = {
  code: "", name: "", type: "PERCENT", value: "", maxUses: "",
  startsAt: "", expiresAt: "", isActive: true,
};

function couponStatus(c: Coupon): { label: string; className: string } {
  if (!c.isActive) return { label: "Inactive", className: "bg-red-500/10 text-red-400 border-red-500/20" };
  const now = Date.now();
  if (c.startsAt && now < new Date(c.startsAt).getTime()) {
    return { label: "Scheduled", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
  }
  if (c.expiresAt && now > new Date(c.expiresAt).getTime()) {
    return { label: "Expired", className: "bg-red-500/10 text-red-400 border-red-500/20" };
  }
  if (c.maxUses !== null && c.usedCount >= c.maxUses) {
    return { label: "Used Up", className: "bg-red-500/10 text-red-400 border-red-500/20" };
  }
  return { label: "Active", className: "bg-green-500/10 text-green-500 border-green-500/20" };
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState<null | { mode: "create" } | { mode: "edit"; coupon: Coupon }>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", "20");
    const res = await fetch(`/api/admin/coupons?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCoupons(data.coupons);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setModalOpen({ mode: "create" });
  }

  function openEdit(coupon: Coupon) {
    setForm({
      code: coupon.code,
      name: coupon.name ?? "",
      type: coupon.type,
      value: String(coupon.value),
      maxUses: coupon.maxUses !== null ? String(coupon.maxUses) : "",
      startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : "",
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
      isActive: coupon.isActive,
    });
    setFormError("");
    setModalOpen({ mode: "edit", coupon });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload: Record<string, unknown> = {
      code: form.code,
      name: form.name || null,
      type: form.type,
      value: Number(form.value),
      maxUses: form.maxUses === "" ? null : Number(form.maxUses),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isActive: form.isActive,
    };

    try {
      const isEdit = modalOpen?.mode === "edit";
      const res = await fetch(
        isEdit ? `/api/admin/coupons/${(modalOpen as { mode: "edit"; coupon: Coupon }).coupon.id}` : "/api/admin/coupons",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save coupon");
        return;
      }
      setModalOpen(null);
      fetchCoupons();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(coupon: Coupon) {
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    if (res.ok) fetchCoupons();
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    setDeleting(coupon.id);
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Couldn't delete this coupon.");
    }
    setDeleting(null);
    fetchCoupons();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Coupons</h1>
          <p className="text-text-secondary text-sm mt-1">
            Platform discounts applied to signups, renewals and upgrades
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Coupon
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search by code or name..."
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
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Code</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Discount</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Usage</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Validity</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-text-muted">Loading...</td></tr>
                ) : coupons.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-text-muted">No coupons yet — create your first one.</td></tr>
                ) : (
                  coupons.map((coupon) => {
                    const status = couponStatus(coupon);
                    return (
                      <tr key={coupon.id} className="border-b border-border/50 hover:bg-surface-hover">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-text-primary">
                            <Ticket className="h-3.5 w-3.5 text-gold" /> {coupon.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{coupon.name || "—"}</td>
                        <td className="py-3 px-4 text-text-primary">
                          {coupon.type === "PERCENT" ? `${coupon.value}% off` : `KSh ${coupon.value.toLocaleString()} off`}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          {coupon.usedCount}{coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ""}
                        </td>
                        <td className="py-3 px-4 text-text-muted text-xs">
                          {formatDate(coupon.startsAt)} → {formatDate(coupon.expiresAt)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={status.className}>{status.label}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(coupon)}
                              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggle(coupon)}
                              className={`p-1.5 rounded-lg hover:bg-surface-hover ${coupon.isActive ? "text-amber-500" : "text-green-500"}`}
                              title={coupon.isActive ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(coupon)}
                              disabled={deleting === coupon.id}
                              className="p-1.5 rounded-lg hover:bg-surface-hover text-red-400 hover:text-red-500 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOpen(null)}>
          <div
            className="bg-surface-elevated border border-border rounded-xl p-6 max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">
                {modalOpen.mode === "edit" ? "Edit Coupon" : "New Coupon"}
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

              <Input
                label="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. LAUNCH20"
                required
              />
              <Input
                label="Name (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Launch promotion"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as CouponForm["type"] })}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                  >
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FIXED">Fixed amount (KSh)</option>
                  </select>
                </div>
                <Input
                  label={form.type === "PERCENT" ? "Percent off" : "Amount off (KSh)"}
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={form.type === "PERCENT" ? "100" : undefined}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Max total uses (blank = unlimited)"
                type="number"
                min="1"
                step="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Unlimited"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">Starts (optional)</label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">Expires (optional)</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-border"
                />
                Active (can be redeemed)
              </label>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setModalOpen(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="lg" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : modalOpen.mode === "edit" ? "Save Changes" : "Create Coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
