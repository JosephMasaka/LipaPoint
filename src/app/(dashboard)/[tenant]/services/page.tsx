"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors } from "lucide-react";

export default function ServiceCatalogPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Service Catalog</h1>
        <Badge variant="outline">Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-gold" />
            Service Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Define your services with pricing, duration, and staff assignments. Create service packages and manage your catalog. This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
