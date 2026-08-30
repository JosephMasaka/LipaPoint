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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Copy,
  CheckCircle,
  AlertCircle,
  Users,
} from "lucide-react";

interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOff: boolean;
  notes: string | null;
  staffId: string;
  staff: { id: string; name: string; role: string };
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const monStr = monday.toLocaleDateString("en-US", opts);
  const sunStr = sunday.toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  return `Week of ${monStr} - ${sunStr}`;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 6; h <= 22; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) {
      times.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return times;
}

const TIME_OPTIONS = generateTimeOptions();

const ROLE_VARIANTS: Record<string, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  OWNER: "default",
  ADMIN: "warning",
  MANAGER: "success",
  CASHIER: "secondary",
  STOCK_KEEPER: "secondary",
  KITCHEN: "secondary",
};

export default function StaffSchedulingPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [copying, setCopying] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // Form state
  const [formStaffId, setFormStaffId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formIsOff, setFormIsOff] = useState(false);
  const [formNotes, setFormNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const fetchSchedules = useCallback(async () => {
    try {
      const startDate = formatDateISO(weekStart);
      const endDate = formatDateISO(
        new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
      );
      const res = await fetch(
        `/api/schedules?startDate=${startDate}&endDate=${endDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setStaffList(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    setLoading(true);
    fetchSchedules();
  }, [fetchSchedules]);

  const navigateWeek = (direction: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + direction * 7);
    setWeekStart(newStart);
  };

  const getScheduleForCell = (
    staffId: string,
    date: Date
  ): Schedule | undefined => {
    return schedules.find((s) => {
      const schedDate = new Date(s.date);
      return s.staffId === staffId && isSameDay(schedDate, date);
    });
  };

  const openAddModal = (staffId?: string, date?: Date) => {
    setEditingId(null);
    setFormStaffId(staffId || "");
    setFormDate(date ? formatDateISO(date) : "");
    setFormStartTime("09:00");
    setFormEndTime("17:00");
    setFormIsOff(false);
    setFormNotes("");
    setShowModal(true);
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setFormStaffId(schedule.staffId);
    setFormDate(formatDateISO(new Date(schedule.date)));
    setFormStartTime(schedule.startTime || "09:00");
    setFormEndTime(schedule.endTime || "17:00");
    setFormIsOff(schedule.isOff);
    setFormNotes(schedule.notes || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formStaffId || !formDate) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: formStaffId,
          date: formDate,
          startTime: formIsOff ? "" : formStartTime,
          endTime: formIsOff ? "" : formEndTime,
          isOff: formIsOff,
          notes: formNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        notify("success", editingId ? "Schedule updated" : "Schedule created");
        setShowModal(false);
        fetchSchedules();
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to save schedule");
      }
    } catch {
      notify("error", "Failed to save schedule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/schedules/${editingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        notify("success", "Schedule deleted");
        setShowModal(false);
        fetchSchedules();
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to delete");
      }
    } catch {
      notify("error", "Failed to delete");
    }
  };

  const handleCopyPreviousWeek = async () => {
    setCopying(true);
    try {
      const prevStart = new Date(weekStart);
      prevStart.setDate(weekStart.getDate() - 7);
      const prevEnd = new Date(prevStart);
      prevEnd.setDate(prevStart.getDate() + 6);

      const res = await fetch(
        `/api/schedules?startDate=${formatDateISO(
          prevStart
        )}&endDate=${formatDateISO(prevEnd)}`
      );
      if (!res.ok) {
        notify("error", "Failed to fetch previous week");
        return;
      }

      const prevSchedules: Schedule[] = await res.json();

      if (prevSchedules.length === 0) {
        notify("error", "No schedules found in previous week");
        return;
      }

      let created = 0;
      for (const sched of prevSchedules) {
        const prevDate = new Date(sched.date);
        const newDate = new Date(prevDate);
        newDate.setDate(prevDate.getDate() + 7);

        const saveRes = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: sched.staffId,
            date: formatDateISO(newDate),
            startTime: sched.startTime,
            endTime: sched.endTime,
            isOff: sched.isOff,
            notes: sched.notes || undefined,
          }),
        });
        if (saveRes.ok) created++;
      }

      notify("success", `Copied ${created} schedule(s) from previous week`);
      fetchSchedules();
    } catch {
      notify("error", "Failed to copy schedules");
    } finally {
      setCopying(false);
    }
  };

  // Stats
  const scheduledThisWeek = new Set(
    schedules.filter((s) => !s.isOff).map((s) => s.staffId)
  ).size;
  const daysOffThisWeek = schedules.filter((s) => s.isOff).length;

  if (loading && schedules.length === 0) {
    return <PageLoader label="Loading schedules..." />;
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Staff Scheduling"
        subtitle="Manage staff shifts and availability"
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
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <Users className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {staffList.length}
                  </p>
                  <p className="text-xs text-text-secondary">Total Staff</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CalendarDays className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {scheduledThisWeek}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Scheduled This Week
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <X className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {daysOffThisWeek}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Days Off This Week
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-text-primary">
              {formatWeekRange(weekStart)}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPreviousWeek}
              disabled={copying}
            >
              <Copy className="h-3 w-3" />
              {copying ? "Copying..." : "Copy Previous Week"}
            </Button>
            <Button size="sm" onClick={() => openAddModal()}>
              <Plus className="h-3 w-3" />
              Add Schedule
            </Button>
          </div>
        </div>

        {/* Desktop: Weekly Grid View */}
        <div className="hidden lg:block">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium text-text-secondary w-48">
                        Staff
                      </th>
                      {weekDays.map((day, i) => {
                        const isToday = isSameDay(day, today);
                        return (
                          <th
                            key={i}
                            className={cn(
                              "text-center p-3 text-sm font-medium text-text-secondary min-w-[120px]",
                              isToday &&
                                "bg-gold/5 border-l border-r border-gold/20"
                            )}
                          >
                            <div>
                              {DAYS[i]}{" "}
                              <span className={cn(isToday && "text-gold font-bold")}>
                                {day.getDate()}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-12 text-text-muted text-sm"
                        >
                          No staff members found
                        </td>
                      </tr>
                    ) : (
                      staffList.map((member, idx) => (
                        <tr
                          key={member.id}
                          className={cn(
                            "border-b border-border last:border-0",
                            idx % 2 === 1 && "bg-surface/50"
                          )}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">
                                {member.name}
                              </span>
                              <Badge
                                variant={
                                  ROLE_VARIANTS[member.role] || "secondary"
                                }
                              >
                                {member.role}
                              </Badge>
                            </div>
                          </td>
                          {weekDays.map((day, dayIdx) => {
                            const sched = getScheduleForCell(member.id, day);
                            const isToday = isSameDay(day, today);
                            return (
                              <td
                                key={dayIdx}
                                className={cn(
                                  "p-2 text-center cursor-pointer hover:bg-surface-hover transition-colors",
                                  isToday &&
                                    "bg-gold/5 border-l border-r border-gold/20"
                                )}
                                onClick={() => {
                                  if (sched) {
                                    openEditModal(sched);
                                  } else {
                                    openAddModal(member.id, day);
                                  }
                                }}
                              >
                                {sched ? (
                                  sched.isOff ? (
                                    <span className="inline-block px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                      OFF
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-1 rounded-md text-xs font-medium bg-gold/10 text-gold border border-gold/20">
                                      {sched.startTime}-{sched.endTime}
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-block px-2 py-1 rounded-md text-xs text-text-muted">
                                    --
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile: List View grouped by day */}
        <div className="lg:hidden space-y-4">
          {weekDays.map((day, dayIdx) => {
            const isToday = isSameDay(day, today);
            const daySchedules = schedules.filter((s) =>
              isSameDay(new Date(s.date), day)
            );
            return (
              <Card
                key={dayIdx}
                className={cn(isToday && "border-gold/30")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className={cn(
                        "text-sm font-semibold",
                        isToday ? "text-gold" : "text-text-primary"
                      )}
                    >
                      {DAYS[dayIdx]} {day.getDate()}{" "}
                      {day.toLocaleDateString("en-US", { month: "short" })}
                      {isToday && (
                        <Badge variant="default" className="ml-2">
                          Today
                        </Badge>
                      )}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAddModal(undefined, day)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {daySchedules.length === 0 ? (
                    <p className="text-xs text-text-muted">
                      No schedules
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {daySchedules.map((sched) => (
                        <div
                          key={sched.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface/50 cursor-pointer hover:bg-surface-hover"
                          onClick={() => openEditModal(sched)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-text-primary">
                              {sched.staff.name}
                            </span>
                            <Badge
                              variant={
                                ROLE_VARIANTS[sched.staff.role] || "secondary"
                              }
                            >
                              {sched.staff.role}
                            </Badge>
                          </div>
                          {sched.isOff ? (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                              OFF
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gold/10 text-gold border border-gold/20">
                              {sched.startTime}-{sched.endTime}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Schedule Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  {editingId ? "Edit Schedule" : "Add Schedule"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-surface-hover text-text-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Staff Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    Staff Member
                  </label>
                  <select
                    value={formStaffId}
                    onChange={(e) => setFormStaffId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                  >
                    <option value="">Select staff...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <Input
                  label="Date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />

                {/* Day Off Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsOff}
                    onChange={(e) => setFormIsOff(e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-surface-elevated accent-gold"
                  />
                  <span className="text-sm font-medium text-text-primary">
                    Day Off
                  </span>
                </label>

                {/* Time Dropdowns (disabled if day off) */}
                {!formIsOff && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-secondary">
                        Start Time
                      </label>
                      <select
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-secondary">
                        End Time
                      </label>
                      <select
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:border-gold/50 transition-all"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <Input
                  label="Notes (optional)"
                  placeholder="Any additional notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between border-t border-border px-6 py-4">
                <div>
                  {editingId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!formStaffId || !formDate || submitting}
                  >
                    {submitting
                      ? "Saving..."
                      : editingId
                      ? "Update"
                      : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
