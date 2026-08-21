"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Wifi, WifiOff, Download, X, Bell, BellOff, CloudOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncOfflineOrders, getOfflineOrders } from "@/lib/offline-db";

interface PWAContextType {
  isOnline: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  installApp: () => Promise<void>;
  pendingOfflineOrders: number;
  notificationsEnabled: boolean;
  enableNotifications: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isInstalled: false,
  canInstall: false,
  installApp: async () => {},
  pendingOfflineOrders: 0,
  notificationsEnabled: false,
  enableNotifications: async () => false,
});

export function usePWA() {
  return useContext(PWAContext);
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [pendingOfflineOrders, setPendingOfflineOrders] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
      handleSync();
    };
    const goOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Install prompt
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      if (!isStandalone && !localStorage.getItem("lipapoint-install-dismissed")) {
        setTimeout(() => setShowInstallBanner(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setShowInstallBanner(false);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  // Notification permission check
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  // Check pending offline orders
  useEffect(() => {
    const checkPending = async () => {
      try {
        const orders = await getOfflineOrders();
        setPendingOfflineOrders(orders.length);
      } catch {}
    };
    checkPending();
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen for sync messages from service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "ORDER_SYNCED") {
        setSyncMessage(`Order synced successfully`);
        setTimeout(() => setSyncMessage(""), 4000);
        getOfflineOrders().then((o) => setPendingOfflineOrders(o.length));
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // Cache dashboard routes when SW is ready
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: "CACHE_URLS",
          urls: ["/", "/login", "/offline"],
        });
      });
    }
  }, []);

  const handleSync = useCallback(async () => {
    const orders = await getOfflineOrders();
    if (orders.length === 0) return;
    setSyncMessage(`Syncing ${orders.length} offline order(s)...`);
    const result = await syncOfflineOrders();
    if (result.synced > 0) {
      setSyncMessage(`${result.synced} order(s) synced!`);
      setPendingOfflineOrders((prev) => prev - result.synced);
    }
    setTimeout(() => setSyncMessage(""), 4000);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const result = await deferredPrompt.current.userChoice;
    if (result.outcome === "accepted") {
      setIsInstalled(true);
      setCanInstall(false);
    }
    deferredPrompt.current = null;
    setShowInstallBanner(false);
  };

  const enableNotifications = async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    setNotificationsEnabled(granted);
    if (granted) {
      new Notification("LipaPoint", {
        body: "Notifications are now active!",
        icon: "/icons/icon-192.svg",
      });
    }
    return granted;
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("lipapoint-install-dismissed", "1");
  };

  return (
    <PWAContext.Provider
      value={{ isOnline, isInstalled, canInstall, installApp, pendingOfflineOrders, notificationsEnabled, enableNotifications }}
    >
      {children}

      {/* Offline Banner */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
          <WifiOff className="h-4 w-4" />
          <span>You&apos;re offline — sales will sync when connection returns</span>
          {pendingOfflineOrders > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{pendingOfflineOrders} queued</span>
          )}
          <button onClick={() => setShowOfflineBanner(false)} className="ml-2 p-0.5 rounded hover:bg-white/20">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sync Message */}
      {syncMessage && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-emerald-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
          <Check className="h-4 w-4" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[200] bg-surface border border-gold/30 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Install LipaPoint</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Install as a desktop app for faster access, offline support & notifications.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={installApp}>Install App</Button>
                <Button size="sm" variant="ghost" onClick={dismissInstall}>Not now</Button>
              </div>
            </div>
            <button onClick={dismissInstall} className="p-1 text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}

// Network status indicator for the sidebar/header
export function NetworkStatus() {
  const { isOnline, pendingOfflineOrders } = usePWA();

  if (isOnline && pendingOfflineOrders === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium">
      {!isOnline ? (
        <>
          <WifiOff className="h-3 w-3 text-amber-500" />
          <span className="text-amber-500">Offline</span>
        </>
      ) : pendingOfflineOrders > 0 ? (
        <>
          <CloudOff className="h-3 w-3 text-blue-400" />
          <span className="text-blue-400">Syncing {pendingOfflineOrders}</span>
        </>
      ) : null}
    </div>
  );
}

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
