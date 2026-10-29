import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Briefcase, Calculator, BarChart3 } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Professional Services — Clients, Billing & Books",
  description:
    "LipaPoint's professional services solution: client records and statements, invoicing, general ledger and practice reports for agencies and consultancies.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/professional-services" },
  openGraph: {
    title: "LipaPoint for Professional Services",
    description:
      "Client records, invoicing, statements and practice reports for agencies and consultancies.",
    url: "https://lipapoint.co.ke/industries/professional-services",
  },
};

export default function ProfessionalServicesIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Professional Services
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Bill clients cleanly, keep the ledger tight, and see which
            engagements actually pay — without a POS in sight.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Briefcase className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Client Records
            </h3>
            <p className="text-text-secondary">
              Every client&apos;s details, statements and balances in one
              register — detailed or summary, whenever they ask.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Calculator className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Accounts & Invoicing
            </h3>
            <p className="text-text-secondary">
              Chart of accounts, general ledger and eTIMS-compliant invoicing
              for every engagement, with bank reconciliation built in.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <BarChart3 className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Practice Insight
            </h3>
            <p className="text-text-secondary">
              Sales, customer and financial reports show which clients and
              services actually pay — plus an AI assistant on the dashboard.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Month-end without the panic
          </h3>
          <p className="text-text-secondary mb-6">
            Financial statements, customer statements and withholding-tax
            tracking are generated from the same ledger your invoices post to —
            nothing to re-key at year end.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Statements</p>
              <p className="text-lg text-text-secondary">Detailed & summary</p>
            </div>
            <div>
              <p className="font-semibold">Invoicing</p>
              <p className="text-lg text-text-secondary">eTIMS ready</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=PROFESSIONAL_SERVICES" className="text-sm text-gold hover:underline">
              See Professional Services pricing →
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
