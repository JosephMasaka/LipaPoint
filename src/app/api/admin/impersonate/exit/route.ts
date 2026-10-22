import { NextResponse } from "next/server";
import { exitImpersonation } from "@/lib/auth";

export async function POST() {
  const result = await exitImpersonation();
  if (!result.ok) {
    return NextResponse.json({ error: "No active impersonation session" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
