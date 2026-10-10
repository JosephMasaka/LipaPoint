import { getIntelligence } from "./intelligence-cache";
import { buildPromptPayload } from "./prompt";

/**
 * Same export name/signature as before, so the chat route's import is
 * unchanged. Now backed by the shared (cached) intelligence engine, so chat
 * and the Insights dashboard always agree.
 */
export async function buildBusinessContext(tenantId: string): Promise<string> {
  try {
    const { intel } = await getIntelligence(tenantId);
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