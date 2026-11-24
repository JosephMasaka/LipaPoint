import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { AGENT_FEATURE, isAgentEnabled, listAgents, monthlyRunLimitFor } from "@/lib/ai/agents";
import { monthWindow } from "@/lib/ai/quota";
import { db } from "@/lib/db";

/** Registry view: what each agent may do and how much of its limit is used. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canAccessFeature(user.tenant.tier, AGENT_FEATURE, user.tenant.type)) {
      return NextResponse.json({ error: "AI is not included in this plan." }, { status: 403 });
    }

    const { start, end } = monthWindow();
    const runs = await db.aiAgentRun.groupBy({
      by: ["agent"],
      where: { tenantId: user.tenantId, createdAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    const usedByAgent = new Map(runs.map((row) => [row.agent, row._count._all]));

    const agents = listAgents().map((agent) => {
      const limit = monthlyRunLimitFor(agent.id, user.tenant.tier);
      const used = usedByAgent.get(agent.id) ?? 0;
      return {
        id: agent.id,
        version: agent.version,
        label: agent.label,
        description: agent.description,
        enabled: isAgentEnabled(agent.id),
        readTools: agent.readTools,
        actionTools: agent.actionTools,
        usage: { used, limit, remaining: Math.max(0, limit - used) },
      };
    });

    return NextResponse.json({ agents, monthEndsAt: end.toISOString() });
  } catch (error) {
    console.error("AI agents GET error:", error);
    return NextResponse.json({ error: "Failed to load the agent registry" }, { status: 500 });
  }
}
