import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  Landmark,
  Users,
  Clock,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint ERP for Restaurants & Hospitality — Front to Back of House",
  description:
    "Run service, kitchen, stock, staff and the books on one ERP: table and order management, food cost, statutory payroll and KRA eTIMS for Kenyan restaurants.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/restaurant" },
  openGraph: {
    title: "LipaPoint ERP for Restaurants & Hospitality",
    description:
      "Orders, kitchen, food cost, staff and books connected from service to payroll — built for Kenyan hospitality.",
    url: "https://lipapoint.co.ke/industries/restaurant",
    images: ogImage("restaurant", "LipaPoint ERP for restaurants and hospitality"),
  },
};

export default function RestaurantIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Restaurants & Hospitality
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            From fine dining to casual eateries, LipaPoint connects service, kitchen,
            food cost, staff and the books — one system from order to payroll.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ShoppingCart className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Service that posts itself</h3>
            <p className="text-text-secondary">
              Tables, tabs, split checks and kitchen tickets in one flow — every order
              updates sales and ingredient stock without a second entry.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Landmark className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Food cost you can see</h3>
            <p className="text-text-secondary">
              Menu margins, wastage and purchasing in one view. Change a price or a
              recipe and know what it does to the bottom line.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Clock className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Staff and books connected</h3>
            <p className="text-text-secondary">
              Statutory payroll for service and kitchen teams, posted as journal entries to
              the same ledger your sales reconcile against.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Multi-venue, one set of books
          </h3>
          <p className="text-text-secondary mb-6">
            Run restaurants, bars and cafés from one tenant. Compare covers, food cost and
            stock across venues, then close the month from consolidated accounts.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Venues</p>
              <p className="text-lg text-text-secondary">Unlimited</p>
            </div>
            <div>
              <p className="font-semibold">Categories</p>
              <p className="text-lg text-text-secondary">Menu categories</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=RESTAURANT_HOSPITALITY" className="text-sm text-gold hover:underline">
              See Restaurant & Hospitality pricing →
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