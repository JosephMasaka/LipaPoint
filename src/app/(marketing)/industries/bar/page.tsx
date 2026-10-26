import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Package,
  Users,
  ShieldCheck,
  Landmark,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Bars & Lodges — Nightlife and Hospitality",
  description:
    "LipaPoint's bar solution: nightly sales capture, stock tracking for drinks and stocktakes, payment flow, and M-Pesa integration. Designed for nightlife businesses in Kenya.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/bar" },
  openGraph: {
    title: "LipaPoint Bars — Nightly Sales and Stock",
    description:
      "Nightly sales capture, drink stock tracking, M-Pesa STK Push, and payment flow for bars, lodges, and nightclubs. Built for Kenyan nightlife businesses.",
    url: "https://lipapoint.co.ke/industries/bar",
  },
};

export default function BarIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Bars & Lodges
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            From neighborhood pubs to city clubs, LipaPoint helps you capture sales, track
            stock, and manage payments — without the clipboard chaos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <CreditCard className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Payment Capture</h3>
            <p className="text-text-secondary">
              M-Pesa STK Push, customer payments, and B2B transactions. Settled into your
              records the way Kenyan businesses actually transact.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Drink Stock tracking</h3>
            <p className="text-text-secondary">
              Track beer, spirits, and mixer stock. Stocktakes, waste tracking, and
              reorder alerts for bar inventory.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Landmark className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Nightly Sales Reports</h3>
            <p className="text-text-secondary">
              Capture nightly sales, track peak hours, and identify best-selling drinks.
              Compare performance across locations.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Simplified Operations
          </h3>
          <p className="text-text-secondary mb-6">
            No clipboard chaos. All sales, stock, and payments tracked automatically in
            one system. Focus on customers, not paperwork.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Sales</p>
              <p className="text-lg text-text-secondary">Automatic</p>
            </div>
            <div>
              <p className="font-semibold">Stock</p>
              <p className="text-lg text-text-secondary">Real-time</p>
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