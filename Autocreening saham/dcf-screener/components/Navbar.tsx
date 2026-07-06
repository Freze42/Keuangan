"use client";

import React from "react";
import Link from "next/link";
import { BarChart3, PieChart } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/20 ring-1 ring-emerald-600/40">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-sm font-bold tracking-tight">
            DCF<span className="text-emerald-400">Screener</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-emerald-950/50 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-700/30 sm:inline-flex">
            Food &amp; Beverage
          </span>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <PieChart className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
