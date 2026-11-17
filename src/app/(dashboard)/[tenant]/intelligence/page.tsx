import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessFeature } from "@/lib/plans";
import { Header } from "@/components/header";
import { AIInsights } from "@/components/ai-insights";
import { AiUsagePanel } from "@/components/intelligence/ai-usage-panel";
import { RecommendationsPanel } from "@/components/intelligence/recommendations-panel";
import { ForecastPanel } from "@/components/intelligence/forecast-panel";

export default async function IntelligencePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const enabled = canAccessFeature(user.tenant.tier, "ai-assistant", user.tenant.type);
  if (!enabled) redirect(`/${user.tenant.slug}/dashboard`);

  return (
    <div className="space-y-6">
      <Header
        title="Intelligence"
        subtitle="Grounded answers from your own sales, stock and customers"
      />
      <AIInsights tier={user.tenant.tier} />
      <RecommendationsPanel />
      <ForecastPanel />
      {can(user.role, "ai:usage:read") && <AiUsagePanel />}
    </div>
  );
}
