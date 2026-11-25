"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { AlertCircle, ArrowLeft, CheckCircle, Play, RefreshCw, Upload } from "lucide-react";

interface SyncConfig {
  id: string;
  entity: string;
  enabled: boolean;
  frequency: string;
  conflictPolicy: string;
  mapping: unknown;
  lastRunAt: string | null;
  nextRunAt: string | null;
  sourceFileName: string | null;
}

interface Connection {
  id: string;
  providerId: string;
  providerLabel: string;
  name: string;
  status: string;
  authType: string;
  baseUrl: string | null;
  maskedHint: string | null;
  webhookUrl: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastErrorMessage: string | null;
  syncConfigs: SyncConfig[];
}

interface Job {
  id: string;
  entity: string;
  status: string;
  trigger: string;
  processedCount: number;
  appliedCount: number;
  rejectedCount: number;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  PENDING: "warning",
  PAUSED: "secondary",
  ERROR: "destructive",
  DISCONNECTED: "secondary",
  SUCCEEDED: "success",
  PARTIAL: "warning",
  FAILED: "destructive",
  DEAD: "destructive",
  QUEUED: "secondary",
  RUNNING: "warning",
  APPLIED: "success",
  REJECTED: "destructive",
};

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function ConnectConnectionPage() {
  const params = useParams<{ tenant: string; id: string }>();
  const tenantSlug = params?.tenant ?? "";
  const connectionId = params?.id ?? "";

  const [connection, setConnection] = useState<Connection | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const notify = (type: "ok" | "error", message: string) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 5000);
  };

  const load = useCallback(async () => {
    try {
      const [connectionResponse, jobsResponse] = await Promise.all([
        fetch(`/api/connect/connections/${connectionId}`),
        fetch(`/api/connect/jobs?connectionId=${encodeURIComponent(connectionId)}&limit=10`),
      ]);
      const connectionData = await connectionResponse.json();
      if (!connectionResponse.ok) {
        notify("error", connectionData.error || "Could not load the connection");
        return;
      }
      setConnection(connectionData.connection);
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setJobs(jobsData.jobs ?? []);
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (key: string, run: () => Promise<Response>, successMessage: string) => {
    setBusy(key);
    try {
      const response = await run();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify("error", (data as { error?: string }).error || "That action failed");
        return;
      }
      notify("ok", successMessage);
      await load();
    } catch {
      notify("error", "Network error");
    } finally {
      setBusy(null);
    }
  };

  const test = () =>
    runAction(
      "test",
      () => fetch(`/api/connect/connections/${connectionId}/test`, { method: "POST" }),
      "Connection tested"
    );

  const setStatus = (status: "ACTIVE" | "PAUSED") =>
    runAction(
      `status-${status}`,
      () =>
        fetch(`/api/connect/connections/${connectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      status === "ACTIVE" ? "Connection resumed" : "Connection paused"
    );

  const disconnect = () => {
    if (!window.confirm("Disconnect this integration? Stored credentials are deleted; sync history is kept.")) return;
    runAction(
      "disconnect",
      () => fetch(`/api/connect/connections/${connectionId}`, { method: "DELETE" }),
      "Connection disconnected"
    );
  };

  const sync = (entity: string) =>
    runAction(
      `sync-${entity}`,
      () =>
        fetch(`/api/connect/connections/${connectionId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity }),
        }),
      `Sync started for ${entity}`
    );

  const saveConfig = (entity: string, patch: Record<string, unknown>) =>
    runAction(
      `config-${entity}`,
      () =>
        fetch(`/api/connect/connections/${connectionId}/sync/${entity}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
      `${entity} settings saved`
    );

  const saveMapping = async (entity: string) => {
    const draft = mappingDraft[entity];
    if (draft === undefined) return;
    let parsed: unknown = null;
    if (draft.trim()) {
      try {
        parsed = JSON.parse(draft);
      } catch {
        notify("error", "The mapping is not valid JSON");
        return;
      }
    }
    await saveConfig(entity, { mapping: parsed });
  };

  const upload = (entity: string, file: File) => {
    const format = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
    if (format === "csv" && !file.name.toLowerCase().endsWith(".csv")) {
      notify("error", "Upload a .csv or .xlsx file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("error", "The file is larger than 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result ?? "").split(",")[1] ?? "";
      await saveConfig(entity, { file: { fileName: file.name, format, content: base64 } });
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="p-8"><Loader label="Loading connection..." /></div>;
  if (!connection) return <div className="p-8 text-text-muted">Connection not found.</div>;

  return (
    <div className="min-h-screen bg-surface">
      <Header title={connection.name} subtitle={`${connection.providerLabel} · ${connection.authType}`} />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href={`/${tenantSlug}/connect`} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Connect
        </Link>

        {banner && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              banner.type === "ok"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {banner.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {banner.message}
          </div>
        )}

        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-text-muted">Status</p>
              <Badge variant={STATUS_VARIANT[connection.status] ?? "secondary"}>{connection.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-text-muted">Credentials</p>
              <p className="text-sm text-text-primary">{connection.maskedHint ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Last sync</p>
              <p className="text-sm text-text-primary">{fmt(connection.lastSyncAt)}</p>
              {connection.lastErrorMessage && <p className="text-xs text-red-400">{connection.lastErrorMessage}</p>}
            </div>
            <div>
              <p className="text-xs text-text-muted">Webhook</p>
              <p className="break-all text-xs text-text-secondary">{connection.webhookUrl ?? "Not enabled"}</p>
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-4">
              <Button variant="outline" className="gap-2" onClick={test} disabled={busy !== null}>
                <RefreshCw className="h-4 w-4" /> Test connection
              </Button>
              {connection.status === "PAUSED" ? (
                <Button variant="outline" onClick={() => setStatus("ACTIVE")} disabled={busy !== null}>Resume</Button>
              ) : (
                <Button variant="outline" onClick={() => setStatus("PAUSED")} disabled={busy !== null || connection.status === "DISCONNECTED"}>
                  Pause
                </Button>
              )}
              <Button variant="destructive" onClick={disconnect} disabled={busy !== null || connection.status === "DISCONNECTED"}>
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>

        {connection.syncConfigs.map((config) => (
          <Card key={config.id}>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize text-text-primary">{config.entity}</p>
                  <p className="text-xs text-text-muted">
                    Last run {fmt(config.lastRunAt)} · next {fmt(config.nextRunAt)}
                    {config.sourceFileName ? ` · ${config.sourceFileName}` : ""}
                  </p>
                </div>
                <Button className="gap-2" onClick={() => sync(config.entity)} disabled={busy !== null || connection.status !== "ACTIVE"}>
                  <Play className="h-4 w-4" /> Sync now
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Schedule</label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    value={config.frequency}
                    onChange={(event) => saveConfig(config.entity, { frequency: event.target.value })}
                  >
                    <option value="MANUAL">Manual only</option>
                    <option value="HOURLY">Hourly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">When a record exists</label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    value={config.conflictPolicy}
                    onChange={(event) => saveConfig(config.entity, { conflictPolicy: event.target.value })}
                  >
                    <option value="KEEP_EXTERNAL">Update local values</option>
                    <option value="KEEP_LOCAL">Keep local values</option>
                  </select>
                </div>
                {(connection.providerId === "file" || connection.providerId === "mock") && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Spreadsheet</label>
                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-secondary">
                      <Upload className="h-4 w-4" />
                      <span className="truncate">{config.sourceFileName ?? "Upload CSV or Excel"}</span>
                      <input
                        type="file"
                        accept=".csv,.xlsx"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) upload(config.entity, file);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <details>
                <summary className="cursor-pointer text-xs font-medium text-text-secondary">
                  Field mapping (JSON)
                </summary>
                <textarea
                  className="mt-2 h-40 w-full rounded-xl border border-border bg-surface-elevated p-3 font-mono text-xs text-text-primary"
                  placeholder='{ "fields": { "sku": "sku", "name": "name", "price": "price" } }'
                  value={mappingDraft[config.entity] ?? (config.mapping ? JSON.stringify(config.mapping, null, 2) : "")}
                  onChange={(event) => setMappingDraft({ ...mappingDraft, [config.entity]: event.target.value })}
                />
                <Button className="mt-2" variant="outline" onClick={() => saveMapping(config.entity)} disabled={busy !== null}>
                  Save mapping
                </Button>
              </details>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">Recent syncs</p>
              <p className="text-xs text-text-muted">
                <Link href={`/${tenantSlug}/connect/history`} className="text-gold hover:underline">View full history</Link>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50 text-xs uppercase text-text-secondary">
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-left">Entity</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Applied</th>
                    <th className="px-4 py-3 text-right">Rejected</th>
                    <th className="px-4 py-3 text-left">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No syncs yet.</td></tr>
                  ) : jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-4 py-3 text-text-secondary">{fmt(job.createdAt)}</td>
                      <td className="px-4 py-3 capitalize text-text-primary">{job.entity}</td>
                      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>{job.status}</Badge></td>
                      <td className="px-4 py-3 text-right text-text-secondary">{job.appliedCount}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{job.rejectedCount}</td>
                      <td className="px-4 py-3 text-xs text-red-400">{job.errorDetail ?? job.errorCode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
