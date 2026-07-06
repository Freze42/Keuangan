"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialDataPoint } from "@/types";

interface FinancialChartProps { data: FinancialDataPoint[]; isLoading: boolean; }

function formatTrillions(value: number): string {
  const t = value / 1_000_000_000_000;
  if (t >= 1) return `Rp${t.toFixed(1)}T`;
  return `Rp${(value / 1_000_000_000).toFixed(0)}B`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">FY {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6 text-sm">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono font-semibold text-foreground">{formatTrillions(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function FinancialChart({ data, isLoading }: FinancialChartProps) {
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle className="text-base">Revenue vs FCFF</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[320px] w-full rounded-lg" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Revenue vs Free Cash Flow to Firm</CardTitle>
        <span className="text-xs text-muted-foreground">5-Year Trend</span>
      </CardHeader>
      <CardContent>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 18% 15%)" vertical={false} />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "hsl(210 10% 55%)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(210 10% 55%)", fontSize: 12 }} tickFormatter={formatTrillions} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "hsl(210 18% 14%)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(210 10% 55%)" }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={36} />
              <Bar dataKey="fcff" name="FCFF" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
