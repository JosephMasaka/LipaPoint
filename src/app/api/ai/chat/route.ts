import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { generateAiReply } from "@/lib/ai/orchestrator";
import { buildBusinessContext } from "@/lib/ai/business-context";
import { AiRateLimitError } from "@/lib/ai/types";

const SYSTEM_PROMPT = `You are LipaPoint AI, an expert point-of-sale business assistant for small and medium businesses in Kenya. You help with: sales insights, inventory and restocking advice, pricing suggestions, customer retention, and general business tips. Ground your advice in the real sales and stock data provided below when it's relevant to the question — cite specific product names and numbers rather than generic advice when the data supports it. Be concise, actionable, and friendly. Keep responses under 200 words unless asked for detail. The business operates in Kenya with KES currency.`;

// App-level rate limit, separate from each provider's own limits. With two
// providers now available via fallback, 15/min is conservative rather than
// a hard ceiling matching a single provider's free tier — left as-is since
// raising it depends on your actual Groq/Gemini plan limits, not something
// to guess at.
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

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type)) {
      return NextResponse.json(
        { error: "AI Assistant is available on Professional and Enterprise plans. Upgrade to access." },
        { status: 403 }
      );
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const businessData = await buildBusinessContext(user.tenantId);
    const fullSystemPrompt =
      `${SYSTEM_PROMPT}\n\nBusiness name: ${user.tenant.name}. Business type: ${user.tenant.type}.\n\n${businessData}` +
      (context ? `\nAdditional context: ${context}` : "");

    const result = await generateAiReply(fullSystemPrompt, message);

    return NextResponse.json({
      reply: result.reply,
      usage: { tokensUsed: result.tokensUsed ?? 0, provider: result.provider },
    });
  } catch (error: unknown) {
    if (error instanceof AiRateLimitError) {
      return NextResponse.json(
        { error: "AI quota exceeded. Please try again later." },
        { status: 429 }
      );
    }

    console.error("AI Chat Error:", error);
    return NextResponse.json(
      { error: "Failed to generate response. Please try again." },
      { status: 500 }
    );
  }
}