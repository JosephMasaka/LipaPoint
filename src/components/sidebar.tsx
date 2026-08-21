"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { usePWA } from "@/components/pwa-provider";
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  Settings, Store, TrendingUp, Users, LogOut, Receipt,
  Menu, X, Sun, Moon, Clock, PanelLeftClose, PanelLeftOpen, MapPin, WifiOff, Download,
} from "lucide-react";
import { useState, useEffect } from "react";

interface SidebarProps {
  tenantSlug: string;
  user: { name: string; role: string; tenant: { name: string; tier: string } };
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "STOCK_KEEPER", "KITCHEN"] },
  { icon: ShoppingCart, label: "Point of Sale", href: "/pos", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"] },
  { icon: Clock, label: "Tabs", href: "/tabs", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"] },
  { icon: ClipboardList, label: "Orders", href: "/orders", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "KITCHEN"] },
  { icon: Package, label: "Inventory", href: "/inventory", roles: ["OWNER", "ADMIN", "MANAGER", "STOCK_KEEPER"] },
  { icon: Receipt, label: "Transactions", href: "/transactions", roles: ["OWNER", "ADMIN", "MANAGER"] },
  { icon: TrendingUp, label: "Analytics", href: "/analytics", roles: ["OWNER", "ADMIN", "MANAGER"] },
  { icon: Users, label: "Staff", href: "/users", roles: ["OWNER", "ADMIN", "MANAGER"] },
  { icon: MapPin, label: "Locations", href: "/locations", roles: ["OWNER", "ADMIN"] },
  { icon: Settings, label: "Settings", href: "/settings", roles: ["OWNER", "ADMIN"] },
];

export function Sidebar({ tenantSlug, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }));
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const { isOnline, canInstall, installApp } = usePWA();
  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  const sidebarContent = (
    <>
      <div className={cn("flex h-14 items-center border-b border-border px-4 shrink-0", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
              <Store className="h-4 w-4 text-gold" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-text-primary truncate">
                {user.tenant.name}
              </h1>
              <p className="text-[9px] text-text-muted uppercase tracking-widest">
                LipaPoint
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
            <Store className="h-4 w-4 text-gold" />
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
        {filteredNav.map((item) => {
          const fullHref = `/${tenantSlug}${item.href}`;
          const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
          return (
            <Link
              key={item.label}
              href={fullHref}
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
        {!isOnline && (
          <div className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20", collapsed && "justify-center px-2")}>
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Offline Mode</span>}
          </div>
        )}
        {canInstall && (
          <button
            onClick={installApp}
            className={cn("flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-gold hover:bg-gold/10 transition-colors", collapsed && "justify-center px-2")}
            title={collapsed ? "Install App" : undefined}
          >
            <Download className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Install App</span>}
          </button>
        )}
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

        {!collapsed && (
          <div className="rounded-lg bg-surface-elevated p-2.5 border border-border">
            <p className="text-xs font-medium text-text-secondary truncate">{user.name}</p>
            <p className="text-[10px] text-text-muted capitalize">{user.role.toLowerCase().replace("_", " ")}</p>
          </div>
        )}

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
