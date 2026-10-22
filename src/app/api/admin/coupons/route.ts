import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeCouponCode } from "@/lib/coupons";

async function guard() {
  const user = await getCurrentUser();
  if (!user || (user.role as string) !== "SUPER_ADMIN") return null;
  return user;
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
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [coupons, total] = await Promise.all([
    db.coupon.findMany({
      where,
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.coupon.count({ where }),
  ]);

  return NextResponse.json({
    coupons,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const code = normalizeCouponCode(String(body.code ?? ""));
  const type = body.type;
  const value = Number(body.value);
  const maxUses = body.maxUses === null || body.maxUses === undefined || body.maxUses === "" ? null : Number(body.maxUses);

  if (!code) return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json(
      { error: "Code must be 3-32 characters: letters, numbers, - or _" },
      { status: 400 }
    );
  }
  if (type !== "PERCENT" && type !== "FIXED") {
    return NextResponse.json({ error: "Type must be PERCENT or FIXED" }, { status: 400 });
  }
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Value must be greater than 0" }, { status: 400 });
  }
  if (type === "PERCENT" && value > 100) {
    return NextResponse.json({ error: "Percentage discount cannot exceed 100" }, { status: 400 });
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    return NextResponse.json({ error: "Max uses must be a whole number of at least 1" }, { status: 400 });
  }

  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (startsAt && isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  if (expiresAt && isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
  }
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    return NextResponse.json({ error: "Expiry date must be after the start date" }, { status: 400 });
  }

  try {
    const coupon = await db.coupon.create({
      data: {
        code,
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
        type,
        value,
        maxUses,
        isActive: body.isActive !== false,
        startsAt,
        expiresAt,
      },
    });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    // Unique constraint on code
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    console.error("Create coupon error:", error);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
