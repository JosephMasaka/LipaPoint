import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { requireUserWithFeature, routeError, parseBody, pagination } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("supplier-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { kraPin: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.supplier.count({ where }),
    ]);

    return NextResponse.json({
      suppliers,
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/suppliers", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("supplier-management");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      name?: string;
      kraPin?: string;
      email?: string;
      phone?: string;
      address?: string;
      paymentTerms?: string;
    }>(request);

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    const supplier = await db.supplier.create({
      data: {
        tenantId: user.tenantId,
        name: body.name.trim(),
        kraPin: body.kraPin || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        paymentTerms: body.paymentTerms || null,
      },
    });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.PROCUREMENT.SUPPLIER_CREATED,
      module: "procurement",
      entity: "supplier",
      entityId: supplier.id,
      after: { name: supplier.name, kraPin: supplier.kraPin },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return routeError("POST /api/suppliers", error);
  }
}
