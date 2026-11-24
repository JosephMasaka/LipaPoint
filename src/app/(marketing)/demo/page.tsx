import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, ArrowRight } from "lucide-react";

// The demo tenants are live data, so this page must not be statically cached.
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  SUPERMARKET: "Supermarket",
  RETAIL: "Retail shop",
  BAR: "Bar & lounge",
  RESTAURANT: "Restaurant",
  PHARMACY: "Pharmacy",
  HARDWARE: "Hardware",
  BARBERSHOP: "Barbershop",
};

export default async function DemoPage() {
  const tenants = await db.tenant.findMany({
    where: { demoMode: true, isActive: true, type: { not: "PLATFORM" } },
    select: { slug: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 mx-auto mb-6">
            <Monitor className="h-7 w-7 text-gold" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-4">Explore a live demo</h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            Every workspace below is seeded with real transactions, staff records and fixed assets,
            and each one opens fully unlocked — no sign-up, no password. Pick a business type and
            you are in.
          </p>
        </div>

        {tenants.length === 0 ? (
          <p className="text-center text-text-secondary">
            No demo workspaces are available right now. Please request a demo instead.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tenants.map((tenant) => (
              <Card key={tenant.slug} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{tenant.name}</CardTitle>
                  <CardDescription>{TYPE_LABELS[tenant.type] ?? tenant.type}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <form action="/api/demo/login" method="post">
                    <input type="hidden" name="tenant" value={tenant.slug} />
                    <Button type="submit" className="w-full">
                      Open workspace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-text-secondary mt-10">
          Want to sign in as a specific staff role, such as a cashier or stock keeper? Those
          credentials are listed in the demo account sheet.
        </p>
      </div>
    </div>
  );
}
