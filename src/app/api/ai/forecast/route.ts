import { NextResponse } from "next/server";
import { requireUserWithPlanFeature } from "@/lib/api-guards";
import { AiScopeError, resolveAiScope } from "@/lib/ai/scope";
import { buildForecast, buildForecastAccuracy } from "@/lib/ai/forecast";

/**
 * Cash-flow projection + anomaly flags for the requested branch.
 * Deterministic: computed from orders, expenses and supplier invoices only.
 */
export async function GET(request: Request) {
  const guard = await requireUserWithPlanFeature("ai-assistant");
  if (guard.response) return guard.response;
  const user = guard.user;

  const params = new URL(request.url).searchParams;

  try {
    const { scope } = await resolveAiScope(user, { locationId: params.get("locationId") });
    const [forecast, accuracy] = await Promise.all([
      buildForecast(user.tenantId, {
        locationId: scope.locationId,
        currency: scope.currency,
      }),
      buildForecastAccuracy(user.tenantId, { locationId: scope.locationId }),
    ]);
    return NextResponse.json(
      { forecast, accuracy, scope },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AiScopeError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Forecast failed:", error);
    return NextResponse.json(
      { error: "Failed to build the forecast", code: "FORECAST_FAILED" },
      { status: 500 }
    );
  }
}
