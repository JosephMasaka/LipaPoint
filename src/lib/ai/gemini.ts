import { GoogleGenAI } from "@google/genai";
import { AiProvider, AiGenerateResult, AiRateLimitError, AiProviderError } from "./types";

// gemini-1.5-flash was retired September 24, 2025 — this is why the
// previous implementation was failing. gemini-2.5-flash is the current
// stable choice as of this writing; Google's model lineup moves fast
// (gemini-3-flash-preview and others already exist), so it's worth
// checking https://ai.google.dev/gemini-api/docs/models periodically
// rather than assuming this stays current indefinitely.
const MODEL = "gemini-2.5-flash";

export function createGeminiProvider(apiKey: string): AiProvider {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    async generate(systemPrompt: string, message: string): Promise<AiGenerateResult> {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: message,
          config: { systemInstruction: systemPrompt },
        });

        // NOTE: response.text is a property in @google/genai — the old
        // @google/generative-ai SDK used response.text() as a method call.
        // Mixing these up silently returns a function reference instead
        // of a string.
        const reply = response.text;
        if (!reply) {
          throw new AiProviderError("Gemini returned an empty response");
        }

        return {
          reply,
          tokensUsed: response.usageMetadata?.totalTokenCount,
          provider: "gemini",
        };
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        const e = err as { status?: number; message?: string };
        if (e.status === 429 || /quota|rate.?limit/i.test(e.message ?? "")) {
          throw new AiRateLimitError(e.message ?? "Gemini rate limit");
        }
        throw new AiProviderError(e.message ?? "Gemini request failed");
      }
    },
  };
}
