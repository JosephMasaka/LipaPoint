import type { Metadata } from "next";
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
  title: "LipaPoint for Barbershops & Salons — Appointments and grooming",
  description:
    "LipaPoint's barbershop/solution: appointment booking, service catalog, queue management, and retail product sales for grooming businesses.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/barbershop" },
  openGraph: {
    title: "LipaPoint Barbershop — Appointments and Service Catalog",
    description:
      "Appointment booking, service catalog, queue management, and retail product sales for barbershops and salons. Built for Kenyan grooming businesses.",
    url: "https://lipapoint.co.ke/industries/barbershop",
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
            From barbershops to beauty salons, LipaPoint helps you book appointments,
            manage staff, and retail products — all in one system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Users className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Appointment Booking</h3>
            <p className="text-text-secondary">
              Book appointments for barbers, stylists, and therapists. Calendar view,
              reminder notifications, and no-show tracking.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Calendar className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Service Catalog</h3>
            <p className="text-text-secondary">
              Catalog of haircuts, colors, treatments, and retail products. Track what's
              sold and set commissions for staff.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Queue Management</h3>
            <p className="text-text-secondary">
              Manage walk-in queues, reduce wait times, and notify customers when
              it's their turn. Track staff availability in real time.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Retail Products
          </h3>
          <p className="text-text-secondary mb-6">
            Sell shampoo, hair care products, and grooming kits directly through the
            POS. Track inventory and set reorder points for retail items.
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