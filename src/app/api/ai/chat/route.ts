import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { generateAiReply } from "@/lib/ai/orchestrator";
import { buildBusinessContext } from "@/lib/ai/business-context";
import { AiRateLimitError } from "@/lib/ai/types";

const SYSTEM_PROMPT = `You are LipaPoint AI, an expert point-of-sale and retail advisor for small and medium businesses in Kenya. Currency is KES; customers commonly pay by M-Pesa, cash and card.

You advise on: sales performance, restocking and quantities, pricing and margins, product range, customer retention and churn, and what is selling in the business's local area.

HOW TO USE THE DATA YOU ARE GIVEN
The business data below is JSON, split into sections with different reliability. Always say which kind of evidence you are relying on:
- YOUR_DATA: measured from this business's own sales. State it as fact ("you sold...").
- AREA_BENCHMARK: an anonymised aggregate of comparable LipaPoint businesses, with a stated scope (county or Kenya-wide). Say "comparable businesses in the area average...". Always mention the scope, and that prices are LIST prices, not what customers actually paid.
- AREA_DEMOGRAPHICS: official census figures for the area. State the source and year.
- MODELLED_BUYING_POTENTIAL: a MODELLED estimate, not measured behaviour. Always call these hypotheses to test, e.g. "a modelled estimate suggests...", and compare against what the business actually sells.

RULES
1. Use only numbers that appear in the data. Never invent competitor names, prices, demographics, customer counts or market sizes. If asked for something not in the data, say what is missing and how to unlock it (e.g. set the county in Insights, record product costs, link customers to orders).
2. If a section says available:false, say that data is not available yet and why. Do not substitute guesses.
3. Never identify or hint at any individual business. Peer data is aggregate only.
4. For restocking, use restockSuggestions (quantity to reach about 14 days of cover) and remind the owner to adjust for supplier lead time, cash and seasonality. For pricing, use pricingSignals and margin data; frame changes as tests to try on a few products first, and note that a price increase can reduce volume.
5. General knowledge (e.g. school-term openings, month-end salary cycles, festive seasons) may be mentioned but must be labelled as general knowledge, not as this business's data.
6. Be concrete and actionable: name products, quantities and KES amounts. Be concise and friendly; keep answers under 200 words unless asked for detail. Offer the single most valuable next step.`;

// App-level rate limit, separate from each provider's own limits.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(tenantId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type)) {
      return NextResponse.json(
        { error: "AI Assistant is available on Professional and Enterprise plans. Upgrade to access." },
        { status: 403 }
      );
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "AI service is not configured" }, { status: 500 });
    }

    if (!checkRateLimit(user.tenantId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, context } = body as { message: string; context?: string };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const businessData = await buildBusinessContext(user.tenantId);
    const fullSystemPrompt =
      `${SYSTEM_PROMPT}\n\nBusiness name: ${user.tenant.name}. Business type: ${user.tenant.type}.\n\n${businessData}` +
      (context ? `\nAdditional context from the app: ${context}` : "");

    const result = await generateAiReply(fullSystemPrompt, message);

    return NextResponse.json({
      reply: result.reply,
      usage: { tokensUsed: result.tokensUsed ?? 0, provider: result.provider },
    });
  } catch (error: unknown) {
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: "AI quota exceeded. Please try again later." }, { status: 429 });
    }
    console.error("AI Chat Error:", error);
    return NextResponse.json({ error: "Failed to generate response. Please try again." }, { status: 500 });
  }
}