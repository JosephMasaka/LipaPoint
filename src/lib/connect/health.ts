import type { IntegrationConnection } from "@prisma/client";

/**
 * Health is computed, never stored as a claim. A connection that has never
 * been tested is PENDING — not "healthy" — and a scheduled sync that is
 * overdue shows DEGRADED instead of quietly displaying an old success.
 */

export type HealthLabel = "HEALTHY" | "DEGRADED" | "ERROR" | "PAUSED" | "PENDING" | "DISCONNECTED";

export interface HealthInput {
  status: string;
  lastTestOk: boolean | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastErrorMessage: string | null;
  frequency?: string | null;
  nextRunAt?: Date | null;
}

export interface HealthResult {
  label: HealthLabel;
  reasons: string[];
}

export function connectionHealth(input: HealthInput, now: Date = new Date()): HealthResult {
  if (input.status === "DISCONNECTED") return { label: "DISCONNECTED", reasons: ["Disconnected"] };
  if (input.status === "PAUSED") return { label: "PAUSED", reasons: ["Paused by an admin"] };

  if (input.lastTestOk === false || input.status === "ERROR") {
    return {
      label: "ERROR",
      reasons: [input.lastErrorMessage ?? "The last connection test failed"],
    };
  }

  if (input.lastTestOk === null && !input.lastSyncAt) {
    return { label: "PENDING", reasons: ["Not tested yet"] };
  }

  if (input.lastSyncStatus === "FAILED" || input.lastSyncStatus === "DEAD") {
    return { label: "ERROR", reasons: [input.lastErrorMessage ?? "The last sync failed"] };
  }

  const reasons: string[] = [];
  if (input.frequency === "HOURLY") {
    const due = input.nextRunAt;
    if (due && now.getTime() - due.getTime() > 30 * 60 * 1000) {
      reasons.push("The scheduled sync is overdue — check the cron tick");
    }
  }
  if (input.lastSyncStatus === "PARTIAL") reasons.push("The last sync rejected some rows");

  return { label: reasons.length > 0 ? "DEGRADED" : "HEALTHY", reasons };
}

export function healthForConnection(connection: IntegrationConnection, nextRunAt?: Date | null): HealthResult {
  return connectionHealth({
    status: connection.status,
    lastTestOk: connection.lastTestOk,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastErrorMessage: connection.lastErrorMessage,
    frequency: nextRunAt ? "HOURLY" : null,
    nextRunAt: nextRunAt ?? null,
  });
}
