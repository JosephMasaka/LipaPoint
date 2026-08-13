import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, contactName, email, phone, businessType, message } = body;

    if (!businessName || !contactName || !email || !phone || !businessType) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const demoRequest = await db.demoRequest.create({
      data: { businessName, contactName, email, phone, businessType, message },
    });

    return NextResponse.json(demoRequest, { status: 201 });
  } catch (error) {
    console.error("Demo request error:", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}
