import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit";
import { webhookSecretFor } from "./connections";
import { ConnectError } from "./errors";
import { enqueueJob } from "./jobs";
import { isConnectEntity, type ConnectEntity } from "./types";

/**
 * Inbound webhooks.
 *
 * The endpoint is unauthenticated by session (an external system calls it),
 * so the signature *is* the authentication. Rules that matter:
 * - HMAC over the raw body, compared in constant time (`timingSafeEqual`)
 *   after a length check — never `!==`.
 * - Fail closed when no secret is configured (503), instead of accepting
 *   unsigned payloads.
 * - Deduplicate on `(connectionId, externalEventId)` so a provider retry does
 *   not create a second job, and answer 200 for the duplicate.
 * - Bound the work: 1 MB body, 120 events/minute per connection.
 */

export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export function verifySignature(secret: string, body: string, header: string | null): boolean {
  if (!header) return false;
  const provided = header.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export interface WebhookOutcome {
  status: number;
  duplicate: boolean;
  eventId: string;
  jobId: string | null;
  entity: ConnectEntity;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function handleInboundWebhook(args: {
  connectionId: string;
  rawBody: string;
  signature: string | null;
}): Promise<WebhookOutcome> {
  const connection = await db.integrationConnection.findFirst({ where: { id: args.connectionId } });
  if (!connection || connection.status === "DISCONNECTED") {
    throw new ConnectError("Unknown webhook endpoint", 404, "CONNECT_WEBHOOK_UNKNOWN");
  }
  if (connection.status !== "ACTIVE") {
    throw new ConnectError("This connection is not active", 409, "CONNECT_CONNECTION_INACTIVE");
  }

  const secret = webhookSecretFor(connection);
  if (!secret) {
    throw new ConnectError("Webhooks are not configured for this connection", 503, "CONNECT_WEBHOOK_UNCONFIGURED");
  }

  if (!verifySignature(secret, args.rawBody, args.signature)) {
    await writeAuditLog({
      tenantId: connection.tenantId,
      action: AUDIT_ACTIONS.CONNECT.WEBHOOK_REJECTED,
      module: "connect",
      entity: "integrationConnection",
      entityId: connection.id,
      details: "Signature verification failed",
    });
    throw new ConnectError("Invalid signature", 401, "CONNECT_WEBHOOK_SIGNATURE_INVALID");
  }

  // Bound the work per connection. Counting rows keeps this correct across
  // instances without a shared cache.
  const recent = await db.integrationWebhookEvent.count({
    where: {
      connectionId: connection.id,
      receivedAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= 120) {
    throw new ConnectError("Too many webhook deliveries", 429, "CONNECT_WEBHOOK_RATE_LIMITED");
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(args.rawBody) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch {
    throw new ConnectError("The webhook body is not valid JSON", 400, "CONNECT_WEBHOOK_INVALID_JSON");
  }

  const payloadHash = createHash("sha256").update(args.rawBody, "utf8").digest("hex");
  const eventIdRaw = payload.id ?? payload.event_id ?? payload.eventId;
  const eventId = eventIdRaw ? String(eventIdRaw).slice(0, 200) : payloadHash;

  const configuredEntity = await db.integrationSyncConfig.findFirst({
    where: { connectionId: connection.id, enabled: true },
    select: { entity: true },
  });
  const entity: ConnectEntity = isConnectEntity(payload.entity)
    ? payload.entity
    : isConnectEntity(configuredEntity?.entity)
      ? configuredEntity.entity
      : "products";

  let event;
  try {
    event = await db.integrationWebhookEvent.create({
      data: {
        tenantId: connection.tenantId,
        connectionId: connection.id,
        externalEventId: eventId,
        eventType: typeof payload.type === "string" ? payload.type.slice(0, 100) : null,
        payloadHash,
        status: "RECEIVED",
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: 200, duplicate: true, eventId, jobId: null, entity };
    }
    throw error;
  }

  const job = await enqueueJob({
    tenantId: connection.tenantId,
    connectionId: connection.id,
    entity,
    trigger: "WEBHOOK",
    syncConfigId: configuredEntity && isConnectEntity(configuredEntity.entity) ? undefined : null,
  });

  await db.integrationWebhookEvent.update({
    where: { id: event.id },
    data: { status: "ENQUEUED", jobId: job.id, processedAt: new Date() },
  });

  await writeAuditLog({
    tenantId: connection.tenantId,
    action: AUDIT_ACTIONS.CONNECT.WEBHOOK_RECEIVED,
    module: "connect",
    entity: "integrationConnection",
    entityId: connection.id,
    details: `${entity} · ${eventId}`,
  });

  return { status: 202, duplicate: false, eventId, jobId: job.id, entity };
}
