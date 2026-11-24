"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";

interface Approval {
  id: string;
  agent: string;
  toolName: string;
  summary: string;
  status: string;
  expiresAt: string;
  decidedById: string | null;
  decidedAt: string | null;
  consumedAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-gold/10 text-gold",
  APPROVED: "bg-emerald-500/10 text-emerald-400",
  REJECTED: "bg-red-500/10 text-red-400",
  EXPIRED: "bg-zinc-500/10 text-zinc-400",
  CANCELLED: "bg-zinc-500/10 text-zinc-400",
};

export function ApprovalsInbox() {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = status === "pending" ? "?status=pending" : "";
      const res = await fetch(`/api/ai/approvals${query}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not load approvals.");
      setItems((json.approvals ?? []) as Approval[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load approvals.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function run(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/ai/approvals/${id}/execute`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not run the action.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run the action.");
    } finally {
      setBusyId(null);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/ai/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note[id] || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not record decision.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-text-primary">AI approval requests</h3>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setStatus("pending")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${status === "pending" ? "bg-gold text-black" : "border border-border text-text-muted"}`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setStatus("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${status === "all" ? "bg-gold text-black" : "border border-border text-text-muted"}`}
          >
            All
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading approvals…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted">
          {status === "pending" ? "No pending AI actions." : "No approval requests yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const expired = new Date(a.expiresAt).getTime() <= Date.now();
            const pending = a.status === "PENDING" && !expired;
            return (
              <li key={a.id} className="rounded-xl border border-border bg-background/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{a.summary}</p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {a.agent} · {a.toolName} · requested {new Date(a.createdAt).toLocaleString("en-KE")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[a.status] ?? "bg-zinc-500/10 text-zinc-400"}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>

                <p className="mt-2 flex items-center gap-1 text-[11px] text-text-muted">
                  <Clock className="h-3 w-3" />
                  {a.consumedAt
                    ? `Used ${new Date(a.consumedAt).toLocaleString("en-KE")}`
                    : a.status === "APPROVED"
                    ? "Approved but not yet used"
                    : `Expires ${new Date(a.expiresAt).toLocaleString("en-KE")}`}
                </p>

                {a.status === "APPROVED" && !a.consumedAt && !expired && (
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => run(a.id)}
                    className="mt-3 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                  >
                    Run approved action
                  </button>
                )}

                {pending && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={note[a.id] ?? ""}
                      onChange={(e) => setNote({ ...note, [a.id]: e.target.value })}
                      placeholder="Optional note"
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => decide(a.id, "approve")}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => decide(a.id, "reject")}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-text-muted">
        Approving records your decision only. The action still runs only when the
        AI runtime confirms the payload has not changed and the approval has not
        expired or been used already.
      </p>
    </section>
  );
}
