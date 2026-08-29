import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role as string) !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [subscriptions, total, allActive, churnedThisMonth] = await Promise.all([
    db.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.subscription.count({ where }),
    db.subscription.findMany({ where: { status: "active" } }),
    db.subscription.count({
      where: {
        status: "cancelled",
        updatedAt: { gte: monthStart },
      },
    }),
  ]);

  // Fetch tenant names for subscriptions
  const tenantIds = [...new Set(subscriptions.map((s) => s.tenantId))];
  const tenants = await db.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  const subscriptionsWithTenantName = subscriptions.map((sub) => ({
    ...sub,
    tenantName: tenantMap.get(sub.tenantId) || "Unknown",
  }));

  const totalMRR = allActive.reduce((sum, sub) => sum + sub.amount, 0);

  return NextResponse.json({
    subscriptions: subscriptionsWithTenantName,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: {
      totalMRR,
      activeSubs: allActive.length,
      churnedThisMonth,
    },
  });
}
