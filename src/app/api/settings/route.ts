import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { canonicalCounty } from "@/lib/kenya-counties";
import { isFeatureEnabled } from "@/lib/features";
import { invalidateIntelligence } from "@/lib/ai/intelligence-cache";
import { clampTargetCoverDays } from "@/lib/ai/restock-target";
import { recordSyncResponse, replaySyncResponse } from "@/lib/idempotency";

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
    return NextResponse.json({
      ...tenant,
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
    } = body;

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
      },
    });

    if (county !== undefined || city !== undefined || type || restockTarget !== undefined) {
      await invalidateIntelligence(user.tenantId);
    }

    return recordSyncResponse(request, user.tenantId, NextResponse.json(tenant));
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
