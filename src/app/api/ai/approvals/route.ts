import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApprovalError, createApprovalRequest, listApprovals } from "@/lib/ai/approvals";
import { isActionTool, proposeAction } from "@/lib/ai/actions";

const MAX_PAYLOAD_CHARS = 8000;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const limit = Number.parseInt(params.get("limit") ?? "", 10);
    const approvals = await listApprovals(user.tenantId, {
      status: params.get("status") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ approvals });
  } catch (error) {
    console.error("AI approvals GET error:", error);
    return NextResponse.json({ error: "Failed to load approvals" }, { status: 500 });
  }
}

/**
 * Queues a proposed action for human approval. This is the entry point a
 * future agent runtime calls instead of acting; nothing executes here.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { agent, toolName, summary, payload, ttlMinutes } = body as Record<string, unknown>;

    if (typeof agent !== "string" || typeof toolName !== "string" || typeof summary !== "string") {
      return NextResponse.json({ error: "agent, toolName and summary are required." }, { status: 400 });
    }
    if (payload === undefined || JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) {
      return NextResponse.json({ error: `payload is required and must be under ${MAX_PAYLOAD_CHARS} characters.` }, { status: 400 });
    }
    if (ttlMinutes !== undefined && (typeof ttlMinutes !== "number" || !Number.isFinite(ttlMinutes))) {
      return NextResponse.json({ error: "ttlMinutes must be a number." }, { status: 400 });
    }

    // An action's payload is validated here, exactly as the chat path does:
    // a malformed request must never reach an approver looking legitimate.
    if (isActionTool(toolName)) {
      const { approval } = await proposeAction({
        tenantId: user.tenantId,
        userId: user.id,
        toolName,
        args: payload as Record<string, unknown>,
      });
      return NextResponse.json({ approval }, { status: 201 });
    }

    const approval = await createApprovalRequest({
      tenantId: user.tenantId,
      requestedById: user.id,
      agent,
      toolName,
      summary,
      payload,
      ttlMinutes: ttlMinutes as number | undefined,
    });
    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    if (error instanceof ApprovalError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("AI approvals POST error:", error);
    return NextResponse.json({ error: "Failed to create approval request" }, { status: 500 });
  }
}
