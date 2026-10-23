import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createCreditNote, approveCreditNote } from "@/lib/credit-debit-notes";
import { requireUserWithModule, routeError, parseBody, pagination } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = { tenantId: user.tenantId, ...(status ? { status } : {}) };

    const [creditNotes, total] = await Promise.all([
      db.creditNote.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.creditNote.count({ where }),
    ]);

    return NextResponse.json({ creditNotes, pagination: pagination(page, limit, total) });
  } catch (error) {
    return routeError("GET /api/credit-notes", error);
  }
}

/** Creates a draft credit note. Body: { customerId, amount, reason } */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{ customerId?: string; amount?: number; reason?: string }>(
      request
    );

    if (!body.customerId || !body.amount || !body.reason) {
      return NextResponse.json(
        { error: "customerId, amount and reason are required" },
        { status: 400 }
      );
    }

    const note = await createCreditNote({
      tenantId: user.tenantId,
      customerId: body.customerId,
      amount: Number(body.amount),
      reason: body.reason,
      createdBy: user.id,
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return routeError("POST /api/credit-notes", error);
  }
}

/** Approves a draft credit note — posts DR Sales / CR AR. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{ id?: string; action?: string }>(request);
    if (!body.id || body.action !== "approve") {
      return NextResponse.json(
        { error: "id and action:'approve' are required" },
        { status: 400 }
      );
    }

    const note = await approveCreditNote(user.tenantId, body.id, user.id);
    return NextResponse.json(note);
  } catch (error) {
    return routeError("PATCH /api/credit-notes", error);
  }
}
