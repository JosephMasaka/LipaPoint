import { NextResponse } from "next/server";
import { requireUserWithPlanFeature } from "@/lib/api-guards";
import { generateAiReply } from "@/lib/ai/orchestrator";
import { buildBusinessContext } from "@/lib/ai/business-context";
import { resolveAiScope, AiScopeError } from "@/lib/ai/scope";
import { checkQuota, recordUsage, recordToolInvocation } from "@/lib/ai/quota";
import { newRunId } from "@/lib/ai/usage";
import { citationsFor } from "@/lib/ai/citations";
import { runTool, toolDeclarations, toolResultForPrompt, AiToolError, type ToolExecution } from "@/lib/ai/tools/registry";
import { getIntelligence } from "@/lib/ai/intelligence-cache";
import { AiRateLimitError, AiTimeoutError, type AiCitation, type AiScopeInfo } from "@/lib/ai/types";

const SYSTEM_PROMPT = `You are LipaPoint AI, an expert point-of-sale and retail advisor for small and medium businesses in Kenya. Currency is KES; customers commonly pay by M-Pesa, cash and card.

You advise on: sales performance, restocking and quantities, pricing and margins, product range, customer retention and churn, and what is selling in the business's local area.

HOW TO USE THE DATA YOU ARE GIVEN
The business data below is JSON, split into sections with different reliability. Always say which kind of evidence you are relying on:
- YOUR_DATA: measured from this business's own sales. State it as fact ("you sold...").
- AREA_BENCHMARK: an anonymised aggregate of comparable LipaPoint businesses, with a stated scope (county or Kenya-wide). Say "comparable businesses in the area average...". Always mention the scope, and that prices are LIST prices, not what customers actually paid.
- AREA_DEMOGRAPHICS: official census figures for the area. State the source and year.
- MODELLED_BUYING_POTENTIAL: a MODELLED estimate, not measured behaviour. Always call these hypotheses to test, e.g. "a modelled estimate suggests...", and compare against what the business actually sells.
- TOOL RESULTS: verified output from a read-only tool, already scoped to this business, date range and branch. Treat it exactly like YOUR_DATA.

RULES
1. Use only numbers that appear in the data. Never invent competitor names, prices, demographics, customer counts or market sizes. If asked for something not in the data, say what is missing and how to unlock it (e.g. set the county in Insights, record product costs, link customers to orders).
2. If a section says available:false, say that data is not available yet and why. Do not substitute guesses.
3. Never identify or hint at any individual business. Peer data is aggregate only.
4. For restocking, use restockSuggestions (quantity to reach about 14 days of cover) and remind the owner to adjust for supplier lead time, cash and seasonality. For pricing, use pricingSignals and margin data; frame changes as tests to try on a few products first, and note that a price increase can reduce volume.
5. General knowledge (e.g. school-term openings, month-end salary cycles, festive seasons) may be mentioned but must be labelled as general knowledge, not as this business's data.
6. Be concrete and actionable: name products, quantities and KES amounts. Be concise and friendly; keep answers under 200 words unless asked for detail. Offer the single most valuable next step.
7. Always state the exact period and branch you are reporting on when quoting figures.`;

const MAX_TOOL_CALLS = 5;
const MAX_MESSAGE_LENGTH = 2000;

// Burst limiter, per user, per server instance. The monthly quota in
// src/lib/ai/quota.ts is the authoritative ceiling.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function scopeLine(scope: AiScopeInfo): string {
  return `Resolved scope (server-side): period ${scope.from.slice(0, 10)} to ${scope.to.slice(0, 10)}; location ${scope.locationName ?? "all branches"}; currency ${scope.currency}.`;
}

function errorBody(error: string, code: string, runId: string) {
  return { error, code, runId };
}

export async function POST(request: Request) {
  const runId = newRunId();

  let body: { message?: unknown; from?: unknown; to?: unknown; locationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(errorBody("Invalid JSON body", "INVALID_BODY", runId), { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(errorBody("Message is required", "MISSING_MESSAGE", runId), { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      errorBody(`Message must be under ${MAX_MESSAGE_LENGTH} characters`, "MESSAGE_TOO_LONG", runId),
      { status: 400 }
    );
  }

  const guard = await requireUserWithPlanFeature("ai-assistant");
  if (guard.response) return guard.response;
  const user = guard.user;

  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      errorBody("AI service is not configured", "AI_NOT_CONFIGURED", runId),
      { status: 500 }
    );
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      errorBody("Rate limit exceeded. Please wait a moment before trying again.", "RATE_LIMITED", runId),
      { status: 429 }
    );
  }

  const startedAt = Date.now();
  let scope: AiScopeInfo | null = null;
  let provider = "none";
  let model: string | null = null;
  let promptTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let toolCallCount = 0;

  try {
    const resolved = await resolveAiScope(user, {
      from: body.from,
      to: body.to,
      locationId: body.locationId,
    });
    scope = resolved.scope;

    const quota = await checkQuota(user.tenantId, user.tenant.tier);
    if (!quota.allowed) {
      await recordUsage({
        tenantId: user.tenantId,
        userId: user.id,
        runId,
        surface: "chat",
        provider: "none",
        status: "QUOTA_EXCEEDED",
        errorCode: "QUOTA_EXCEEDED",
        latencyMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: `Monthly AI allowance reached (${quota.limit} requests). It resets on ${quota.resetsAt.slice(0, 10)}.`,
          code: "QUOTA_EXCEEDED",
          runId,
          quota,
        },
        { status: 429 }
      );
    }

    // Only pass explicit dates: the default window's "to" is "now",
    // which would make every request a distinct cache key.
    const range = {
      from: body.from ? new Date(scope.from) : undefined,
      to: body.to ? new Date(scope.to) : undefined,
      locationId: scope.locationId ?? undefined,
    };
    const businessData = await buildBusinessContext(user.tenantId, range);

    const systemPrompt =
      `${SYSTEM_PROMPT}\n\n${scopeLine(scope)}\n` +
      `Business name: ${user.tenant.name}. Business type: ${user.tenant.type}.\n\n${businessData}`;

    const toolsEnabled = process.env.AI_TOOLS_ENABLED !== "false";
    const declarations = toolsEnabled ? toolDeclarations() : undefined;

    let result = await generateAiReply(systemPrompt, message, { tools: declarations });
    provider = result.provider;
    model = result.model ?? null;
    promptTokens += result.promptTokens ?? 0;
    outputTokens += result.outputTokens ?? 0;
    totalTokens += result.tokensUsed ?? (result.promptTokens ?? 0) + (result.outputTokens ?? 0);

    const executed: ToolExecution[] = [];
    const requestedCalls = (result.toolCalls ?? []).slice(0, MAX_TOOL_CALLS);

    if (toolsEnabled && requestedCalls.length > 0) {
      const { intel } = await getIntelligence(user.tenantId, range);

      for (const call of requestedCalls) {
        toolCallCount++;
        const toolStarted = Date.now();
        try {
          const args =
            call.args && typeof call.args === "object" && !Array.isArray(call.args)
              ? (call.args as Record<string, unknown>)
              : {};
          const execution = runTool(call.name, args, intel);
          executed.push(execution);
          await recordToolInvocation({
            tenantId: user.tenantId,
            runId,
            toolName: call.name,
            args,
            ok: true,
            resultRows: execution.rows,
            latencyMs: Date.now() - toolStarted,
          });
        } catch (error) {
          const code = error instanceof AiToolError ? error.code : "TOOL_FAILED";
          console.error(`AI tool ${call.name} failed:`, error);
          await recordToolInvocation({
            tenantId: user.tenantId,
            runId,
            toolName: call.name,
            args: {},
            ok: false,
            errorCode: code,
            latencyMs: Date.now() - toolStarted,
          });
        }
      }

      if (executed.length > 0) {
        const followup =
          `${message}\n\nTOOL RESULTS (verified, tenant-scoped, read-only). Use these numbers for the answer:\n` +
          toolResultForPrompt(executed, scope);
        const final = await generateAiReply(`${systemPrompt}\n\nAnswer using the TOOL RESULTS provided in the user message.`, followup);
        provider = final.provider;
        model = final.model ?? model;
        promptTokens += final.promptTokens ?? 0;
        outputTokens += final.outputTokens ?? 0;
        totalTokens += final.tokensUsed ?? (final.promptTokens ?? 0) + (final.outputTokens ?? 0);
        result = final;
      }
    }

    const citations: AiCitation[] = citationsFor(executed, scope);

    await recordUsage({
      tenantId: user.tenantId,
      userId: user.id,
      runId,
      surface: "chat",
      provider,
      model,
      promptTokens,
      outputTokens,
      totalTokens,
      latencyMs: Date.now() - startedAt,
      status: "SUCCESS",
      toolCallCount,
    });

    return NextResponse.json({
      reply: result.reply,
      citations,
      scope,
      usage: { tokensUsed: totalTokens, provider, runId },
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startedAt;
    const base = { tenantId: user.tenantId, userId: user.id, runId, surface: "chat" as const, provider, model, promptTokens, outputTokens, totalTokens, latencyMs, toolCallCount };

    if (error instanceof AiScopeError) {
      await recordUsage({ ...base, status: "ERROR", errorCode: error.code });
      return NextResponse.json(errorBody(error.message, error.code, runId), { status: error.status });
    }
    if (error instanceof AiRateLimitError) {
      await recordUsage({ ...base, status: "RATE_LIMITED", errorCode: "RATE_LIMITED" });
      return NextResponse.json(
        errorBody("AI quota exceeded at the provider. Please try again later.", "RATE_LIMITED", runId),
        { status: 429 }
      );
    }
    if (error instanceof AiTimeoutError) {
      await recordUsage({ ...base, status: "TIMEOUT", errorCode: "TIMEOUT" });
      return NextResponse.json(
        errorBody("The AI service took too long to respond. Please try again.", "TIMEOUT", runId),
        { status: 504 }
      );
    }

    await recordUsage({ ...base, status: "ERROR", errorCode: "AI_FAILED" });
    console.error("AI Chat Error:", error);
    return NextResponse.json(
      errorBody("Failed to generate response. Please try again.", "AI_FAILED", runId),
      { status: 500 }
    );
  }
}
