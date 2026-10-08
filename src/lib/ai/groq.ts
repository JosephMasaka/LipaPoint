import Groq from "groq-sdk";
import { AiProvider, AiGenerateResult, AiRateLimitError, AiProviderError } from "./types";

// llama-3.3-70b-versatile is Groq's current flagship general-purpose model.
// Groq's free tier also has its own rate limits (requests/day and
// tokens/minute) — this isn't unlimited fallback capacity, just additional
// capacity on top of Gemini's.
const MODEL = "llama-3.3-70b-versatile";

export function createGroqProvider(apiKey: string): AiProvider {
  const groq = new Groq({ apiKey });

  return {
    name: "groq",
    async generate(systemPrompt: string, message: string): Promise<AiGenerateResult> {
      try {
        const completion = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        });

        const reply = completion.choices[0]?.message?.content;
        if (!reply) {
          throw new AiProviderError("Groq returned an empty response");
        }

        return {
          reply,
          tokensUsed: completion.usage?.total_tokens,
          provider: "groq",
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
