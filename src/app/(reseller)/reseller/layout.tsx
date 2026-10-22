import { redirect } from "next/navigation";
import { getCurrentReseller } from "@/lib/auth";
import { ResellerSidebar } from "@/components/reseller-sidebar";

export default async function ResellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reseller = await getCurrentReseller();

  if (!reseller) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-surface">
      <ResellerSidebar resellerName={reseller.name} />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
