"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import {
  ListOrdered,
  Plus,
  X,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  UserCheck,
  Timer,
  XCircle,
} from "lucide-react";

interface QueueEntry {
  id: string;
  ticketNo: number;
  clientName: string;
  clientPhone: string | null;
  serviceName: string | null;
  status: "WAITING" | "SERVING" | "COMPLETED" | "CANCELLED";
  staffId: string | null;
  createdAt: string;
  servedAt: string | null;
  completedAt: string | null;
  staff: { id: string; name: string } | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface Notification {
  type: string;
  message: string;
}

function formatTicket(num: number): string {
  return `#${String(num).padStart(3, "0")}`;
}

function minutesBetween(start: string, end?: string | null): number {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.round((e - s) / 60000));
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  return `${minutes}m`;
}

export default function QueueManagementPage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showServeModal, setShowServeModal] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [notification, setNotification] = useState<Notification | null>(null);
  const [, setTick] = useState(0);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formService, setFormService] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error("Failed to fetch queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchStaff();
  }, [fetchEntries, fetchStaff]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchEntries, 10000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  // Tick every 30s to update wait time displays
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formName.trim(),
          clientPhone: formPhone.trim() || undefined,
          serviceName: formService.trim() || undefined,
        }),
      });
      if (res.ok) {
        notify("success", "Client added to queue");
        setFormName("");
        setFormPhone("");
        setFormService("");
        setShowAddModal(false);
        fetchEntries();
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to add to queue");
      }
    } catch {
      notify("error", "Failed to add to queue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartServing = async (entryId: string) => {
    try {
      const res = await fetch(`/api/queue/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SERVING",
          staffId: selectedStaffId || undefined,
        }),
      });
      if (res.ok) {
        notify("success", "Now serving client");
        setShowServeModal(null);
        setSelectedStaffId("");
        fetchEntries();
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to update");
      }
    } catch {
      notify("error", "Failed to update");
    }
  };

  const handleComplete = async (entryId: string) => {
    try {
      const res = await fetch(`/api/queue/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        notify("success", "Service completed");
        fetchEntries();
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to update");
      }
    } catch {
      notify("error", "Failed to update");
    }
  };

  const handleCancel = async (entryId: string) => {
    try {
      const res = await fetch(`/api/queue/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        notify("success", "Entry cancelled");
        fetchEntries();
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to cancel");
      }
    } catch {
      notify("error", "Failed to cancel");
    }
  };

  const waiting = entries.filter((e) => e.status === "WAITING");
  const serving = entries.filter((e) => e.status === "SERVING");
  const completed = entries.filter((e) => e.status === "COMPLETED");

  // Average wait time for served entries today
  const servedEntries = entries.filter((e) => e.servedAt);
  const avgWait =
    servedEntries.length > 0
      ? Math.round(
          servedEntries.reduce(
            (sum, e) => sum + minutesBetween(e.createdAt, e.servedAt),
            0
          ) / servedEntries.length
        )
      : null;

  if (loading) {
    return <PageLoader label="Loading queue..." />;
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Queue Management"
        subtitle="Manage walk-in clients and wait times"
      />

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

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {waiting.length}
                  </p>
                  <p className="text-xs text-text-secondary">Waiting</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <UserCheck className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {serving.length}
                  </p>
                  <p className="text-xs text-text-secondary">Serving</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {completed.length}
                  </p>
                  <p className="text-xs text-text-secondary">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <Timer className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {avgWait !== null ? `${avgWait}m` : "-- min"}
                  </p>
                  <p className="text-xs text-text-secondary">Avg Wait</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add to Queue Button */}
        <div className="flex justify-end">
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            Add to Queue
          </Button>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Waiting */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <ListOrdered className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-text-primary">
                Waiting
              </h2>
              <Badge variant="warning">{waiting.length}</Badge>
            </div>
            {waiting.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-text-muted">No one waiting</p>
                </CardContent>
              </Card>
            ) : (
              waiting.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gold">
                          {formatTicket(entry.ticketNo)}
                        </p>
                        <p className="text-sm font-medium text-text-primary mt-1">
                          {entry.clientName}
                        </p>
                        {entry.serviceName && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            {entry.serviceName}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(minutesBetween(entry.createdAt))}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedStaffId("");
                          setShowServeModal(entry.id);
                        }}
                      >
                        <Play className="h-3 w-3" />
                        Start Serving
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(entry.id)}
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Column 2: Serving */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-text-primary">
                Serving
              </h2>
              <Badge variant="default">{serving.length}</Badge>
            </div>
            {serving.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <UserCheck className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-text-muted">No one being served</p>
                </CardContent>
              </Card>
            ) : (
              serving.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-400">
                          {formatTicket(entry.ticketNo)}
                        </p>
                        <p className="text-sm font-medium text-text-primary mt-1">
                          {entry.clientName}
                        </p>
                        {entry.serviceName && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            {entry.serviceName}
                          </p>
                        )}
                        {entry.staff && (
                          <p className="text-xs text-gold mt-1">
                            Staff: {entry.staff.name}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(
                          minutesBetween(entry.servedAt || entry.createdAt)
                        )}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="success"
                      className="w-full"
                      onClick={() => handleComplete(entry.id)}
                    >
                      <CheckCircle className="h-3 w-3" />
                      Complete
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Column 3: Completed */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-text-primary">
                Completed
              </h2>
              <Badge variant="success">{completed.length}</Badge>
            </div>
            {completed.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-text-muted">
                    No completed services yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              completed.slice(0, 10).map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-bold text-emerald-400">
                          {formatTicket(entry.ticketNo)}
                        </p>
                        <p className="text-sm font-medium text-text-primary mt-0.5">
                          {entry.clientName}
                        </p>
                        {entry.serviceName && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            {entry.serviceName}
                          </p>
                        )}
                      </div>
                      <Badge variant="success">
                        <Timer className="h-3 w-3 mr-1" />
                        {formatDuration(
                          minutesBetween(entry.createdAt, entry.completedAt)
                        )}{" "}
                        total
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add to Queue Modal */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Add to Queue
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg hover:bg-surface-hover text-text-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <Input
                  label="Client Name"
                  placeholder="Enter client name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <Input
                  label="Phone (optional)"
                  placeholder="Enter phone number"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
                <Input
                  label="Service Requested (optional)"
                  placeholder="e.g., Haircut, Shave"
                  value={formService}
                  onChange={(e) => setFormService(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!formName.trim() || submitting}
                >
                  {submitting ? "Adding..." : "Add to Queue"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Start Serving Modal (staff assignment) */}
      {showServeModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => {
              setShowServeModal(null);
              setSelectedStaffId("");
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Assign Staff
                </h3>
                <button
                  onClick={() => {
                    setShowServeModal(null);
                    setSelectedStaffId("");
                  }}
                  className="p-1 rounded-lg hover:bg-surface-hover text-text-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    Staff Member (optional)
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                  >
                    <option value="">No staff assigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowServeModal(null);
                    setSelectedStaffId("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => handleStartServing(showServeModal)}>
                  <Play className="h-4 w-4" />
                  Start Serving
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
