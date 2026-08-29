"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, X, Eye, Power, Trash2 } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  tier: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    orders: number;
    products: number;
    users: number;
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantDetails, setTenantDetails] = useState<Record<string, unknown> | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (tierFilter) params.set("tier", tierFilter);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/admin/tenants?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTenants(data.tenants);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [search, typeFilter, tierFilter, page]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleToggleActive = async (tenant: Tenant) => {
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !tenant.isActive }),
    });
    if (res.ok) fetchTenants();
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Are you sure you want to delete "${tenant.name}"? This action cannot be undone.`)) return;
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, { method: "DELETE" });
    if (res.ok) fetchTenants();
  };

  const handleViewDetails = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    const res = await fetch(`/api/admin/tenants/${tenant.id}`);
    if (res.ok) {
      const data = await res.json();
      setTenantDetails(data);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Tenants Management</h1>
        <p className="text-text-secondary text-sm mt-1">Manage all platform tenants</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-surface-elevated border-border"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-surface-elevated text-text-primary text-sm"
        >
          <option value="">All Types</option>
          <option value="RETAIL">Retail</option>
          <option value="RESTAURANT">Restaurant</option>
          <option value="BAR">Bar</option>
          <option value="SUPERMARKET">Supermarket</option>
          <option value="PHARMACY">Pharmacy</option>
          <option value="HARDWARE">Hardware</option>
          <option value="BARBERSHOP">Barbershop</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-surface-elevated text-text-primary text-sm"
        >
          <option value="">All Tiers</option>
          <option value="STARTER">Starter</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <Card className="bg-surface-elevated border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Slug</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Tier</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Created</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">Loading...</td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">No tenants found</td>
                  </tr>
                ) : (
                  tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-3 px-4 text-text-primary font-medium">{tenant.name}</td>
                      <td className="py-3 px-4 text-text-muted">{tenant.slug}</td>
                      <td className="py-3 px-4 text-text-secondary capitalize">{tenant.type.toLowerCase()}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">{tenant.tier}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={tenant.isActive ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                          {tenant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-text-muted">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(tenant)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(tenant)}
                            className={`p-1.5 rounded-lg hover:bg-surface-hover ${tenant.isActive ? "text-amber-500" : "text-green-500"}`}
                            title={tenant.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tenant)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-red-400 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Tenant Detail Panel */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setSelectedTenant(null); setTenantDetails(null); }}>
          <div className="bg-surface-elevated border border-border rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">{selectedTenant.name}</h2>
              <button onClick={() => { setSelectedTenant(null); setTenantDetails(null); }} className="p-1 rounded-lg hover:bg-surface-hover text-text-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            {tenantDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-text-muted">Slug</p>
                    <p className="text-sm text-text-primary">{(tenantDetails as Record<string, unknown>).slug as string}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Type</p>
                    <p className="text-sm text-text-primary capitalize">{((tenantDetails as Record<string, unknown>).type as string || "").toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Tier</p>
                    <p className="text-sm text-text-primary">{(tenantDetails as Record<string, unknown>).tier as string}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Status</p>
                    <Badge className={(tenantDetails as Record<string, unknown>).isActive ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                      {(tenantDetails as Record<string, unknown>).isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-medium text-text-primary mb-2">Usage Stats</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-surface border-border">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-text-primary">{((tenantDetails as Record<string, unknown>)._count as Record<string, number>)?.orders ?? 0}</p>
                        <p className="text-xs text-text-muted">Orders</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-surface border-border">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-text-primary">{((tenantDetails as Record<string, unknown>)._count as Record<string, number>)?.products ?? 0}</p>
                        <p className="text-xs text-text-muted">Products</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-surface border-border">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold text-text-primary">{((tenantDetails as Record<string, unknown>)._count as Record<string, number>)?.users ?? 0}</p>
                        <p className="text-xs text-text-muted">Staff</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-center py-4">Loading details...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
