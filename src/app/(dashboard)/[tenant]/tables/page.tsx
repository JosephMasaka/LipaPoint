"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import {
  UtensilsCrossed, Plus, Search, Users, Pencil, Trash2,
  CheckCircle, X, LayoutGrid,
} from "lucide-react";

interface TableData {
  id: string;
  name: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  locationId: string;
  location: { id: string; name: string };
  activeOrder: {
    id: string;
    orderNo: string;
    status: string;
    total: number;
    createdAt: string;
    _count: { items: number };
  } | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" | "default"; dot: string }
> = {
  AVAILABLE: { label: "Available", variant: "success", dot: "bg-emerald-400" },
  OCCUPIED: { label: "Occupied", variant: "warning", dot: "bg-amber-400" },
  RESERVED: { label: "Reserved", variant: "secondary", dot: "bg-slate-400" },
  CLEANING: { label: "Cleaning", variant: "default", dot: "bg-gold" },
};

const STATUS_ORDER: Array<"AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING"> = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "CLEANING",
];

export default function TableManagementPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState("4");
  const [formLocationId, setFormLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchTables = useCallback(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTables(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const openAddModal = () => {
    setEditingTable(null);
    setFormName("");
    setFormCapacity("4");
    setFormLocationId("");
    setShowModal(true);
  };

  const openEditModal = (table: TableData) => {
    setEditingTable(table);
    setFormName(table.name);
    setFormCapacity(table.capacity.toString());
    setFormLocationId(table.locationId);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      notify("error", "Table name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingTable) {
        const res = await fetch(`/api/tables/${editingTable.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            capacity: parseInt(formCapacity) || 4,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify("error", data.error || "Failed to update table");
        } else {
          notify("success", "Table updated successfully");
          setShowModal(false);
          fetchTables();
        }
      } else {
        const res = await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            capacity: parseInt(formCapacity) || 4,
            locationId: formLocationId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify("error", data.error || "Failed to create table");
        } else {
          notify("success", "Table created successfully");
          setShowModal(false);
          fetchTables();
        }
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table: TableData) => {
    if (!confirm(`Delete table "${table.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        notify("error", data.error || "Failed to delete table");
      } else {
        notify("success", "Table deleted");
        fetchTables();
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const handleStatusChange = async (table: TableData, newStatus: string) => {
    setStatusDropdown(null);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === table.id ? { ...t, status: newStatus as TableData["status"] } : t
          )
        );
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to update status");
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const filtered = tables.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalTables = tables.length;
  const availableCount = tables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedCount = tables.filter((t) => t.status === "OCCUPIED").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface overflow-x-hidden">
        <Header title="Table Management" subtitle="Manage restaurant tables and seating" />
        <div className="p-4 sm:p-6 lg:p-8">
          <Loader size="lg" label="Loading tables..." className="min-h-[60vh]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Table Management" subtitle="Manage restaurant tables and seating" />

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <LayoutGrid className="h-5 w-5 text-gold" />
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{totalTables}</p>
              <p className="text-xs text-text-muted mt-1">Total Tables</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{availableCount}</p>
              <p className="text-xs text-text-muted mt-1">Available</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{occupiedCount}</p>
              <p className="text-xs text-text-muted mt-1">Occupied</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-surface-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-2" /> Add Table
          </Button>
        </div>

        {/* Table Grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <UtensilsCrossed className="h-10 w-10 text-text-muted mx-auto mb-3 opacity-30" />
              <p className="text-sm text-text-muted">
                {tables.length === 0
                  ? "No tables yet. Add your first table to get started."
                  : "No tables match your search."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((table) => {
              const config = STATUS_CONFIG[table.status];
              return (
                <Card
                  key={table.id}
                  className="hover:bg-surface-hover/50 transition-colors relative group"
                >
                  <CardContent className="p-4 sm:p-5">
                    {/* Actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(table);
                        }}
                        className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(table);
                        }}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Table Name */}
                    <div className="flex items-center gap-2 mb-3">
                      <UtensilsCrossed className="h-4 w-4 text-gold shrink-0" />
                      <h3 className="font-semibold text-text-primary text-sm truncate">
                        {table.name}
                      </h3>
                    </div>

                    {/* Capacity */}
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
                      <Users className="h-3.5 w-3.5" />
                      <span>{table.capacity} seats</span>
                    </div>

                    {/* Status Badge (clickable) */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setStatusDropdown(
                            statusDropdown === table.id ? null : table.id
                          )
                        }
                        className="w-full"
                      >
                        <Badge variant={config.variant} className="w-full justify-center cursor-pointer">
                          <span className={`h-1.5 w-1.5 rounded-full ${config.dot} mr-1.5`} />
                          {config.label}
                        </Badge>
                      </button>

                      {/* Status Dropdown */}
                      {statusDropdown === table.id && (
                        <>
                          <div
                            className="fixed inset-0 z-[60]"
                            onClick={() => setStatusDropdown(null)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-border rounded-lg shadow-xl z-[70] overflow-hidden">
                            {STATUS_ORDER.map((s) => {
                              const sc = STATUS_CONFIG[s];
                              return (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(table, s)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-hover transition-colors ${
                                    table.status === s
                                      ? "text-gold font-medium"
                                      : "text-text-secondary"
                                  }`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                                  {sc.label}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Active Order Info */}
                    {table.activeOrder && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-text-muted">
                          Order #{table.activeOrder.orderNo}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {table.activeOrder._count.items} item{table.activeOrder._count.items !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <Card className="relative w-full max-w-md z-10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-primary">
                  {editingTable ? "Edit Table" : "Add Table"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-md hover:bg-surface-hover text-text-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Table Name"
                  placeholder="e.g. Table 1, Patio A"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <Input
                  label="Capacity (seats)"
                  type="number"
                  min="1"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader size="sm" /> : editingTable ? "Update" : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
