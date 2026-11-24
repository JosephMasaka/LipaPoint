import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Human approvals for AI-proposed actions (M3 foundation).
 *
 * The rules live here, not in a prompt:
 * - an approval is bound to the SHA-256 of the exact canonical payload, so
 *   changing an amount, product or branch after approval invalidates it;
 * - only an owner, admin or manager can decide;
 * - a request is single-use and expires;
 * - every decision is recorded with who decided and when.
 *
 * Nothing executes yet: `consumeApproval` is what a future agent runtime calls
 * immediately before performing the action, and it marks the approval spent.
 */

export const APPROVER_ROLES = ["OWNER", "ADMIN", "MANAGER"] as const;
export const DEFAULT_APPROVAL_TTL_MINUTES = 30;

export type ApprovalDecision = "approve" | "reject";

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  requestedById: string | null;
  agent: string;
  toolName: string;
  summary: string;
  payloadJson: string;
  payloadHash: string;
  fingerprint: string;
  status: string;
  /** Agent run that proposed this action, when there was one. */
  runId: string | null;
  expiresAt: Date;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  consumedAt: Date | null;
  createdAt: Date;
}

export type ApprovalErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_PENDING"
  | "EXPIRED"
  | "PAYLOAD_MISMATCH"
  | "ALREADY_CONSUMED"
  | "NOT_APPROVED";

export class ApprovalError extends Error {
  constructor(readonly code: ApprovalErrorCode, message: string, readonly status: number) {
    super(message);
    this.name = "ApprovalError";
  }
}

/** Stable JSON so key order cannot change the hash. */
export function canonicalJson(payload: unknown): string {
  const normalise = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalise);
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      return Object.fromEntries(entries.map(([k, v]) => [k, normalise(v)]));
    }
    return value;
  };
  return JSON.stringify(normalise(payload ?? {}));
}

export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function fingerprintFor(agent: string, toolName: string, hash: string): string {
  return createHash("sha256").update(`${agent}:${toolName}:${hash}`).digest("hex");
}

export function canApprove(role: string): boolean {
  return (APPROVER_ROLES as readonly string[]).includes(role);
}

/**
 * Persistence seam. The default binds to Prisma; tests inject an in-memory
 * table so the approval policy can be exercised without a database.
 */
export interface ApprovalStore {
  findByFingerprint(tenantId: string, fingerprint: string): Promise<ApprovalRecord | null>;
  findById(id: string): Promise<ApprovalRecord | null>;
  create(data: Omit<ApprovalRecord, "id" | "createdAt">): Promise<ApprovalRecord>;
  update(id: string, data: Partial<ApprovalRecord>): Promise<ApprovalRecord>;
}

const prismaStore: ApprovalStore = {
  findByFingerprint(tenantId, fingerprint) {
    return db.aiApprovalRequest.findUnique({
      where: { tenantId_fingerprint: { tenantId, fingerprint } },
    });
  },
  findById(id) {
    return db.aiApprovalRequest.findUnique({ where: { id } });
  },
  create(data) {
    return db.aiApprovalRequest.create({ data });
  },
  update(id, data) {
    return db.aiApprovalRequest.update({ where: { id }, data });
  },
};

export interface CreateApprovalInput {
  tenantId: string;
  requestedById?: string | null;
  agent: string;
  toolName: string;
  summary: string;
  payload: unknown;
  runId?: string | null;
  ttlMinutes?: number;
  now?: Date;
  store?: ApprovalStore;
}

/**
 * Creates (or reuses) a pending approval for this exact proposal.
 * Re-requesting an unchanged payload returns the open request; a changed
 * payload is a different fingerprint and therefore a new request.
 */
export async function createApprovalRequest(input: CreateApprovalInput): Promise<ApprovalRecord> {
  const store = input.store ?? prismaStore;
  const now = input.now ?? new Date();
  if (!input.agent.trim() || !input.toolName.trim()) {
    throw new ApprovalError("INVALID_INPUT", "An approval needs an agent and a tool.", 400);
  }

  const json = canonicalJson(input.payload);
  const hash = payloadHash(input.payload);
  const fingerprint = fingerprintFor(input.agent, input.toolName, hash);

  const existing = await store.findByFingerprint(input.tenantId, fingerprint);
  if (existing && existing.status === "PENDING" && existing.expiresAt.getTime() > now.getTime()) {
    return existing;
  }

  const ttlMinutes = Math.max(1, Math.min(24 * 60, Math.round(input.ttlMinutes ?? DEFAULT_APPROVAL_TTL_MINUTES)));
  const data = {
    tenantId: input.tenantId,
    requestedById: input.requestedById ?? null,
    agent: input.agent,
    toolName: input.toolName,
    summary: input.summary.slice(0, 500),
    payloadJson: json,
    payloadHash: hash,
    fingerprint,
    status: "PENDING",
    runId: input.runId ?? null,
    expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    consumedAt: null,
  };

  // A unique (tenantId, fingerprint) violation means a request appeared between
  // the lookup and the insert; the open one is still the right answer.
  if (existing) return store.update(existing.id, data);
  return store.create(data);
}

export interface DecideApprovalInput {
  tenantId: string;
  requestId: string;
  actorId: string;
  actorRole: string;
  decision: ApprovalDecision;
  note?: string | null;
  now?: Date;
  store?: ApprovalStore;
}

export async function decideApproval(input: DecideApprovalInput): Promise<ApprovalRecord> {
  const store = input.store ?? prismaStore;
  const now = input.now ?? new Date();

  if (!canApprove(input.actorRole)) {
    throw new ApprovalError("FORBIDDEN", "Only an owner, admin or manager can approve an AI action.", 403);
  }

  const record = await store.findById(input.requestId);
  // A request from another tenant is reported as missing, never as forbidden.
  if (!record || record.tenantId !== input.tenantId) {
    throw new ApprovalError("NOT_FOUND", "Approval request not found.", 404);
  }
  if (record.status !== "PENDING") {
    throw new ApprovalError("NOT_PENDING", `This request is already ${record.status.toLowerCase()}.`, 409);
  }
  if (record.expiresAt.getTime() <= now.getTime()) {
    await store.update(record.id, { status: "EXPIRED" });
    throw new ApprovalError("EXPIRED", "This request expired before it was decided.", 409);
  }

  return store.update(record.id, {
    status: input.decision === "approve" ? "APPROVED" : "REJECTED",
    decidedById: input.actorId,
    decidedAt: now,
    decisionNote: input.note ? String(input.note).slice(0, 500) : null,
  });
}

export interface ConsumeApprovalInput {
  tenantId: string;
  requestId: string;
  payload: unknown;
  now?: Date;
  store?: ApprovalStore;
}

/**
 * Marks an approval spent and proves it matches the action about to run.
 * Call this immediately before executing, and only after it returns.
 */
export async function consumeApproval(input: ConsumeApprovalInput): Promise<ApprovalRecord> {
  const store = input.store ?? prismaStore;
  const now = input.now ?? new Date();

  const record = await store.findById(input.requestId);
  if (!record || record.tenantId !== input.tenantId) {
    throw new ApprovalError("NOT_FOUND", "Approval request not found.", 404);
  }
  if (record.status === "REJECTED" || record.status === "EXPIRED" || record.status === "CANCELLED") {
    throw new ApprovalError("NOT_APPROVED", `This request is ${record.status.toLowerCase()} and cannot be used.`, 409);
  }
  if (record.status !== "APPROVED") {
    throw new ApprovalError("NOT_APPROVED", "This request has not been approved.", 409);
  }
  if (record.consumedAt) {
    throw new ApprovalError("ALREADY_CONSUMED", "This approval has already been used.", 409);
  }
  if (record.expiresAt.getTime() <= now.getTime()) {
    await store.update(record.id, { status: "EXPIRED" });
    throw new ApprovalError("EXPIRED", "This approval expired before it was used.", 409);
  }
  if (payloadHash(input.payload) !== record.payloadHash) {
    throw new ApprovalError(
      "PAYLOAD_MISMATCH",
      "The action differs from what was approved, so it must be requested again.",
      409
    );
  }

  return store.update(record.id, { consumedAt: now });
}

export async function listApprovals(tenantId: string, opts: { status?: string; limit?: number } = {}) {
  const status = opts.status?.toUpperCase();
  return db.aiApprovalRequest.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, opts.limit ?? 50)),
    select: {
      id: true, agent: true, toolName: true, summary: true, status: true, runId: true,
      expiresAt: true, decidedById: true, decidedAt: true, consumedAt: true, createdAt: true,
    },
  });
}
