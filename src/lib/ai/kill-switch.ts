import { db } from "@/lib/db";

/**
 * Kill switch for model calls.
 *
 * Two levels, both enforced in backend code rather than the prompt:
 * - global: `AI_DISABLED=true` stops every tenant (incident response).
 * - tenant: `Tenant.aiEnabled = false` stops one business (Settings → General).
 *
 * Only provider calls stop. Intelligence, recommendations and reports are
 * computed from the database and keep working, which is the point: the business
 * keeps its panels during an AI incident.
 */

export class AiDisabledError extends Error {
  readonly code = "AI_DISABLED";
  readonly status = 503;
  constructor(message = "AI features are switched off for this business.") {
    super(message);
    this.name = "AiDisabledError";
  }
}

export function isAiDisabledGlobally(): boolean {
  const flag = (process.env.AI_DISABLED ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export async function isAiEnabledForTenant(tenantId: string): Promise<boolean> {
  if (isAiDisabledGlobally()) return false;
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { aiEnabled: true },
    });
    return tenant?.aiEnabled ?? true;
  } catch (error) {
    // A database blip must not silently enable AI for a tenant that turned it
    // off, but it also must not take chat down. Log and allow; the flag is a
    // safety control, not a security boundary.
    console.error("AI kill switch check failed — allowing request:", error);
    return true;
  }
}

export async function assertAiEnabled(tenantId: string): Promise<void> {
  if (!(await isAiEnabledForTenant(tenantId))) throw new AiDisabledError();
}
