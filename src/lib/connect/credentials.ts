import { decryptJSON, encryptJSON } from "../crypto";
import type { AuthType, ConnectionStatus } from "./types";

/**
 * Credential handling for Connect.
 *
 * Same AES-256-GCM envelope as `TenantPaymentGateway.credentialsEnc`
 * (src/lib/crypto.ts) — one crypto path, one key, one failure mode. Secrets
 * are write-only from the client's perspective: the API returns `maskedHint`
 * and there is no reveal endpoint.
 */

export interface ConnectionSecrets {
  authType: AuthType;
  values: Record<string, string>;
}

/** Trims, drops empty values and caps length so a paste of a whole file can't bloat a row. */
export function sanitizeSecretValues(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(key)) continue;
    out[key] = trimmed.slice(0, 4096);
  }
  return out;
}

export function encryptSecrets(secrets: ConnectionSecrets): string {
  return encryptJSON(secrets);
}

export function decryptSecrets(encoded: string): ConnectionSecrets {
  const parsed = decryptJSON<ConnectionSecrets>(encoded);
  if (!parsed || typeof parsed !== "object" || typeof parsed.values !== "object") {
    throw new Error("Malformed credentials payload");
  }
  return {
    authType: (parsed.authType ?? "NONE") as AuthType,
    values: sanitizeSecretValues(parsed.values),
  };
}

/** `••••abcd` — enough for a human to recognise which key is installed. */
export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const visible = trimmed.slice(-4);
  return `••••${visible}`;
}

export function buildMaskedHint(secrets: ConnectionSecrets): string | null {
  const first = Object.values(secrets.values).find((value) => value.trim().length > 0);
  return first ? maskValue(first) : null;
}

/** A connection can be used by the engine only in these states. */
export function isSyncableStatus(status: string): status is ConnectionStatus {
  return status === "ACTIVE";
}
