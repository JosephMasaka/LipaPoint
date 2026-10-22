import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeCouponCode } from "@/lib/coupons";

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
  const coupon = await db.coupon.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { redemptions: true } },
    },
  });
  if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const tenantIds = [...new Set(coupon.redemptions.map((r) => r.tenantId))];
  const tenants = await db.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true, slug: true },
  });
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));

  return NextResponse.json({
    coupon: {
      ...coupon,
      redemptions: coupon.redemptions.map((r) => ({
        ...r,
        tenant: tenantMap.get(r.tenantId) ?? null,
      })),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.code !== undefined) {
    const code = normalizeCouponCode(String(body.code));
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }
    data.code = code;
  }
  if (body.name !== undefined) {
    data.name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  }
  if (body.type !== undefined) {
    if (body.type !== "PERCENT" && body.type !== "FIXED") {
      return NextResponse.json({ error: "Type must be PERCENT or FIXED" }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "Value must be greater than 0" }, { status: 400 });
    }
    const finalType = (data.type as string) ?? existing.type;
    if (finalType === "PERCENT" && value > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100" }, { status: 400 });
    }
    data.value = value;
  }
  if (body.maxUses !== undefined) {
    if (body.maxUses === null || body.maxUses === "") {
      data.maxUses = null;
    } else {
      const maxUses = Number(body.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1) {
        return NextResponse.json({ error: "Max uses must be a whole number of at least 1" }, { status: 400 });
      }
      if (maxUses < existing.usedCount) {
        return NextResponse.json(
          { error: `Already used ${existing.usedCount} times — max uses can't go below that` },
          { status: 400 }
        );
      }
      data.maxUses = maxUses;
    }
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.startsAt !== undefined) {
    if (!body.startsAt) {
      data.startsAt = null;
    } else {
      const d = new Date(body.startsAt);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
      data.startsAt = d;
    }
  }
  if (body.expiresAt !== undefined) {
    if (!body.expiresAt) {
      data.expiresAt = null;
    } else {
      const d = new Date(body.expiresAt);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
      data.expiresAt = d;
    }
  }

  const finalStarts = (data.startsAt as Date | null | undefined) !== undefined ? (data.startsAt as Date | null) : existing.startsAt;
  const finalExpires = (data.expiresAt as Date | null | undefined) !== undefined ? (data.expiresAt as Date | null) : existing.expiresAt;
  if (finalStarts && finalExpires && finalExpires <= finalStarts) {
    return NextResponse.json({ error: "Expiry date must be after the start date" }, { status: 400 });
  }

  try {
    const coupon = await db.coupon.update({ where: { id }, data });
    return NextResponse.json({ coupon });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    console.error("Update coupon error:", error);
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.coupon.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  if (existing.usedCount > 0 || existing._count.redemptions > 0) {
    return NextResponse.json(
      { error: "This coupon has been used — deactivate it instead of deleting to preserve billing history." },
      { status: 409 }
    );
  }

  await db.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
