"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, Tag, X, CheckCircle, AlertCircle, Trash2, Edit2, Power,
} from "lucide-react";

interface Discount {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "PERCENTAGE",
    value: "",
    minOrder: "",
    maxUses: "",
    startsAt: "",
    expiresAt: "",
  });
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/discounts");
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Discount name is required");
      return;
    }

    if (!form.value || parseFloat(form.value) <= 0) {
      setError("Value must be greater than 0");
      return;
    }

    if (form.type === "PERCENTAGE" && parseFloat(form.value) > 100) {
      setError("Percentage cannot exceed 100");
      return;
    }

    const payload = {
      name: form.name,
      code: form.code || null,
      type: form.type,
      value: parseFloat(form.value),
      minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
    };

    try {
      const url = editingDiscount ? `/api/discounts/${editingDiscount.id}` : "/api/discounts";
      const method = editingDiscount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error");
        return;
      }

      resetForm();
      fetchDiscounts();
      notify("success", editingDiscount ? "Discount updated" : "Discount created");
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (discount: Discount) => {
    setEditingDiscount(discount);
    setForm({
      name: discount.name,
      code: discount.code || "",
      type: discount.type,
      value: String(discount.value),
      minOrder: discount.minOrder ? String(discount.minOrder) : "",
      maxUses: discount.maxUses ? String(discount.maxUses) : "",
      startsAt: discount.startsAt ? discount.startsAt.slice(0, 16) : "",
      expiresAt: discount.expiresAt ? discount.expiresAt.slice(0, 16) : "",
    });
    setShowForm(true);
  };

  const toggleActive = async (discount: Discount) => {
    try {
      const res = await fetch(`/api/discounts/${discount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !discount.isActive }),
      });
      if (res.ok) {
        fetchDiscounts();
        notify("success", discount.isActive ? "Discount deactivated" : "Discount activated");
      }
    } catch {
      notify("error", "Failed to update discount");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/discounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDiscounts();
        setConfirmDelete(null);
        notify("success", "Discount removed");
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to delete");
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingDiscount(null);
    setForm({ name: "", code: "", type: "PERCENTAGE", value: "", minOrder: "", maxUses: "", startsAt: "", expiresAt: "" });
    setError("");
  };

  const getStatusBadge = (discount: Discount) => {
    if (!discount.isActive) return <Badge variant="destructive">Inactive</Badge>;
    const now = new Date();
    if (discount.expiresAt && new Date(discount.expiresAt) < now) return <Badge variant="destructive">Expired</Badge>;
    if (discount.startsAt && new Date(discount.startsAt) > now) return <Badge variant="warning">Scheduled</Badge>;
    if (discount.maxUses && discount.usedCount >= discount.maxUses) return <Badge variant="secondary">Maxed Out</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Discounts" subtitle="Manage discount codes and promotions" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-gold" />
            <span className="text-sm text-text-secondary">{discounts.length} discount{discounts.length !== 1 ? "s" : ""}</span>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create Discount</span><span className="sm:hidden">Create</span>
          </Button>
        </div>

        {/* Create/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-bold text-text-primary">
                  {editingDiscount ? "Edit Discount" : "New Discount"}
                </h3>
                <button onClick={resetForm} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                <Input
                  label="Discount Name"
                  placeholder="e.g. Summer Sale, VIP 10%"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />

                <Input
                  label="Coupon Code (optional)"
                  placeholder="e.g. SUMMER2024"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_AMOUNT">Fixed Amount (KSh)</option>
                    </select>
                  </div>
                  <Input
                    label={form.type === "PERCENTAGE" ? "Percentage" : "Amount (KSh)"}
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.type === "PERCENTAGE" ? "100" : undefined}
                    placeholder={form.type === "PERCENTAGE" ? "10" : "500"}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Min. Order (KSh)"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional"
                    value={form.minOrder}
                    onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                  />
                  <Input
                    label="Max Uses"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Unlimited"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Starts At</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Expires At</label>
                    <input
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                      className="w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>
                  <Button type="submit" className="flex-1 gap-1.5">
                    <Plus className="h-4 w-4" /> {editingDiscount ? "Update" : "Create Discount"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Discounts Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Usage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Expires</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-12"><Loader label="Loading discounts..." className="py-4" /></td></tr>
                  ) : discounts.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">No discounts yet. Create your first discount to get started.</td></tr>
                  ) : discounts.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center">
                            <Tag className="h-4 w-4 text-gold" />
                          </div>
                          <p className="font-medium text-text-primary">{d.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.code ? (
                          <code className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-xs font-mono text-text-primary">{d.code}</code>
                        ) : (
                          <span className="text-text-muted text-xs">No code</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {d.type === "PERCENTAGE" ? "Percentage" : "Fixed Amount"}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {d.type === "PERCENTAGE" ? `${d.value}%` : formatCurrency(d.value)}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : " uses"}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(d)}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {d.expiresAt
                          ? new Date(d.expiresAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleActive(d)}
                            className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors", d.isActive ? "hover:bg-amber-500/10 text-text-secondary hover:text-amber-400" : "hover:bg-emerald-500/10 text-text-secondary hover:text-emerald-400")}
                            title={d.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleEdit(d)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(d.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Discount</h3>
              <p className="text-sm text-text-secondary">This action cannot be undone. The discount code will no longer be usable.</p>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
