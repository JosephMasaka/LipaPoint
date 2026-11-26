/**
 * Per-tenant eTIMS configuration (Settings > eTIMS).
 *
 * The eTIMS submission path and the Connect eTIMS connector both need the
 * same seller identity, device type and provider mode. Historically these
 * came only from platform env vars (ETIMS_SELLER_TIN, ETIMS_CSID, ...), which
 * means one deployment could only ever submit under one seller. This module
 * resolves the tenant's own configuration first and lets the caller fall back
 * to env, so a single deployment can hold many sellers and an operator can
 * change a tenant's device without a redeploy.
 *
 * Two fields are credentials — the KRA CSID and the callback shared secret —
 * and are stored AES-256-GCM encrypted (src/lib/crypto.ts). They are never
 * returned by an API; Settings shows only whether a value is set.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export type EtimsProviderMode = "mock" | "oscu" | "vscu";
export type EtimsDeviceTypeName = "OSCU" | "VSCU";

export interface EtimsTenantConfig {
  /** null = no per-tenant override; the platform env decides. */
  provider: EtimsProviderMode | null;
  deviceType: EtimsDeviceTypeName | null;
  sellerTin: string | null;
  sellerBranch: string | null;
  sellerName: string | null;
  /** Decrypted CSID. */
  csid: string | null;
  /** Decrypted callback shared secret. */
  callbackSecret: string | null;
}

export const EMPTY_ETIMS_TENANT_CONFIG: EtimsTenantConfig = {
  provider: null,
  deviceType: null,
  sellerTin: null,
  sellerBranch: null,
  sellerName: null,
  csid: null,
  callbackSecret: null,
};

/** Columns to select on Tenant when resolving eTIMS config. */
export const ETIMS_TENANT_SELECT = {
  etimsProvider: true,
  etimsDeviceType: true,
  etimsSellerTin: true,
  etimsSellerBranch: true,
  etimsSellerName: true,
  etimsCsidEnc: true,
  etimsCallbackSecretEnc: true,
} satisfies Prisma.TenantSelect;

export type EtimsTenantRow = {
  etimsProvider: string | null;
  etimsDeviceType: string | null;
  etimsSellerTin: string | null;
  etimsSellerBranch: string | null;
  etimsSellerName: string | null;
  etimsCsidEnc: string | null;
  etimsCallbackSecretEnc: string | null;
};

/**
 * Decrypts a stored secret. A value that will not decrypt (ENCRYPTION_KEY
 * rotated or lost) is reported as missing rather than thrown: the caller then
 * fails with the same "config incomplete" error the real submission path
 * raises, instead of a stack trace from deep inside a webhook.
 */
function decryptSecret(blob: string | null, field: string, tenantHint: string): string | null {
  if (!blob) return null;
  try {
    const value = decrypt(blob).trim();
    return value === "" ? null : value;
  } catch (error) {
    console.error(
      `eTIMS ${field} for ${tenantHint} could not be decrypted — treating it as unset:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toEtimsTenantConfig(row: EtimsTenantRow, tenantHint = "tenant"): EtimsTenantConfig {
  const provider = clean(row.etimsProvider)?.toLowerCase();
  const device = clean(row.etimsDeviceType)?.toUpperCase();

  return {
    provider: provider === "mock" || provider === "oscu" || provider === "vscu" ? provider : null,
    deviceType: device === "OSCU" || device === "VSCU" ? device : null,
    sellerTin: clean(row.etimsSellerTin),
    sellerBranch: clean(row.etimsSellerBranch),
    sellerName: clean(row.etimsSellerName),
    csid: decryptSecret(row.etimsCsidEnc, "CSID", tenantHint),
    callbackSecret: decryptSecret(row.etimsCallbackSecretEnc, "callback secret", tenantHint),
  };
}

export async function loadEtimsTenantConfig(
  tenantId: string | null | undefined
): Promise<EtimsTenantConfig> {
  if (!tenantId) return EMPTY_ETIMS_TENANT_CONFIG;
  const row = await db.tenant.findUnique({
    where: { id: tenantId },
    select: ETIMS_TENANT_SELECT,
  });
  if (!row) return EMPTY_ETIMS_TENANT_CONFIG;
  return toEtimsTenantConfig(row, tenantId);
}

/**
 * True when the tenant has told us which registered eTIMS device it is, i.e.
 * the operator has done the Settings > eTIMS step. Used by the Connect
 * connector's connectivity test.
 */
export function describesLiveDevice(config: EtimsTenantConfig): boolean {
  return Boolean(config.csid || config.sellerTin || config.deviceType);
}
