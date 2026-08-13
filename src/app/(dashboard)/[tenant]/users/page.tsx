"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Plus, UserPlus, Shield, Trash2, Power,
  Users, Lock, ShoppingCart, Package, BarChart3,
  Settings, Receipt, CheckCircle,
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

const ROLES = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "STOCK_KEEPER", "KITCHEN"];

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

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: PERMISSIONS.map(p => p.key),
  ADMIN: PERMISSIONS.map(p => p.key),
  MANAGER: ["pos", "orders", "tabs", "inventory", "stock_management", "analytics", "expenses"],
  CASHIER: ["pos", "orders", "tabs"],
  STOCK_KEEPER: ["inventory", "stock_management", "expenses"],
  KITCHEN: ["orders"],
};

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "CASHIER" });
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

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
    } catch { setError("Network error"); }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
      fetchUsers();
      notify("success", isActive ? "Staff deactivated" : "Staff activated");
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      fetchUsers();
      setConfirmDelete(null);
      notify("success", "Staff member removed");
    } catch { /* ignore */ }
  };

  const togglePermission = (role: string, permission: string) => {
    setRolePermissions(prev => {
      const current = prev[role] || [];
      const updated = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
      return { ...prev, [role]: updated };
    });
  };

  return (
    <div className="min-h-screen bg-surface relative">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Staff & Roles" subtitle="Manage team members and access permissions" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Tab switcher */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg border border-border p-1 bg-surface-elevated">
            <button onClick={() => setActiveTab("staff")} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors", activeTab === "staff" ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary")}>
              <Users className="h-4 w-4" /> Staff
            </button>
            <button onClick={() => setActiveTab("roles")} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors", activeTab === "roles" ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary")}>
              <Shield className="h-4 w-4" /> Roles & Permissions
            </button>
          </div>
          {activeTab === "staff" && (
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <UserPlus className="h-4 w-4" /> {showForm ? "Cancel" : "Add Staff"}
            </Button>
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
                          {ROLES.filter(r => r !== "OWNER").map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
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
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">Loading...</td></tr>
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
                              {u.role.replace("_", " ")}
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Role selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-secondary mb-3">Select Role</p>
              {ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-3 transition-all text-left",
                    selectedRole === role ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"
                  )}
                >
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", selectedRole === role ? "bg-gold/20" : "bg-surface-elevated")}>
                    <Shield className={cn("h-4 w-4", selectedRole === role ? "text-gold" : "text-text-muted")} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{role.replace("_", " ")}</p>
                    <p className="text-[10px] text-text-muted">{users.filter(u => u.role === role).length} member{users.filter(u => u.role === role).length !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Permissions grid */}
            <div className="lg:col-span-3">
              {selectedRole ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedRole.replace("_", " ")} Permissions</CardTitle>
                        <CardDescription>Configure what this role can access</CardDescription>
                      </div>
                      {(selectedRole === "OWNER" || selectedRole === "ADMIN") && (
                        <Badge variant="warning">Full Access</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PERMISSIONS.map(perm => {
                        const isEnabled = (rolePermissions[selectedRole] || []).includes(perm.key);
                        const isLocked = selectedRole === "OWNER" || selectedRole === "ADMIN";
                        return (
                          <div
                            key={perm.key}
                            className={cn("flex items-center gap-3 rounded-lg border p-3 transition-all", isEnabled ? "border-gold/30 bg-gold/5" : "border-border")}
                          >
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", isEnabled ? "bg-gold/20" : "bg-surface-elevated")}>
                              <perm.icon className={cn("h-4 w-4", isEnabled ? "text-gold" : "text-text-muted")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">{perm.label}</p>
                              <p className="text-[10px] text-text-muted truncate">{perm.description}</p>
                            </div>
                            <label className="relative inline-flex cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                disabled={isLocked}
                                onChange={() => togglePermission(selectedRole, perm.key)}
                                className="sr-only peer"
                              />
                              <div className={cn("h-5 w-9 rounded-full transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4", isLocked ? "bg-gold/50 cursor-not-allowed" : "bg-surface-hover peer-checked:bg-gold")} />
                            </label>
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

      {/* Delete Confirmation Modal */}
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
    </div>
  );
}
