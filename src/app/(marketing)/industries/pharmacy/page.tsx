import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Package,
  ShieldCheck,
  Landmark,
  Users,
  Banknote,
  Calendar,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint ERP for Pharmacies — Stock, Expiry & eTIMS",
  description:
    "Run dispensing, stock and expiry control, staff payroll and KRA eTIMS invoicing on one ERP. Built for Kenyan pharmacies, drug stores and dispensaries.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/pharmacy" },
  openGraph: {
    title: "LipaPoint ERP for Pharmacies",
    description:
      "Stock and expiry control, prescription sales and KRA eTIMS invoicing without the paperwork.",
    url: "https://lipapoint.co.ke/industries/pharmacy",
    images: ogImage("pharmacy", "LipaPoint ERP for pharmacies"),
  },
};

export default function PharmacyIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Pharmacies
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Dispensing, expiry-controlled stock, staff and KRA-compliant invoicing —
            one system, audit-ready by default.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Stock & Expiry Control</h3>
            <p className="text-text-secondary">
              Track medicine stock, set expiry dates, and get automatic alerts when
              products are close to expiring. Ensure compliance and reduce waste.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ShieldCheck className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">KRA eTIMS Invoicing</h3>
            <p className="text-text-secondary">
              Issue eTIMS-compliant receipts and invoices, submit to KRA&apos;s eTIMS (OSCU & VSCU) in real time,
              and track CSIDs and VAT reconciliation from the compliance dashboard.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Banknote className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Counter and dispensary connected</h3>
            <p className="text-text-secondary">
              Prescription and over-the-counter sales draw down the same stock, with patient
              records kept private and controlled items accounted for.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Compliance without the paperwork
          </h3>
          <p className="text-text-secondary mb-6">
            eTIMS invoicing, statutory payroll and VAT reconciliation run off the same
            transactions, so inspections and month end do not depend on manual records.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">eTIMS</p>
              <p className="text-lg text-text-secondary">Compliant</p>
            </div>
            <div>
              <p className="font-semibold">Prescription</p>
              <p className="text-lg text-text-secondary">Tracked</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=HEALTHCARE_PHARMACY" className="text-sm text-gold hover:underline">
              See Healthcare & Pharmacy pricing →
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