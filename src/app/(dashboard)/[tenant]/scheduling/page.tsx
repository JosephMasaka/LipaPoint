"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

export default function StaffSchedulingPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Staff Scheduling</h1>
        <Badge variant="outline">Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gold" />
            Staff Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Create and manage staff schedules, track availability, handle shift swaps, and ensure optimal coverage during peak hours. This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
