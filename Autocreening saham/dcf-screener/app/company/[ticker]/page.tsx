"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, TrendingUp, DollarSign, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FinancialChart from "@/components/FinancialChart";
import InteractiveDCFCalculator from "@/components/InteractiveDCFCalculator";
import { fetchCompanyDetail, MOCK_HISTORICAL } from "@/lib/api";
import { formatCurrency, formatPercent, getMoSColor, getMoSLabel } from "@/lib/utils";
import type { CompanyDetail } from "@/types";

function buildMockDetail(ticker: string): CompanyDetail {
  const nameMap: Record<string, string> = {
    icbp: "Indofood CBP Sukses Makmur Tbk", indf: "Indofood Sukses Makmur Tbk",
    myor: "Mayora Indah Tbk", ultj: "Ultra Jaya Milk Industry Tbk",
    cleo: "Sariguna Primatirta Tbk", sttp: "Siantar Top Tbk",
    aali: "Astra Agro Lestari Tbk", cpin: "Charoen Pokphand Indonesia Tbk",
    jpfa: "Japfa Comfeed Indonesia Tbk", roti: "Nippon Indosari Corpindo Tbk",
  };
  const priceMap: Record<string, number> = { icbp: 11750, indf: 6450, myor: 2550, ultj: 1825, cleo: 705, sttp: 11400, aali: 5900, cpin: 4970, jpfa: 1650, roti: 1200 };
  const fvMap: Record<string, number> = { icbp: 15200, indf: 7100, myor: 2180, ultj: 2350, cleo: 920, sttp: 10800, aali: 6250, cpin: 5800, jpfa: 1320, roti: 1410 };
  const price = priceMap[ticker] ?? 5000;
  const fv = fvMap[ticker] ?? 5500;
  return {
    ticker: ticker.toUpperCase(), companyName: nameMap[ticker] ?? `${ticker.toUpperCase()} Company`,
    sector: "Food & Beverage", currentPrice: price, fairValue: fv,
    marginOfSafety: ((fv - price) / price) * 100, marketCap: price * 5_000_000_000,
    description: "A leading Food & Beverage company listed on the Indonesia Stock Exchange (IDX).",
    historical: MOCK_HISTORICAL,
  };
}

export default function CompanyDetailPage() {
  const params = useParams<{ ticker: string }>();
  const router = useRouter();
  const ticker = params.ticker.toLowerCase();

  const { data, isLoading, isError } = useQuery<CompanyDetail>({
    queryKey: ["company", ticker],
    queryFn: () => fetchCompanyDetail(ticker),
    placeholderData: buildMockDetail(ticker),
  });

  const detail: CompanyDetail = data ?? buildMockDetail(ticker);
  const mos = detail.marginOfSafety;
  const mosColor = getMoSColor(mos);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <button onClick={() => router.push("/")} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Screener
      </button>

      {isError && (
        <div className="mb-6 rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          ⚠️ Unable to reach the backend API. Showing mock data.
        </div>
      )}

      {/* Company Header */}
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          {isLoading ? (
            <><Skeleton className="h-5 w-20" /><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-48" /></>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-primary">{detail.ticker}</span>
                <Badge variant="secondary" className="text-[10px]">{detail.sector}</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{detail.companyName}</h1>
              <p className="text-sm text-muted-foreground line-clamp-2">{detail.description}</p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Card className="min-w-[140px] border-border">
            <CardContent className="flex flex-col items-center justify-center px-4 py-3">
              <DollarSign className="mb-1 h-4 w-4 text-muted-foreground" />
              {isLoading ? <Skeleton className="h-6 w-20" /> : <span className="text-lg font-bold">{formatCurrency(detail.currentPrice)}</span>}
              <span className="text-[10px] text-muted-foreground">Current Price</span>
            </CardContent>
          </Card>
          <Card className="min-w-[140px] border-border">
            <CardContent className="flex flex-col items-center justify-center px-4 py-3">
              <TrendingUp className="mb-1 h-4 w-4 text-muted-foreground" />
              {isLoading ? <Skeleton className="h-6 w-20" /> : <span className="text-lg font-bold">{formatCurrency(detail.fairValue)}</span>}
              <span className="text-[10px] text-muted-foreground">Fair Value</span>
            </CardContent>
          </Card>
          <Card className={`min-w-[140px] border-border ${mosColor.glow}`}>
            <CardContent className="flex flex-col items-center justify-center px-4 py-3">
              <Activity className={`mb-1 h-4 w-4 ${mosColor.text}`} />
              {isLoading ? <Skeleton className="h-6 w-20" /> : <Badge variant={undefined} className={mosColor.badge}>{formatPercent(mos)}</Badge>}
              <span className={`mt-1 text-[10px] ${mosColor.text}`}>{getMoSLabel(mos)}</span>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <FinancialChart data={detail.historical} isLoading={isLoading} />
          <Card className="mt-6">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />About {detail.companyName}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-4/6" /></div>
              ) : (
                <div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Sector</span><p className="font-medium">{detail.sector}</p></div>
                    <div><span className="text-muted-foreground">Market Cap</span><p className="font-medium">{formatCurrency(detail.marketCap)}</p></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <InteractiveDCFCalculator ticker={detail.ticker} defaultAssumptions={{ wacc: 9, growthRate1to5: 8, terminalGrowthRate: 2.5 }} />
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Assumptions are for illustrative purposes. Fair value estimates are not guarantees of future performance. Always do your own research.
          </p>
        </div>
      </div>
    </div>
  );
}
