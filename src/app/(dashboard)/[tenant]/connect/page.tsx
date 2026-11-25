"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { AlertCircle, CheckCircle, History, Plug, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncConfigSummary {
  id: string;
  entity: string;
  frequency: string;
  enabled: boolean;
  lastRunAt: string | null;
}

interface ConnectionSummary {
  id: string;
  providerId: string;
  providerLabel: string;
  name: string;
  status: string;
  authType: string;
  maskedHint: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastTestOk: boolean | null;
  syncConfigs: SyncConfigSummary[];
}

interface Usage {
  used: number;
  limit: number;
  label: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  PENDING: "warning",
  PAUSED: "secondary",
  ERROR: "destructive",
  DISCONNECTED: "secondary",
};

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function ConnectPage() {
  const tenantSlug = usePathname().split("/")[1] || "";
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/connect/connections");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not load connections");
        return;
      }
      setError("");
      setConnections(data.connections);
      setUsage(data.usage);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = connections.filter((connection) => connection.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-surface">
      <Header title="Connect" subtitle="Sync products and customers with the systems you already use" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-border bg-surface-elevated/50 px-4 py-3">
            <p className="text-xs text-text-muted">Connections</p>
            <p className="text-lg font-bold text-text-primary">
              {usage ? `${usage.used} / ${Number.isFinite(usage.limit) ? usage.limit : "∞"}` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated/50 px-4 py-3">
            <p className="text-xs text-text-muted">Active</p>
            <p className="text-lg font-bold text-text-primary">{active}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href={`/${tenantSlug}/connect/history`}>
              <Button variant="outline" className="gap-2">
                <History className="h-4 w-4" /> Sync history
              </Button>
            </Link>
            <Link href={`/${tenantSlug}/connect/catalogue`}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add integration
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          {usage ? usage.label : ""} · read-only ingestion in this release: Connect reads from the other
          system and writes to LipaPoint, never the reverse.
        </p>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <Loader label="Loading connections..." />
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Plug className="h-10 w-10 text-text-muted" />
              <p className="text-text-primary font-medium">No systems connected yet</p>
              <p className="max-w-md text-sm text-text-muted">
                Start with a CSV or Excel file of your products, or point Connect at a REST endpoint that
                returns JSON.
              </p>
              <Link href={`/${tenantSlug}/connect/catalogue`}>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add your first integration
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <Link key={connection.id} href={`/${tenantSlug}/connect/${connection.id}`}>
                <Card className="h-full transition-colors hover:border-gold/40">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-text-muted">
                          {connection.providerLabel}
                        </p>
                        <p className="font-semibold text-text-primary">{connection.name}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[connection.status] ?? "secondary"}>
                        {connection.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {connection.syncConfigs.map((config) => (
                        <span
                          key={config.id}
                          className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                        >
                          {config.entity} · {config.frequency}
                        </span>
                      ))}
                    </div>

                    <dl className="space-y-1 text-xs text-text-secondary">
                      <div className="flex justify-between gap-2">
                        <dt>Last sync</dt>
                        <dd className={cn(connection.lastSyncStatus === "FAILED" && "text-red-400")}>
                          {fmt(connection.lastSyncAt)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Credentials</dt>
                        <dd className="flex items-center gap-1">
                          {connection.maskedHint ? (
                            <>
                              <CheckCircle className="h-3 w-3 text-emerald-400" /> {connection.maskedHint}
                            </>
                          ) : (
                            "Not set"
                          )}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
