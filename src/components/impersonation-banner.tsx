"use client";

import { useState } from "react";
import { Eye, LogOut } from "lucide-react";

/**
 * Fixed top banner shown while a super-admin is impersonating a tenant.
 * Exiting restores the parked admin session and returns to /admin.
 */
export function ImpersonationBanner({ tenantName }: { tenantName: string }) {
  const [exiting, setExiting] = useState(false);

  const handleExit = async () => {
    setExiting(true);
    try {
      const res = await fetch("/api/admin/impersonate/exit", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        window.location.href = "/admin";
      } else {
        alert(data.error || "Couldn't exit impersonation — try signing out.");
        setExiting(false);
      }
    } catch {
      alert("Network error — try again.");
      setExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-3 bg-gold px-4 py-2 pl-14 sm:pl-4 sm:justify-center text-sm text-black shadow-lg">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="font-medium truncate">
        Impersonating <strong>{tenantName}</strong> — you are seeing their account as-is
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md bg-black/80 px-3 py-1 text-xs font-semibold text-gold hover:bg-black transition-colors disabled:opacity-60 shrink-0"
      >
        <LogOut className="h-3.5 w-3.5" />
        {exiting ? "Exiting..." : "Exit to Admin"}
      </button>
    </div>
  );
}
