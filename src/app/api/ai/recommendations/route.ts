import { NextResponse } from "next/server";
import { requireUserWithPlanFeature } from "@/lib/api-guards";
import { can } from "@/lib/permissions";
import { AiScopeError, resolveAiScope } from "@/lib/ai/scope";
import {
  isRecommendationStatus,
  listRecommendations,
  recommendationCounts,
  setRecommendationStatus,
  syncRestockRecommendations,
} from "@/lib/ai/recommendations";

/** Tenant-scoped recommendation list plus per-status counts. */
export async function GET(request: Request) {
  const guard = await requireUserWithPlanFeature("ai-assistant");
  if (guard.response) return guard.response;
  const user = guard.user;

  const params = new URL(request.url).searchParams;
  const rawStatus = params.get("status") ?? "new";
  if (rawStatus !== "all" && !isRecommendationStatus(rawStatus)) {
    return NextResponse.json({ error: "Unknown status filter", code: "INVALID_STATUS" }, { status: 400 });
  }
  const rawLimit = Number(params.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;

  try {
    const [items, counts] = await Promise.all([
      listRecommendations(user.tenantId, { status: rawStatus as "all", limit }),
      recommendationCounts(user.tenantId),
    ]);
    return NextResponse.json(
      { items, counts },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Recommendation list failed:", error);
    return NextResponse.json(
      { error: "Failed to load recommendations", code: "RECOMMENDATIONS_FAILED" },
      { status: 500 }
    );
  }
}

/** Recomputes deterministic recommendations for the requested scope. */
export async function POST(request: Request) {
  const guard = await requireUserWithPlanFeature("ai-assistant");
  if (guard.response) return guard.response;
  const user = guard.user;

  if (!can(user.role, "ai:recommendations:write")) {
    return NextResponse.json(
      { error: "Only managers and above can refresh recommendations", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    const { scope } = await resolveAiScope(user, {
      from: body.from,
      to: body.to,
      locationId: body.locationId,
    });
    const result = await syncRestockRecommendations(scope);
    return NextResponse.json({ ...result, scope }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AiScopeError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Recommendation refresh failed:", error);
    return NextResponse.json(
      { error: "Failed to refresh recommendations", code: "RECOMMENDATIONS_FAILED" },
      { status: 500 }
    );
  }
}

/** Human accept/dismiss/done. Never executes the suggestion. */
export async function PATCH(request: Request) {
  const guard = await requireUserWithPlanFeature("ai-assistant");
  if (guard.response) return guard.response;
  const user = guard.user;

  if (!can(user.role, "ai:recommendations:write")) {
    return NextResponse.json(
      { error: "Only managers and above can update recommendations", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "id is required", code: "INVALID_BODY" }, { status: 400 });
  }
  if (!isRecommendationStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be new, accepted, dismissed or done", code: "INVALID_STATUS" },
      { status: 400 }
    );
  }
  const feedback =
    typeof body.feedback === "string" ? body.feedback.slice(0, 500) : undefined;

  try {
    const updated = await setRecommendationStatus(
      user.tenantId,
      body.id,
      body.status,
      user.id,
      feedback
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Recommendation not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Recommendation update failed:", error);
    return NextResponse.json(
      { error: "Failed to update recommendation", code: "RECOMMENDATIONS_FAILED" },
      { status: 500 }
    );
  }
}
