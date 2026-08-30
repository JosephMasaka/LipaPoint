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
  Plus,
  Truck,
  X,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit2,
  Power,
  MapPin,
  Clock,
  Phone,
  Package,
} from "lucide-react";

interface DeliveryZone {
  id: string;
  name: string;
  minOrder: number;
  deliveryFee: number;
  estimatedTime: number;
  isActive: boolean;
  createdAt: string;
}

interface DeliveryOrder {
  id: string;
  orderNo: string;
  customerName: string | null;
  deliveryAddress: string | null;
  deliveryPhone: string | null;
  deliveryFee: number | null;
  total: number;
  status: string;
  createdAt: string;
}

export default function DeliveryManagementPage() {
  const [activeTab, setActiveTab] = useState<"zones" | "deliveries">("zones");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState({
    name: "",
    deliveryFee: "",
    minOrder: "",
    estimatedTime: "",
  });
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{
    type: string;
    message: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchZones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/delivery-zones");
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        const deliveryOrders = data.filter(
          (o: DeliveryOrder) => o.deliveryAddress
        );
        setOrders(deliveryOrders);
      }
    } catch {
      // silent fail
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  useEffect(() => {
    if (activeTab === "deliveries") {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Zone name is required");
      return;
    }

    const payload = {
      name: form.name,
      deliveryFee: form.deliveryFee ? parseFloat(form.deliveryFee) : 0,
      minOrder: form.minOrder ? parseFloat(form.minOrder) : 0,
      estimatedTime: form.estimatedTime ? parseInt(form.estimatedTime) : 30,
    };

    try {
      const url = editingZone
        ? `/api/delivery-zones/${editingZone.id}`
        : "/api/delivery-zones";
      const method = editingZone ? "PUT" : "POST";

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
      fetchZones();
      notify("success", editingZone ? "Zone updated" : "Zone created");
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setForm({
      name: zone.name,
      deliveryFee: String(zone.deliveryFee),
      minOrder: String(zone.minOrder),
      estimatedTime: String(zone.estimatedTime),
    });
    setShowForm(true);
  };

  const toggleActive = async (zone: DeliveryZone) => {
    try {
      const res = await fetch(`/api/delivery-zones/${zone.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !zone.isActive }),
      });
      if (res.ok) {
        fetchZones();
        notify(
          "success",
          zone.isActive ? "Zone deactivated" : "Zone activated"
        );
      }
    } catch {
      notify("error", "Failed to update zone");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/delivery-zones/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchZones();
        setConfirmDelete(null);
        notify("success", "Delivery zone removed");
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
    setEditingZone(null);
    setForm({ name: "", deliveryFee: "", minOrder: "", estimatedTime: "" });
    setError("");
  };

  // Stats
  const totalZones = zones.length;
  const activeZones = zones.filter((z) => z.isActive).length;
  const avgDeliveryFee =
    zones.length > 0
      ? zones.reduce((sum, z) => sum + z.deliveryFee, 0) / zones.length
      : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="success">Completed</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

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
        title="Delivery Management"
        subtitle="Manage delivery zones and track deliveries"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-surface-elevated/50 border border-border rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("zones")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "zones"
                ? "bg-gold text-black shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            )}
          >
            Delivery Zones
          </button>
          <button
            onClick={() => setActiveTab("deliveries")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "deliveries"
                ? "bg-gold text-black shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            )}
          >
            Active Deliveries
          </button>
        </div>

        {/* Tab 1: Delivery Zones */}
        {activeTab === "zones" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Total Zones</p>
                      <p className="text-xl font-bold text-text-primary">
                        {totalZones}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Active Zones</p>
                      <p className="text-xl font-bold text-text-primary">
                        {activeZones}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">
                        Avg. Delivery Fee
                      </p>
                      <p className="text-xl font-bold text-text-primary">
                        {formatCurrency(avgDeliveryFee)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-gold" />
                <span className="text-sm text-text-secondary">
                  {zones.length} zone{zones.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Add Zone</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>

            {/* Create/Edit Form Modal */}
            {showForm && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={resetForm}
                />
                <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">
                      {editingZone ? "Edit Zone" : "New Delivery Zone"}
                    </h3>
                    <button
                      onClick={resetForm}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}

                    <Input
                      label="Zone Name"
                      placeholder="e.g. CBD, Westlands, Kilimani"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      required
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Delivery Fee"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={form.deliveryFee}
                        onChange={(e) =>
                          setForm({ ...form, deliveryFee: e.target.value })
                        }
                      />
                      <Input
                        label="Min. Order Amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={form.minOrder}
                        onChange={(e) =>
                          setForm({ ...form, minOrder: e.target.value })
                        }
                      />
                    </div>

                    <Input
                      label="Estimated Delivery Time (minutes)"
                      type="number"
                      step="1"
                      min="1"
                      placeholder="30"
                      value={form.estimatedTime}
                      onChange={(e) =>
                        setForm({ ...form, estimatedTime: e.target.value })
                      }
                    />

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={resetForm}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1 gap-1.5">
                        <Plus className="h-4 w-4" />{" "}
                        {editingZone ? "Update Zone" : "Create Zone"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Zones Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                          Zone Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                          Delivery Fee
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                          Min Order
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                          Est. Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12">
                            <Loader
                              label="Loading delivery zones..."
                              className="py-4"
                            />
                          </td>
                        </tr>
                      ) : zones.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-text-muted"
                          >
                            No delivery zones yet. Create your first zone to get
                            started.
                          </td>
                        </tr>
                      ) : (
                        zones.map((zone) => (
                          <tr
                            key={zone.id}
                            className="hover:bg-surface-hover/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center">
                                  <MapPin className="h-4 w-4 text-gold" />
                                </div>
                                <p className="font-medium text-text-primary">
                                  {zone.name}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-text-primary">
                              {formatCurrency(zone.deliveryFee)}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {formatCurrency(zone.minOrder)}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {zone.estimatedTime} min
                            </td>
                            <td className="px-4 py-3">
                              {zone.isActive ? (
                                <Badge variant="success">Active</Badge>
                              ) : (
                                <Badge variant="destructive">Inactive</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => toggleActive(zone)}
                                  className={cn(
                                    "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                                    zone.isActive
                                      ? "hover:bg-amber-500/10 text-text-secondary hover:text-amber-400"
                                      : "hover:bg-emerald-500/10 text-text-secondary hover:text-emerald-400"
                                  )}
                                  title={
                                    zone.isActive ? "Deactivate" : "Activate"
                                  }
                                >
                                  <Power className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleEdit(zone)}
                                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(zone.id)}
                                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
          </>
        )}

        {/* Tab 2: Active Deliveries */}
        {activeTab === "deliveries" && (
          <>
            {ordersLoading ? (
              <Loader label="Loading deliveries..." className="py-12" />
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
                    <Truck className="h-6 w-6 text-text-muted" />
                  </div>
                  <p className="text-text-muted text-sm">
                    No delivery orders found.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gold/10 flex items-center justify-center">
                            <Package className="h-4 w-4 text-gold" />
                          </div>
                          <span className="font-medium text-text-primary text-sm">
                            {order.orderNo}
                          </span>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      {order.customerName && (
                        <p className="text-sm text-text-primary font-medium">
                          {order.customerName}
                        </p>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-text-muted mt-0.5 shrink-0" />
                          <p className="text-xs text-text-secondary">
                            {order.deliveryAddress}
                          </p>
                        </div>

                        {order.deliveryPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-text-muted shrink-0" />
                            <p className="text-xs text-text-secondary">
                              {order.deliveryPhone}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" />
                          <p className="text-xs text-text-muted">
                            {new Date(order.createdAt).toLocaleDateString(
                              "en-KE",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        {order.deliveryFee != null && (
                          <div>
                            <p className="text-[10px] text-text-muted uppercase">
                              Delivery Fee
                            </p>
                            <p className="text-xs font-medium text-text-secondary">
                              {formatCurrency(order.deliveryFee)}
                            </p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-[10px] text-text-muted uppercase">
                            Total
                          </p>
                          <p className="text-sm font-bold text-text-primary">
                            {formatCurrency(order.total)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">
                Delete Delivery Zone
              </h3>
              <p className="text-sm text-text-secondary">
                This action cannot be undone. The delivery zone will be
                permanently removed.
              </p>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0"
                onClick={() => handleDelete(confirmDelete)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
