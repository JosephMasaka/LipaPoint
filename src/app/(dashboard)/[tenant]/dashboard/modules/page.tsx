"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, X, Save, Lock, ChevronDown, ChevronRight, LayoutDashboard, Package, Calculator, Globe, HandCoins, Truck, Boxes, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/modules";
import { type AppId } from "@/lib/apps";
import { getSessionUser } from "@/lib/session-client";

/**
 * Odoo-style "Apps" screen (sub-feature spec §8): App → Module → Feature.
 *
 * App is the card, each module inside it keeps its own on/off switch, and
 * every module expands to its sub-features as checkboxes — core features are
 * the free floor (locked on), billable ones toggle individually, which is
 * exactly the granularity the client asked for ("Payroll without the rest").
 *
 * State and mutations go through /api/modules and /api/features — this page
 * must never import the server functions directly, since they pull Prisma
 * into the browser bundle and the page silently fails to load.
 */

interface ModuleInfo {
  key: ModuleKey;
  label: string;
  description: string;
  group: "commerce" | "backoffice";
  requires: ModuleKey[];
  enabled: boolean;
  source: string | null;
  enabledAt: string | null;
  entitledByTier: boolean;
}

interface ModulesResponse {
  modules: ModuleInfo[];
  tier: string;
  role: string;
}

interface FeatureInfo {
  key: string;
  label: string;
  core: boolean;
  requires: string[];
  moduleKey: string;
  enabled: boolean;
  source: string | null;
}

interface AppTree {
  id: AppId;
  label: string;
  tagline: string;
  group: "commerce" | "backoffice";
  modules: {
    key: ModuleKey;
    label: string;
    description: string;
    enabled: boolean;
    features: FeatureInfo[];
  }[];
}

interface FeaturesResponse {
  apps: AppTree[];
  enabled: string[];
  category: string;
  tier: string;
  role: string;
}

const MODULE_ICONS: Record<ModuleKey, React.ComponentType<{ className?: string }>> = {
  pos: LayoutDashboard,
  inventory: Package,
  crm: Users,
  finance: Calculator,
  procurement: Truck,
  etims: Globe,
  payroll: HandCoins,
  assets: Boxes,
};

const APP_ICONS: Record<AppId, React.ComponentType<{ className?: string }>> = {
  pos: LayoutDashboard,
  crm: Users,
  finance: Calculator,
  payroll: HandCoins,
  assets: Boxes,
  etims: Globe,
};

type ChangeAction = "grant" | "revoke";

export default function DashboardModulesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [apps, setApps] = useState<AppTree[]>([]);
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingChange, setPendingChange] = useState<{
    module: ModuleInfo;
    action: ChangeAction;
  } | null>(null);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const [modRes, featRes] = await Promise.all([
        fetch("/api/modules", { credentials: "include" }),
        fetch("/api/features", { credentials: "include" }),
      ]);
      const modData = (await modRes.json().catch(() => ({}))) as ModulesResponse & {
        error?: string;
      };
      if (!modRes.ok) {
        setError(modData.error || `Could not load modules (${modRes.status})`);
        setModules([]);
        return;
      }
      setModules(modData.modules);
      setTier(modData.tier);

      const featData = (await featRes.json().catch(() => ({}))) as FeaturesResponse;
      if (featRes.ok) {
        setApps(featData.apps);
      }
      // Non-admins can read features but not modules — degrade to the module
      // list only rather than failing the whole screen.
      if (!featRes.ok && featRes.status !== 403) {
        setApps([]);
      }
    } catch {
      setError("Failed to load app state. Please refresh and try again.");
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessionUser().then((u) => {
      if (!u) {
        setError("Your session has expired — sign in again to manage apps.");
        setLoading(false);
        return;
      }
      fetchState();
    });
  }, [fetchState]);

  function requestChange(mod: ModuleInfo, action: ChangeAction) {
    setInfo(null);
    if (!mod.entitledByTier && !mod.enabled) {
      setPendingChange(null);
      setInfo(
        `${mod.label} isn't included in your ${tier.toLowerCase()} plan. Upgrade your plan or contact support to add this app.`
      );
      return;
    }
    if (action === "grant" && !mod.entitledByTier && mod.enabled) {
      // Already granted as an addon — no need to re-grant.
      return;
    }
    setPendingChange({ module: mod, action });
  }

  async function confirmChange() {
    if (!pendingChange || busy) return;
    const { module: mod, action } = pendingChange;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ moduleKey: mod.key, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update modules. Please try again.");
        return;
      }
      await fetchState();
    } catch {
      setError("Network error — could not update modules.");
    } finally {
      setBusy(false);
      setPendingChange(null);
    }
  }

  async function toggleFeature(feature: FeatureInfo) {
    if (feature.core || busy) return;
    setInfo(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          featureKey: feature.key,
          action: feature.enabled ? "revoke" : "grant",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update this feature. Please try again.");
        return;
      }
      await fetchState();
    } catch {
      setError("Network error — could not update features.");
    } finally {
      setBusy(false);
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (error && !loading && modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-text-muted">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchState}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const moduleByKey = new Map(modules.map((m) => [m.key, m]));

  const renderFeature = (feature: FeatureInfo, moduleEnabled: boolean) => {
    const dimmed = !moduleEnabled;
    return (
      <button
        key={feature.key}
        type="button"
        disabled={feature.core || dimmed || busy}
        onClick={() => toggleFeature(feature)}
        title={
          feature.core
            ? "Core feature — always included with this module"
            : dimmed
              ? `Turn on ${feature.moduleKey} to configure this feature`
              : undefined
        }
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
          feature.core
            ? "bg-surface-hover/30 cursor-not-allowed opacity-80"
            : dimmed
              ? "bg-surface-hover/20 cursor-not-allowed opacity-60"
              : feature.enabled
                ? "bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer"
                : "bg-surface-hover/40 hover:bg-surface-hover cursor-pointer"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border",
              feature.enabled && !feature.core
                ? "border-emerald-500 bg-emerald-500 text-white"
                : feature.core
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-border bg-surface-elevated"
            )}
          >
            {feature.enabled && !feature.core && (
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1.5 5L4.5 8L8.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {feature.core && <Lock className="h-2.5 w-2.5" />}
          </span>
          <span
            className={cn(
              "text-[13px] truncate",
              feature.enabled ? "text-text-primary" : "text-text-secondary"
            )}
          >
            {feature.label}
          </span>
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted">
          {feature.core ? "Free" : feature.enabled ? "On" : "Off"}
        </span>
      </button>
    );
  };

  const renderRow = (mod: ModuleInfo, treeFeatures: FeatureInfo[]) => {
    const Icon = MODULE_ICONS[mod.key];
    const locked = !mod.entitledByTier && !mod.enabled;
    const isPending = pendingChange?.module.key === mod.key;
    const isOpen = expanded.has(mod.key);
    const canExpand = treeFeatures.length > 0;

    return (
      <div key={mod.key} className="rounded-lg">
        <div className="flex items-stretch gap-1">
          <button
            type="button"
            onClick={() => requestChange(mod, mod.enabled ? "revoke" : "grant")}
            className={cn(
              "flex-1 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              locked
                ? "bg-surface-hover/30 opacity-70 cursor-not-allowed"
                : isPending
                  ? "bg-gold/10 ring-1 ring-gold/40 cursor-pointer"
                  : mod.enabled
                    ? "bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer"
                    : "bg-surface-hover/40 hover:bg-surface-hover cursor-pointer"
            )}
            title={locked ? "Not included in your plan" : undefined}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  mod.enabled ? "text-emerald-500" : locked ? "text-text-muted" : "text-gold"
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    mod.enabled ? "text-text-primary" : "text-text-secondary"
                  )}
                >
                  {mod.label}
                </p>
                <p className="text-[11px] truncate text-text-muted">{mod.description}</p>
                {mod.requires.length > 0 && (
                  <p className="text-[10px] text-text-muted">requires: {mod.requires.join(", ")}</p>
                )}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border",
                mod.enabled
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : locked
                    ? "border-border bg-surface-elevated text-text-muted"
                    : "border-border bg-surface-elevated text-text-secondary"
              )}
            >
              {locked ? (
                <>
                  <Lock className="h-3 w-3" /> Not in plan
                </>
              ) : mod.enabled ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path
                      d="M1.5 5L4.5 8L8.5 2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  On
                </>
              ) : (
                "Off"
              )}
            </span>
          </button>
          {canExpand && (
            <button
              type="button"
              onClick={() => toggleExpanded(mod.key)}
              aria-expanded={isOpen}
              title={isOpen ? "Hide features" : "Show features"}
              className="shrink-0 w-9 flex items-center justify-center rounded-lg bg-surface-hover/40 hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {isOpen && canExpand && (
          <div className="mt-1 ml-4 pl-3 border-l border-border/70 space-y-1 py-1">
            <p className="px-1 pt-1 text-[10px] uppercase tracking-wide text-text-muted">
              Features{!mod.enabled && " — turn this module on to configure"}
            </p>
            {treeFeatures.map((feature) => renderFeature(feature, mod.enabled))}
          </div>
        )}
      </div>
    );
  };

  const renderAppCard = (app: AppTree) => {
    const AppIcon = APP_ICONS[app.id] ?? Boxes;
    const nodes = app.modules
      .map((node) => ({ node, info: moduleByKey.get(node.key) }))
      .filter((row): row is { node: AppTree["modules"][number]; info: ModuleInfo } => Boolean(row.info));
    if (nodes.length === 0) return null;
    const onCount = nodes.filter((row) => row.info.enabled).length;
    const featureCount = nodes.reduce((n, row) => n + row.node.features.length, 0);
    const enabledFeatures = nodes.reduce(
      (n, row) => n + row.node.features.filter((f) => f.enabled).length,
      0
    );

    return (
      <Card key={app.id}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AppIcon className="h-5 w-5 text-gold" />
            {app.label}
            <span className="ml-auto text-xs font-normal text-text-muted">
              {onCount}/{app.modules.length} modules · {enabledFeatures}/{featureCount} features
            </span>
          </CardTitle>
          <p className="text-sm text-text-secondary">{app.tagline}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nodes.map(({ node, info }) => renderRow(info, node.features))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const commerceApps = apps.filter((a) => a.group === "commerce");
  const backofficeApps = apps.filter((a) => a.group === "backoffice");

  return (
    <div className="space-y-6">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4 pt-12 lg:pt-5 shrink-0 sticky top-0 z-10 mb-0">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">LipaPoint Apps</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-text-secondary">
            Every app your business runs on — switch apps on or off, then open one to pick the
            individual features you actually pay for, like Payroll without the rest of HR.
          </p>
        </div>
        
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Button asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4 mr-2" />
              Back to dashboard
          </Link>
        </Button>

        {error && modules.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {info && !error && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
            {info}
          </div>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader size="lg" label="Loading apps..." />
            </CardContent>
          </Card>
        ) : (
          <>
            {commerceApps.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-text-muted">
                  Commerce apps
                </p>
                <div className="grid gap-6 sm:grid-cols-2">{commerceApps.map(renderAppCard)}</div>
              </div>
            )}
            {backofficeApps.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-text-muted">
                  Back-office apps
                </p>
                <div className="grid gap-6 sm:grid-cols-2">{backofficeApps.map(renderAppCard)}</div>
              </div>
            )}

            {apps.length === 0 && modules.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-sky-500" />
                      Commerce apps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {modules.filter((m) => m.group === "commerce").map((m) => renderRow(m, []))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Boxes className="h-5 w-5 text-emerald-500" />
                      Back-office apps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {modules.filter((m) => m.group === "backoffice").map((m) => renderRow(m, []))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {pendingChange && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
                  <div>
                    <p className="font-medium text-text-primary">
                      {pendingChange.action === "grant" ? "Turn this app on?" : "Turn this app off?"}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {pendingChange.module.label} will be{" "}
                      {pendingChange.action === "grant" ? "enabled" : "disabled"}
                      {pendingChange.action === "grant" &&
                      pendingChange.module.requires.length > 0
                        ? ` — ${pendingChange.module.requires.join(", ")} will be enabled with it.`
                        : "."}
                      {pendingChange.action === "revoke" &&
                      " — its features switch off with it, but your choices are remembered."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingChange(null)}
                      disabled={busy}
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={confirmChange} className="gap-2" disabled={busy}>
                      <Save className="h-4 w-4" />
                      {busy
                        ? "Saving..."
                        : `Confirm ${pendingChange.action === "grant" ? "Enable" : "Disable"}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}