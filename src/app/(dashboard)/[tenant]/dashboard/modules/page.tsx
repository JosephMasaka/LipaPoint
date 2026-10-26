"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, X, Save, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Calculator,
  Globe,
  HandCoins,
  Truck,
  Boxes,
  Users,
} from "lucide-react";
import type { ModuleKey } from "@/lib/modules";
import { getSessionUser } from "@/lib/session-client";

/**
 * Odoo-style "Apps" screen for a tenant.
 *
 * State and mutations go through /api/modules — this page must never import
 * src/lib/modules' server functions directly, since they pull Prisma into
 * the browser bundle and the page silently fails to load.
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

type ChangeAction = "grant" | "revoke";

export default function DashboardModulesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    module: ModuleInfo;
    action: ChangeAction;
  } | null>(null);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/modules", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Could not load modules (${res.status})`);
        setModules([]);
        return;
      }
      setModules((data as ModulesResponse).modules);
      setTier((data as ModulesResponse).tier);
    } catch {
      setError("Failed to load module state. Please refresh and try again.");
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

  const renderRow = (mod: ModuleInfo) => {
    const Icon = MODULE_ICONS[mod.key];
    const locked = !mod.entitledByTier && !mod.enabled;
    const isPending = pendingChange?.module.key === mod.key;
    return (
      <button
        key={mod.key}
        type="button"
        onClick={() => requestChange(mod, mod.enabled ? "revoke" : "grant")}
        className={cn(
          "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
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
              <p className="text-[10px] text-text-muted">
                requires: {mod.requires.join(", ")}
              </p>
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
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Apps</h1>
          <p className="text-text-secondary">
            Every app your business runs on, with its own on/off switch — turn apps
            on or off per tenant, and switch the ones you need into one unified system.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Back to dashboard
          </Link>
        </Button>
      </div>

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
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-sky-500" />
                  Commerce apps
                </CardTitle>
                <p className="text-sm text-text-secondary">
                  Sales, stock, customers and loyalty. Each can be switched on or off
                  without affecting the back office.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {modules.filter((m) => m.group === "commerce").map(renderRow)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-emerald-500" />
                  Back-office apps
                </CardTitle>
                <p className="text-sm text-text-secondary">
                  Accounting, procurement, eTIMS, payroll and assets. All require
                  Finance, so Finance is the key you actually toggle first.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {modules.filter((m) => m.group === "backoffice").map(renderRow)}
                </div>
              </CardContent>
            </Card>
          </div>

          {pendingChange && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
                <div>
                  <p className="font-medium text-text-primary">
                    {pendingChange.action === "grant"
                      ? "Turn this app on?"
                      : "Turn this app off?"}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {pendingChange.module.label} will be{" "}
                    {pendingChange.action === "grant" ? "enabled" : "disabled"}
                    {pendingChange.action === "grant" &&
                    pendingChange.module.requires.length > 0
                      ? ` — ${pendingChange.module.requires.join(", ")} will be enabled with it.`
                      : "."}
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
  );
}
