import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

async function guard() {
  const user = await getCurrentUser();
  if (!user || (user.role as string) !== "SUPER_ADMIN") return null;
  return user;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const reseller = await db.reseller.findUnique({
    where: { id },
    include: {
      tenants: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          tier: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!reseller) return NextResponse.json({ error: "Reseller not found" }, { status: 404 });

  const tenantIds = reseller.tenants.map((t) => t.id);
  const payments =
    tenantIds.length > 0
      ? await db.transaction.findMany({
          where: {
            tenantId: { in: tenantIds },
            status: "COMPLETED",
            OR: [
              { type: { in: ["SUBSCRIPTION", "SUBSCRIPTION_PAYMENT"] } },
              { type: { startsWith: "UPGRADE:" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            tenantId: true,
            amount: true,
            type: true,
            description: true,
            createdAt: true,
          },
        })
      : [];

  const tenantMap = new Map(reseller.tenants.map((t) => [t.id, t]));
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const commissionRows = payments.map((p) => ({
    ...p,
    tenant: tenantMap.get(p.tenantId) ?? null,
    commission: Math.round((p.amount * reseller.commissionPercent) / 100 * 100) / 100,
  }));

  const { password, ...safe } = reseller;
  void password;

  return NextResponse.json({
    reseller: {
      ...safe,
      totalRevenue,
      totalCommission: Math.round((totalRevenue * reseller.commissionPercent) / 100 * 100) / 100,
      payments: commissionRows,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.reseller.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Reseller not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = name;
  }
  if (body.phone !== undefined) {
    data.phone = body.phone && String(body.phone).trim() ? String(body.phone).trim() : null;
  }
  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    data.email = email;
  }
  if (body.code !== undefined) {
    const code = String(body.code).trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return NextResponse.json({ error: "Invalid reseller code" }, { status: 400 });
    }
    data.code = code;
  }
  if (body.commissionPercent !== undefined) {
    const pct = Number(body.commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: "Commission must be between 0 and 100 percent" }, { status: 400 });
    }
    data.commissionPercent = pct;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.password !== undefined && body.password !== "") {
    if (String(body.password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    data.password = await hashPassword(String(body.password));
  }

  try {
    const reseller = await db.reseller.update({ where: { id }, data });
    const { password, ...safe } = reseller;
    void password;
    return NextResponse.json({ reseller: safe });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Email or code already in use" }, { status: 409 });
    }
    console.error("Update reseller error:", error);
    return NextResponse.json({ error: "Failed to update reseller" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.reseller.findUnique({
    where: { id },
    include: { _count: { select: { tenants: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Reseller not found" }, { status: 404 });

  if (existing._count.tenants > 0) {
    return NextResponse.json(
      { error: "This reseller has referred tenants — deactivate them instead to keep attribution." },
      { status: 409 }
    );
  }

  await db.reseller.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
