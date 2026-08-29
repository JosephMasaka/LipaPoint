"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  LayoutDashboard, Building2, Activity, CreditCard,
  MessageSquare, Settings, Menu, X, Sun, Moon,
  PanelLeftClose, PanelLeftOpen, LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Building2, label: "Tenants", href: "/admin/tenants" },
  { icon: Activity, label: "Activity", href: "/admin/activity" },
  { icon: CreditCard, label: "Subscriptions", href: "/admin/subscriptions" },
  { icon: MessageSquare, label: "Demo Requests", href: "/admin/demo-requests" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("admin-sidebar-collapsed", String(next));
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const sidebarContent = (
    <>
      <div className={cn("flex h-14 items-center border-b border-border px-4 shrink-0", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 7L9 22L21 22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold"/>
                <circle cx="20" cy="11" r="2.2" fill="currentColor" className="text-gold"/>
                <path d="M23 8.5C25 10.5 25 13 23 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-gold"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-text-primary truncate">
                LipaPoint Admin
              </h1>
              <p className="text-[9px] text-text-muted uppercase tracking-widest">
                Super Admin
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 7L9 22L21 22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold"/>
              <circle cx="20" cy="11" r="2.2" fill="currentColor" className="text-gold"/>
              <path d="M23 8.5C25 10.5 25 13 23 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-gold"/>
            </svg>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-lg text-text-secondary hover:bg-surface-hover"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-1 shrink-0">
        {/* Desktop collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>

        <button
          onClick={toggleTheme}
          className={cn("flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors", collapsed && "justify-center px-2")}
          title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
        </button>

        <button
          onClick={handleLogout}
          className={cn("flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-red-400 hover:bg-red-500/5 transition-colors", collapsed && "justify-center px-2")}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-surface-elevated border border-border text-text-primary shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 bg-surface border-r border-border flex flex-col transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 z-40 h-screen border-r border-border bg-surface flex-col transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
        data-collapsed={collapsed}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
