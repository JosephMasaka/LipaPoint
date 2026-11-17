/**
 * Token accounting for AI calls.
 *
 * Prices are list prices per 1M tokens, used only to show an order-of-magnitude
 * cost in the usage panel. They are estimates, not billing figures — provider
 * invoices remain the source of truth.
 */

interface ModelPrice {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

const PRICES: Record<string, ModelPrice> = {
  "gemini-2.5-flash": { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5 },
  "llama-3.3-70b-versatile": { inputPerMillionUsd: 0.59, outputPerMillionUsd: 0.79 },
};

const DEFAULT_PRICE: ModelPrice = { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.5 };

export function estimateCostUsd(input: {
  model?: string | null;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): number {
  const price = (input.model && PRICES[input.model]) || DEFAULT_PRICE;
  let prompt = input.promptTokens ?? 0;
  let output = input.outputTokens ?? 0;

  // Some providers only report a total. Split it 70/30 as a documented
  // approximation rather than pretending the split is known.
  if (prompt === 0 && output === 0 && (input.totalTokens ?? 0) > 0) {
    prompt = Math.round((input.totalTokens ?? 0) * 0.7);
    output = (input.totalTokens ?? 0) - prompt;
  }

  const cost =
    (prompt / 1_000_000) * price.inputPerMillionUsd +
    (output / 1_000_000) * price.outputPerMillionUsd;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
