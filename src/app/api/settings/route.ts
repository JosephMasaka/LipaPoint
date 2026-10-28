import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canonicalCounty } from "@/lib/kenya-counties";
import { isFeatureEnabled } from "@/lib/features";
import { invalidateIntelligence } from "@/lib/ai/intelligence-cache";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        name: true, slug: true, type: true, tier: true, currency: true,
        taxRate: true, receiptHeader: true, receiptFooter: true, isActive: true,
        mpesaPaybill: true, mpesaTill: true, mpesaAccountName: true,
        city: true, county: true,
        // On-the-go pricing at the till (src/lib/price-override.ts)
        priceOverrideEnabled: true, priceFloorMode: true, priceFloorValue: true,
        // Receipt preference — who is printed as "Served by" on receipts
        showServedBy: true,
        paymentGateways: {
          select: { provider: true, isActive: true, merchantRef: true },
        },
      },
    });
    return NextResponse.json({
      ...tenant,
      // On-the-go pricing is a sellable sub-feature — the toggle is only
      // meaningful while "Price Override" is switched on for this tenant
      // (sub-feature spec §1/§4). Told separately so the Settings UI can
      // grey the switch out and explain why instead of silently ignoring it.
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
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only an owner or admin can change business settings." }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, type, currency, taxRate, receiptHeader, receiptFooter,
      mpesaPaybill, mpesaTill, mpesaAccountName, city, county,
      priceOverrideEnabled, priceFloorMode, priceFloorValue,
      showServedBy,
    } = body;

    // On-the-go pricing can only be switched on while the tenant actually
    // holds the "Price Override" feature — turning it back off always works
    // (otherwise a revoked tenant could get stuck with a live setting).
    if (priceOverrideEnabled !== undefined && priceOverrideEnabled) {
      const available = await isFeatureEnabled(user.tenantId, "price-override");
      if (!available) {
        return NextResponse.json(
          { error: "On-the-go pricing needs the \"Price Override\" feature — switch it on from the Apps screen." },
          { status: 403 }
        );
      }
    }

    // On-the-go pricing: mode is percent-or-amount, the tolerance is a
    // non-negative number — and a percentage can never exceed 100 (that
    // would mean giving stock away for free). When only one of the two is
    // being updated, the stored row decides which rule applies.
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
        (await db.tenant.findUnique({
          where: { id: user.tenantId },
          select: { priceFloorMode: true },
        }))?.priceFloorMode ??
        "PERCENT";
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

    // County must be one of Kenya's 47 counties — it drives area benchmarks and census lookups.
    let countyValue: string | null | undefined;
    if (county !== undefined) {
      if (county === null || county === "") {
        countyValue = null;
      } else {
        const canonical = canonicalCounty(county);
        if (!canonical) {
          return NextResponse.json({ error: "Select a valid Kenyan county." }, { status: 400 });
        }
        countyValue = canonical;
      }
    }

    const tenant = await db.tenant.update({
      where: { id: user.tenantId },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(currency && { currency }),
        ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
        ...(receiptHeader !== undefined && { receiptHeader }),
        ...(receiptFooter !== undefined && { receiptFooter }),
        ...(mpesaPaybill !== undefined && { mpesaPaybill }),
        ...(mpesaTill !== undefined && { mpesaTill }),
        ...(mpesaAccountName !== undefined && { mpesaAccountName }),
        ...(city !== undefined && { city: typeof city === "string" && city.trim() ? city.trim().slice(0, 80) : null }),
        ...(countyValue !== undefined && { county: countyValue }),
        ...(priceOverrideEnabled !== undefined && { priceOverrideEnabled: !!priceOverrideEnabled }),
        ...(floorMode !== undefined && { priceFloorMode: floorMode }),
        ...(floorValue !== undefined && { priceFloorValue: floorValue }),
        ...(showServedBy !== undefined && { showServedBy: !!showServedBy }),
      },
    });

    // Location and business type change which peers we compare against.
    if (county !== undefined || city !== undefined || type) invalidateIntelligence(user.tenantId);

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}