import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { canonicalCounty } from "@/lib/kenya-counties";
import { isFeatureEnabled } from "@/lib/features";
import { invalidateIntelligence } from "@/lib/ai/intelligence-cache";
import { clampTargetCoverDays } from "@/lib/ai/restock-target";
import { recordSyncResponse, replaySyncResponse } from "@/lib/idempotency";
import { encrypt } from "@/lib/crypto";

type EtimsFields = {
  etimsProvider?: unknown;
  etimsDeviceType?: unknown;
  etimsSellerTin?: unknown;
  etimsSellerBranch?: unknown;
  etimsSellerName?: unknown;
  etimsCsid?: unknown;
  etimsCallbackSecret?: unknown;
};

/**
 * Validates and maps the Settings > eTIMS fields onto Tenant columns.
 *
 * The two credentials are write-only: a non-empty string is encrypted and
 * stored, an absent/null value leaves the stored one untouched (so the form
 * can be saved without re-typing a secret it is never shown), and an empty
 * string clears it. Returns an error message instead of a partial update when
 * anything is invalid.
 */
function readEtimsFields(body: EtimsFields): { data: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};

  const mode = body.etimsProvider;
  if (mode !== undefined) {
    const value = typeof mode === "string" ? mode.trim().toLowerCase() : "";
    if (value === "") data.etimsProvider = null;
    else if (value === "mock" || value === "oscu" || value === "vscu") data.etimsProvider = value;
    else return { data, error: "eTIMS provider must be mock, oscu or vscu." };
  }

  const device = body.etimsDeviceType;
  if (device !== undefined) {
    const value = typeof device === "string" ? device.trim().toUpperCase() : "";
    if (value === "") data.etimsDeviceType = null;
    else if (value === "OSCU" || value === "VSCU") data.etimsDeviceType = value;
    else return { data, error: "eTIMS device type must be OSCU or VSCU." };
  }

  // TIN and branch are KRA identifiers. Whitespace inside one is always a
  // paste accident and KRA would bounce it, so reject it here rather than
  // store something that fails at submission time.
  const tin = body.etimsSellerTin;
  if (tin !== undefined) {
    if (tin !== null && typeof tin !== "string") return { data, error: "Seller TIN must be text." };
    const value = typeof tin === "string" ? tin.trim() : "";
    if (/\s/.test(value)) return { data, error: "Seller TIN cannot contain spaces." };
    if (value.length > 40) return { data, error: "Seller TIN is too long." };
    data.etimsSellerTin = value === "" ? null : value;
  }

  const branch = body.etimsSellerBranch;
  if (branch !== undefined) {
    if (branch !== null && typeof branch !== "string") return { data, error: "Seller branch must be text." };
    const value = typeof branch === "string" ? branch.trim() : "";
    if (/\s/.test(value)) return { data, error: "Seller branch cannot contain spaces." };
    if (value.length > 40) return { data, error: "Seller branch is too long." };
    data.etimsSellerBranch = value === "" ? null : value;
  }

  const sellerName = body.etimsSellerName;
  if (sellerName !== undefined) {
    if (sellerName !== null && typeof sellerName !== "string") {
      return { data, error: "Seller name must be text." };
    }
    const value = typeof sellerName === "string" ? sellerName.trim() : "";
    if (value.length > 120) return { data, error: "Seller name is too long (120 characters max)." };
    data.etimsSellerName = value === "" ? null : value;
  }

  try {
    const csid = body.etimsCsid;
    if (csid !== undefined && csid !== null) {
      if (typeof csid !== "string") return { data, error: "CSID must be text." };
      const value = csid.trim();
      if (value !== "") data.etimsCsidEnc = encrypt(value);
    }

    const callbackSecret = body.etimsCallbackSecret;
    if (callbackSecret !== undefined && callbackSecret !== null) {
      if (typeof callbackSecret !== "string") {
        return { data, error: "Callback secret must be text." };
      }
      const value = callbackSecret.trim();
      if (value !== "") data.etimsCallbackSecretEnc = encrypt(value);
    }
  } catch (error) {
    // Missing/malformed ENCRYPTION_KEY: refuse the write outright rather than
    // storing a credential in plaintext or half-applying the rest of the form.
    console.error("Failed to encrypt eTIMS secret:", error);
    return { data: {}, error: "Server encryption is not configured — the eTIMS secret was not saved." };
  }

  return { data };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        name: true,
        slug: true,
        type: true,
        tier: true,
        currency: true,
        taxRate: true,
        receiptHeader: true,
        receiptFooter: true,
        isActive: true,
        mpesaPaybill: true,
        mpesaTill: true,
        mpesaAccountName: true,
        city: true,
        county: true,
        priceOverrideEnabled: true,
        priceFloorMode: true,
        priceFloorValue: true,
        showServedBy: true,
        restockTargetDays: true,
        aiEnabled: true,
        // Per-tenant KRA eTIMS device. The two secrets are never selected:
        // the response says only whether one is stored.
        etimsProvider: true,
        etimsDeviceType: true,
        etimsSellerTin: true,
        etimsSellerBranch: true,
        etimsSellerName: true,
        etimsCsidEnc: true,
        etimsCallbackSecretEnc: true,
        paymentGateways: {
          select: {
            provider: true,
            isActive: true,
            merchantRef: true,
          },
        },
      },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const { etimsCsidEnc, etimsCallbackSecretEnc, ...rest } = tenant;
    return NextResponse.json({
      ...rest,
      etimsCsidSet: Boolean(etimsCsidEnc),
      etimsCallbackSecretSet: Boolean(etimsCallbackSecretEnc),
      priceOverrideAvailable: await isFeatureEnabled(user.tenantId, "price-override"),
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Only an owner or admin can change business settings." }, { status: 403 });
    }

    const replay = await replaySyncResponse(request, user.tenantId);
    if (replay) return replay;

    const body = await request.json();
    const {
      name,
      type,
      currency,
      taxRate,
      receiptHeader,
      receiptFooter,
      mpesaPaybill,
      mpesaTill,
      mpesaAccountName,
      city,
      county,
      priceOverrideEnabled,
      priceFloorMode,
      priceFloorValue,
      showServedBy,
      restockTargetDays,
      aiEnabled,
      etimsProvider,
      etimsDeviceType,
      etimsSellerTin,
      etimsSellerBranch,
      etimsSellerName,
      etimsCsid,
      etimsCallbackSecret,
    } = body;

    const etims = readEtimsFields({
      etimsProvider,
      etimsDeviceType,
      etimsSellerTin,
      etimsSellerBranch,
      etimsSellerName,
      etimsCsid,
      etimsCallbackSecret,
    });
    if (etims.error) {
      return NextResponse.json({ error: etims.error }, { status: 400 });
    }

    if (aiEnabled !== undefined && typeof aiEnabled !== "boolean") {
      return NextResponse.json({ error: "AI enabled must be true or false." }, { status: 400 });
    }

    let restockTarget: number | undefined;
    if (restockTargetDays !== undefined) {
      const parsed = Number(restockTargetDays);
      if (typeof restockTargetDays === "boolean" || !Number.isFinite(parsed)) {
        return NextResponse.json({ error: "Restock target must be a number of days." }, { status: 400 });
      }
      restockTarget = clampTargetCoverDays(parsed);
    }

    if (priceOverrideEnabled !== undefined && priceOverrideEnabled) {
      const available = await isFeatureEnabled(user.tenantId, "price-override");
      if (!available) {
        return NextResponse.json(
          { error: "On-the-go pricing needs the \"Price Override\" feature — switch it on from the Apps screen." },
          { status: 403 }
        );
      }
    }

    let floorMode: string | undefined;
    let floorValue: number | undefined;
    if (priceFloorMode !== undefined) {
      if (priceFloorMode !== "PERCENT" && priceFloorMode !== "AMOUNT") {
        return NextResponse.json({ error: "Price floor mode must be percent or amount." }, { status: 400 });
      }
      floorMode = priceFloorMode;
    }
    if (priceFloorValue !== undefined) {
      const effectiveMode =
        floorMode ??
        ((await db.tenant.findUnique({
          where: { id: user.tenantId },
          select: { priceFloorMode: true },
        }))?.priceFloorMode ?? "PERCENT");

      floorValue = parseFloat(priceFloorValue);
      if (!Number.isFinite(floorValue) || floorValue < 0) {
        return NextResponse.json(
          { error: "How far below the set price must be 0 or more." },
          { status: 400 }
        );
      }
      if (effectiveMode === "PERCENT" && floorValue > 100) {
        return NextResponse.json(
          { error: "A percentage cannot exceed 100%." },
          { status: 400 }
        );
      }
    }

    const tenant = await db.tenant.update({
      where: { id: user.tenantId },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(currency && { currency }),
        ...(taxRate !== undefined && { taxRate: Number(taxRate) }),
        ...(receiptHeader !== undefined && { receiptHeader }),
        ...(receiptFooter !== undefined && { receiptFooter }),
        ...(mpesaPaybill !== undefined && { mpesaPaybill }),
        ...(mpesaTill !== undefined && { mpesaTill }),
        ...(mpesaAccountName !== undefined && { mpesaAccountName }),
        ...(city !== undefined && {
          city: typeof city === "string" && city.trim() !== "" ? city.trim().slice(0, 80) : null,
        }),
        ...(county !== undefined && {
          county:
            county === null || county === ""
              ? null
              : canonicalCounty(county) ?? county,
        }),
        ...(priceOverrideEnabled !== undefined && {
          priceOverrideEnabled: Boolean(priceOverrideEnabled),
        }),
        ...(floorMode !== undefined && { priceFloorMode: floorMode }),
        ...(floorValue !== undefined && { priceFloorValue: floorValue }),
        ...(showServedBy !== undefined && { showServedBy: Boolean(showServedBy) }),
        ...(restockTarget !== undefined && { restockTargetDays: restockTarget }),
        ...(aiEnabled !== undefined && { aiEnabled }),
        ...etims.data,
      },
    });

    if (county !== undefined || city !== undefined || type || restockTarget !== undefined) {
      await invalidateIntelligence(user.tenantId);
    }

    // Never echo the encrypted secrets back, even in the save response.
    const { etimsCsidEnc, etimsCallbackSecretEnc, ...saved } = tenant;
    void etimsCsidEnc;
    void etimsCallbackSecretEnc;
    return recordSyncResponse(request, user.tenantId, NextResponse.json(saved));
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
