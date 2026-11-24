"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History, ShieldCheck } from "lucide-react";

interface Run {
  runId: string;
  agent: string;
  agentVersion: number;
  surface: string;
  trigger: string;
  status: string;
  errorCode: string | null;
  toolCallCount: number;
  approvalCount: number;
  startedAt: string;
  finishedAt: string | null;
}

interface RunDetail {
  run: Run;
  tools: Array<{
    id: string;
    toolName: string;
    ok: boolean;
    errorCode: string | null;
    resultRows: number;
    latencyMs: number;
    createdAt: string;
  }>;
  approvals: Array<{
    id: string;
    toolName: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
  usage: { provider: string; model: string | null; totalTokens: number; estimatedCostUsd: number } | null;
}

const STATUS_CLASS: Record<string, string> = {
  RUNNING: "bg-gold/10 text-gold",
  AWAITING_APPROVAL: "bg-amber-500/10 text-amber-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  CANCELLED: "bg-zinc-500/10 text-zinc-400",
  QUEUED: "bg-zinc-500/10 text-zinc-400",
};

const STATUS_LABEL: Record<string, string> = {
  RUNNING: "Running",
  AWAITING_APPROVAL: "Awaiting approval",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  QUEUED: "Queued",
};

function shortTime(value: string) {
  return new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export function AgentRunsPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/runs?limit=10", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(json.error ?? "Could not load agent runs."); return; }
        setRuns((json.runs ?? []) as Run[]);
      })
      .catch(() => { if (!cancelled) setError("Could not load agent runs."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function toggle(runId: string) {
    if (openRun === runId) { setOpenRun(null); setDetail(null); return; }
    setOpenRun(runId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/ai/runs/${runId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not load the run.");
      setDetail(json as RunDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the run.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-text-primary">Recent agent runs</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-text-muted">Owners, admins & managers</span>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {loading && <p className="text-xs text-text-muted">Loading runs…</p>}
      {!loading && runs.length === 0 && (
        <p className="text-xs text-text-muted">No agent runs yet. Ask the assistant a question to create one.</p>
      )}

      <ul className="divide-y divide-border/60">
        {runs.map((run) => (
          <li key={run.runId} className="py-2">
            <button
              type="button"
              onClick={() => toggle(run.runId)}
              className="flex w-full items-center gap-3 text-left"
              aria-expanded={openRun === run.runId}
            >
              {openRun === run.runId ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-text-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">
                  {run.agent} agent <span className="text-text-muted">v{run.agentVersion}</span>
                </span>
                <span className="block text-[11px] text-text-muted">
                  {shortTime(run.startedAt)} · {run.toolCallCount} tool call{run.toolCallCount === 1 ? "" : "s"}
                  {run.approvalCount > 0 ? ` · ${run.approvalCount} approval${run.approvalCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[run.status] ?? "bg-zinc-500/10 text-zinc-400"}`}>
                {STATUS_LABEL[run.status] ?? run.status}
              </span>
            </button>

            {openRun === run.runId && (
              <div className="ml-7 mt-2 space-y-2 rounded-xl bg-background/40 p-3 text-[11px]">
                {detailLoading && <p className="text-text-muted">Loading timeline…</p>}
                {detail && detail.run.runId === run.runId && (
                  <>
                    {detail.usage && (
                      <p className="text-text-muted">
                        {detail.usage.provider} {detail.usage.model ? `· ${detail.usage.model}` : ""} ·{" "}
                        {detail.usage.totalTokens.toLocaleString("en-KE")} tokens · $
                        {detail.usage.estimatedCostUsd.toFixed(3)}
                      </p>
                    )}
                    {detail.tools.length === 0 && detail.approvals.length === 0 && (
                      <p className="text-text-muted">No tool calls or approvals in this run.</p>
                    )}
                    {detail.tools.map((tool) => (
                      <div key={tool.id} className="flex items-center gap-2 text-text-secondary">
                        <ShieldCheck className={`h-3 w-3 ${tool.ok ? "text-emerald-400" : "text-red-400"}`} />
                        <span className="font-mono text-[11px]">{tool.toolName}</span>
                        <span className="text-text-muted">
                          {tool.ok ? `${tool.resultRows} row${tool.resultRows === 1 ? "" : "s"}` : tool.errorCode}
                          {" · "}
                          {tool.latencyMs} ms
                        </span>
                      </div>
                    ))}
                    {detail.approvals.map((approval) => (
                      <div key={approval.id} className="flex items-start gap-2 text-text-secondary">
                        <ShieldCheck className="mt-0.5 h-3 w-3 flex-shrink-0 text-gold" />
                        <span>
                          {approval.summary}
                          <span className="ml-1 text-text-muted">({approval.status.toLowerCase()})</span>
                        </span>
                      </div>
                    ))}
                    {detail.run.errorCode && (
                      <p className="text-red-400">Ended with {detail.run.errorCode}.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
