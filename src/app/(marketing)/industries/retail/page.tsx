import type { Metadata } from "next";
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
  title: "LipaPoint for Retail & Supermarkets — POS & ERP Solution",
  description:
    "LipaPoint's retail solution: point of sale, inventory management, supplier ordering, and multi-location tracking for shops and supermarkets. Built for Kenyan businesses.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/retail" },
  openGraph: {
    title: "LipaPoint Retail — POS, Inventory and Multi-location Management",
    description:
      "Point of sale, stock tracking, purchase orders, and multi-branch reporting for retail and supermarket businesses in Kenya.",
    url: "https://lipapoint.co.ke/industries/retail",
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
            From corner shops to large supermarkets, LipaPoint helps you manage sales,
            stock, and operations from one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ShoppingCart className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Point of Sale</h3>
            <p className="text-text-secondary">
              Fast checkout with barcode scanning, product search, and multi-payment support
              (M-Pesa, card, cash). Print or send digital receipts via SMS and WhatsApp.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Inventory Management</h3>
            <p className="text-text-secondary">
              Real-time stock levels across all locations. Set reorder points, track serial
              numbers, and get low-stock alerts. Manage suppliers and purchase orders.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <BarChart3 className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Sales Analytics</h3>
            <p className="text-text-secondary">
              Daily, weekly, monthly revenue reports. Compare periods and track growth.
              Identify top performers and best-selling items.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Multi-location Support
          </h3>
          <p className="text-text-secondary mb-6">
            Run multiple shops or supermarket branches from one tenant. Get location-level
            sales, stock, and reports. Compare performance across outlets.
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