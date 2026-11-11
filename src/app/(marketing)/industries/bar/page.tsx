import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
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
  title: "LipaPoint ERP for Bars & Lodges — Sales, Stock & Compliance",
  description:
    "Run nightly sales, drink stock, M-Pesa payments and the books on one ERP. Stocktakes, wastage and KRA eTIMS for Kenyan bars, lodges and nightclubs.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/bar" },
  openGraph: {
    title: "LipaPoint ERP for Bars & Lodges",
    description:
      "Nightly sales, drink stock and payments reconciled in one system — built for Kenyan bars, lodges and nightclubs.",
    url: "https://lipapoint.co.ke/industries/bar",
    images: ogImage("bar", "LipaPoint ERP for bars and lodges"),
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
            From neighbourhood pubs to city clubs, LipaPoint reconciles sales, drink stock,
            payments and the books — without the clipboard chaos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <CreditCard className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Nightly sales reconciled</h3>
            <p className="text-text-secondary">
              M-Pesa, card and cash sales settle into the same records, by till, shift and
              waiter — no morning-after re-keying.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Drink stock that adds up</h3>
            <p className="text-text-secondary">
              Beer, spirits and mixers tracked per location, with stocktakes, wastage and
              reorder alerts that surface shrinkage early.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Landmark className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Books close with the bar</h3>
            <p className="text-text-secondary">
              Peak-hour and best-seller reports feed straight into accounting, payroll and
              eTIMS — so tax time is not a reconstruction exercise.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Less paperwork, more control
          </h3>
          <p className="text-text-secondary mb-6">
            Sales, stock, payments, payroll and compliance in one tenant. Compare
            locations, spot variances and keep the books current while you trade.
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