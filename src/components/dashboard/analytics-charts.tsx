"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const revenueData = [
  { month: "Jan", revenue: 32000, profit: 12000 },
  { month: "Feb", revenue: 28000, profit: 9800 },
  { month: "Mar", revenue: 41000, profit: 15200 },
  { month: "Apr", revenue: 38000, profit: 14000 },
  { month: "May", revenue: 45000, profit: 18500 },
  { month: "Jun", revenue: 52000, profit: 21000 },
  { month: "Jul", revenue: 48000, profit: 19200 },
  { month: "Aug", revenue: 55000, profit: 22800 },
];

const categoryData = [
  { name: "Beverages", value: 35, color: "#3b82f6" },
  { name: "Food", value: 40, color: "#10b981" },
  { name: "Desserts", value: 10, color: "#f59e0b" },
  { name: "Spirits", value: 15, color: "#8b5cf6" },
];

const hourlyData = [
  { hour: "8AM", orders: 12 },
  { hour: "9AM", orders: 25 },
  { hour: "10AM", orders: 18 },
  { hour: "11AM", orders: 32 },
  { hour: "12PM", orders: 48 },
  { hour: "1PM", orders: 55 },
  { hour: "2PM", orders: 42 },
  { hour: "3PM", orders: 30 },
  { hour: "4PM", orders: 22 },
  { hour: "5PM", orders: 35 },
  { hour: "6PM", orders: 52 },
  { hour: "7PM", orders: 65 },
  { hour: "8PM", orders: 58 },
  { hour: "9PM", orders: 45 },
  { hour: "10PM", orders: 28 },
];

const topProducts = [
  { name: "Cappuccino", sales: 342 },
  { name: "Beef Burger", sales: 289 },
  { name: "Caesar Salad", sales: 234 },
  { name: "Whiskey Sour", sales: 198 },
  { name: "Chef Special", sales: 167 },
];

export function AnalyticsCharts() {
  return (
    <div className="space-y-6">
      {/* Revenue & Profit Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Profit Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", color: "#fafafa" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
                <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                <Bar dataKey="revenue" fill="#d4af37" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", color: "#fafafa" }}
                    formatter={(value: number) => [`${value}%`, ""]}
                  />
                  <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Orders by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Orders by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="hour" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", color: "#fafafa" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#d4af37"
                    strokeWidth={2}
                    dot={{ fill: "#d4af37", r: 3 }}
                    activeDot={{ r: 5, fill: "#d4af37" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.map((product, i) => (
              <div key={product.name} className="flex items-center gap-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-200">{product.name}</span>
                    <span className="text-sm text-zinc-400 tabular-nums">{product.sales} units</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold"
                      style={{ width: `${(product.sales / topProducts[0].sales) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
