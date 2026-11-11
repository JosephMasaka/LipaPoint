import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users, Banknote, Shield, Package } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint ERP for HR & Payroll — Statutory Payroll & People",
  description:
    "Run statutory payroll, PAYE, NSSF, SHIF and housing levy, leave and employee records on one ERP — with every payroll run posted to the books.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/hr-payroll" },
  openGraph: {
    title: "LipaPoint ERP for HR & Payroll",
    description:
      "Statutory payroll posted straight to the books, with employee records, leave and assets in one system.",
    url: "https://lipapoint.co.ke/industries/hr-payroll",
    images: ogImage("hr-payroll", "LipaPoint ERP for HR and payroll"),
  },
};

export default function HrPayrollIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for HR & Payroll
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Manage your team, run statutory payroll, and post every run to the same books
            your sales and purchases use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Users className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Employee Management
            </h3>
            <p className="text-text-secondary">
              Track employee information, roles, and contact details. Manage hiring,
              onboarding, and offboarding all in one place.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Banknote className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Statutory Payroll
            </h3>
            <p className="text-text-secondary">
              Automatically calculate PAYE, NSSF, SHIF and housing levy. Generate payslips,
              post journals and file statutory returns from one run.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              KRA Compliance
            </h3>
            <p className="text-text-secondary">
              Stay aligned with KRA payroll requirements. Generate compliance
              reports and keep your business audit-ready year-round.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Asset Tracking
          </h3>
          <p className="text-text-secondary mb-6">
            Track company assets, equipment, and vehicles. Assign to employees,
            track depreciation, and maintain an up-to-date asset register.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Assets</p>
              <p className="text-lg text-text-secondary">Unlimited</p>
            </div>
            <div>
              <p className="font-semibold">Depreciation</p>
              <p className="text-lg text-text-secondary">Automated</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=HUMAN_RESOURCE" className="text-sm text-gold hover:underline">
              See Human Resource pricing →
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