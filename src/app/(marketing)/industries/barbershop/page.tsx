import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  Shield,
  Package,
  Landmark,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint ERP for Barbershops & Salons — Bookings to Commissions",
  description:
    "Run bookings, services, retail products, staff commissions and payroll on one ERP. Built for Kenyan barbershops, salons and grooming businesses.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/barbershop" },
  openGraph: {
    title: "LipaPoint ERP for Barbershops & Salons",
    description:
      "Bookings, services, retail products and staff commissions in one place — built for Kenyan grooming businesses.",
    url: "https://lipapoint.co.ke/industries/barbershop",
    images: ogImage("barbershop", "LipaPoint ERP for barbershops and salons"),
  },
};

export default function BarbershopIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Barbershops & Salons
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            From barbershops to beauty salons, LipaPoint connects bookings, services,
            retail products, staff commissions and payroll in one system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Users className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Bookings and walk-ins</h3>
            <p className="text-text-secondary">
              Schedule barbers, stylists and therapists, manage the walk-in queue, and keep
              no-shows visible — at the chair and on the dashboard.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Calendar className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Services and retail together</h3>
            <p className="text-text-secondary">
              Haircuts, colour and treatments priced alongside shampoo and grooming kits,
              with stock and margins tracked from the same sale.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Commissions from real sales</h3>
            <p className="text-text-secondary">
              Commission is calculated from actual service and product sales, then flows
              into payroll and the books — no spreadsheet at month end.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            One view of the business
          </h3>
          <p className="text-text-secondary mb-6">
            Service revenue, retail stock, staff costs and expenses sit in the same
            reporting suite, so you can see which chairs and which products actually pay.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Retail Products</p>
              <p className="text-lg text-text-secondary">Tracked</p>
            </div>
            <div>
              <p className="font-semibold"> commissions</p>
              <p className="text-lg text-text-secondary"> configurable</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=BARBERSHOP_SALON" className="text-sm text-gold hover:underline">
              See Barbershop & Salon pricing →
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