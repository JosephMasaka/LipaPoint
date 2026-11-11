"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Industry {
  key: string;
  label: string;
  description: string;
}

const INDUSTRIES: Industry[] = [
  { key: "retail", label: "Retail & Supermarkets", description: "Sales, stock and branch margins connected to the books" },
  { key: "pharmacy", label: "Pharmacy", description: "Stock & expiry control with eTIMS-ready dispensing and records" },
  { key: "restaurant", label: "Restaurants & Hospitality", description: "Orders, food cost, staff and payroll in one system" },
  { key: "bar", label: "Bars & Lodges", description: "Nightly sales, drink stock and payments reconciled automatically" },
  { key: "barbershop", label: "Barbershop & Salon", description: "Bookings, services, retail and commissions in one place" },
  { key: "hr-payroll", label: "HR & Payroll", description: "Statutory payroll, attendance, leave and staff scheduling" },
  { key: "asset-management", label: "Asset Management", description: "Asset register, depreciation, maintenance and disposal" },
  { key: "finance", label: "Finance & Accounting", description: "General ledger, bank reconciliation, statements, KRA eTIMS" },
  { key: "procurement-wholesale", label: "Procurement & Wholesale", description: "Purchase orders, supplier invoicing, multi-location stock" },
  { key: "education-training", label: "Education & Training", description: "Learner records, fee tracking, payroll and scheduling" },
  { key: "logistics-warehousing", label: "Logistics & Warehousing", description: "Warehouse stock, transfers, order fulfilment and valuation" },
  { key: "professional-services", label: "Professional Services", description: "Client billing, statements, practice accounts and reports" },
];

export default function IndustriesPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-text-primary mb-8">Industries</h1>
        <p className="text-lg text-text-secondary mb-8">
          LipaPoint is one ERP with industry-ready setups — so sales, stock, staff and
          the books stay connected to how your business actually runs.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INDUSTRIES.map((industry) => (
            <Card key={industry.key} className="hover:bg-gold/5 transition-colors">
              <CardHeader>
                <CardTitle>{industry.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-secondary">{industry.description}</p>
                <Link
                  href={`/industries/${industry.key}`}
                  className="text-sm text-text-primary hover:underline mt-2 block"
                >
                  Learn More
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}