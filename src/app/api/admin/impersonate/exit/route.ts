import { NextResponse } from "next/server";
import { exitImpersonation, getCurrentUser } from "@/lib/auth";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";

export async function POST() {
  const impersonated = await getCurrentUser();
  const result = await exitImpersonation();
  if (!result.ok) {
    return NextResponse.json({ error: "No active impersonation session" }, { status: 400 });
  }

  if (impersonated) {
    await writeAuditLog({
      tenantId: impersonated.tenantId,
      userId: impersonated.id,
      action: AUDIT_ACTIONS.AUTH.IMPERSONATION_END,
      entity: "user",
      entityId: impersonated.id,
      details: `Super-admin left tenant ${impersonated.tenant.slug}`,
    });
  }

  return NextResponse.json({ ok: true });
}
