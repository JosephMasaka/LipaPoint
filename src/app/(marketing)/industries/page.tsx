"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Industry {
  key: string;
  label: string;
  description: string;
}

const INDUSTRIES: Industry[] = [
  { key: "retail", label: "Retail & Supermarkets", description: "POS, inventory, sales analytics, multi-location" },
  { key: "pharmacy", label: "Pharmacy", description: "Stock & expiry control, KRA eTIMS invoicing, prescription sales" },
  { key: "restaurant", label: "Restaurants & Hospitality", description: "Table & order management, menu & kitchen, staff & payroll" },
  { key: "bar", label: "Bars & Lodges", description: "Payment capture, drink stock tracking, nightly sales reports" },
  { key: "barbershop", label: "Barbershop & Salon", description: "Appointment booking, service catalog, queue management, retail products" },
];

export default function IndustriesPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-text-primary mb-8">Industries</h1>
        <p className="text-lg text-text-secondary mb-8">
          LipaPoint offers industry-specific POS solutions tailored to unique business needs.
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