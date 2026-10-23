import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

async function guard() {
  const user = await getCurrentUser();
  if (!user || (user.role as string) !== "SUPER_ADMIN") return null;
  return user;
}

function generateResellerCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  const suffix = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4);
  return `${base || "SELL"}${suffix}`;
}

/** Subscription payments (signup, renewal, upgrade) across a set of tenants. */
async function summarizeEarnings(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, number>();
  const transactions = await db.transaction.findMany({
    where: {
      tenantId: { in: tenantIds },
      status: "COMPLETED",
      OR: [
        { type: { in: ["SUBSCRIPTION", "SUBSCRIPTION_PAYMENT"] } },
        { type: { startsWith: "UPGRADE:" } },
      ],
    },
    select: { tenantId: true, amount: true },
  });
  const totals = new Map<string, number>();
  for (const t of transactions) {
    totals.set(t.tenantId, (totals.get(t.tenantId) ?? 0) + t.amount);
  }
  return totals;
}

export async function GET(request: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const [resellers, total] = await Promise.all([
    db.reseller.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        code: true,
        commissionPercent: true,
        isActive: true,
        createdAt: true,
        _count: { select: { tenants: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.reseller.count({ where }),
  ]);

  // Earnings: completed subscription payments from tenants each reseller
  // brought in, times their commission rate.
  const allTenantLinks = await db.tenant.findMany({
    where: { resellerId: { in: resellers.map((r) => r.id) } },
    select: { id: true, resellerId: true },
  });
  const earningsByTenant = await summarizeEarnings(allTenantLinks.map((t) => t.id));

  const revenueByReseller = new Map<string, number>();
  for (const link of allTenantLinks) {
    if (!link.resellerId) continue;
    revenueByReseller.set(
      link.resellerId,
      (revenueByReseller.get(link.resellerId) ?? 0) + (earningsByTenant.get(link.id) ?? 0)
    );
  }

  const enriched = resellers.map((r) => {
    const revenue = revenueByReseller.get(r.id) ?? 0;
    return {
      ...r,
      totalRevenue: revenue,
      totalCommission: Math.round((revenue * r.commissionPercent) / 100 * 100) / 100,
    };
  });

  return NextResponse.json({
    resellers: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const password = typeof body.password === "string" ? body.password : "";
  const commissionPercent = body.commissionPercent === undefined ? 10 : Number(body.commissionPercent);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
    return NextResponse.json({ error: "Commission must be between 0 and 100 percent" }, { status: 400 });
  }

  const code = typeof body.code === "string" && body.code.trim()
    ? body.code.trim().toUpperCase().replace(/\s+/g, "")
    : generateResellerCode(name);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json(
      { error: "Code must be 3-32 characters: letters, numbers, - or _" },
      { status: 400 }
    );
  }

  try {
    const reseller = await db.reseller.create({
      data: {
        name,
        email,
        phone,
        password: await hashPassword(password),
        code,
        commissionPercent,
      },
    });
    const { password: _pw, ...safe } = reseller;
    void _pw;
    return NextResponse.json({ reseller: safe }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const field = (error as { meta?: { target?: string[] } }).meta?.target?.[0];
      if (field === "email") {
        return NextResponse.json({ error: "A reseller with this email already exists" }, { status: 409 });
      }
      if (field === "code") {
        // Regenerate once instead of failing — codes are cheap to mint.
        const retry = generateResellerCode(name);
        try {
          const reseller = await db.reseller.create({
            data: {
              name,
              email,
              phone,
              password: await hashPassword(password),
              code: retry,
              commissionPercent,
            },
          });
          const { password: _pw, ...safe } = reseller;
          void _pw;
          return NextResponse.json({ reseller: safe }, { status: 201 });
        } catch {
          return NextResponse.json({ error: "Code collision — try a custom code" }, { status: 409 });
        }
      }
      return NextResponse.json({ error: "Duplicate value" }, { status: 409 });
    }
    console.error("Create reseller error:", error);
    return NextResponse.json({ error: "Failed to create reseller" }, { status: 500 });
  }
}
