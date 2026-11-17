import { getIntelligence, type IntelligenceRequest } from "./intelligence-cache";
import { buildPromptPayload } from "./prompt";

/**
 * Compact, deterministic evidence snapshot handed to the model. The same
 * snapshot backs the Insights dashboard, so chat and insights agree.
 *
 * Scope is resolved by the caller (src/lib/ai/scope.ts) and is always
 * tenant-scoped; this function never reads a tenant id from the request body.
 */
export async function buildBusinessContext(
  tenantId: string,
  opts: IntelligenceRequest = {}
): Promise<string> {
  try {
    const { intel } = await getIntelligence(tenantId, opts);
    return [
      "VERIFIED BUSINESS INTELLIGENCE (JSON). Each section states its provenance — respect it when answering.",
      JSON.stringify(buildPromptPayload(intel)),
    ].join("\n");
  } catch (err) {
    // Don't take the whole chat down if analytics fail — answer with general advice instead.
    console.error("Failed to build business intelligence for chat:", err);
    return "Business data is temporarily unavailable. Give general advice only and say that you could not access this business's data.";
  }
}
