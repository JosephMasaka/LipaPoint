import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

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
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar tenantSlug={tenantSlug} user={user} />
      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  );
}
