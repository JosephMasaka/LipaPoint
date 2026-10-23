"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Pagination } from "@/components/pagination";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, Search, Truck, Phone, Mail, X,
  CheckCircle, AlertCircle, Trash2, Edit2, Eye, ArrowLeft, Building2, FileText, Receipt,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  kraPin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTerms: string | null;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

interface SupplierDetail extends Supplier {
  purchaseOrders: {
    id: string;
    poNumber: string;
    status: string;
    total: number;
    createdAt: string;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    amount: number;
    paidAmount: number;
    status: string;
    dueDate: string | null;
  }[];
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PO_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  partially_received: "warning",
  received: "success",
  closed: "secondary",
  cancelled: "destructive",
};

const INVOICE_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  unpaid: "warning",
  partial: "default",
  paid: "success",
};

const EMPTY_FORM = {
  name: "",
  kraPin: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<SupplierDetail | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchSuppliers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/suppliers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers);
        setPagination(data.pagination);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuppliers(1), 300);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Supplier name is required");
      return;
    }
    try {
      const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error");
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditing(null);
      fetchSuppliers(pagination.page);
      notify("success", editing ? "Supplier updated" : "Supplier added");
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      kraPin: supplier.kraPin || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      paymentTerms: supplier.paymentTerms || "",
    });
    setShowForm(true);
  };

  const handleView = async (id: string) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`);
      if (res.ok) setViewing(await res.json());
      else notify("error", "Failed to load supplier details");
    } catch {
      notify("error", "Failed to load supplier details");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSuppliers(pagination.page);
        setConfirmDelete(null);
        notify("success", "Supplier archived");
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to archive");
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  // ── Supplier detail ──
  if (viewing) {
    const owed = viewing.balance > 0;
    return (
      <div className="min-h-screen bg-surface">
        <Header title="Supplier Details" subtitle={viewing.name} />
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <Button variant="outline" onClick={() => setViewing(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Suppliers
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{viewing.name}</h3>
                    <p className="text-xs text-text-muted">
                      Supplier since {new Date(viewing.createdAt).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {viewing.phone && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Phone className="h-4 w-4 text-text-muted" /> {viewing.phone}
                  </div>
                )}
                {viewing.email && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Mail className="h-4 w-4 text-text-muted" /> {viewing.email}
                  </div>
                )}
                {viewing.address && <p className="text-sm text-text-secondary">{viewing.address}</p>}
                {viewing.kraPin && (
                  <p className="text-xs text-text-muted">
                    KRA PIN: <span className="font-mono">{viewing.kraPin}</span>
                  </p>
                )}
                {viewing.paymentTerms && (
                  <p className="text-xs text-text-muted italic">Terms: {viewing.paymentTerms}</p>
                )}

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-text-muted">Balance owed</p>
                  <p className={cn("text-xl font-bold", owed ? "text-red-400" : "text-emerald-400")}>
                    {formatCurrency(Math.abs(viewing.balance))}
                    {owed ? " due" : viewing.balance < 0 ? " in credit" : " — settled"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { const s = viewing; setViewing(null); handleEdit(s); }}
                >
                  <Edit2 className="h-4 w-4" /> Edit Supplier
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <FileText className="h-4 w-4 text-text-muted" />
                    <h4 className="text-sm font-semibold text-text-primary">Purchase Orders</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">PO</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Total</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewing.purchaseOrders.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">No purchase orders yet.</td></tr>
                        ) : viewing.purchaseOrders.map((po) => (
                          <tr key={po.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{po.poNumber}</td>
                            <td className="px-4 py-2.5 font-medium text-text-primary">{formatCurrency(po.total)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant={PO_STATUS_VARIANT[po.status] ?? "secondary"}>{po.status.replace(/_/g, " ")}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-muted">
                              {new Date(po.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-text-muted" />
                    <h4 className="text-sm font-semibold text-text-primary">Supplier Invoices</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Invoice</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Amount</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Paid</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewing.invoices.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No invoices recorded yet.</td></tr>
                        ) : viewing.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{inv.invoiceNumber}</td>
                            <td className="px-4 py-2.5 font-medium text-text-primary">{formatCurrency(inv.amount)}</td>
                            <td className="px-4 py-2.5 text-text-secondary">{formatCurrency(inv.paidAmount)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? "secondary"}>{inv.status}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-muted">
                              {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—"}
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

  // ── List view ──
  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Suppliers" subtitle="Manage suppliers, purchase orders and what you owe them" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search by name, phone, KRA PIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { cancelForm(); setShowForm(true); }} className="gap-2 w-fit">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Supplier</span><span className="sm:hidden">Add</span>
          </Button>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cancelForm} />
            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-bold text-text-primary">
                  {editing ? "Edit Supplier" : "New Supplier"}
                </h3>
                <button onClick={cancelForm} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                <Input
                  label="Supplier Name"
                  placeholder="Coca-Cola Distributors"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Phone"
                    placeholder="+254 7XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="orders@supplier.co.ke"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="KRA PIN"
                    placeholder="P000000000X"
                    value={form.kraPin}
                    onChange={(e) => setForm({ ...form, kraPin: e.target.value })}
                  />
                  <Input
                    label="Payment Terms"
                    placeholder="Net 30"
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  />
                </div>
                <Input
                  label="Address"
                  placeholder="Industrial Area, Nairobi"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={cancelForm}>Cancel</Button>
                  <Button type="submit" className="flex-1 gap-1.5">
                    <Plus className="h-4 w-4" /> {editing ? "Update" : "Add Supplier"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">KRA PIN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Terms</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Balance</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-12"><Loader label="Loading suppliers..." className="py-4" /></td></tr>
                  ) : suppliers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                      {search ? "No suppliers found matching your search." : "No suppliers yet. Add your first supplier to start raising purchase orders."}
                    </td></tr>
                  ) : suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-gold" />
                          </div>
                          <p className="font-medium text-text-primary">{s.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{s.phone || "—"}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs font-mono">{s.kraPin || "—"}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{s.paymentTerms || "—"}</td>
                      <td className={cn("px-4 py-3 font-medium", s.balance > 0 ? "text-red-400" : "text-emerald-400")}>
                        {formatCurrency(s.balance)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleView(s.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gold/10 text-text-secondary hover:text-gold transition-colors" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleEdit(s)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(s)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors" title="Archive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
              onPageChange={(page) => fetchSuppliers(page)}
            />
          </CardContent>
        </Card>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Archive Supplier</h3>
              <p className="text-sm text-text-secondary">
                {confirmDelete.name} will be hidden from new purchase orders. Existing history is kept.
              </p>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => handleDelete(confirmDelete.id)}>Archive</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
