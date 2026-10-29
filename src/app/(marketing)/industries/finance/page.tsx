import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Landmark, Calculator, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Finance & Accounting — Books, Banking & eTIMS",
  description:
    "LipaPoint's finance solution: chart of accounts, general ledger, bank reconciliation, financial statements and KRA eTIMS compliance for Kenyan businesses.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/finance" },
  openGraph: {
    title: "LipaPoint for Finance & Accounting — Books, Banking & eTIMS",
    description:
      "General ledger, bank reconciliation, financial statements and real-time eTIMS invoicing on one platform.",
    url: "https://lipapoint.co.ke/industries/finance",
  },
};

export default function FinanceIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Finance & Accounting
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Keep the books clean, reconcile the bank, and file on time — a real
            general ledger behind every sale, purchase and payment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Calculator className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              General Ledger
            </h3>
            <p className="text-text-secondary">
              Chart of accounts, journal entries and a live general ledger that
              closes cleanly every period — no spreadsheet round-trips.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Landmark className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Banking & Cash
            </h3>
            <p className="text-text-secondary">
              Reconcile bank statements against cash movements, with cashier
              and till reports feeding straight from the POS.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <ShieldCheck className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              KRA eTIMS Compliance
            </h3>
            <p className="text-text-secondary">
              Submit OSCU invoices in real time, monitor the compliance
              dashboard, and keep every return audit-ready.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Reporting that closes the month
          </h3>
          <p className="text-text-secondary mb-6">
            Financial statements, customer statements and the full sales, stock
            and cashier report suites — exportable whenever the auditor, the
            bank or management asks.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Statements</p>
              <p className="text-lg text-text-secondary">Detailed & summary</p>
            </div>
            <div>
              <p className="font-semibold">eTIMS invoicing</p>
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
