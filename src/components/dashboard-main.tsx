"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCollapsed(detail.collapsed);
    };
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  return (
    <main
      className={cn(
        "min-h-screen overflow-x-hidden transition-[margin] duration-200",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )}
    >
      {children}
    </main>
  );
}
