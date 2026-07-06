"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search, ChevronUp, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, getMoSColor, getMoSLabel } from "@/lib/utils";
import type { StockScreenerItem } from "@/types";

interface ScreenerTableProps { data: StockScreenerItem[]; isLoading: boolean; }
type SortKey = "ticker" | "marginOfSafety" | "currentPrice" | "fairValue";
type SortDir = "asc" | "desc";

export default function ScreenerTable({ data, isLoading }: ScreenerTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("marginOfSafety");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let rows = [...data];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.ticker.toLowerCase().includes(q) || r.companyName.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const aVal = a[sortKey]; const bVal = b[sortKey];
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
    return rows;
  }, [data, search, sortKey, sortDir]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Food &amp; Beverage Screener</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}
        </CardContent>
      </Card>
    );
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ChevronUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ChevronDown className="ml-1 h-3.5 w-3.5 text-primary" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Food &amp; Beverage Screener</CardTitle>
        <span className="text-xs text-muted-foreground">{filtered.length} of {data.length} stocks</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by ticker or company name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px] cursor-pointer select-none" onClick={() => toggleSort("ticker")}>
                <span className="inline-flex items-center">Ticker <SortIcon column="ticker" /></span>
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("currentPrice")}>
                <span className="inline-flex items-center justify-end">Price <SortIcon column="currentPrice" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("fairValue")}>
                <span className="inline-flex items-center justify-end">Fair Value <SortIcon column="fairValue" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("marginOfSafety")}>
                <span className="inline-flex items-center justify-end">MoS <SortIcon column="marginOfSafety" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center"><p className="text-sm text-muted-foreground">No stocks match &quot;{search}&quot;</p></TableCell></TableRow>
            ) : (
              filtered.map((row) => {
                const mos = row.marginOfSafety; const color = getMoSColor(mos);
                return (
                  <TableRow key={row.ticker} className="cursor-pointer animate-fade-in" onClick={() => router.push(`/company/${row.ticker.toLowerCase()}`)}>
                    <TableCell><span className="font-mono text-sm font-bold tracking-wider text-primary">{row.ticker}</span></TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm">{row.companyName}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(row.currentPrice)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(row.fairValue)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={undefined} className={color.badge}>{formatPercent(mos)}</Badge>
                      <span className={`ml-2 text-xs ${color.text}`}>{getMoSLabel(mos)}</span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
