/**
 * Odoo-style App layer over the ERP module registry — pure data, no Prisma.
 *
 * An App is what a customer buys and launches (marketing, onboarding, the
 * switcher); a module is what the database gates on. One app can install
 * several modules (Point of Sale installs the POS + inventory modules).
 * Shared by register onboarding, the sidebar switcher and the dashboard
 * first-run tiles so every surface tells the same modular story.
 */

import {
  MODULE_KEYS,
  expandModuleSet,
  minTierForModules,
  TIER_ORDER,
} from "./module-registry";
import type { AppKey, ModuleKey } from "./module-registry";

/** Alias of the registry's AppKey so the App layer and the feature layer
 * can never disagree about how many Apps exist. */
export type AppId = AppKey;

export interface AppDefinition {
  id: AppId;
  label: string;
  tagline: string;
  /** Modules installed when this app is switched on. */
  modules: ModuleKey[];
  group: "commerce" | "backoffice";
}

export const APPS: AppDefinition[] = [
  {
    id: "pos",
    label: "Point of Sale",
    tagline: "Sell from any till — orders, tabs, receipts and stock in one go.",
    modules: ["pos", "inventory"],
    group: "commerce",
  },
  {
    id: "crm",
    label: "Customers & Loyalty",
    tagline: "Customer ledger, statements and loyalty points.",
    modules: ["crm"],
    group: "commerce",
  },
  {
    id: "finance",
    label: "Finance & Procurement",
    tagline: "Chart of accounts, general ledger, suppliers and purchase orders.",
    modules: ["finance", "procurement"],
    group: "backoffice",
  },
  {
    id: "payroll",
    label: "HR & Payroll",
    tagline: "Kenyan statutory payroll — PAYE, NSSF, SHIF, housing levy, P9.",
    modules: ["payroll"],
    group: "backoffice",
  },
  {
    id: "assets",
    label: "Asset Management",
    tagline: "Fixed asset register, depreciation, maintenance and disposal.",
    modules: ["assets"],
    group: "backoffice",
  },
  {
    id: "etims",
    label: "KRA eTIMS",
    tagline: "Real-time OSCU invoice submission and compliance dashboard.",
    modules: ["etims"],
    group: "backoffice",
  },
];

export const APP_IDS = APPS.map((a) => a.id);

export function getApp(id: string): AppDefinition | undefined {
  return APPS.find((a) => a.id === id);
}

/** Module keys installed by a set of apps, with dependencies expanded. */
export function modulesForApps(appIds: Iterable<string>): Set<ModuleKey> {
  const keys: ModuleKey[] = [];
  for (const id of appIds) {
    const app = getApp(id);
    if (app) keys.push(...app.modules);
  }
  return expandModuleSet(keys);
}

/** Which apps a set of enabled modules turns on (an app counts as on when
 *  any of its modules is enabled — the switcher reads this). */
export function appsFromModules(enabledModules: Iterable<string>): Set<AppId> {
  const enabled = new Set<string>(enabledModules);
  const out = new Set<AppId>();
  for (const app of APPS) {
    if (app.modules.some((m) => enabled.has(m))) out.add(app.id);
  }
  return out;
}

/** The tier label an app needs, e.g. "Professional & up". */
export function appTierLabel(app: AppDefinition): string {
  const idx = minTierForModules(app.modules);
  const tier = TIER_ORDER[idx < 0 ? TIER_ORDER.length - 1 : idx];
  if (tier === "STARTER") return "Starter & up";
  if (tier === "PROFESSIONAL") return "Professional & up";
  return "Enterprise only";
}

/** Minimum tier (index into TIER_ORDER) covering a set of apps; 0 if empty. */
export function minTierIndexForApps(appIds: Iterable<string>): number {
  const modules = modulesForApps(appIds);
  if (modules.size === 0) return 0;
  const idx = minTierForModules(modules);
  return idx < 0 ? TIER_ORDER.length - 1 : idx;
}

/** Guided-first-run task shown on the dashboard's apps panel. */
export interface AppTask {
  title: string;
  task: string;
  href: string;
}

export const APP_TASKS: Record<AppId, AppTask> = {
  pos: { title: "Point of Sale", task: "Ring up your first sale", href: "/pos" },
  crm: { title: "Customers & Loyalty", task: "Add your first customer", href: "/customers" },
  finance: { title: "Finance & Procurement", task: "Review your chart of accounts", href: "/finance" },
  payroll: { title: "HR & Payroll", task: "Add an employee and run payroll", href: "/payroll" },
  assets: { title: "Asset Management", task: "Register your first asset", href: "/assets" },
  etims: { title: "KRA eTIMS", task: "Connect to KRA eTIMS", href: "/etims" },
};

/** Every module key — re-exported for convenience in onboarding UI. */
export { MODULE_KEYS };
