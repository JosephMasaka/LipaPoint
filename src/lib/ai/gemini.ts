import { GoogleGenAI, Type, type Schema, FunctionCallingConfigMode } from "@google/genai";
import { AiProvider, AiGenerateResult, AiGenerateOptions, AiRateLimitError, AiProviderError } from "./types";

// gemini-1.5-flash was retired September 24, 2025 — this is why the
// previous implementation was failing. gemini-2.5-flash is the current
// stable choice as of this writing; Google's model lineup moves fast
// (gemini-3-flash-preview and others already exist), so it's worth
// checking https://ai.google.dev/gemini-api/docs/models periodically
// rather than assuming this stays current indefinitely.
const MODEL = "gemini-2.5-flash";

const TYPE_MAP: Record<string, Type> = {
  object: Type.OBJECT,
  string: Type.STRING,
  integer: Type.INTEGER,
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
};

function toSchema(input: unknown): Schema {
  const value = (input ?? {}) as {
    type?: string;
    description?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const schema: Schema = {
    type: TYPE_MAP[value.type ?? "string"] ?? Type.STRING,
  };
  if (value.description) schema.description = value.description;
  if (value.properties) {
    schema.properties = Object.fromEntries(
      Object.entries(value.properties).map(([key, child]) => [key, toSchema(child)])
    );
  }
  if (value.required) schema.required = value.required;
  return schema;
}

export function createGeminiProvider(apiKey: string): AiProvider {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    async generate(
      systemPrompt: string,
      message: string,
      options: AiGenerateOptions = {}
    ): Promise<AiGenerateResult> {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: message,
          config: {
            systemInstruction: systemPrompt,
            ...(options.tools && options.tools.length > 0
              ? {
                  tools: [
                    {
                      functionDeclarations: options.tools.map((tool) => ({
                        name: tool.name,
                        description: tool.description,
                        parameters: toSchema(tool.parameters),
                      })),
                    },
                  ],
                  toolConfig: {
                    functionCallingConfig: {
                      mode: "AUTO" as FunctionCallingConfigMode,
                      allowedFunctionNames: options.tools.map((t) => t.name),
                    },
                  },
                }
              : {}),
          },
        });

        // NOTE: response.text is a property in @google/genai — the old
        // @google/generative-ai SDK used response.text() as a method call.
        // Mixing these up silently returns a function reference instead
        // of a string.
        const reply = response.text ?? "";
        const toolCalls = (response.functionCalls ?? []).map((call) => ({
          name: call.name ?? "",
          args: (call.args ?? {}) as Record<string, unknown>,
        })).filter((call) => call.name.length > 0);

        if (!reply && toolCalls.length === 0) {
          throw new AiProviderError("Gemini returned an empty response");
        }

        return {
          reply,
          tokensUsed: response.usageMetadata?.totalTokenCount,
          promptTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
          provider: "gemini",
          model: MODEL,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
