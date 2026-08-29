"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";

export default function OnlineOrderingPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Online Ordering</h1>
        <Badge variant="outline">Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gold" />
            Online Ordering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Accept orders from your branded online portal. Manage pre-orders, track incoming orders, and serve customers beyond your physical location. This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
