import { Sidebar } from "@/components/sidebar";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar tenantSlug={tenant} />
      <main className="ml-64">{children}</main>
    </div>
  );
}
