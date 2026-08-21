"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { MapPin, Plus, Edit3, Power, X, CheckCircle, Store } from "lucide-react";

interface Register {
  id: string;
  name: string;
  isActive: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  registers: Register[];
  _count: { orders: number; stocks: number };
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
        try { localStorage.setItem("lipapoint-oc-locations", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      }
    } catch {
      try {
        const raw = localStorage.getItem("lipapoint-oc-locations");
        if (raw) { const { data } = JSON.parse(raw); setLocations(data); }
      } catch {}
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLocations(); }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setLocations([...locations, { ...data, _count: { orders: 0, stocks: 0 } }]);
        setShowAdd(false);
        setForm({ name: "", address: "", phone: "" });
        notify("success", "Location added");
      } else {
        notify("error", data.error || "Failed to add location");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("location_add", form);
        requestBackgroundSync();
        setShowAdd(false);
        setForm({ name: "", address: "", phone: "" });
        notify("info", "Saved offline — will sync when online");
      } else {
        notify("error", "Network error");
      }
    }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = { id: editing.id, ...form };
    try {
      const res = await fetch("/api/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setLocations(locations.map(l => l.id === editing.id ? { ...l, ...form } : l));
        setEditing(null);
        notify("success", "Location updated");
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to update");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("location_update", payload);
        requestBackgroundSync();
        setLocations(locations.map(l => l.id === editing.id ? { ...l, ...form } : l));
        setEditing(null);
        notify("info", "Saved offline — will sync when online");
      } else {
        notify("error", "Network error");
      }
    }
    finally { setSaving(false); }
  };

  const toggleActive = async (loc: Location) => {
    const payload = { id: loc.id, isActive: !loc.isActive };
    try {
      const res = await fetch("/api/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setLocations(locations.map(l => l.id === loc.id ? { ...l, isActive: !l.isActive } : l));
        notify("success", `Location ${!loc.isActive ? "activated" : "deactivated"}`);
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("location_update", payload);
        requestBackgroundSync();
        setLocations(locations.map(l => l.id === loc.id ? { ...l, isActive: !l.isActive } : l));
        notify("info", "Queued offline — will sync when online");
      } else {
        notify("error", "Network error");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface overflow-x-hidden">
        <Header title="Locations" subtitle="Manage your business locations" />
        <PageLoader label="Loading locations..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Locations" subtitle="Manage your business locations and registers" />

      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => { setShowAdd(true); setForm({ name: "", address: "", phone: "" }); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </div>

        {/* Add / Edit Modal */}
        {(showAdd || editing) && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAdd(false); setEditing(null); }} />
            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-text-primary">{editing ? "Edit Location" : "Add New Location"}</h3>
                <button onClick={() => { setShowAdd(false); setEditing(null); }}><X className="h-5 w-5 text-text-muted" /></button>
              </div>
              <Input label="Location Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Downtown Branch" />
              <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Moi Avenue, Nairobi" />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</Button>
                <Button className="flex-1" disabled={saving || !form.name.trim()} onClick={editing ? handleUpdate : handleAdd}>
                  {saving ? "Saving..." : editing ? "Update" : "Add Location"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Locations Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <Card key={loc.id} className={cn(!loc.isActive && "opacity-60")}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                      <MapPin className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{loc.name}</CardTitle>
                      {loc.address && <CardDescription className="text-xs mt-0.5">{loc.address}</CardDescription>}
                    </div>
                  </div>
                  <Badge variant={loc.isActive ? "success" : "secondary"}>{loc.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loc.phone && <p className="text-xs text-text-muted">{loc.phone}</p>}
                <div className="flex gap-4 text-xs text-text-secondary">
                  <span>{loc._count.orders} orders</span>
                  <span>{loc._count.stocks} stock items</span>
                  <span>{loc.registers.length} register{loc.registers.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(loc); setForm({ name: loc.name, address: loc.address || "", phone: loc.phone || "" }); }}>
                    <Edit3 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(loc)}>
                    <Power className="h-3 w-3 mr-1" /> {loc.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {locations.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Store className="h-12 w-12 text-text-muted mb-3" />
                <p className="text-text-secondary">No locations yet. Add your first location to get started.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
