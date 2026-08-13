import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
