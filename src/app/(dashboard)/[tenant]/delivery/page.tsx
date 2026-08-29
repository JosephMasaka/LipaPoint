"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";

export default function DeliveryManagementPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Delivery Management</h1>
        <Badge variant="outline">Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-gold" />
            Delivery Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Manage delivery zones, assign riders, and track deliveries in real time. Set zone-based minimum orders and delivery fees. This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
