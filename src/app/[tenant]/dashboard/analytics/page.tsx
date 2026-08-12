import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";

export default async function AnalyticsPage() {
  return (
    <div className="flex flex-col">
      <Header title="Analytics" subtitle="Deep insights into your business performance" />
      <div className="p-6">
        <AnalyticsCharts />
      </div>
    </div>
  );
}
