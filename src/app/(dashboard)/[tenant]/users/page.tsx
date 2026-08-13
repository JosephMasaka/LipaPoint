"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StaffForm {
  name: string;
  email: string;
  phone: string;
  role: string;
}

const emptyForm: StaffForm = {
  name: "",
  email: "",
  phone: "",
  role: "CASHIER",
};

const roles = ["ADMIN", "MANAGER", "CASHIER", "STOCK_KEEPER", "KITCHEN"];

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      setForm(emptyForm);
      setShowForm(false);
      fetchUsers();
    } catch {
      setError("Network error");
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      console.error("Failed to update user");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      console.error("Failed to delete user");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-surface">
      <Header title="Staff Management" subtitle="Manage your team members and their roles" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {users.length} staff member{users.length !== 1 ? "s" : ""}
          </p>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setShowForm(!showForm);
            }}
          >
            {showForm ? "Cancel" : "Add Staff"}
          </Button>
        </div>

        {/* Add Staff Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Staff Member</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="Full Name"
                    placeholder="e.g. John Kamau"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                  <Input
                    label="Phone"
                    placeholder="+254 7XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">
                      Role
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold/50"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  Default password will be set to &quot;changeme123&quot;. Staff should change it on first login.
                </p>
                <div className="flex gap-3 pt-2">
                  <Button type="submit">Add Staff Member</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        Loading staff...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        No staff members found. Add your first team member.
                      </td>
                    </tr>
                  ) : (
                    users.map((staffUser) => (
                      <tr
                        key={staffUser.id}
                        className="hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-text-primary">
                          {staffUser.name}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {staffUser.email}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {staffUser.phone || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="secondary">
                            {staffUser.role.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={staffUser.isActive ? "success" : "destructive"}
                          >
                            {staffUser.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {formatDate(staffUser.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleActive(staffUser.id, staffUser.isActive)
                              }
                            >
                              {staffUser.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleDelete(staffUser.id)}
                            >
                              Delete
                            </Button>
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
      </div>
    </div>
  );
}
