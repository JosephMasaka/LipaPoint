"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed } from "lucide-react";

export default function TableManagementPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Table Management</h1>
        <Badge variant="outline">Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-gold" />
            Table Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Manage restaurant tables and seating. Assign orders to tables, track table status, and optimize your floor layout. This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
