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
  Plus, Search, Scissors, X, Edit2, Trash2,
  CheckCircle, AlertCircle, Clock, DollarSign, Activity, Hash,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  isActive: boolean;
  categoryId: string | null;
  category: Category | null;
  _count: { appointments: number };
  createdAt: string;
}

export default function ServiceCatalogPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    price: "",
    duration: "30",
    description: "",
    categoryId: "",
    isActive: true,
  });

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/products?categories=true");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCategories(data);
        } else if (data.categories) {
          setCategories(data.categories);
        }
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, [fetchServices, fetchCategories]);

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalServices = services.length;
  const activeServices = services.filter((s) => s.isActive).length;
  const avgPrice = totalServices > 0 ? services.reduce((sum, s) => sum + s.price, 0) / totalServices : 0;
  const avgDuration = totalServices > 0 ? Math.round(services.reduce((sum, s) => sum + s.duration, 0) / totalServices) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Service name is required");
      return;
    }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setError("A valid price is required");
      return;
    }

    try {
      const url = editingService ? `/api/services/${editingService.id}` : "/api/services";
      const method = editingService ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          duration: Number(form.duration) || 30,
          description: form.description || null,
          categoryId: form.categoryId || null,
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error");
        return;
      }

      resetForm();
      fetchServices();
      notify("success", editingService ? "Service updated" : "Service added");
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration),
      description: service.description || "",
      categoryId: service.categoryId || "",
      isActive: service.isActive,
    });
    setShowForm(true);
    setError("");
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchServices();
        setConfirmDelete(null);
        notify("success", "Service deleted");
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to delete");
        setConfirmDelete(null);
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingService(null);
    setForm({ name: "", price: "", duration: "30", description: "", categoryId: "", isActive: true });
    setError("");
  };

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm",
          notification.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        )}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Service Catalog" subtitle="Manage your services and pricing" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <Hash className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Services</p>
                <p className="text-lg font-bold text-text-primary">{totalServices}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Active Services</p>
                <p className="text-lg font-bold text-text-primary">{activeServices}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Avg. Price</p>
                <p className="text-lg font-bold text-text-primary">{formatCurrency(avgPrice)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Avg. Duration</p>
                <p className="text-lg font-bold text-text-primary">{avgDuration} min</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2 w-fit">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Service</span><span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Service Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader label="Loading services..." />
          </div>
        ) : filteredServices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Scissors className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-30" />
              <p className="text-text-muted">
                {search ? "No services found matching your search." : "No services yet. Add your first service to get started."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <Card key={service.id} className="hover:border-gold/30 transition-colors">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary truncate">{service.name}</h3>
                      </div>
                      {service.category && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: service.category.color }}
                          />
                          <span className="text-xs text-text-secondary">{service.category.name}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant={service.isActive ? "success" : "destructive"}>
                      {service.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-sm font-semibold text-text-primary">{formatCurrency(service.price)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-sm text-text-secondary">{service.duration} min</span>
                    </div>
                  </div>

                  {service.description && (
                    <p className="text-xs text-text-muted line-clamp-2">{service.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Badge variant="secondary">
                      {service._count.appointments} appointment{service._count.appointments !== 1 ? "s" : ""}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(service)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(service.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">
                {editingService ? "Edit Service" : "New Service"}
              </h3>
              <button onClick={resetForm} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

              <Input
                label="Service Name"
                placeholder="e.g., Haircut, Beard Trim"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Price (KSh)"
                  type="number"
                  placeholder="500"
                  min="0"
                  step="any"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
                <Input
                  label="Duration (minutes)"
                  type="number"
                  placeholder="30"
                  min="5"
                  step="5"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Description</label>
                <textarea
                  placeholder="Brief description of the service..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="h-5 w-9 rounded-full bg-surface-hover peer-checked:bg-gold transition-colors" />
                  <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-sm text-text-secondary">Active</span>
              </label>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>
                <Button type="submit" className="flex-1 gap-1.5">
                  <Plus className="h-4 w-4" /> {editingService ? "Update" : "Add Service"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Service</h3>
              <p className="text-sm text-text-secondary">This action cannot be undone. Services with existing appointments cannot be deleted.</p>
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
