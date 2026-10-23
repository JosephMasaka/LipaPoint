import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createBankAccount } from "@/lib/bank";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

export async function GET() {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const accounts = await db.bankAccount.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { coaAccount: { select: { code: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Current balance per wallet = opening balance + in − out, so the
    // Banking screen never has to sum the transaction list itself.
    const flows = accounts.length
      ? await db.bankTransaction.groupBy({
          by: ["bankAccountId", "direction"],
          where: { tenantId: user.tenantId, bankAccountId: { in: accounts.map((a) => a.id) } },
          _sum: { amount: true },
        })
      : [];
    const flowByAccount = new Map(
      flows.map((f) => [`${f.bankAccountId}:${f.direction}`, f._sum.amount ?? 0])
    );
    const withBalance = accounts.map((account) => ({
      ...account,
      balance:
        account.openingBalance +
        (flowByAccount.get(`${account.id}:in`) ?? 0) -
        (flowByAccount.get(`${account.id}:out`) ?? 0),
    }));

    return NextResponse.json(withBalance);
  } catch (error) {
    return routeError("GET /api/bank-accounts", error);
  }
}

/**
 * Creates a bank/cash wallet. Body:
 *   { name, type: bank|mpesa_till|mpesa_paybill|cash, accountNumber?, openingBalance?, coaAccountCode? }
 * Opening balance posts DR wallet / CR owner's equity automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{
      name?: string;
      type?: string;
      accountNumber?: string;
      openingBalance?: number;
      coaAccountCode?: string;
    }>(request);

    if (!body.name || !body.type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 });
    }
    if (!["bank", "mpesa_till", "mpesa_paybill", "cash"].includes(body.type)) {
      return NextResponse.json(
        { error: "type must be one of: bank, mpesa_till, mpesa_paybill, cash" },
        { status: 400 }
      );
    }

    const account = await createBankAccount({
      tenantId: user.tenantId,
      name: body.name,
      type: body.type,
      accountNumber: body.accountNumber ?? null,
      openingBalance: body.openingBalance ?? 0,
      coaAccountCode: body.coaAccountCode ?? null,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return routeError("POST /api/bank-accounts", error);
  }
}
