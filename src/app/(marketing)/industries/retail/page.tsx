import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  CreditCard,
  BarChart3,
  Users,
  Landmark,
  ShieldCheck,
  Banknote,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint ERP for Retail & Supermarkets — Sales, Stock & Branches",
  description:
    "Run every shop and supermarket branch on one ERP: point of sale, replenishment, purchasing, staff and daily margin reporting — M-Pesa and KRA eTIMS ready.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/retail" },
  openGraph: {
    title: "LipaPoint ERP for Retail & Supermarkets",
    description:
      "Sales, stock, purchasing and branch reporting connected in one ERP — built for Kenyan shops and supermarkets.",
    url: "https://lipapoint.co.ke/industries/retail",
    images: ogImage("retail", "LipaPoint ERP for retail and supermarkets"),
  },
};

export default function RetailIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Retail & Supermarkets
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            From corner shops to large supermarkets, LipaPoint connects sales, stock,
            purchasing, staff and the books — so you can see margin by item and by branch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ShoppingCart className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Checkout that feeds the books</h3>
            <p className="text-text-secondary">
              Fast checkout with barcode scanning and M-Pesa, card or cash — every sale
              posts stock, revenue and tax straight to the ledger and eTIMS.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Stock you can trust</h3>
            <p className="text-text-secondary">
              Quantities by location, reorder points and low-stock alerts. Raise purchase
              orders and receive goods without leaving the same system.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <BarChart3 className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Margin by item and branch</h3>
            <p className="text-text-secondary">
              Daily sales, stock movement and gross margin reports. Compare branches and
              spot slow movers before they tie up cash.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            One system from shelf to statement
          </h3>
          <p className="text-text-secondary mb-6">
            Purchasing, supplier balances, payroll and eTIMS invoicing run in the same
            tenant as your tills — location-level sales and stock roll up into one set of
            books, ready for month end.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Locations</p>
              <p className="text-lg text-text-secondary">Unlimited</p>
            </div>
            <div>
              <p className="font-semibold">Users</p>
              <p className="text-lg text-text-secondary">Role-based access</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=RETAIL_GENERAL" className="text-sm text-gold hover:underline">
              See Retail & General pricing →
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