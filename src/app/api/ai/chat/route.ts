import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";

const SYSTEM_PROMPT = `You are LipaPoint AI, a smart business assistant for a POS system. You help business owners with: sales insights, inventory advice, pricing suggestions, customer trends, and general business tips. Be concise, actionable, and friendly. Keep responses under 200 words unless asked for detail. The business operates in Kenya with KES currency.`;

// Simple in-memory rate limiting per tenant
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15; // 15 requests per minute (matching Gemini free tier)
const RATE_WINDOW = 60 * 1000; // 1 minute

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
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

    const businessContext = `\nBusiness name: ${user.tenant.name}. Business type: ${user.tenant.type}.`;
    const fullSystemPrompt = SYSTEM_PROMPT + businessContext + (context ? `\nAdditional context: ${context}` : "");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: fullSystemPrompt,
    });

    const result = await model.generateContent(message);
    const response = result.response;
    const reply = response.text();
    const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

    return NextResponse.json({
      reply,
      usage: { tokensUsed },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 429 || err.message?.includes("quota")) {
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
