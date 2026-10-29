import type { Metadata } from "next";
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
  title: "LipaPoint for Pharmacy — Prescription & Inventory Management",
  description:
    "LipaPoint's pharmacy solution: prescription sales, expiry tracking, stock control, and KRA eTIMS-compliant invoicing for pharmacies and drug stores.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/pharmacy" },
  openGraph: {
    title: "LipaPoint Pharmacy — Stock, Prescriptions and eTIMS",
    description:
      "Prescription-style sales, expiry tracking, stock movement, and KRA eTIMS invoicing for pharmacies. Built for Kenyan drug stores and pharmacists.",
    url: "https://lipapoint.co.ke/industries/pharmacy",
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
            Prescription-style sales, expiry-controlled inventory, and KRA-compliant
            invoicing — all in one system.
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
              Issue eTIMS-compliant receipts and invoices, submit to KRA's OSCU in real time,
              and track CSIDs and VAT reconciliation from the compliance dashboard.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Banknote className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Prescription Sales</h3>
            <p className="text-text-secondary">
              Track prescription sales, manage controlled substances, and maintain patient
              records with privacy and compliance.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Regulatory Compliance
          </h3>
          <p className="text-text-secondary mb-6">
            KRA eTIMS-ready, NSSF and NHIF integration, and statutory reporting made
            simple. Stay aligned with Kenya's pharmaceutical regulations.
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