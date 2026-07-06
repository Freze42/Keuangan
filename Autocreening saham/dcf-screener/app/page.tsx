"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import ScreenerTable from "@/components/ScreenerTable";
import { fetchScreener, MOCK_SCREENER } from "@/lib/api";
import type { StockScreenerItem } from "@/types";

export default function HomePage() {
  const { data, isLoading, isError } = useQuery<StockScreenerItem[]>({
    queryKey: ["screener"],
    queryFn: fetchScreener,
    placeholderData: MOCK_SCREENER,
  });

  const displayData = data ?? MOCK_SCREENER;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <section className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">DCF Stock Screener</h1>
        <p className="text-sm text-muted-foreground">
          Discounted Cash Flow valuation for Food &amp; Beverage companies listed on the IDX.
          Sort by Margin of Safety to find undervalued gems.
        </p>
      </section>

      {isError && (
        <div className="mb-6 rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          ⚠️ Unable to reach the backend API. Showing mock data for development.
        </div>
      )}

      <ScreenerTable data={displayData} isLoading={isLoading} />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Data delayed. DCF valuations are estimates only — not financial advice.
      </p>
    </div>
  );
}
