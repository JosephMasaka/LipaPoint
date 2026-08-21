"use client";

import { useEffect, useState } from "react";
import { WifiOff, CloudOff, CheckCircle } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const goOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
      updatePendingCount();
    };

    const goOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [wasOffline]);

  useEffect(() => {
    if (!isOffline) return;
    const interval = setInterval(updatePendingCount, 5000);
    updatePendingCount();
    return () => clearInterval(interval);
  }, [isOffline]);

  const updatePendingCount = async () => {
    try {
      const { getPendingCount } = await import("@/lib/offline-db");
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  };

  if (!isOffline && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white shadow-lg text-sm font-medium">
          <CheckCircle className="h-4 w-4" />
          <span>Back online — syncing data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 shadow-lg text-sm font-medium">
        <WifiOff className="h-4 w-4 text-amber-400" />
        <span>Offline mode</span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <CloudOff className="h-3 w-3" />
            {pendingCount} pending
          </span>
        )}
      </div>
    </div>
  );
}
