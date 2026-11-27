import { db } from "../db";

/**
 * Retention for the Connect history tables.
 *
 * `IntegrationJobRecord` and `IntegrationWebhookEvent` grow once per external
 * record and per webhook delivery, so a busy tenant accumulates them without
 * bound. The roadmap makes purging them older than 90 days part of the
 * scheduler tick, which is the only background worker Connect has.
 *
 * What is deleted: per-record outcomes of old jobs and old webhook deliveries.
 * What is kept: `IntegrationJob` itself (the sync history the UI lists),
 * `IntegrationExternalRecord` (the idempotency link — deleting it would make
 * the next sync re-create every local row), and every audit entry.
 *
 * Consequence worth knowing: the unique `(connectionId, externalEventId)` key
 * is the webhook dedupe. A provider re-delivering an event older than the
 * retention window is therefore processed again; no real provider replays
 * beyond a few days, and the sync itself is idempotent.
 */

/** Kept for this many days unless `CONNECT_RETENTION_DAYS` says otherwise. */
export const DEFAULT_RETENTION_DAYS = 90;

export function retentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Clamped to 1 day … 10 years, so a typo cannot wipe the whole history. */
export function retentionDaysFromEnv(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RETENTION_DAYS;
  return Math.min(3650, Math.floor(parsed));
}

export interface RetentionResult {
  days: number;
  cutoff: string;
  perRecords: number;
  webhookEvents: number;
}

export async function purgeExpiredConnectHistory(
  options: { now?: Date; days?: number } = {}
): Promise<RetentionResult> {
  const days = options.days ?? retentionDaysFromEnv(process.env.CONNECT_RETENTION_DAYS);
  const cutoff = retentionCutoff(days, options.now);

  const [perRecords, webhookEvents] = await db.$transaction([
    db.integrationJobRecord.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.integrationWebhookEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
  ]);

  return {
    days,
    cutoff: cutoff.toISOString(),
    perRecords: perRecords.count,
    webhookEvents: webhookEvents.count,
  };
}
