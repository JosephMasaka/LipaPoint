"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface Job {
  id: string;
  connectionId: string;
  entity: string;
  trigger: string;
  status: string;
  attempt: number;
  processedCount: number;
  appliedCount: number;
  rejectedCount: number;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface Stats {
  queued: number;
  running: number;
  failed: number;
  succeeded: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  SUCCEEDED: "success",
  PARTIAL: "warning",
  FAILED: "destructive",
  DEAD: "destructive",
  QUEUED: "secondary",
  RUNNING: "warning",
};

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function ConnectHistoryPage() {
  const tenantSlug = usePathname().split("/")[1] || "";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const query = status ? `?status=${status}` : "";
      const response = await fetch(`/api/connect/jobs${query}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not load sync history");
        return;
      }
      setError("");
      setJobs(data.jobs);
      setStats(data.stats);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (job: Job) => {
    const response = await fetch(`/api/connect/jobs/${job.id}/retry`, { method: "POST" });
    if (response.ok) load();
  };

  return (
    <div className="min-h-screen bg-surface">
      <Header title="Sync history" subtitle="Every inbound sync, with per-record outcomes" />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href={`/${tenantSlug}/connect`} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Connect
        </Link>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Queued", value: stats?.queued ?? 0 },
            { label: "Running", value: stats?.running ?? 0 },
            { label: "Succeeded", value: stats?.succeeded ?? 0 },
            { label: "Failed", value: stats?.failed ?? 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-surface-elevated/50 p-4">
              <p className="text-xs text-text-muted">{card.label}</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-text-secondary">Status</label>
          <select
            className="h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="PARTIAL">Partial</option>
            <option value="FAILED">Failed</option>
            <option value="DEAD">Dead</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50 text-xs uppercase text-text-secondary">
                    <th className="px-4 py-3 text-left">Started</th>
                    <th className="px-4 py-3 text-left">Entity</th>
                    <th className="px-4 py-3 text-left">Trigger</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Applied</th>
                    <th className="px-4 py-3 text-right">Rejected</th>
                    <th className="px-4 py-3 text-left">Error</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-10"><Loader label="Loading history..." /></td></tr>
                  ) : jobs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-text-muted">No sync runs yet.</td></tr>
                  ) : jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-surface-hover/50">
                      <td className="px-4 py-3 text-text-secondary">{fmt(job.createdAt)}</td>
                      <td className="px-4 py-3 capitalize text-text-primary">{job.entity}</td>
                      <td className="px-4 py-3 text-xs uppercase text-text-muted">{job.trigger}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>{job.status}</Badge>
                        {job.attempt > 1 && <span className="ml-2 text-[11px] text-text-muted">attempt {job.attempt}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">{job.appliedCount}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{job.rejectedCount}</td>
                      <td className="max-w-[280px] px-4 py-3 text-xs text-red-400">
                        {job.errorDetail ?? job.errorCode ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(job.status === "FAILED" || job.status === "DEAD" || job.status === "PARTIAL") && (
                          <Button size="sm" variant="outline" onClick={() => retry(job)}>Retry</Button>
                        )}
                      </td>
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
