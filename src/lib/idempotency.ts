import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Exactly-once replay for Offline Mode.
 *
 * The offline queue (src/lib/offline-db.ts) retries a write until the server
 * accepts it. The dangerous case is a request that *landed* but whose reply
 * was lost to the network: the retry would otherwise create a second sale,
 * expense or stock movement. Every replayed write therefore carries a stable
 * `x-idempotency-key` (the queue record's `clientRef`), and routes return the
 * stored response for that key instead of applying the write again.
 *
 * Usage in a route (after auth, before doing the work):
 *
 *   const replay = await replaySyncResponse(request, user.tenantId);
 *   if (replay) return replay;
 *   ...
 *   return recordSyncResponse(request, user.tenantId, NextResponse.json(payload));
 *
 * Requests without the header (every normal in-app call) are untouched: one
 * cheap header read and no database work. Receipts expire after 7 days, which
 * is far longer than any till should be offline.
 */

export const IDEMPOTENCY_HEADER = "x-idempotency-key";
const RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9:._-]{8,200}$/;

export function idempotencyKey(request: Request): string | null {
  const raw = request.headers.get(IDEMPOTENCY_HEADER);
  if (!raw) return null;
  const key = raw.trim();
  return KEY_PATTERN.test(key) ? key : null;
}

/** The original response for a replayed write, or null for a first attempt. */
export async function replaySyncResponse(
  request: Request,
  tenantId: string
): Promise<NextResponse | null> {
  const key = idempotencyKey(request);
  if (!key) return null;

  try {
    const receipt = await db.syncReceipt.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { status: true, body: true },
    });
    if (!receipt) return null;
    return NextResponse.json(receipt.body as Prisma.JsonValue, {
      status: receipt.status,
      headers: { [IDEMPOTENCY_HEADER]: "replayed" },
    });
  } catch (error) {
    // A missing table (migration not applied yet) must never break the write
    // itself — fall through and let the route do the work.
    console.error("replaySyncResponse error:", error);
    return null;
  }
}

/**
 * Remembers a successful response so a later retry of the same offline write
 * returns it instead of applying the change twice. Returns the same response
 * the route would have sent.
 */
export async function recordSyncResponse(
  request: Request,
  tenantId: string,
  response: Response
): Promise<Response> {
  const key = idempotencyKey(request);
  if (!key || !response.ok || response.status === 204) return response;

  let body: Prisma.InputJsonValue;
  try {
    body = (await response.clone().json()) as Prisma.InputJsonValue;
  } catch {
    return response; // non-JSON success — nothing to replay
  }

  try {
    await db.syncReceipt.create({
      data: {
        tenantId,
        key,
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        body,
      },
    });
  } catch {
    // Unique violation = a concurrent retry won the race; its receipt stands.
  }

  // Housekeeping without a cron: occasional, best-effort.
  if (Math.random() < 0.02) {
    void db.syncReceipt
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RECEIPT_TTL_MS) } } })
      .catch(() => {});
  }

  return response;
}
