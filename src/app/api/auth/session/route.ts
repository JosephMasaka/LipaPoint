import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("[AUTH/session] error:", error);
    return NextResponse.json({ error: "Failed to read session" }, { status: 500 });
  }
}
