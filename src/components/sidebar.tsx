"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  Settings,
  Store,
  TrendingUp,
} from "lucide-react";

interface SidebarProps {
  tenantSlug: string;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingCart, label: "Point of Sale", href: "/pos" },
  { icon: ClipboardList, label: "Orders", href: "/orders" },
  { icon: Package, label: "Inventory", href: "/inventory" },
  { icon: TrendingUp, label: "Analytics", href: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ tenantSlug }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
          <Store className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h1 className="text-base font-bold text-zinc-100 tracking-tight">
            LipaPoint
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            Enterprise POS
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const fullHref = `/${tenantSlug}${item.href}`;
          const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="rounded-lg bg-zinc-900 p-3 border border-zinc-800">
          <p className="text-xs font-medium text-zinc-400">Current Plan</p>
          <p className="text-sm font-bold text-gold">Pro Tier</p>
          <p className="text-[10px] text-zinc-500 mt-1">5 Locations · Unlimited Users</p>
        </div>
      </div>
    </aside>
  );
}
