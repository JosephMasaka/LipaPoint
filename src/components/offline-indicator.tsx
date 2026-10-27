"use client";

import { useEffect, useState } from "react";
import { WifiOff, CloudOff, CheckCircle, Lock } from "lucide-react";
import { getPendingCount } from "@/lib/offline-db";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);
  const [featureRequired, setFeatureRequired] = useState(false);

  // The offline write queue refused a save because `offline-mode` (a paid
  // feature) isn't enabled for this tenant — src/lib/offline-db.ts announces
  // it, we surface it so the cashier never believes a change was queued.
  useEffect(() => {
    const onRequired = () => {
      setFeatureRequired(true);
      window.setTimeout(() => setFeatureRequired(false), 7000);
    };
    window.addEventListener("lipapoint:offline-feature-required", onRequired);
    return () =>
      window.removeEventListener("lipapoint:offline-feature-required", onRequired);
  }, []);

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
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  };

  if (featureRequired) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] transition-all duration-300">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-900 border border-amber-500/40 text-zinc-100 shadow-lg text-sm font-medium max-w-[92vw]">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            Offline Mode is not enabled for your plan — go online to save
            this change, or switch it on in Apps.
          </span>
        </div>
      </div>
    );
  }

  if (!isOffline && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] transition-all duration-300">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white shadow-lg text-sm font-medium">
          <CheckCircle className="h-4 w-4" />
          <span>Back online — syncing data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] transition-all duration-300">
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
