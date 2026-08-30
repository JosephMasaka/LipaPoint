"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import {
  Plus, Calendar, ChevronLeft, ChevronRight, X,
  CheckCircle, AlertCircle, Clock, Users, XCircle, Check,
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Staff {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  clientName: string;
  clientPhone: string | null;
  serviceId: string;
  staffId: string | null;
  service: { id: string; name: string; price: number; duration: number };
  staff: { id: string; name: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  SCHEDULED: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", label: "Scheduled" },
  CONFIRMED: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/30", label: "Confirmed" },
  IN_PROGRESS: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", label: "In Progress" },
  COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", label: "Completed" },
  CANCELLED: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", label: "Cancelled" },
  NO_SHOW: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30", label: "No Show" },
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  SCHEDULED: "default",
  CONFIRMED: "default",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "secondary",
};

const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

const BOOKING_TIMES: string[] = [];
for (let h = 8; h < 20; h++) {
  BOOKING_TIMES.push(`${String(h).padStart(2, "0")}:00`);
  BOOKING_TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [staffFilter, setStaffFilter] = useState("");
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: toISODateString(new Date()),
    startTime: "09:00",
    serviceId: "",
    staffId: "",
    clientName: "",
    clientPhone: "",
    notes: "",
  });

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = toISODateString(selectedDate);
      const params = new URLSearchParams({ date: dateStr });
      if (staffFilter) params.set("staffId", staffFilter);
      const res = await fetch(`/api/appointments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [selectedDate, staffFilter]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data.filter ? data.filter((s: Service & { isActive?: boolean }) => s.isActive !== false) : data);
      }
    } catch {
      // silent fail
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        const users = Array.isArray(data) ? data : data.users || [];
        setStaffList(users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchStaff();
  }, [fetchServices, fetchStaff]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const navigateDay = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const todayCount = appointments.length;
  const upcomingCount = appointments.filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledCount = appointments.filter((a) => a.status === "CANCELLED" || a.status === "NO_SHOW").length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.clientName.trim()) {
      setError("Client name is required");
      return;
    }
    if (!form.serviceId) {
      setError("Please select a service");
      return;
    }
    if (!form.date) {
      setError("Please select a date");
      return;
    }

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          serviceId: form.serviceId,
          staffId: form.staffId || null,
          clientName: form.clientName,
          clientPhone: form.clientPhone || null,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error");
        return;
      }

      resetForm();
      fetchAppointments();
      notify("success", "Appointment booked");
    } catch {
      setError("Network error");
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchAppointments();
        setSelectedAppointment(null);
        setShowStatusMenu(false);
        notify("success", `Status updated to ${STATUS_COLORS[newStatus]?.label || newStatus}`);
      } else {
        const d = await res.json();
        notify("error", d.error || "Failed to update");
      }
    } catch {
      notify("error", "Network error");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setForm({
      date: toISODateString(selectedDate),
      startTime: "09:00",
      serviceId: "",
      staffId: "",
      clientName: "",
      clientPhone: "",
      notes: "",
    });
    setError("");
  };

  // Calculate appointment position in timeline
  const getAppointmentStyle = (appt: Appointment) => {
    const startMinutes = timeToMinutes(appt.startTime) - timeToMinutes("08:00");
    const endMinutes = timeToMinutes(appt.endTime) - timeToMinutes("08:00");
    const totalMinutes = timeToMinutes("20:00") - timeToMinutes("08:00"); // 12 hours = 720 min

    const topPercent = (startMinutes / totalMinutes) * 100;
    const heightPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      top: `${topPercent}%`,
      height: `${Math.max(heightPercent, 2.5)}%`,
    };
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

      <Header title="Appointments" subtitle="Schedule and manage client bookings" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Today&apos;s Total</p>
                <p className="text-lg font-bold text-text-primary">{todayCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Upcoming</p>
                <p className="text-lg font-bold text-text-primary">{upcomingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Completed</p>
                <p className="text-lg font-bold text-text-primary">{completedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Cancelled</p>
                <p className="text-lg font-bold text-text-primary">{cancelledCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date Navigation and Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDay(-1)}
              className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-surface-hover text-text-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center min-w-[220px]">
              <h2 className="text-base font-bold text-text-primary">{formatDateDisplay(selectedDate)}</h2>
            </div>
            <button
              onClick={() => navigateDay(1)}
              className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-surface-hover text-text-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="text-xs"
            >
              Today
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Staff Filter */}
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all"
            >
              <option value="">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Book Appointment</span><span className="sm:hidden">Book</span>
            </Button>
          </div>
        </div>

        {/* Day View Timeline */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader label="Loading appointments..." />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="flex">
                {/* Time Column */}
                <div className="w-16 sm:w-20 shrink-0 border-r border-border">
                  {TIME_SLOTS.map((slot) => (
                    <div
                      key={slot}
                      className="h-14 flex items-start justify-end pr-2 pt-0.5"
                    >
                      <span className="text-[10px] sm:text-xs text-text-muted font-mono">{slot}</span>
                    </div>
                  ))}
                </div>

                {/* Appointments Area */}
                <div className="flex-1 relative min-h-[calc(25*3.5rem)]">
                  {/* Grid lines */}
                  {TIME_SLOTS.map((slot) => (
                    <div
                      key={`line-${slot}`}
                      className="h-14 border-b border-border/50"
                    />
                  ))}

                  {/* Appointment blocks */}
                  <div className="absolute inset-0">
                    {appointments.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Calendar className="h-10 w-10 text-text-muted mx-auto mb-2 opacity-30" />
                          <p className="text-sm text-text-muted">No appointments for this day</p>
                        </div>
                      </div>
                    ) : (
                      appointments.map((appt) => {
                        const style = getAppointmentStyle(appt);
                        const colors = STATUS_COLORS[appt.status] || STATUS_COLORS.SCHEDULED;
                        const isCancelled = appt.status === "CANCELLED";
                        return (
                          <button
                            key={appt.id}
                            onClick={() => {
                              setSelectedAppointment(appt);
                              setShowStatusMenu(false);
                            }}
                            className={cn(
                              "absolute left-1 right-1 sm:left-2 sm:right-2 rounded-lg border px-2 py-1 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:z-10",
                              colors.bg,
                              colors.border,
                              isCancelled && "opacity-60"
                            )}
                            style={style}
                          >
                            <div className="flex items-start justify-between gap-1 min-w-0">
                              <div className="min-w-0 text-left">
                                <p className={cn(
                                  "text-xs sm:text-sm font-semibold truncate",
                                  colors.text,
                                  isCancelled && "line-through"
                                )}>
                                  {appt.clientName}
                                </p>
                                <p className="text-[10px] sm:text-xs text-text-secondary truncate">
                                  {appt.service.name}
                                </p>
                                <p className="text-[10px] text-text-muted">
                                  {appt.startTime} - {appt.endTime}
                                  {appt.staff ? ` / ${appt.staff.name}` : ""}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Appointment Detail / Status Change Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedAppointment(null); setShowStatusMenu(false); }} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">Appointment Details</h3>
              <button
                onClick={() => { setSelectedAppointment(null); setShowStatusMenu(false); }}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{selectedAppointment.clientName}</p>
                  {selectedAppointment.clientPhone && (
                    <p className="text-xs text-text-secondary">{selectedAppointment.clientPhone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-text-muted">Service</p>
                  <p className="text-sm font-medium text-text-primary">{selectedAppointment.service.name}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Time</p>
                  <p className="text-sm font-medium text-text-primary">{selectedAppointment.startTime} - {selectedAppointment.endTime}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Staff</p>
                  <p className="text-sm font-medium text-text-primary">{selectedAppointment.staff?.name || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Status</p>
                  <Badge variant={STATUS_BADGE_VARIANT[selectedAppointment.status] || "secondary"}>
                    {STATUS_COLORS[selectedAppointment.status]?.label || selectedAppointment.status}
                  </Badge>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-xs text-text-muted">Notes</p>
                  <p className="text-sm text-text-secondary">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Status Change */}
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                >
                  Change Status
                </Button>
                {showStatusMenu && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-10">
                    {Object.entries(STATUS_COLORS).map(([status, colors]) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(selectedAppointment.id, status)}
                        disabled={selectedAppointment.status === status}
                        className={cn(
                          "w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-surface-hover transition-colors disabled:opacity-40",
                          colors.text
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", colors.bg, "border", colors.border)} />
                        {colors.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Book Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="text-lg font-bold text-text-primary">Book Appointment</h3>
              <button onClick={resetForm} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

              <Input
                label="Client Name"
                placeholder="Client full name"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                required
              />

              <Input
                label="Client Phone"
                placeholder="+254 7XX XXX XXX"
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">Start Time</label>
                  <select
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                  >
                    {BOOKING_TIMES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Service</label>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                  required
                >
                  <option value="">Select a service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} - {s.duration}min</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Staff</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Notes</label>
                <textarea
                  placeholder="Any special instructions..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>
                <Button type="submit" className="flex-1 gap-1.5">
                  <Plus className="h-4 w-4" /> Book Appointment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
