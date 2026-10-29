import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Boxes, Truck, ClipboardList } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Logistics & Warehousing — Stock in Motion",
  description:
    "LipaPoint's logistics and warehousing solution: multi-location stock control, transfers, order fulfilment and valuation for transport and storage businesses.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/logistics-warehousing" },
  openGraph: {
    title: "LipaPoint for Logistics & Warehousing",
    description:
      "Multi-location stock control, transfers and order fulfilment for transport, courier and storage businesses.",
    url: "https://lipapoint.co.ke/industries/logistics-warehousing",
  },
};

export default function LogisticsWarehousingIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Logistics & Warehousing
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Every bay, every transfer, every consignment counted — stock that
            stays accurate while it is on the move.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Boxes className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Warehouse Stock Control
            </h3>
            <p className="text-text-secondary">
              Quantities by location with re-order alerts, expiry tracking and
              live valuation — know what is where without walking the floor.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Truck className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Transfers & Delivery
            </h3>
            <p className="text-text-secondary">
              Move goods between locations and dispatch deliveries without
              losing the trail — every movement recorded against stock.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ClipboardList className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Orders & Fulfilment
            </h3>
            <p className="text-text-secondary">
              Take orders, fulfil them from the nearest location and invoice
              with eTIMS when the goods land.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Reports for every movement
          </h3>
          <p className="text-text-secondary mb-6">
            Stock received, transferred, adjusted and valued at cost or selling
            price — plus physical stock-take, so the system and the floor agree.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Locations</p>
              <p className="text-lg text-text-secondary">Unlimited on Enterprise</p>
            </div>
            <div>
              <p className="font-semibold">Valuation</p>
              <p className="text-lg text-text-secondary">Cost & selling price</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4 text-sm text-text-muted">
            Sign up with M-Pesa — apply your coupon code at sign-up.
          </p>
        </div>
      </div>
    </section>
  );
}
