import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { getIntelligence } from "@/lib/ai/intelligence-cache";
import { generateAiReply } from "@/lib/ai/orchestrator";
import { buildPromptPayload } from "@/lib/ai/prompt";
import type { AiNarrative, BusinessIntelligence } from "@/lib/ai/types";

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

// Narrative cache keyed to the intelligence snapshot it was written for.
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

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type)) {
      return NextResponse.json(
        { error: "AI Insights is available on Professional and Enterprise plans. Upgrade to access." },
        { status: 403 }
      );
    }

    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const { intel, cached } = await getIntelligence(user.tenantId, { force });

    let ai = narrativeCache.get(user.tenantId);
    if (ai && ai.forGeneratedAt !== intel.generatedAt) ai = undefined;

    if (!ai && (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)) {
      try {
        const result = await generateAiReply(
          NARRATIVE_SYSTEM_PROMPT,
          JSON.stringify(buildPromptPayload(intel))
        );
        const narrative = parseNarrative(result.reply);
        if (narrative) {
          // Only successful, validated narratives are cached.
          ai = {
            forGeneratedAt: intel.generatedAt,
            ai: { provider: result.provider, tokensUsed: result.tokensUsed, narrative },
          };
          narrativeCache.set(user.tenantId, ai);
        } else {
          console.error("AI narrative could not be parsed; serving rule-based insights only.");
        }
      } catch (err) {
        // The AI brief is an enhancement — never fail the whole dashboard because of it.
        console.error("AI narrative generation failed:", err);
      }
    }

    return NextResponse.json(
      { ...intel, ai: ai?.ai, cached },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("AI Insights Error:", error);
    return NextResponse.json({ error: "Failed to generate insights. Please try again." }, { status: 500 });
  }
}