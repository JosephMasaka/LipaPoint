"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListOrdered } from "lucide-react";

export default function QueueManagementPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Queue Management</h1>
        <Badge variant="outline">Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-gold" />
            Queue Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">
            Manage walk-in queues, estimated wait times, and customer flow. Keep clients informed and optimize your daily throughput. This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
