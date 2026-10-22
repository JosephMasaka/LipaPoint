import { redirect } from "next/navigation";
import { getCurrentReseller } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ResellerTenantsPage() {
  const reseller = await getCurrentReseller();
  if (!reseller) redirect("/login");

  const tenants = await db.tenant.findMany({
    where: { resellerId: reseller.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      tier: true,
      email: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true, users: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Tenants</h1>
        <p className="text-text-secondary text-sm mt-1">
          Every business that registered with your code ({tenants.length} total)
        </p>
      </div>

      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Referred Businesses</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {tenants.length === 0 ? (
            <p className="text-sm text-text-muted px-0 sm:px-0">
              No businesses have used your code yet. Share{" "}
              <span className="font-mono text-gold">{reseller.code}</span> — it&apos;s entered on the
              registration form.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Business</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Email</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Tier</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Orders</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Staff</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-2 px-3 text-text-primary font-medium">{tenant.name}</td>
                      <td className="py-2 px-3 text-text-muted">{tenant.email}</td>
                      <td className="py-2 px-3 text-text-secondary capitalize">
                        {tenant.type.toLowerCase()}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary" className="text-xs">{tenant.tier}</Badge>
                      </td>
                      <td className="py-2 px-3 text-text-secondary">
                        {tenant._count.orders.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">{tenant._count.users}</td>
                      <td className="py-2 px-3">
                        <Badge
                          className={
                            tenant.isActive
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          }
                        >
                          {tenant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
