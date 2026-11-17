import Groq from "groq-sdk";
import { AiProvider, AiGenerateResult, AiGenerateOptions, AiRateLimitError, AiProviderError } from "./types";

// Groq retires model ids periodically (e.g. llama-3.3-70b-versatile), so the
// id is configurable and defaults to a currently served general-purpose model
// with tool-calling support. Groq's free tier also has its own rate limits
// (requests/day and tokens/minute) — this isn't unlimited fallback capacity,
// just additional capacity on top of Gemini's.
const MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new AiProviderError("Groq returned invalid tool arguments");
  }
}

export function createGroqProvider(apiKey: string): AiProvider {
  const groq = new Groq({ apiKey });

  return {
    name: "groq",
    async generate(
      systemPrompt: string,
      message: string,
      options: AiGenerateOptions = {}
    ): Promise<AiGenerateResult> {
      try {
        const tools = options.tools?.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));

        const completion = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
        });

        const choice = completion.choices[0]?.message;
        const reply = choice?.content ?? "";
        const toolCalls = (choice?.tool_calls ?? [])
          .filter((call) => call.type === "function")
          .map((call) => ({
            name: call.function.name,
            args: parseArgs(call.function.arguments),
          }));

        if (!reply && toolCalls.length === 0) {
          throw new AiProviderError("Groq returned an empty response");
        }

        return {
          reply,
          tokensUsed: completion.usage?.total_tokens,
          promptTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
          provider: "groq",
          model: MODEL,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        const e = err as { status?: number; message?: string };
        if (e.status === 429) {
          throw new AiRateLimitError(e.message ?? "Groq rate limit");
        }
        throw new AiProviderError(e.message ?? "Groq request failed");
      }
    },
  };
}
