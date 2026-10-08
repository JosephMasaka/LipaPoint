import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import type { AiGenerateResult } from "./types";

export async function generateAiReply(
  systemPrompt: string,
  message: string
): Promise<AiGenerateResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const errors: string[] = [];

  if (geminiKey) {
    try {
      return await createGeminiProvider(geminiKey).generate(systemPrompt, message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      errors.push(`Gemini: ${msg}`);
      console.error("Gemini provider failed, falling back to Groq if available:", err);
    }
  }

  if (groqKey) {
    try {
      return await createGroqProvider(groqKey).generate(systemPrompt, message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      errors.push(`Groq: ${msg}`);
      console.error("Groq provider failed:", err);
    }
  }

  throw new Error(
    errors.length > 0
      ? `All AI providers failed — ${errors.join("; ")}`
      : "No AI provider is configured (set GEMINI_API_KEY and/or GROQ_API_KEY)"
  );
}
