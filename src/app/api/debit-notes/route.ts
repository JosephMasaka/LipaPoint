import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createDebitNote, approveDebitNote } from "@/lib/credit-debit-notes";
import { requireUserWithFeature, routeError, parseBody, pagination } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("credit-debit-notes");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = { tenantId: user.tenantId, ...(status ? { status } : {}) };

    const [debitNotes, total] = await Promise.all([
      db.debitNote.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.debitNote.count({ where }),
    ]);

    return NextResponse.json({ debitNotes, pagination: pagination(page, limit, total) });
  } catch (error) {
    return routeError("GET /api/debit-notes", error);
  }
}

/** Creates a draft debit note. Body: { supplierId, amount, reason, invoiceId? } */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("credit-debit-notes");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      supplierId?: string;
      invoiceId?: string;
      amount?: number;
      reason?: string;
    }>(request);

    if (!body.supplierId || !body.amount || !body.reason) {
      return NextResponse.json(
        { error: "supplierId, amount and reason are required" },
        { status: 400 }
      );
    }

    const note = await createDebitNote({
      tenantId: user.tenantId,
      supplierId: body.supplierId,
      invoiceId: body.invoiceId ?? null,
      amount: Number(body.amount),
      reason: body.reason,
      createdBy: user.id,
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return routeError("POST /api/debit-notes", error);
  }
}

/** Approves a draft debit note — posts DR AP / CR Inventory. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("credit-debit-notes");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{ id?: string; action?: string }>(request);
    if (!body.id || body.action !== "approve") {
      return NextResponse.json(
        { error: "id and action:'approve' are required" },
        { status: 400 }
      );
    }

    const note = await approveDebitNote(user.tenantId, body.id, user.id);
    return NextResponse.json(note);
  } catch (error) {
    return routeError("PATCH /api/debit-notes", error);
  }
}
