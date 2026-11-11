"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WifiOff,
  CloudOff,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Trash2,
  X,
} from "lucide-react";
import {
  OFFLINE_QUEUE_EVENT,
  discardQueueRecord,
  getLastSyncAt,
  getQueue,
  releaseQueueBackoff,
  retryAllQueueRecords,
  retryQueueRecord,
  syncQueue,
} from "@/lib/offline-db";
import type { QueueItem } from "@/lib/offline-sync";

/**
 * Offline Mode status + queue inspector.
 *
 * Offline Mode is free on every plan, so this never gates anything: it tells
 * the cashier what happened to their writes while the internet was gone.
 * The pill appears while offline, while anything is queued, and briefly after
 * reconnecting; tapping it opens the queue, where each write can be retried
 * or discarded by hand. Writes the server permanently refuses (e.g. a sale
 * that breaks the price floor) stay visible with the reason instead of
 * vanishing quietly.
 *
 * "Offline" means *the server is unreachable*, not merely `navigator.onLine`
 * — a till on a dead uplink still reports online, and showing "syncing" while
 * nothing can reach the server is how a cashier ends up trusting a queue that
 * never drains.
 */

const PROBE_URL = "/api/health";
const PROBE_INTERVAL_MS = 15_000;
const SYNC_DEBOUNCE_MS = 1_200;

function relative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} d ago`;
}

async function probeServer(): Promise<boolean> {
  try {
    const res = await fetch(PROBE_URL, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function OfflineIndicator() {
  const [browserOnline, setBrowserOnline] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const [showReconnected, setShowReconnected] = useState(false);

  const wasOffline = useRef(false);
  const mountedAt = useRef(Date.now());

  const online = browserOnline && reachable;

  const refresh = useCallback(async () => {
    try {
      const queue = await getQueue();
      setItems(queue);
    } catch {
      /* IndexedDB unavailable (private mode) — nothing to show */
    }
    setLastSync(getLastSyncAt());
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncQueue();
    } catch {
      /* offline — the queue keeps everything */
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  // Queue updates: this tab, other tabs, the service worker.
  useEffect(() => {
    void refresh();

    const onChange = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(OFFLINE_QUEUE_EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);

    const bc =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("lipapoint-offline")
        : null;
    if (bc) bc.onmessage = onChange;

    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
      bc?.close();
    };
  }, [refresh]);

  // Connectivity: browser events plus a real server probe.
  useEffect(() => {
    setBrowserOnline(navigator.onLine);

    const markOnline = async () => {
      setBrowserOnline(true);
      const ok = await probeServer();
      setReachable(ok);
      if (ok) {
        wasOffline.current = true;
        void releaseQueueBackoff();
        void runSync();
      }
    };
    const markOffline = () => {
      setBrowserOnline(false);
      setReachable(false);
      wasOffline.current = true;
    };

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);

    /* Re-probe while we believe we're online but something is queued: a
       cached response or a dead uplink both fail this, and the first probe
       runs a little after mount so it never competes with page load. */
    const timer = setInterval(() => {
      if (!navigator.onLine) {
        setReachable(false);
        return;
      }
      void probeServer().then((ok) => setReachable(ok));
    }, PROBE_INTERVAL_MS);

    const firstProbe = setTimeout(() => {
      if (navigator.onLine) void probeServer().then(setReachable);
      void refresh();
    }, 2_500);

    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      clearInterval(timer);
      clearTimeout(firstProbe);
    };
  }, [refresh, runSync]);

  // Drain the queue whenever we're reachable and something is waiting.
  useEffect(() => {
    const pending = items.length;
    if (!online || pending === 0 || syncing) return;
    const due = items.some(
      (item) => item.status === "queued" || item.status === "retrying"
    );
    if (!due) return;
    const timer = setTimeout(() => void runSync(), SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [online, items, syncing, runSync]);

  // Keep polling while anything is queued (covers browsers with no events).
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(timer);
  }, [items.length, refresh]);

  // "Back online" confirmation, once per reconnection.
  useEffect(() => {
    if (!online) return;
    setShowReconnected(true);
    const timer = setTimeout(() => setShowReconnected(false), 4_000);
    return () => clearTimeout(timer);
  }, [online]);

  const needsAttention = items.filter((i) => i.status === "needs-attention");

  // Fresh page load, online, nothing queued: stay out of the way.
  const recentlyArrived = Date.now() - mountedAt.current < 5_000;
  if (online && items.length === 0 && !(showReconnected && wasOffline.current) && !expanded) {
    return null;
  }

  const tone = !online
    ? "border-amber-500/40 bg-zinc-900 text-zinc-100"
    : needsAttention.length > 0
      ? "border-amber-500/40 bg-zinc-900 text-zinc-100"
      : "border-emerald-500/40 bg-zinc-900 text-zinc-100";

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] transition-all duration-300">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-sm font-medium max-w-[92vw] ${tone}`}
        >
          {!online ? (
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
          ) : syncing ? (
            <RefreshCw className="h-4 w-4 text-gold shrink-0 animate-spin" />
          ) : needsAttention.length > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          )}

          <span>
            {!online
              ? "Offline mode"
              : syncing
                ? `Syncing ${items.length}…`
                : needsAttention.length > 0
                  ? `${needsAttention.length} need${needsAttention.length === 1 ? "s" : ""} attention`
                  : showReconnected && recentlyArrived
                    ? "Back online"
                    : "All changes synced"}
          </span>

          {items.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <CloudOff className="h-3 w-3" />
              {items.length} pending
            </span>
          )}

          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] w-[min(28rem,92vw)] rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Offline Mode</p>
              <p className="text-xs text-text-muted">
                Free on every plan ·{" "}
                {online ? "connected" : "no connection"} ·{" "}
                {lastSync ? `last sync ${relative(lastSync)}` : "not synced yet"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="p-1 text-text-muted hover:text-text-primary"
              aria-label="Close offline queue"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto px-2 py-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-text-muted">
                Nothing waiting — every sale and change has reached the server.
              </p>
            ) : (
              items.map((item) => {
                const key = `${item.store}-${item.id}`;
                return (
                  <div key={key} className="rounded-lg px-2 py-2 hover:bg-surface-hover/40">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text-primary">
                          {item.label}
                          {item.amount !== null && (
                            <span className="ml-2 text-xs text-text-muted">
                              KSh {item.amount.toLocaleString()}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          {relative(item.createdAt)}
                          {item.status === "needs-attention"
                            ? " · refused by server"
                            : item.status === "retrying"
                              ? ` · retrying (attempt ${item.attempts})`
                              : " · queued"}
                        </p>
                        {item.detail && (
                          <p
                            className={`mt-1 text-[11px] ${item.status === "needs-attention" ? "text-amber-500" : "text-text-muted"}`}
                          >
                            {item.detail}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void retryQueueRecord(item)}
                          disabled={!online}
                          title="Retry now"
                          className="rounded-md p-1.5 text-text-muted hover:text-gold hover:bg-gold/10 disabled:opacity-40"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>

                        {confirmDiscard === key ? (
                          <button
                            type="button"
                            onClick={() => {
                              void discardQueueRecord(item);
                              setConfirmDiscard(null);
                            }}
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10"
                          >
                            Discard?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDiscard(key)}
                            title="Discard this queued change"
                            className="rounded-md p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
            <button
              type="button"
              onClick={() => void retryAllQueueRecords().then(refresh)}
              disabled={items.length === 0}
              className="text-xs text-text-muted hover:text-text-primary disabled:opacity-40"
            >
              Retry all
            </button>
            <button
              type="button"
              onClick={() => void runSync()}
              disabled={!online || items.length === 0 || syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-black hover:bg-gold/90 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
