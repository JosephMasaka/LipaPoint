"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  Settings, Store, TrendingUp, Users, LogOut, Receipt,
} from "lucide-react";

interface SidebarProps {
  tenantSlug: string;
  user: { name: string; role: string; tenant: { name: string; tier: string } };
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingCart, label: "Point of Sale", href: "/pos" },
  { icon: ClipboardList, label: "Orders", href: "/orders" },
  { icon: Package, label: "Inventory", href: "/inventory" },
  { icon: Receipt, label: "Transactions", href: "/transactions" },
  { icon: Users, label: "Staff", href: "/users" },
  { icon: TrendingUp, label: "Analytics", href: "/dashboard" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ tenantSlug, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
          <Store className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-zinc-100 truncate">
            {user.tenant.name}
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            LipaPoint POS
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navItems.map((item) => {
          const fullHref = `/${tenantSlug}${item.href}`;
          const isActive = pathname === fullHref;
          return (
            <Link
              key={item.label}
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

      <div className="border-t border-zinc-800 p-4 space-y-3">
        <div className="rounded-lg bg-zinc-900 p-3 border border-zinc-800">
          <p className="text-xs font-medium text-zinc-400 truncate">{user.name}</p>
          <p className="text-[10px] text-zinc-500 capitalize">{user.role.toLowerCase().replace("_", " ")}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
