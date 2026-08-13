import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }

    const expenses = await db.expense.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { date, category, description, amount } = body;

    if (!date || !category || !description || !amount) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const expense = await db.expense.create({
      data: {
        date: new Date(date),
        category,
        description,
        amount: parseFloat(amount),
        tenantId: user.tenantId,
        userId: user.id,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
