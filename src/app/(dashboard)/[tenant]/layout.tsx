import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { DashboardMain } from "@/components/dashboard-main";

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

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar tenantSlug={tenantSlug} user={user} />
      <DashboardMain>{children}</DashboardMain>
    </div>
  );
}
