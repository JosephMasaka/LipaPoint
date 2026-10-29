import type { Metadata } from "next";
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
  title: "LipaPoint for Restaurants & Hospitality — POS & Operations",
  description:
    "LipaPoint's restaurant solution: table and order management, menu-driven sales, kitchen flow, and payroll for back-of-house. One system for front and back of house.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/restaurant" },
  openGraph: {
    title: "LipaPoint Restaurants — Table Management and Payroll",
    description:
      "Table and order management, menu-driven sales, kitchen display, and staff payroll for restaurants and hospitality businesses in Kenya.",
    url: "https://lipapoint.co.ke/industries/restaurant",
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
            From fine dining to casual eateries, LipaPoint helps you run your restaurant
            from order to payroll in one system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ShoppingCart className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Table & Order Management</h3>
            <p className="text-text-secondary">
              Floor plan management, server-assigned tables, menu-driven ordering, and
              kitchen display integration. Track tabs and split checks.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Landmark className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Menu & Kitchen</h3>
            <p className="text-text-secondary">
              Menu-driven sales, course management, kitchen display system (KDS), and
              food cost tracking. Manage daily specials and item availability.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Clock className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Staff & Payroll</h3>
            <p className="text-text-secondary">
              Run statutory payroll, post journals, manage bank accounts and reconciliation,
              and keep the books clean. KRA-compliant payroll for hospitality staff.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Multi-venue Management
          </h3>
          <p className="text-text-secondary mb-6">
            Run multiple restaurants, bars, or cafés from one tenant. Get location-level
            sales, stock, and reports. Compare performance across venues.
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