import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const locationId = searchParams.get("locationId");

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      date: new Date(date),
    };
    if (locationId) where.locationId = locationId;

    const summary = await db.dailySummary.findFirst({
      where,
      include: {
        location: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!summary) {
      return NextResponse.json({ exists: false, date });
    }

    return NextResponse.json({ exists: true, ...summary });
  } catch (error) {
    console.error("GET /api/daily-summary error:", error);
    return NextResponse.json({ error: "Failed to fetch daily summary" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["OWNER", "ADMIN", "MANAGER", "CASHIER"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { date, locationId, cashSurrendered, debtsPaid, otherIncome, notes } = body;

    if (!date || !locationId) {
      return NextResponse.json({ error: "Date and locationId required" }, { status: 400 });
    }

    const summaryDate = new Date(date);

    // Calculate totals from actual data
    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");

    // Total cash sales for the day
    const cashOrders = await db.order.findMany({
      where: {
        tenantId: user.tenantId,
        locationId,
        status: "COMPLETED",
        paymentMethod: "CASH",
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { total: true },
    });
    const totalSales = cashOrders.reduce((sum, o) => sum + o.total, 0);

    // M-Pesa received
    const mpesaOrders = await db.order.findMany({
      where: {
        tenantId: user.tenantId,
        locationId,
        status: "COMPLETED",
        paymentMethod: { in: ["MPESA_MANUAL", "MPESA_STK"] },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { total: true },
    });
    const mpesaReceived = mpesaOrders.reduce((sum, o) => sum + o.total, 0);

    // Unpaid bills (tabs opened today)
    const newTabs = await db.order.findMany({
      where: {
        tenantId: user.tenantId,
        locationId,
        status: "TAB",
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { total: true },
    });
    const unpaidBills = newTabs.reduce((sum, o) => sum + o.total, 0);

    // Expenses for the day
    const dayExpenses = await db.expense.findMany({
      where: { tenantId: user.tenantId, locationId, date: summaryDate },
      select: { amount: true, category: true },
    });
    const purchases = dayExpenses.filter(e => e.category === "Purchases").reduce((sum, e) => sum + e.amount, 0);
    const expenses = dayExpenses.filter(e => e.category !== "Purchases").reduce((sum, e) => sum + e.amount, 0);

    // Get previous day's carried forward
    const prevDay = new Date(summaryDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevSummary = await db.dailySummary.findFirst({
      where: { tenantId: user.tenantId, locationId, date: prevDay },
      select: { cashCarriedForward: true },
    });
    const cashBroughtForward = prevSummary?.cashCarriedForward || 0;

    const debts = debtsPaid || 0;
    const others = otherIncome || 0;
    const subtotal = cashBroughtForward + totalSales + debts + others;
    const totalCash = subtotal - mpesaReceived - purchases - expenses - unpaidBills;
    const surrendered = cashSurrendered || 0;
    const shortExcess = totalCash - surrendered;
    const cashCarriedForward = surrendered > 0 ? surrendered : totalCash;

    const summary = await db.dailySummary.upsert({
      where: { tenantId_locationId_date: { tenantId: user.tenantId, locationId, date: summaryDate } },
      update: {
        cashBroughtForward, totalSales, debtsPaid: debts, otherIncome: others,
        subtotal, mpesaReceived, purchases, expenses, unpaidBills,
        totalCash, cashSurrendered: surrendered, shortExcess, cashCarriedForward,
        notes, userId: user.id,
      },
      create: {
        date: summaryDate, cashBroughtForward, totalSales, debtsPaid: debts, otherIncome: others,
        subtotal, mpesaReceived, purchases, expenses, unpaidBills,
        totalCash, cashSurrendered: surrendered, shortExcess, cashCarriedForward,
        notes, tenantId: user.tenantId, locationId, userId: user.id,
      },
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("POST /api/daily-summary error:", error);
    return NextResponse.json({ error: "Failed to save daily summary" }, { status: 500 });
  }
}
