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
  Plus, Search, UserCircle, Phone, Mail, X,
  CheckCircle, AlertCircle, Trash2, Edit2, Eye, ArrowLeft,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  totalSpent: number;
  visitCount: number;
  lastVisit: string | null;
  loyaltyPoints: number;
  createdAt: string;
}

interface CustomerWithOrders extends Customer {
  orders: {
    id: string;
    orderNo: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }[];
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerWithOrders | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchCustomers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setPagination(data.pagination);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(1), 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Customer name is required");
      return;
    }

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

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

      setForm({ name: "", email: "", phone: "", address: "", notes: "" });
      setShowForm(false);
      setEditingCustomer(null);
      fetchCustomers(pagination.page);
      notify("success", editingCustomer ? "Customer updated" : "Customer added");
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setShowForm(true);
  };

  const handleView = async (id: string) => {
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingCustomer(data);
      }
    } catch {
      notify("error", "Failed to load customer details");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCustomers(pagination.page);
        setConfirmDelete(null);
        notify("success", "Customer removed");
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to delete");
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setForm({ name: "", email: "", phone: "", address: "", notes: "" });
    setError("");
  };

  // Customer detail view
  if (viewingCustomer) {
    return (
      <div className="min-h-screen bg-surface">
        <Header title="Customer Details" subtitle={viewingCustomer.name} />
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <Button variant="outline" onClick={() => setViewingCustomer(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Customers
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer Info */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center">
                    <UserCircle className="h-6 w-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{viewingCustomer.name}</h3>
                    <p className="text-xs text-text-muted">Customer since {new Date(viewingCustomer.createdAt).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}</p>
                  </div>
                </div>

                {viewingCustomer.phone && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Phone className="h-4 w-4 text-text-muted" />
                    {viewingCustomer.phone}
                  </div>
                )}
                {viewingCustomer.email && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Mail className="h-4 w-4 text-text-muted" />
                    {viewingCustomer.email}
                  </div>
                )}
                {viewingCustomer.address && (
                  <p className="text-sm text-text-secondary">{viewingCustomer.address}</p>
                )}
                {viewingCustomer.notes && (
                  <p className="text-sm text-text-muted italic">{viewingCustomer.notes}</p>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-text-muted">Total Spent</p>
                    <p className="text-sm font-bold text-text-primary">{formatCurrency(viewingCustomer.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Visits</p>
                    <p className="text-sm font-bold text-text-primary">{viewingCustomer.visitCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Loyalty Points</p>
                    <p className="text-sm font-bold text-gold">{viewingCustomer.loyaltyPoints}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Last Visit</p>
                    <p className="text-sm font-bold text-text-primary">
                      {viewingCustomer.lastVisit
                        ? new Date(viewingCustomer.lastVisit).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
                        : "Never"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order History */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-text-primary">Order History</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Order</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Total</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Payment</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewingCustomer.orders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-text-muted">No orders yet.</td>
                          </tr>
                        ) : viewingCustomer.orders.map((order) => (
                          <tr key={order.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{order.orderNo}</td>
                            <td className="px-4 py-2.5 font-medium text-text-primary">{formatCurrency(order.total)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant={order.status === "COMPLETED" ? "success" : order.status === "CANCELLED" ? "destructive" : "secondary"}>
                                {order.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary">{order.paymentMethod.replace(/_/g, " ")}</td>
                            <td className="px-4 py-2.5 text-xs text-text-muted">{new Date(order.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
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

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Customers" subtitle="Manage your customer database and track loyalty" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Actions bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { cancelForm(); setShowForm(true); }} className="gap-2 w-fit">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Customer</span><span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cancelForm} />
            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-bold text-text-primary">
                  {editingCustomer ? "Edit Customer" : "New Customer"}
                </h3>
                <button onClick={cancelForm} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                <Input
                  label="Full Name"
                  placeholder="Jane Wanjiku"
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
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <Input
                  label="Address"
                  placeholder="Westlands, Nairobi"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <Input
                  label="Notes"
                  placeholder="Any notes about this customer..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={cancelForm}>Cancel</Button>
                  <Button type="submit" className="flex-1 gap-1.5">
                    <Plus className="h-4 w-4" /> {editingCustomer ? "Update" : "Add Customer"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Customers Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Total Spent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Visits</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Points</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Last Visit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-12"><Loader label="Loading customers..." className="py-4" /></td></tr>
                  ) : customers.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                      {search ? "No customers found matching your search." : "No customers yet. Add your first customer to get started."}
                    </td></tr>
                  ) : customers.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-gold">{c.name.charAt(0)}</span>
                          </div>
                          <p className="font-medium text-text-primary">{c.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{c.phone || "-"}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{c.email || "-"}</td>
                      <td className="px-4 py-3 font-medium text-text-primary">{formatCurrency(c.totalSpent)}</td>
                      <td className="px-4 py-3 text-text-secondary">{c.visitCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-gold">{c.loyaltyPoints}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {c.lastVisit
                          ? new Date(c.lastVisit).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleView(c.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gold/10 text-text-secondary hover:text-gold transition-colors" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleEdit(c)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(c.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors" title="Delete">
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
              onPageChange={(page) => fetchCustomers(page)}
            />
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
              <h3 className="text-lg font-bold text-text-primary mb-2">Remove Customer</h3>
              <p className="text-sm text-text-secondary">This action cannot be undone. Customer data and their order association will be removed.</p>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => handleDelete(confirmDelete)}>Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
