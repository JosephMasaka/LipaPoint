import { requireUserWithFeature } from "@/lib/api-guards";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordSyncResponse, replaySyncResponse } from "@/lib/idempotency";

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

  // Queued offline unit changes replay until they land; a replay of a request
  // that already committed returns its original body.
  const replay = await replaySyncResponse(request, user.tenantId);
  if (replay) return replay;

  const body = await request.json();
  const { name, abbreviation } = body;

  if (!name || !abbreviation) {
    return NextResponse.json({ error: "Name and abbreviation are required" }, { status: 400 });
  }

  const unit = await db.unitOfMeasure.create({
    data: { name, abbreviation, tenantId: user.tenantId },
  });

  return recordSyncResponse(
    request,
    user.tenantId,
    NextResponse.json(unit, { status: 201 })
  );
}

export async function PUT(request: NextRequest) {
  const auth = await requireUserWithFeature("stock-tracking-basic");
  if (auth.response) return auth.response;
  const { user } = auth;

  const replay = await replaySyncResponse(request, user.tenantId);
  if (replay) return replay;

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

  return recordSyncResponse(request, user.tenantId, NextResponse.json(conversion));
}
