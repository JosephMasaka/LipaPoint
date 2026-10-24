"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface P9Data {
  year: number;
  employee: {
    id: string;
    staffNumber: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    kraPin: string | null;
    nssfNumber: string | null;
    shaNumber: string | null;
  };
  months: {
    period: string;
    grossPay: number;
    nssf: number;
    shif: number;
    payeBeforeRelief: number;
    personalRelief: number;
    payeAfterRelief: number;
  }[];
  totals: {
    grossPay: number;
    nssf: number;
    shif: number;
    payeBeforeRelief: number;
    personalRelief: number;
    payeAfterRelief: number;
  };
  company: {
    name: string;
    slug: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
  };
}

const monthName = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-KE", { month: "short" });
};

/**
 * Printable P9 (annual tax summary) — standalone route, no dashboard
 * chrome. Print → Save as PDF gives the employee a filing-ready P9 data
 * sheet without adding a PDF dependency.
 */
export default function PrintableP9Page() {
  const params = useParams<{ employeeId: string }>();
  const [data, setData] = useState<P9Data | null>(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    const urlYear = Number(new URLSearchParams(window.location.search).get("year"));
    setYear(Number.isInteger(urlYear) && urlYear > 2000 ? urlYear : new Date().getFullYear());
  }, []);

  useEffect(() => {
    if (year === null) return;
    fetch(`/api/payroll/p9/${params.employeeId}?year=${year}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load P9 summary");
        setData(d);
      })
      .catch((e) => setError((e as Error).message));
  }, [params.employeeId, year]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-text-muted">
            You may need to sign in, or this employee is not on your account.
          </p>
          <Link href="/login" className="text-xs text-gold underline">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-text-muted text-sm">
        Loading P9 summary…
      </div>
    );
  }

  const { employee: e, months, totals, company } = data;

  return (
    <div className="min-h-screen bg-surface py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto space-y-4 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={company.slug ? `/${company.slug}/hr` : "/login"}
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to HR
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-gold text-black px-4 py-2 text-sm font-medium hover:bg-gold/90"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>

        <div className="bg-white text-black rounded-lg border border-border shadow-sm p-10 print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold">{company.name}</h1>
              <p className="text-xs text-neutral-600">
                {[company.address, company.city].filter(Boolean).join(", ")}
                {company.phone ? ` · ${company.phone}` : ""}
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold uppercase tracking-wide">P9 — Tax Year {data.year}</h2>
              <p className="text-xs text-neutral-600">Annual PAYE summary</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs mb-6">
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">Employee</span>
              <span className="font-medium">{e.firstName} {e.lastName}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">Staff number</span>
              <span className="font-medium">{e.staffNumber}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">KRA PIN</span>
              <span className="font-medium">{e.kraPin || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">NSSF / SHA no.</span>
              <span className="font-medium">
                {[e.nssfNumber || "—", e.shaNumber || "—"].join(" / ")}
              </span>
            </div>
          </div>

          {months.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              No payroll runs recorded for {data.year}.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-2 text-left uppercase tracking-wide">Month</th>
                  <th className="py-2 text-right uppercase tracking-wide">Gross pay</th>
                  <th className="py-2 text-right uppercase tracking-wide">NSSF</th>
                  <th className="py-2 text-right uppercase tracking-wide">SHIF</th>
                  <th className="py-2 text-right uppercase tracking-wide">PAYE</th>
                  <th className="py-2 text-right uppercase tracking-wide">Relief</th>
                  <th className="py-2 text-right uppercase tracking-wide">PAYE after relief</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.period} className="border-b border-neutral-200">
                    <td className="py-1.5">{monthName(m.period)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.grossPay)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.nssf)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.shif)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.payeBeforeRelief)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.personalRelief)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.payeAfterRelief)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-2 uppercase">Totals {data.year}</td>
                  <td className="py-2 text-right">{formatCurrency(totals.grossPay)}</td>
                  <td className="py-2 text-right">{formatCurrency(totals.nssf)}</td>
                  <td className="py-2 text-right">{formatCurrency(totals.shif)}</td>
                  <td className="py-2 text-right">{formatCurrency(totals.payeBeforeRelief)}</td>
                  <td className="py-2 text-right">{formatCurrency(totals.personalRelief)}</td>
                  <td className="py-2 text-right">{formatCurrency(totals.payeAfterRelief)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <div className="mt-10 pt-4 border-t border-neutral-300 text-[10px] text-neutral-500">
            Year-to-date figures extracted from payroll runs — the filing data behind KRA&apos;s P9
            form. Verify against your KRA filing before submission.
          </div>
        </div>
      </div>
    </div>
  );
}
