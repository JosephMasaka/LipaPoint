import { NextResponse } from "next/server";
import { requireUserWithPlanFeature } from "@/lib/api-guards";
import { can } from "@/lib/permissions";
import { getUsageSummary } from "@/lib/ai/quota";

/** Month-to-date AI usage for the tenant. OWNER/ADMIN only. */
export async function GET() {
  const guard = await requireUserWithPlanFeature("ai-assistant");
  if (guard.response) return guard.response;
  const user = guard.user;

  if (!can(user.role, "ai:usage:read")) {
    return NextResponse.json(
      { error: "Only owners and admins can view AI usage", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const summary = await getUsageSummary(user.tenantId, user.tenant.tier);
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("AI usage summary failed:", error);
    return NextResponse.json({ error: "Failed to load AI usage", code: "USAGE_FAILED" }, { status: 500 });
  }
}
