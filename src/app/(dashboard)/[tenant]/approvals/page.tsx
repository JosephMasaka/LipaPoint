import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans";
import { Header } from "@/components/header";
import { ApprovalsInbox } from "@/components/intelligence/approvals-inbox";
import { AgentRunsPanel } from "@/components/intelligence/agent-runs-panel";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const enabled = canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type);
  if (!enabled) redirect(`/${user.tenant.slug}/dashboard`);

  return (
    <div className="space-y-6">
      <Header
        title="AI approvals"
        subtitle="Review and decide actions proposed by the AI assistant"
      />
      <ApprovalsInbox />
      <AgentRunsPanel />
    </div>
  );
}
