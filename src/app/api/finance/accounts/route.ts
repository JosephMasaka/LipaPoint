import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError } from "@/lib/api-guards";

/**
 * GET /api/finance/accounts
 * The tenant's chart of accounts, flat with parentId links (clients can
 * build the tree). Filter with ?type=asset|liability|equity|income|expense.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const accounts = await db.chartOfAccount.findMany({
      where: {
        tenantId: user.tenantId,
        ...(type ? { type } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isSystem: true,
        isActive: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    return routeError("GET /api/finance/accounts", error);
  }
}
