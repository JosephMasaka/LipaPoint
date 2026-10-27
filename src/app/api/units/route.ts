import { requireUserWithFeature } from "@/lib/api-guards";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireUserWithFeature("stock-tracking-basic");
  if (auth.response) return auth.response;
  const { user } = auth;

  const units = await db.unitOfMeasure.findMany({
    where: { tenantId: user.tenantId },
    include: {
      conversionsFrom: {
        include: { toUnit: { select: { id: true, name: true, abbreviation: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(units);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserWithFeature("stock-tracking-basic");
  if (auth.response) return auth.response;
  const { user } = auth;

  const body = await request.json();
  const { name, abbreviation } = body;

  if (!name || !abbreviation) {
    return NextResponse.json({ error: "Name and abbreviation are required" }, { status: 400 });
  }

  const unit = await db.unitOfMeasure.create({
    data: { name, abbreviation, tenantId: user.tenantId },
  });

  return NextResponse.json(unit, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUserWithFeature("stock-tracking-basic");
  if (auth.response) return auth.response;
  const { user } = auth;

  const body = await request.json();
  const { fromUnitId, toUnitId, factor } = body;

  if (!fromUnitId || !toUnitId || !factor) {
    return NextResponse.json({ error: "fromUnitId, toUnitId, and factor are required" }, { status: 400 });
  }

  const conversion = await db.unitConversion.upsert({
    where: { fromUnitId_toUnitId: { fromUnitId, toUnitId } },
    update: { factor },
    create: { fromUnitId, toUnitId, factor },
  });

  return NextResponse.json(conversion);
}
