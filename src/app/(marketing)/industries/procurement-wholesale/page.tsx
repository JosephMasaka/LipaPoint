import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardList, Truck, Boxes } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Procurement & Wholesale — Purchase Orders to Delivery",
  description:
    "LipaPoint's procurement and wholesale solution: purchase orders, supplier invoicing, multi-location stock control and B2B selling.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/procurement-wholesale" },
  openGraph: {
    title: "LipaPoint for Procurement & Wholesale",
    description:
      "Purchase orders, supplier accounts and multi-location stock control for distributors and wholesalers.",
    url: "https://lipapoint.co.ke/industries/procurement-wholesale",
  },
};

export default function ProcurementWholesaleIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Procurement & Wholesale
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            From purchase order to goods received to supplier payment — and
            stock that stays accurate across every warehouse and counter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ClipboardList className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Purchase Orders
            </h3>
            <p className="text-text-secondary">
              Raise purchase orders, receive goods against them and match
              supplier invoices — one flow from order to payment.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Truck className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Supplier Accounts
            </h3>
            <p className="text-text-secondary">
              Track supplier balances, due dates and reorder points, with
              statements and purchase history a keystroke away.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Boxes className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Wholesale Selling
            </h3>
            <p className="text-text-secondary">
              Bulk orders, discounts and multi-location stock for distributors
              selling B2B or over the counter, all off the same till.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Stock that survives the warehouse
          </h3>
          <p className="text-text-secondary mb-6">
            Multi-location transfers, valuation at cost or selling price,
            expiry tracking and physical stock-take — every movement auditable,
            every location counted.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Stock valuation</p>
              <p className="text-lg text-text-secondary">Cost & selling price</p>
            </div>
            <div>
              <p className="font-semibold">Transfers</p>
              <p className="text-lg text-text-secondary">Multi-location</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=PROCUREMENT_WHOLESALE" className="text-sm text-gold hover:underline">
              See Procurement & Wholesale pricing →
            </Link>
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Sign up with M-Pesa — apply your coupon code at sign-up.
          </p>
        </div>
      </div>
    </section>
  );
}
