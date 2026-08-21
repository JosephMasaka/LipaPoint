"use client";

import { useState, useEffect } from "react";
import { Bell, X, Check } from "lucide-react";
import { usePWA } from "@/components/pwa-provider";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

export function Header({ title, subtitle }: HeaderProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { notificationsEnabled, enableNotifications } = usePWA();

  useEffect(() => {
    const stored = localStorage.getItem("lipapoint-notifications");
    if (stored) {
      try { setNotifications(JSON.parse(stored)); } catch {}
    }

    // Listen for sw messages
    if ("serviceWorker" in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "ORDER_SYNCED") {
          addNotification("Order Synced", `Order ${event.data.orderNo} synced successfully`);
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      return () => navigator.serviceWorker.removeEventListener("message", handler);
    }
  }, []);

  const addNotification = (ntitle: string, body: string) => {
    const n: AppNotification = {
      id: Date.now().toString(),
      title: ntitle,
      body,
      time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [n, ...prev].slice(0, 20);
      localStorage.setItem("lipapoint-notifications", JSON.stringify(updated));
      return updated;
    });
  };

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem("lipapoint-notifications", JSON.stringify(updated));
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem("lipapoint-notifications");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="border-b border-border bg-surface/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4 pt-12 lg:pt-5 shrink-0 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="relative p-2 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-gold text-[9px] font-bold text-black flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showPanel && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                  <div className="flex items-center gap-1">
                    {notifications.length > 0 && (
                      <>
                        <button onClick={markAllRead} className="p-1 rounded hover:bg-surface-hover text-text-muted" title="Mark all read">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={clearAll} className="p-1 rounded hover:bg-surface-hover text-text-muted" title="Clear all">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notificationsEnabled && (
                    <div className="p-4 border-b border-border bg-gold/5">
                      <p className="text-xs text-text-secondary mb-2">Enable notifications to get real-time alerts</p>
                      <button
                        onClick={enableNotifications}
                        className="text-xs font-medium text-gold hover:underline"
                      >
                        Enable Notifications
                      </button>
                    </div>
                  )}
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-30" />
                      <p className="text-sm text-text-muted">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-border last:border-0 ${!n.read ? "bg-gold/5" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-text-primary">{n.title}</p>
                            <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                          </div>
                          <span className="text-[10px] text-text-muted shrink-0">{n.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
