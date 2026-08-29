import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role as string) !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const tier = searchParams.get("tier") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type) where.type = type;
  if (tier) where.tier = tier;

  const [tenants, total] = await Promise.all([
    db.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        tier: true,
        isActive: true,
        createdAt: true,
        email: true,
        _count: {
          select: {
            orders: true,
            products: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.tenant.count({ where }),
  ]);

  return NextResponse.json({
    tenants,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role as string) !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, ...data } = body;

  if (!id) return NextResponse.json({ error: "Tenant ID required" }, { status: 400 });

  const updated = await db.tenant.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
