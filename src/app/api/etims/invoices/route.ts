import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEtimsStats } from "@/lib/etims/submission";
import { requireUserWithFeature, routeError, pagination } from "@/lib/api-guards";

/**
 * GET /api/etims/invoices — the eTIMS submission log (spec §4.8 dashboard).
 *
 * Query: status (pending|submitted|accepted|rejected), sourceType, search
 * (sourceRef / KRA number), page, limit. Returns the page plus tenant-wide
 * stats so one request feeds both the table and the summary cards.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithFeature("etims-submission");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const sourceType = searchParams.get("sourceType");
    const search = searchParams.get("search");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
      100
    );
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(status && status !== "ALL" ? { status } : {}),
      ...(sourceType && sourceType !== "ALL" ? { sourceType } : {}),
      ...(search
        ? {
            OR: [
              { sourceRef: { contains: search, mode: "insensitive" as const } },
              { kraInvoiceNumber: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [invoices, total, stats] = await Promise.all([
      db.etimsInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          sourceType: true,
          sourceRef: true,
          status: true,
          totalAmount: true,
          taxAmount: true,
          kraInvoiceNumber: true,
          qrCodeUrl: true,
          attempts: true,
          lastError: true,
          submittedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.etimsInvoice.count({ where }),
      getEtimsStats(user.tenantId),
    ]);

    return NextResponse.json({
      invoices,
      stats,
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    return routeError("GET /api/etims/invoices", error);
  }
}
