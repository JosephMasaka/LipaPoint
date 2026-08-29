"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DemoRequest {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  message: string | null;
  status: string;
  createdAt: string;
}

export default function DemoRequestsPage() {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/admin/demo-requests?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch("/api/admin/demo-requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) fetchRequests();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "CONTACTED": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "CONVERTED": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "DECLINED": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Demo Requests</h1>
        <p className="text-text-secondary text-sm mt-1">Manage incoming demo and trial requests</p>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-surface-elevated text-text-primary text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CONVERTED">Converted</option>
          <option value="DECLINED">Declined</option>
        </select>
      </div>

      {/* Table */}
      <Card className="bg-surface-elevated border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Business</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Contact</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Phone</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-muted">Loading...</td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-muted">No demo requests found</td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-3 px-4 text-text-primary font-medium">{req.businessName}</td>
                      <td className="py-3 px-4 text-text-secondary">{req.contactName}</td>
                      <td className="py-3 px-4 text-text-muted text-xs">{req.email}</td>
                      <td className="py-3 px-4 text-text-muted text-xs">{req.phone}</td>
                      <td className="py-3 px-4 text-text-secondary capitalize">{req.businessType.toLowerCase()}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(req.status)}>{req.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-muted">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {req.status === "PENDING" && (
                            <button
                              onClick={() => updateStatus(req.id, "CONTACTED")}
                              className="px-2 py-1 text-xs rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                            >
                              Contacted
                            </button>
                          )}
                          {(req.status === "PENDING" || req.status === "CONTACTED") && (
                            <>
                              <button
                                onClick={() => updateStatus(req.id, "CONVERTED")}
                                className="px-2 py-1 text-xs rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                              >
                                Converted
                              </button>
                              <button
                                onClick={() => updateStatus(req.id, "DECLINED")}
                                className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                              >
                                Declined
                              </button>
                            </>
                          )}
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
    </div>
  );
}
