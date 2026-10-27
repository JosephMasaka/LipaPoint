import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordBankTransaction } from "@/lib/bank";
import { requireUserWithFeature, routeError, parseBody } from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("bank-reconciliation");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;

    const account = await db.bankAccount.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const unreconciledOnly = searchParams.get("unreconciled") === "true";

    const transactions = await db.bankTransaction.findMany({
      where: {
        bankAccountId: id,
        tenantId: user.tenantId,
        ...(unreconciledOnly ? { reconciled: false } : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    return routeError("GET /api/bank-accounts/[id]/transactions", error);
  }
}

/**
 * Records a bank/cash movement and posts the mirrored journal entry.
 * Body: { amount, direction: in|out, date?, description?, reference?,
 *         counterAccountCode?, category?, chequeNumber?, counterparty? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("bank-reconciliation");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{
      amount?: number;
      direction?: string;
      date?: string;
      description?: string;
      reference?: string;
      counterAccountCode?: string;
      category?: string;
      chequeNumber?: string;
      counterparty?: string;
    }>(request);

    if (!body.amount || !body.direction) {
      return NextResponse.json(
        { error: "amount and direction are required" },
        { status: 400 }
      );
    }
    if (!["in", "out"].includes(body.direction)) {
      return NextResponse.json(
        { error: "direction must be 'in' or 'out'" },
        { status: 400 }
      );
    }
    if (body.category && !["general", "cheque", "transfer"].includes(body.category)) {
      return NextResponse.json(
        { error: "category must be one of: general, cheque, transfer" },
        { status: 400 }
      );
    }

    const txn = await recordBankTransaction({
      tenantId: user.tenantId,
      bankAccountId: id,
      amount: Number(body.amount),
      direction: body.direction as "in" | "out",
      date: body.date ? new Date(body.date) : undefined,
      description: body.description ?? null,
      reference: body.reference ?? null,
      counterAccountCode: body.counterAccountCode ?? null,
      category: (body.category as "general" | "cheque" | "transfer" | undefined) ?? undefined,
      chequeNumber: body.chequeNumber ?? null,
      counterparty: body.counterparty ?? null,
    });

    return NextResponse.json(txn, { status: 201 });
  } catch (error) {
    return routeError("POST /api/bank-accounts/[id]/transactions", error);
  }
}
