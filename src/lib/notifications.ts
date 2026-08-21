export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        icon: "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
        ...options,
      });
    });
  } else {
    new Notification(title, {
      icon: "/icons/icon-192.svg",
      ...options,
    });
  }
}

export function notifyOrderComplete(orderNo: string, total: string) {
  showNotification("Order Complete", {
    body: `Order ${orderNo} — ${total} processed successfully`,
    tag: `order-${orderNo}`,
  });
}

export function notifyOfflineOrder(orderNo: string) {
  showNotification("Order Saved Offline", {
    body: `Order ${orderNo} will sync when you're back online`,
    tag: `offline-${orderNo}`,
  });
}

export function notifyLowStock(productName: string, quantity: number) {
  showNotification("Low Stock Alert", {
    body: `${productName} is running low (${quantity} remaining)`,
    tag: `stock-${productName}`,
  });
}

export function notifySyncComplete(count: number) {
  showNotification("Orders Synced", {
    body: `${count} offline order(s) synced successfully`,
    tag: "sync-complete",
  });
}

export async function registerPeriodicSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("periodicSync" in reg) {
      await (reg as ServiceWorkerRegistration & { periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } })
        .periodicSync.register("check-notifications", { minInterval: 60 * 60 * 1000 });
    }
  } catch {}
}
