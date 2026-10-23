import { redirect } from "next/navigation";
import { getCurrentUser, isImpersonating } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { DashboardMain } from "@/components/dashboard-main";
import { Tour } from "@/components/tour";
import { PlanProvider } from "@/components/plan-guard";
import { AIAssistant } from "@/components/ai-assistant";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { canAccessFeature } from "@/lib/plans";
import { getEnabledModules, modulesForTier } from "@/lib/modules";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const user = await getCurrentUser();
  const { tenant: tenantSlug } = await params;

  if (!user) {
    redirect("/login");
  }

  if (user.tenant.slug !== tenantSlug) {
    redirect(`/${user.tenant.slug}/dashboard`);
  }

  const showAI = canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type);
  const impersonating = await isImpersonating();

  // ERP nav (suppliers, POs, banking, finance) is gated per-module, not
  // per plan feature — pure-POS tenants never see the back-office links.
  // Tenants created before module provisioning have no rows yet, so fall
  // back to pure tier entitlement in that case.
  const enabledModules = await getEnabledModules(user.tenantId);
  const modules =
    enabledModules.size > 0 ? [...enabledModules] : [...modulesForTier(user.tenant.tier)];

  return (
    <PlanProvider tenantSlug={tenantSlug}>
      <div className="min-h-screen bg-surface">
        {impersonating && <ImpersonationBanner tenantName={user.tenant.name} />}
        <Sidebar tenantSlug={tenantSlug} user={user} modules={modules} />
        <DashboardMain>{children}</DashboardMain>
        <Tour />
        {showAI && <AIAssistant />}
      </div>
    </PlanProvider>
  );
}
