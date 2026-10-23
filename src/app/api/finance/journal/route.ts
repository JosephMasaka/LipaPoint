import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError, pagination, Prisma } from "@/lib/api-guards";

/**
 * General ledger read (spec §4.3 — JournalEntry is the single source of
 * truth). Returns entries newest-first with their lines and account codes,
 * so the Finance screen can render a drill-down GL without extra fetches.
 *
 * Filters: from/to (date range), sourceModule (pos|procurement|payroll|...).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const sourceModule = searchParams.get("sourceModule");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = { tenantId: user.tenantId };
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    if (sourceModule) where.sourceModule = sourceModule;

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: { select: { code: true, name: true } } },
            orderBy: { id: "asc" },
          },
          postedByUser: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json({ entries, pagination: pagination(page, limit, total) });
  } catch (error) {
    return routeError("GET /api/finance/journal", error);
  }
}
