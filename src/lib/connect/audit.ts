import { AUDIT_ACTIONS, writeAuditLog, type AuditLogInput } from "../audit";

/** Connect writes every state change through the shared ActivityLog. */
export const CONNECT_ACTIONS = AUDIT_ACTIONS.CONNECT;

export type ConnectAuditInput = Omit<AuditLogInput, "module" | "action"> & { action: string };

export async function connectAudit(input: ConnectAuditInput): Promise<void> {
  await writeAuditLog({ ...input, module: "connect" });
}
