"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PayslipData {
  payslip: {
    id: string;
    grossPay: number;
    nssfEmployee: number;
    nssfEmployer: number;
    shif: number;
    housingLevyEmployee: number;
    housingLevyEmployer: number;
    taxablePay: number;
    paye: number;
    personalRelief: number;
    payePayable: number;
    otherDeductions: number;
    loanDeduction: number;
    netPay: number;
    nitaLevy: number;
    createdAt: string;
    employee: {
      staffNumber: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
      employmentType: string;
      kraPin: string | null;
      nssfNumber: string | null;
      shaNumber: string | null;
      bankAccount: string | null;
      mpesaNumber: string | null;
      basicSalary: number;
    };
    payrollRun: { id: string; period: string; status: string };
    rateTable: { label: string; effectiveFrom: string } | null;
  };
  company: {
    name: string;
    slug: string | null;
    header: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
  };
}

const periodLabel = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
};

/**
 * Printable payslip — a standalone route (no dashboard chrome) that renders
 * as a clean sheet of paper and prints via the browser's own dialog, so a
 * PDF needs no extra dependency: Print → Save as PDF.
 */
export default function PrintablePayslipPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PayslipData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/payroll/payslips/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load payslip");
        setData(d);
      })
      .catch((e) => setError((e as Error).message));
  }, [params.id]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-text-muted">
            You may need to sign in, or the payslip belongs to a different account.
          </p>
          <Link href="/login" className="text-xs text-gold underline">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-text-muted text-sm">
        Loading payslip…
      </div>
    );
  }

  const { payslip: p, company } = data;
  const period = periodLabel(p.payrollRun.period);
  const provisional = p.payrollRun.status === "draft" || p.payrollRun.status === "approved";
  const otherNonLoan = Math.max(p.otherDeductions - p.loanDeduction, 0);

  return (
    <div className="min-h-screen bg-surface py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto space-y-4 print:max-w-none print:space-y-0">
        {/* Actions — hidden on paper */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={company.slug ? `/${company.slug}/payroll` : "/login"}
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Payroll
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-gold text-black px-4 py-2 text-sm font-medium hover:bg-gold/90"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>

        {/* The document */}
        <div className="bg-white text-black rounded-lg border border-border shadow-sm p-10 print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold">{company.header || company.name}</h1>
              <p className="text-xs text-neutral-600">
                {[company.address, company.city].filter(Boolean).join(", ")}
                {company.phone ? ` · ${company.phone}` : ""}
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold uppercase tracking-wide">Payslip</h2>
              <p className="text-xs text-neutral-600">{period}</p>
              {provisional && (
                <span className="mt-1 inline-block text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 border border-amber-300 rounded px-2 py-0.5">
                  Provisional — run {p.payrollRun.status}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs mb-6">
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">Employee</span>
              <span className="font-medium">{p.employee.firstName} {p.employee.lastName}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">Staff number</span>
              <span className="font-medium">{p.employee.staffNumber}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">Job title</span>
              <span className="font-medium">{p.employee.jobTitle || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">Employment type</span>
              <span className="font-medium capitalize">{p.employee.employmentType}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">KRA PIN</span>
              <span className="font-medium">{p.employee.kraPin || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-1">
              <span className="text-neutral-500">NSSF / SHA no.</span>
              <span className="font-medium">
                {[p.employee.nssfNumber || "—", p.employee.shaNumber || "—"].join(" / ")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Earnings & deductions */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-2">Earnings & Deductions</h3>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-1.5">Basic salary</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.employee.basicSalary)}</td>
                  </tr>
                  <tr className="font-medium border-t border-neutral-300">
                    <td className="py-1.5">Gross pay</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.grossPay)}</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">Less NSSF (employee)</td>
                    <td className="py-1 text-right">({formatCurrency(p.nssfEmployee)})</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">Less SHIF</td>
                    <td className="py-1 text-right">({formatCurrency(p.shif)})</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">Less Housing Levy (employee)</td>
                    <td className="py-1 text-right">({formatCurrency(p.housingLevyEmployee)})</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">Taxable pay</td>
                    <td className="py-1 text-right">{formatCurrency(p.taxablePay)}</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">PAYE before relief</td>
                    <td className="py-1 text-right">({formatCurrency(p.paye)})</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">Add: personal relief</td>
                    <td className="py-1 text-right">{formatCurrency(p.personalRelief)}</td>
                  </tr>
                  <tr className="text-neutral-700">
                    <td className="py-1">PAYE withheld</td>
                    <td className="py-1 text-right">({formatCurrency(p.payePayable)})</td>
                  </tr>
                  {p.loanDeduction > 0 && (
                    <tr className="text-neutral-700">
                      <td className="py-1">Less loan repayment</td>
                      <td className="py-1 text-right">({formatCurrency(p.loanDeduction)})</td>
                    </tr>
                  )}
                  {otherNonLoan > 0 && (
                    <tr className="text-neutral-700">
                      <td className="py-1">Less other deductions</td>
                      <td className="py-1 text-right">({formatCurrency(otherNonLoan)})</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-black">
                    <td className="py-2 font-bold uppercase">Net pay</td>
                    <td className="py-2 text-right font-bold">{formatCurrency(p.netPay)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Employer statutory costs */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-2">Employer Statutory Costs</h3>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-1.5">NSSF (employer)</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.nssfEmployer)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5">Housing Levy (employer)</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.housingLevyEmployer)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5">NITA training levy</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.nitaLevy)}</td>
                  </tr>
                  <tr className="font-medium border-t border-neutral-300">
                    <td className="py-1.5">Total employer cost</td>
                    <td className="py-1.5 text-right">
                      {formatCurrency(
                        p.grossPay + p.nssfEmployer + p.housingLevyEmployer + p.nitaLevy
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3 className="text-xs font-bold uppercase tracking-wide mt-6 mb-2">Payment</h3>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-1">Method</td>
                    <td className="py-1 text-right">
                      {p.employee.bankAccount ? "Bank transfer" : p.employee.mpesaNumber ? "M-Pesa" : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Destination</td>
                    <td className="py-1 text-right">
                      {p.employee.bankAccount || p.employee.mpesaNumber || "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Rate table</td>
                    <td className="py-1 text-right text-[10px]">{p.rateTable?.label ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10 pt-4 border-t border-neutral-300 text-[10px] text-neutral-500 flex justify-between">
            <span>
              This is a computer-generated payslip and is valid without a signature. Statutory
              figures are computed from the rate table in force for {period}.
            </span>
            <span>Issued {new Date(p.createdAt).toLocaleDateString("en-KE")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
