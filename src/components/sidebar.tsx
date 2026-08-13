"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  Settings, Store, TrendingUp, Users, LogOut, Receipt,
  Menu, X, Sun, Moon, Clock,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  tenantSlug: string;
  user: { name: string; role: string; tenant: { name: string; tier: string } };
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingCart, label: "Point of Sale", href: "/pos" },
  { icon: Clock, label: "Tabs", href: "/tabs" },
  { icon: ClipboardList, label: "Orders", href: "/orders" },
  { icon: Package, label: "Inventory", href: "/inventory" },
  { icon: Receipt, label: "Transactions", href: "/transactions" },
  { icon: TrendingUp, label: "Analytics", href: "/analytics" },
  { icon: Users, label: "Staff", href: "/users" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ tenantSlug, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10">
            <Store className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-text-primary truncate">
              {user.tenant.name}
            </h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              LipaPoint POS
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-text-secondary hover:bg-surface-hover"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navItems.map((item) => {
          const fullHref = `/${tenantSlug}${item.href}`;
          const isActive = pathname === fullHref;
          return (
            <Link
              key={item.label}
              href={fullHref}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <div className="rounded-lg bg-surface-elevated p-3 border border-border">
          <p className="text-xs font-medium text-text-secondary truncate">{user.name}</p>
          <p className="text-[10px] text-text-muted capitalize">{user.role.toLowerCase().replace("_", " ")}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-surface-elevated border border-border text-text-primary shadow-lg"
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
          "fixed left-0 top-0 z-50 h-screen w-72 bg-surface border-r border-border flex flex-col transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-surface flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
