import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import { AiRateLimitError } from "./types";
import type { AiGenerateResult, AiProvider } from "./types";

export async function generateAiReply(
  systemPrompt: string,
  message: string
): Promise<AiGenerateResult> {
  const providers: AiProvider[] = [];
  if (process.env.GEMINI_API_KEY) providers.push(createGeminiProvider(process.env.GEMINI_API_KEY));
  if (process.env.GROQ_API_KEY) providers.push(createGroqProvider(process.env.GROQ_API_KEY));

  if (providers.length === 0) {
    throw new Error("No AI provider is configured (set GEMINI_API_KEY and/or GROQ_API_KEY)");
  }

  const errors: string[] = [];
  let allRateLimited = true;

  for (const provider of providers) {
    try {
      return await provider.generate(systemPrompt, message);
    } catch (err) {
      if (!(err instanceof AiRateLimitError)) allRateLimited = false;
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : "unknown error"}`);
      console.error(`${provider.name} provider failed${providers.length > 1 ? ", trying next provider" : ""}:`, err);
    }
  }

  // Preserve the error type so callers can show "quota exceeded" rather than a generic failure.
  if (allRateLimited) throw new AiRateLimitError(`All AI providers are rate limited — ${errors.join("; ")}`);
  throw new Error(`All AI providers failed — ${errors.join("; ")}`);
}