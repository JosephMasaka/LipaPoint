export interface AiGenerateResult {
  reply: string;
  tokensUsed?: number;
  provider: "gemini" | "groq";
}

export class AiRateLimitError extends Error {}
export class AiProviderError extends Error {}

export interface AiProvider {
  name: "gemini" | "groq";
  generate(systemPrompt: string, message: string): Promise<AiGenerateResult>;
}
