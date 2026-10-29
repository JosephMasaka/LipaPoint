"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { usePWA } from "@/components/pwa-provider";

import { Logo } from "@/components/logo";
import { getBusinessCategory, canAccessFeature, type BusinessCategory } from "@/lib/plans";
import type { FeatureKey, ModuleKey } from "@/lib/module-registry";
import { APPS, appsFromModules, type AppId } from "@/lib/apps";
import { useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { ModuleList } from "@/components/ui/module-list";

import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  Settings, TrendingUp, Users, LogOut, Receipt,
  Menu, X, Sun, Moon, Clock, PanelLeftClose, PanelLeftOpen, MapPin, WifiOff, Download,
  UserCircle, Tag, UtensilsCrossed, ChefHat, BookOpen, Globe, Truck, Calendar, Scissors, ListOrdered, CalendarDays,
  FileText, Landmark, Calculator, ShieldCheck, Contact, Banknote, Boxes, BarChart3,
} from "lucide-react";

interface SidebarProps {
  tenantSlug: string;
  user: { name: string; role: string; tenant: { name: string; tier: string; type: string } };
  /** Enabled ERP module keys for this tenant (from the dashboard layout). */
  modules: string[];
  /** Enabled sub-feature keys (spec §8) — nav items carry `featureKey`. */
  features: string[];
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  roles: string[];
  feature: string | null;
  /** Gate on an enabled sub-feature (TenantFeature, spec §8) — the granular
   *  switch the Apps screen exposes, e.g. Payroll without Attendance. */
  featureKey?: FeatureKey;
  /** Gate on an enabled ERP module (TenantModule) instead of a plan feature. */
  module?: ModuleKey;
  /** Odoo-style app section this link lives under (see SIDEBAR_SECTIONS). */
  app: string;
}

const baseNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "STOCK_KEEPER", "KITCHEN"], feature: null, app: "home" },
  { icon: ShoppingCart, label: "Point of Sale", featureKey: "core-till", href: "/pos", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: null, module: "pos", app: "pos" },
  { icon: ClipboardList, label: "Orders", featureKey: "core-till", href: "/orders", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "KITCHEN"], feature: null, module: "pos", app: "pos" },
];

/* Nav sets shared by the newer pricing categories. No tenant type maps to
 * them yet (TENANT_TYPE_TO_CATEGORY is untouched), so these entries are
 * display-only today: selling verticals reuse the retail set, warehouse
 * keeps Inventory, back-office verticals get the till's Transactions. */
const retailNavItems: NavItem[] = [
  { icon: Clock, label: "Tabs", featureKey: "core-till", href: "/tabs", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: null, module: "pos", app: "pos" },
  { icon: Package, label: "Inventory", featureKey: "stock-tracking-basic", href: "/inventory", roles: ["OWNER", "ADMIN", "MANAGER", "STOCK_KEEPER"], feature: null, module: "inventory", app: "pos" },
  { icon: Receipt, label: "Transactions", featureKey: "core-till", href: "/transactions", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "pos", app: "pos" },
];
const warehouseNavItems: NavItem[] = [retailNavItems[1], retailNavItems[2]];
const deskNavItems: NavItem[] = [retailNavItems[2]];

const categoryNavItems: Record<BusinessCategory, NavItem[]> = {
  RETAIL_GENERAL: retailNavItems,
  RESTAURANT_HOSPITALITY: [
    { icon: Clock, label: "Tabs", featureKey: "core-till", href: "/tabs", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: null, module: "pos", app: "pos" },
    { icon: UtensilsCrossed, label: "Tables", featureKey: "table-management", href: "/tables", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: "table-management", module: "pos", app: "pos" },
    { icon: BookOpen, label: "Menu", featureKey: "menu-management", href: "/menu", roles: ["OWNER", "ADMIN", "MANAGER"], feature: "menu-management", module: "pos", app: "pos" },
    { icon: ChefHat, label: "Kitchen Display", featureKey: "kitchen-display", href: "/kitchen", roles: ["OWNER", "ADMIN", "MANAGER", "KITCHEN"], feature: "kitchen-display", module: "pos", app: "pos" },
    { icon: Package, label: "Inventory", featureKey: "stock-tracking-basic", href: "/inventory", roles: ["OWNER", "ADMIN", "MANAGER", "STOCK_KEEPER"], feature: null, module: "inventory", app: "pos" },
    { icon: Globe, label: "Online Ordering", featureKey: "online-ordering", href: "/online-ordering", roles: ["OWNER", "ADMIN", "MANAGER"], feature: "online-ordering", module: "pos", app: "pos" },
    { icon: Truck, label: "Delivery", featureKey: "delivery-management", href: "/delivery", roles: ["OWNER", "ADMIN", "MANAGER"], feature: "delivery-management", module: "pos", app: "pos" },
    { icon: Receipt, label: "Transactions", featureKey: "core-till", href: "/transactions", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "pos", app: "pos" },
  ],
  BARBERSHOP_SALON: [
    { icon: Calendar, label: "Appointments", featureKey: "appointments", href: "/appointments", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: "appointments", module: "pos", app: "pos" },
    { icon: Scissors, label: "Services", featureKey: "service-catalog", href: "/services", roles: ["OWNER", "ADMIN", "MANAGER"], feature: "service-catalog", module: "pos", app: "pos" },
    { icon: ListOrdered, label: "Queue", featureKey: "queue-management", href: "/queue", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: "queue-management", module: "pos", app: "pos" },
    { icon: CalendarDays, label: "Scheduling", featureKey: "staff-scheduling", href: "/scheduling", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: "staff-scheduling", module: "pos", app: "pos" },
    { icon: Receipt, label: "Transactions", featureKey: "core-till", href: "/transactions", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "pos", app: "pos" },
  ],
  HUMAN_RESOURCE: deskNavItems,
  ASSET_MANAGEMENT: deskNavItems,
  FINANCE: deskNavItems,
  PROCUREMENT_WHOLESALE: retailNavItems,
  HEALTHCARE_PHARMACY: retailNavItems,
  EDUCATION_TRAINING: deskNavItems,
  LOGISTICS_WAREHOUSING: warehouseNavItems,
  PROFESSIONAL_SERVICES: deskNavItems,
};

// ERP back-office links (Phase 1): shown only when the tenant's module
// rows enable them, so a pure-POS customer never sees Finance/Procurement.
const erpNavItems: NavItem[] = [
  { icon: Truck, label: "Suppliers", featureKey: "supplier-management", href: "/suppliers", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "procurement", app: "finance" },
  { icon: FileText, label: "Purchase Orders", featureKey: "purchase-orders", href: "/purchase-orders", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "procurement", app: "finance" },
  { icon: Landmark, label: "Banking", featureKey: "bank-reconciliation", href: "/banking", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "finance", app: "finance" },
  { icon: Calculator, label: "Finance", featureKey: "general-ledger", href: "/finance", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "finance", app: "finance" },
  { icon: ShieldCheck, label: "eTIMS", featureKey: "etims-submission", href: "/etims", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "etims", app: "etims" },
  { icon: Contact, label: "HR", featureKey: "employee-records", href: "/hr", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "payroll", app: "payroll" },
  { icon: Banknote, label: "Payroll", featureKey: "payroll", href: "/payroll", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "payroll", app: "payroll" },
  { icon: Boxes, label: "Assets", featureKey: "asset-register", href: "/assets", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, module: "assets", app: "assets" },
  { icon: BarChart3, label: "Reports", href: "/reports", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, app: "insights" },
];

const suffixNavItems: NavItem[] = [
  { icon: UserCircle, label: "Customers", featureKey: "customer-records", href: "/customers", roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"], feature: null, app: "crm" },
  { icon: Tag, label: "Discounts", featureKey: "discounts-coupons", href: "/discounts", roles: ["OWNER", "ADMIN", "MANAGER"], feature: "discounts", app: "crm" },
  { icon: TrendingUp, label: "Analytics", href: "/analytics", roles: ["OWNER", "ADMIN", "MANAGER"], feature: "analytics", app: "insights" },
  { icon: Users, label: "Staff", href: "/users", roles: ["OWNER", "ADMIN", "MANAGER"], feature: null, app: "admin" },
  { icon: MapPin, label: "Locations", href: "/locations", roles: ["OWNER", "ADMIN"], feature: null, app: "admin" },
  { icon: Settings, label: "Settings", href: "/settings", roles: ["OWNER", "ADMIN"], feature: null, app: "admin" },
  { icon: Boxes, label: "Apps", href: "/dashboard/modules", roles: ["OWNER", "ADMIN"], feature: null, app: "admin" },
];

/** Section chrome for the Odoo-style switcher: display order + icons for
 *  the six product apps plus the three always-on groups. */
const SIDEBAR_SECTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  home: { label: "Home", icon: LayoutDashboard },
  pos: { label: "Point of Sale", icon: ShoppingCart },
  crm: { label: "Customers & Loyalty", icon: UserCircle },
  finance: { label: "Finance & Procurement", icon: Calculator },
  payroll: { label: "HR & Payroll", icon: Banknote },
  assets: { label: "Asset Management", icon: Boxes },
  etims: { label: "KRA eTIMS", icon: ShieldCheck },
  insights: { label: "Insights", icon: BarChart3 },
  admin: { label: "Administration", icon: Settings },
};

const SECTION_ORDER = ["home", "pos", "crm", "finance", "payroll", "assets", "etims", "insights", "admin"];

type SidebarSection =
  | { kind: "group"; id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }
  | { kind: "locked"; app: AppId; label: string; icon: React.ComponentType<{ className?: string }> };

function getNavSections(
  tenantType: string,
  tier: string,
  modules: string[],
  features: string[],
  role: string
): SidebarSection[] {
  const category = getBusinessCategory(tenantType);
  const visible = [...baseNavItems, ...categoryNavItems[category], ...erpNavItems, ...suffixNavItems].filter(
    (item) =>
      item.roles.includes(role) &&
      (!item.feature || canAccessFeature(tier, item.feature, tenantType)) &&
      (!item.featureKey || features.includes(item.featureKey)) &&
      (!item.module || modules.includes(item.module))
  );

  const installed = appsFromModules(modules);
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const sections: SidebarSection[] = [];

  for (const id of SECTION_ORDER) {
    const items = visible.filter((item) => item.app === id);
    const meta = SIDEBAR_SECTIONS[id];
    if (!meta) continue;

    if (items.length > 0) {
      sections.push({ kind: "group", id, label: meta.label, icon: meta.icon, items });
      continue;
    }

    // Odoo's upsell surface: an app the tenant hasn't installed shows up
    // dimmed with an "Add" affordance instead of vanishing — admins only.
    const appDef = APPS.find((a) => a.id === id);
    if (appDef && !installed.has(appDef.id) && isAdmin) {
      sections.push({ kind: "locked", app: appDef.id, label: appDef.label, icon: meta.icon });
    }
  }

  return sections;
}

export function Sidebar({ tenantSlug, user, modules, features }: SidebarProps) {
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
  const sections = getNavSections(user.tenant.type, user.tenant.tier, modules, features, user.role);

  const sidebarContent = (
    <>
      <div className={cn("flex h-14 items-center border-b border-border px-4 shrink-0", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
              <Logo size={18} className="text-gold" />
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
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 7L9 22L21 22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold" />
              <circle cx="20" cy="11" r="2.2" fill="currentColor" className="text-gold" />
              <path d="M23 8.5C25 10.5 25 13 23 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-gold" />
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
        {sections.map((section) => {
          if (section.kind === "locked") {
            const Icon = section.icon;
            return (
              <Link
                key={`locked-${section.app}`}
                href={`/${tenantSlug}/dashboard/modules`}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? section.label : undefined}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-muted/70 opacity-70 hover:opacity-100 hover:text-text-secondary transition-all border border-dashed border-border/70 mt-1"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{section.label}</span>
                    <span className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                      Add
                    </span>
                  </>
                )}
              </Link>
            );
          }

          const SectionIcon = section.icon;
          return (
            <div key={section.id}>
              {!collapsed && section.id !== "home" && (
                <p className="flex items-center gap-1.5 px-3 pt-4 pb-1 text-[11px] font-medium text-text-muted">
                  <SectionIcon className="h-3 w-3" />
                  {section.label}
                </p>
              )}
              {collapsed && section.id !== "home" && (
                <div className="flex justify-center pt-3 pb-1" title={section.label}>
                  <SectionIcon className="h-3.5 w-3.5 text-text-muted/60" />
                </div>
              )}
              {section.items.map((item) => {
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
            </div>
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
