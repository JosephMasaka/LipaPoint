import { NextResponse } from "next/server";
import { requireUserWithPlanFeature } from "@/lib/api-guards";
import { getIntelligence } from "@/lib/ai/intelligence-cache";
import { generateAiReply } from "@/lib/ai/orchestrator";
import { buildPromptPayload } from "@/lib/ai/prompt";
import { resolveAiScope, AiScopeError } from "@/lib/ai/scope";
import { checkQuota, recordUsage } from "@/lib/ai/quota";
import { newRunId } from "@/lib/ai/usage";
import { AiRateLimitError, AiTimeoutError, type AiNarrative, type BusinessIntelligence, type AiScopeInfo } from "@/lib/ai/types";

const NARRATIVE_SYSTEM_PROMPT = `You are LipaPoint Intelligence, a retail analytics advisor for small businesses in Kenya (currency KES).

You will receive verified JSON about one business. Sections are labelled by provenance:
- YOUR_DATA: measured from this business's own sales.
- AREA_BENCHMARK: anonymised aggregate of comparable LipaPoint businesses.
- AREA_DEMOGRAPHICS: official census figures.
- MODELLED_BUYING_POTENTIAL: a MODELLED estimate, never measured behaviour.

HARD RULES
1. Use ONLY numbers present in the JSON. Never invent competitors, prices, demographics, customer counts or market sizes.
2. If a section says available:false, say that data is not available yet and what would unlock it. Do not guess.
3. Always say which kind of evidence you are using ("your sales show...", "peers in the area average...", "modelled estimate suggests...").
4. Never identify or hint at any individual business.
5. Present restock quantities and price changes as suggestions to check, not guarantees. Mention supplier lead time or cash constraints where relevant.
6. Be concrete: name products, quantities and KES amounts from the data.

Respond with ONLY a JSON object, no markdown fences:
{"summary": "2-3 sentence executive summary", "priorities": [{"title": "...", "why": "evidence from the data", "action": "specific next step"}]}
Provide 3 to 4 priorities, ordered by expected impact.`;

// Narrative cache keyed to the scope and the intelligence snapshot it was
// written for, so a changed range or branch never reuses another's narrative.
const narrativeCache = new Map<
  string,
  { forGeneratedAt: string; ai: NonNullable<BusinessIntelligence["ai"]> }
>();

function parseNarrative(text: string): AiNarrative | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (typeof obj.summary !== "string" || !Array.isArray(obj.priorities)) return null;
    const priorities = obj.priorities
      .filter((p: Record<string, unknown>) =>
        typeof p?.title === "string" && typeof p?.why === "string" && typeof p?.action === "string")
      .slice(0, 4)
      .map((p: { title: string; why: string; action: string }) => ({
        title: p.title.slice(0, 120), why: p.why.slice(0, 400), action: p.action.slice(0, 400),
      }));
    if (!obj.summary.trim() || priorities.length === 0) return null;
    return { summary: obj.summary.slice(0, 700), priorities };
  } catch {
    return null;
  }
}

function narrativeKey(scope: AiScopeInfo): string {
  return [scope.tenantId, scope.from, scope.to, scope.locationId ?? "all"].join(":");
}

export async function GET(request: Request) {
  try {
    const guard = await requireUserWithPlanFeature("ai-assistant");
    if (guard.response) return guard.response;
    const user = guard.user;

    const params = new URL(request.url).searchParams;
    const { scope } = await resolveAiScope(user, {
      from: params.get("from"),
      to: params.get("to"),
      locationId: params.get("locationId"),
    });

    const force = params.get("refresh") === "1";
    const { intel, cached } = await getIntelligence(user.tenantId, {
      from: params.get("from") ? new Date(scope.from) : undefined,
      to: params.get("to") ? new Date(scope.to) : undefined,
      locationId: scope.locationId ?? undefined,
      force,
    });

    const key = narrativeKey(scope);
    let entry = narrativeCache.get(key);
    if (entry && entry.forGeneratedAt !== intel.generatedAt) entry = undefined;

    if (!entry && (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)) {
      const quota = await checkQuota(user.tenantId, user.tenant.tier);
      if (!quota.allowed) {
        return NextResponse.json(
          { ...intel, ai: undefined, cached, scope, aiQuota: quota },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }

      const runId = newRunId();
      const startedAt = Date.now();
      try {
        const result = await generateAiReply(
          NARRATIVE_SYSTEM_PROMPT,
          JSON.stringify(buildPromptPayload(intel))
        );
        const narrative = parseNarrative(result.reply);
        if (narrative) {
          // Only successful, validated narratives are cached.
          entry = {
            forGeneratedAt: intel.generatedAt,
            ai: { provider: result.provider, tokensUsed: result.tokensUsed, narrative },
          };
          narrativeCache.set(key, entry);
        } else {
          console.error("AI narrative could not be parsed; serving rule-based insights only.");
        }

        await recordUsage({
          tenantId: user.tenantId,
          userId: user.id,
          runId,
          surface: "insights",
          provider: result.provider,
          model: result.model ?? null,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.tokensUsed,
          latencyMs: Date.now() - startedAt,
          status: narrative ? "SUCCESS" : "ERROR",
          errorCode: narrative ? null : "NARRATIVE_UNPARSED",
        });
      } catch (err) {
        // The AI brief is an enhancement — never fail the whole dashboard because of it.
        console.error("AI narrative generation failed:", err);
        await recordUsage({
          tenantId: user.tenantId,
          userId: user.id,
          runId,
          surface: "insights",
          provider: "none",
          latencyMs: Date.now() - startedAt,
          status: err instanceof AiRateLimitError ? "RATE_LIMITED" : err instanceof AiTimeoutError ? "TIMEOUT" : "ERROR",
          errorCode: "NARRATIVE_FAILED",
        });
      }
    }

    return NextResponse.json(
      { ...intel, ai: entry?.ai, cached, scope },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AiScopeError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("AI Insights Error:", error);
    return NextResponse.json({ error: "Failed to generate insights. Please try again." }, { status: 500 });
  }
}
