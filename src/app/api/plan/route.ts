import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlanLimits, checkUsage } from "@/lib/plans";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { tier: true, trialEndsAt: true, isActive: true },
    });

    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const [productCount, locationCount, staffCount] = await Promise.all([
      db.product.count({ where: { tenantId: user.tenantId, isActive: true } }),
      db.location.count({ where: { tenantId: user.tenantId, isActive: true } }),
      db.user.count({ where: { tenantId: user.tenantId, isActive: true } }),
    ]);

    const limits = getPlanLimits(tenant.tier);
    const usage = checkUsage(tenant.tier, { products: productCount, locations: locationCount, staff: staffCount });

    const now = new Date();
    const trialExpired = tenant.trialEndsAt ? now > tenant.trialEndsAt : false;
    const trialDaysLeft = tenant.trialEndsAt
      ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const expired = trialExpired && !tenant.isActive;

    return NextResponse.json({
      tier: tenant.tier,
      limits,
      usage,
      trial: { expired: trialExpired, daysLeft: trialDaysLeft },
      expired,
      readonly: expired,
    });
  } catch (error) {
    console.error("Plan check error:", error);
    return NextResponse.json({ error: "Failed to check plan" }, { status: 500 });
  }
}
