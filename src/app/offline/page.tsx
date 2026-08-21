"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      window.location.reload();
    }
  }, [isOnline]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
        <WifiOff className="h-10 w-10 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">You&apos;re Offline</h1>
      <p className="text-text-secondary max-w-md mb-8">
        No internet connection detected. Don&apos;t worry — LipaPoint works offline.
        Your POS is still fully functional for processing sales.
      </p>
      <div className="space-y-3">
        <Button onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <p className="text-xs text-text-muted">
          Sales made offline will sync automatically when connection returns.
        </p>
      </div>
    </div>
  );
}
