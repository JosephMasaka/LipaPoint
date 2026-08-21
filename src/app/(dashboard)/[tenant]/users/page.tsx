"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import {
  Plus, UserPlus, Shield, Trash2, Power, Save, RotateCcw,
  Users, Lock, ShoppingCart, Package, BarChart3, X,
  Settings, Receipt, CheckCircle, AlertCircle,
} from "lucide-react";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface RoleData {
  role: string;
  permissions: string[];
  description: string | null;
  isSystem: boolean;
  id: string | null;
}

const PERMISSIONS = [
  { key: "pos", label: "Point of Sale", icon: ShoppingCart, description: "Access POS register and process sales" },
  { key: "orders", label: "Orders", icon: Receipt, description: "View and manage orders" },
  { key: "tabs", label: "Tabs", icon: Receipt, description: "Open, manage, and settle tabs" },
  { key: "inventory", label: "Inventory", icon: Package, description: "Manage products and stock levels" },
  { key: "stock_management", label: "Stock Management", icon: Package, description: "Initialize stock, add stock, manage daily records" },
  { key: "analytics", label: "Analytics", icon: BarChart3, description: "View business analytics and reports" },
  { key: "staff", label: "Staff Management", icon: Users, description: "Add, edit, and remove staff members" },
  { key: "settings", label: "Settings", icon: Settings, description: "Modify business settings and billing" },
  { key: "expenses", label: "Expenses", icon: Receipt, description: "Record and view expenses" },
];

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "CASHIER" });
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] as string[] });
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<string | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        try { localStorage.setItem("lipapoint-oc-users", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      }
    } catch {
      try {
        const raw = localStorage.getItem("lipapoint-oc-users");
        if (raw) { const { data } = JSON.parse(raw); setUsers(data); }
      } catch {}
    } finally { setLoading(false); }
  };

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data: RoleData[] = await res.json();
        setRoles(data);
        const perms: Record<string, string[]> = {};
        data.forEach(r => { perms[r.role] = [...r.permissions]; });
        setRolePermissions(perms);
        setOriginalPermissions(JSON.parse(JSON.stringify(perms)));
        setDirty(false);
        try { localStorage.setItem("lipapoint-oc-roles", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      }
    } catch {
      try {
        const raw = localStorage.getItem("lipapoint-oc-roles");
        if (raw) {
          const { data }: { data: RoleData[] } = JSON.parse(raw);
          setRoles(data);
          const perms: Record<string, string[]> = {};
          data.forEach(r => { perms[r.role] = [...r.permissions]; });
          setRolePermissions(perms);
          setOriginalPermissions(JSON.parse(JSON.stringify(perms)));
        }
      } catch {}
    }
  }, []);

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if (activeTab === "roles") fetchRoles(); }, [activeTab, fetchRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); return; }
      setForm({ name: "", email: "", phone: "", role: "CASHIER" });
      setShowForm(false);
      fetchUsers();
      notify("success", "Staff member added");
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("user_create", form);
        requestBackgroundSync();
        setForm({ name: "", email: "", phone: "", role: "CASHIER" });
        setShowForm(false);
        notify("info", "Saved offline — will sync when online");
      } else {
        setError("Network error");
      }
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
      fetchUsers();
      notify("success", isActive ? "Staff deactivated" : "Staff activated");
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("user_toggle", { _userId: id, isActive: !isActive });
        requestBackgroundSync();
        setUsers(users.map(u => u.id === id ? { ...u, isActive: !isActive } : u));
        notify("info", "Queued offline — will sync when online");
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      fetchUsers();
      setConfirmDelete(null);
      notify("success", "Staff member removed");
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("user_delete", { _userId: id });
        requestBackgroundSync();
        setUsers(users.filter(u => u.id !== id));
        setConfirmDelete(null);
        notify("info", "Queued offline — will sync when online");
      }
    }
  };

  const togglePermission = (role: string, permission: string) => {
    if (role === "OWNER") return;
    setRolePermissions(prev => {
      const current = prev[role] || [];
      const updated = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
      const next = { ...prev, [role]: updated };
      setDirty(JSON.stringify(next) !== JSON.stringify(originalPermissions));
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedRole || selectedRole === "OWNER") return;
    setSaving(true);
    const payload = { role: selectedRole, permissions: rolePermissions[selectedRole] || [] };
    try {
      const res = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOriginalPermissions(JSON.parse(JSON.stringify(rolePermissions)));
        setDirty(false);
        notify("success", `${selectedRole.replace("_", " ")} permissions saved`);
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to save");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("role_update", payload);
        requestBackgroundSync();
        setOriginalPermissions(JSON.parse(JSON.stringify(rolePermissions)));
        setDirty(false);
        notify("info", "Saved offline — will sync when online");
      } else {
        notify("error", "Network error");
      }
    } finally { setSaving(false); }
  };

  const saveAllPermissions = async () => {
    setSaving(true);
    try {
      const changedRoles = Object.keys(rolePermissions).filter(
        role => role !== "OWNER" && JSON.stringify(rolePermissions[role]) !== JSON.stringify(originalPermissions[role])
      );
      for (const role of changedRoles) {
        await fetch("/api/roles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, permissions: rolePermissions[role] }),
        });
      }
      setOriginalPermissions(JSON.parse(JSON.stringify(rolePermissions)));
      setDirty(false);
      notify("success", `Permissions saved for ${changedRoles.length} role${changedRoles.length > 1 ? "s" : ""}`);
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        const changedRoles = Object.keys(rolePermissions).filter(
          role => role !== "OWNER" && JSON.stringify(rolePermissions[role]) !== JSON.stringify(originalPermissions[role])
        );
        for (const role of changedRoles) {
          await saveOfflineAction("role_update", { role, permissions: rolePermissions[role] });
        }
        requestBackgroundSync();
        setOriginalPermissions(JSON.parse(JSON.stringify(rolePermissions)));
        setDirty(false);
        notify("info", "Saved offline — will sync when online");
      } else {
        notify("error", "Failed to save permissions");
      }
    } finally { setSaving(false); }
  };

  const resetPermissions = () => {
    setRolePermissions(JSON.parse(JSON.stringify(originalPermissions)));
    setDirty(false);
  };

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name.trim()) return;
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      });
      if (res.ok) {
        setNewRole({ name: "", description: "", permissions: [] });
        setShowCreateRole(false);
        fetchRoles();
        notify("success", `Role "${newRole.name}" created`);
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to create role");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("role_create", newRole);
        requestBackgroundSync();
        setNewRole({ name: "", description: "", permissions: [] });
        setShowCreateRole(false);
        notify("info", "Saved offline — will sync when online");
      } else {
        notify("error", "Network error");
      }
    }
  };

  const deleteRole = async (role: string) => {
    try {
      const res = await fetch(`/api/roles?role=${encodeURIComponent(role)}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedRole === role) setSelectedRole(null);
        fetchRoles();
        setConfirmDeleteRole(null);
        notify("success", "Role deleted");
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to delete role");
      }
    } catch {
      notify("error", "Network error");
    }
  };

  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Staff & Roles" subtitle="Manage team members and access permissions" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Tab switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg border border-border p-1 bg-surface-elevated w-fit">
            <button onClick={() => setActiveTab("staff")} className={cn("flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors", activeTab === "staff" ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary")}>
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Staff
            </button>
            <button onClick={() => setActiveTab("roles")} className={cn("flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors", activeTab === "roles" ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary")}>
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Roles &</span> Permissions
            </button>
          </div>
          {activeTab === "staff" && (
            <Button onClick={() => setShowForm(!showForm)} className="gap-2 w-fit">
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">{showForm ? "Cancel" : "Add Staff"}</span><span className="sm:hidden">{showForm ? "Cancel" : "Add"}</span>
            </Button>
          )}
          {activeTab === "roles" && (
            <div className="flex items-center gap-2">
              {dirty && (
                <>
                  <Button variant="outline" size="sm" onClick={resetPermissions} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button size="sm" onClick={saveAllPermissions} disabled={saving} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All Changes"}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowCreateRole(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Role
              </Button>
            </div>
          )}
        </div>

        {/* Staff Tab */}
        {activeTab === "staff" && (
          <>
            {showForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New Staff Member</CardTitle>
                  <CardDescription>Default password: changeme123</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Input label="Full Name" placeholder="John Kamau" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                      <Input label="Email" type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                      <Input label="Phone" placeholder="+254 7XX XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
                        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary">
                          {roles.filter(r => r.role !== "OWNER").map(r => <option key={r.role} value={r.role}>{r.role.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                    </div>
                    <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add Member</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Staff</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? (
                        <tr><td colSpan={5} className="px-4 py-12"><Loader label="Loading users..." className="py-4" /></td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">No staff members.</td></tr>
                      ) : users.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center">
                                <span className="text-sm font-bold text-gold">{u.name.charAt(0)}</span>
                              </div>
                              <div>
                                <p className="font-medium text-text-primary">{u.name}</p>
                                <p className="text-[10px] text-text-muted">Joined {new Date(u.createdAt).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-text-secondary">{u.email}</p>
                            {u.phone && <p className="text-[10px] text-text-muted">{u.phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="h-3 w-3" />
                              {u.role.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={u.isActive ? "success" : "destructive"}>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => toggleActive(u.id, u.isActive)} className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors", u.isActive ? "hover:bg-amber-500/10 text-text-secondary hover:text-amber-400" : "hover:bg-emerald-500/10 text-text-secondary hover:text-emerald-400")} title={u.isActive ? "Deactivate" : "Activate"}>
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setConfirmDelete(u.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors" title="Delete">
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
          </>
        )}

        {/* Roles & Permissions Tab */}
        {activeTab === "roles" && (
          <div className="space-y-4 lg:grid lg:grid-cols-4 lg:gap-6 lg:space-y-0">
            {/* Role selector */}
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2 lg:mb-3">Roles</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 lg:pb-0 lg:flex-col lg:overflow-x-visible lg:space-y-2 lg:gap-0">
                {roles.map(r => (
                  <button
                    key={r.role}
                    onClick={() => setSelectedRole(r.role)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-2.5 lg:p-3 transition-all text-left shrink-0 lg:shrink lg:w-full group",
                      selectedRole === r.role ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"
                    )}
                  >
                    <div className={cn("h-7 w-7 lg:h-8 lg:w-8 rounded-lg flex items-center justify-center shrink-0", selectedRole === r.role ? "bg-gold/20" : "bg-surface-elevated")}>
                      <Shield className={cn("h-3.5 w-3.5 lg:h-4 lg:w-4", selectedRole === r.role ? "text-gold" : "text-text-muted")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs lg:text-sm font-medium text-text-primary whitespace-nowrap">{r.role.replace(/_/g, " ")}</p>
                        {!r.isSystem && <Badge variant="secondary" className="text-[8px] px-1 py-0">Custom</Badge>}
                      </div>
                      <p className="text-[10px] text-text-muted hidden lg:block">
                        {r.description || `${users.filter(u => u.role === r.role).length} member${users.filter(u => u.role === r.role).length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    {!r.isSystem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteRole(r.role); }}
                        className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions grid */}
            <div className="lg:col-span-3">
              {selectedRole ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {selectedRole.replace(/_/g, " ")} Permissions
                          {dirty && rolePermissions[selectedRole] && JSON.stringify(rolePermissions[selectedRole]) !== JSON.stringify(originalPermissions[selectedRole]) && (
                            <Badge variant="warning" className="text-[10px]">Unsaved</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>Configure what this role can access</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedRole === "OWNER" && <Badge variant="warning">Full Access (Locked)</Badge>}
                        {selectedRole !== "OWNER" && dirty && rolePermissions[selectedRole] && JSON.stringify(rolePermissions[selectedRole]) !== JSON.stringify(originalPermissions[selectedRole]) && (
                          <Button size="sm" onClick={savePermissions} disabled={saving} className="gap-1.5">
                            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PERMISSIONS.map(perm => {
                        const isEnabled = (rolePermissions[selectedRole] || []).includes(perm.key);
                        const isLocked = selectedRole === "OWNER";
                        return (
                          <div
                            key={perm.key}
                            onClick={() => !isLocked && togglePermission(selectedRole, perm.key)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 transition-all",
                              isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:shadow-sm",
                              isEnabled ? "border-gold/30 bg-gold/5" : "border-border"
                            )}
                          >
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", isEnabled ? "bg-gold/20" : "bg-surface-elevated")}>
                              <perm.icon className={cn("h-4 w-4", isEnabled ? "text-gold" : "text-text-muted")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">{perm.label}</p>
                              <p className="text-[10px] text-text-muted truncate">{perm.description}</p>
                            </div>
                            <div className={cn(
                              "h-5 w-9 rounded-full relative transition-colors shrink-0",
                              isEnabled ? (isLocked ? "bg-gold/50" : "bg-gold") : "bg-surface-hover"
                            )}>
                              <div className={cn(
                                "absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform",
                                isEnabled ? "translate-x-4" : "translate-x-0"
                              )} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-text-muted">
                    <Lock className="h-12 w-12 opacity-30 mb-4" />
                    <p className="text-sm">Select a role to configure permissions</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateRole && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateRole(false)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">Create New Role</h3>
              <button onClick={() => setShowCreateRole(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={createRole} className="p-4 space-y-4">
              <Input
                label="Role Name"
                placeholder="e.g. Bartender, Waiter, Supervisor"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                required
              />
              <Input
                label="Description (optional)"
                placeholder="Brief description of this role"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {PERMISSIONS.map(perm => {
                    const isEnabled = newRole.permissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-all",
                          isEnabled ? "border-gold/30 bg-gold/5" : "border-border hover:border-gold/20"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => setNewRole(prev => ({
                            ...prev,
                            permissions: isEnabled
                              ? prev.permissions.filter(p => p !== perm.key)
                              : [...prev.permissions, perm.key],
                          }))}
                          className="sr-only"
                        />
                        <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", isEnabled ? "bg-gold border-gold" : "border-border")}>
                          {isEnabled && <CheckCircle className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary">{perm.label}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateRole(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 gap-1.5">
                  <Plus className="h-4 w-4" /> Create Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Remove Staff Member</h3>
              <p className="text-sm text-text-secondary">This action cannot be undone. The user will lose access to the system immediately.</p>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => handleDelete(confirmDelete)}>Remove</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation */}
      {confirmDeleteRole && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteRole(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Role</h3>
              <p className="text-sm text-text-secondary">Delete &quot;{confirmDeleteRole.replace(/_/g, " ")}&quot;? Users with this role will need to be reassigned.</p>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteRole(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => deleteRole(confirmDeleteRole)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
