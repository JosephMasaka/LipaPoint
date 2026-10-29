import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap, Banknote, CalendarDays } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Education & Training — Fees, Staff and Operations",
  description:
    "LipaPoint's education solution: learner records, fee and expense tracking, staff payroll and scheduling for schools, colleges and training centres.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/education-training" },
  openGraph: {
    title: "LipaPoint for Education & Training",
    description:
      "Learner records, fee tracking, statutory payroll and scheduling for schools and training centres.",
    url: "https://lipapoint.co.ke/industries/education-training",
  },
};

export default function EducationTrainingIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Education & Training
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Run the front desk, the payroll and the books from one system —
            built for schools, colleges and training centres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <GraduationCap className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Learner Records
            </h3>
            <p className="text-text-secondary">
              Keep every learner&apos;s details, history and communications in
              one register, alongside the customers who pay for them.
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
              Pay teachers, trainers and support staff with PAYE, NSSF, SHIF and
              housing levy calculated for you.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <CalendarDays className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Scheduling & Fees
            </h3>
            <p className="text-text-secondary">
              Build staff schedules, take fee payments at the front desk, and
              track expenses against every programme.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            The same ERP core every LipaPoint plan runs on
          </h3>
          <p className="text-text-secondary mb-6">
            Analytics, the AI business assistant and the full report suites come
            with the tier — so term-end reporting and year-end accounts are
            already done when you need them.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Payroll</p>
              <p className="text-lg text-text-secondary">Statutory ready</p>
            </div>
            <div>
              <p className="font-semibold">Reporting</p>
              <p className="text-lg text-text-secondary">Sales & finance suites</p>
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
