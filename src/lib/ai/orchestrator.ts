import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import { AiRateLimitError, AiTimeoutError } from "./types";
import type { AiGenerateOptions, AiGenerateResult, AiProvider } from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;

function configuredTimeout(): number {
  const raw = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_TIMEOUT_MS;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AiTimeoutError(`AI request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Calls the configured providers in order (Gemini, then Groq) and returns the
 * first successful result. A timeout or failure on one provider falls through
 * to the next; rate limits are reported distinctly so the route can answer 429.
 */
export async function generateAiReply(
  systemPrompt: string,
  message: string,
  options: AiGenerateOptions = {}
): Promise<AiGenerateResult> {
  const providers: AiProvider[] = [];
  if (process.env.GEMINI_API_KEY) providers.push(createGeminiProvider(process.env.GEMINI_API_KEY));
  if (process.env.GROQ_API_KEY) providers.push(createGroqProvider(process.env.GROQ_API_KEY));

  if (providers.length === 0) {
    throw new Error("No AI provider is configured (set GEMINI_API_KEY and/or GROQ_API_KEY)");
  }

  const timeoutMs = options.timeoutMs ?? configuredTimeout();
  const retries = Math.max(0, options.retries ?? 1);
  const errors: string[] = [];
  let allRateLimited = true;
  let lastTimeout = false;

  for (const provider of providers) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const call = provider.generate(systemPrompt, message, {
          tools: options.tools,
          timeoutMs,
        });
        return await withTimeout(call, timeoutMs);
      } catch (err) {
        if (err instanceof AiRateLimitError) {
          errors.push(`${provider.name}: ${err.message}`);
          break;
        }

        allRateLimited = false;
        lastTimeout = err instanceof AiTimeoutError;
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : "unknown error"}`);

        // Retry transient provider errors once; never retry a timeout (it
        // would double the user-visible wait before the fallback runs).
        if (attempt < retries && !lastTimeout) {
          console.warn(`${provider.name} provider failed, retrying:`, err);
          continue;
        }

        console.error(
          `${provider.name} provider failed${providers.length > 1 ? ", trying next provider" : ""}:`,
          err
        );
        break;
      }
    }
  }

  // Preserve the error type so callers can show the right status.
  if (allRateLimited) throw new AiRateLimitError(`All AI providers are rate limited — ${errors.join("; ")}`);
  if (lastTimeout) throw new AiTimeoutError(`All AI providers timed out — ${errors.join("; ")}`);
  throw new Error(`All AI providers failed — ${errors.join("; ")}`);
}
