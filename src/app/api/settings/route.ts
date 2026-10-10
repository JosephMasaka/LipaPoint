import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canonicalCounty } from "@/lib/kenya-counties";
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
        paymentGateways: {
          select: { provider: true, isActive: true, merchantRef: true },
        },
      },
    });
    return NextResponse.json(tenant);
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
    } = body;

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