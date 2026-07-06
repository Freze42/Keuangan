"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { HelpCircle, Zap, TrendingUp, Activity } from "lucide-react";
import { calculateCustomDCF } from "@/lib/api";
import { formatCurrency, formatPercent, getMoSColor } from "@/lib/utils";
import type { DCFResult, DCFAssumptions } from "@/types";

interface InteractiveDCFCalculatorProps {
  ticker: string;
  defaultAssumptions: DCFAssumptions;
}

const DEFAULT_ASSUMPTIONS: DCFAssumptions = { wacc: 9, growthRate1to5: 8, terminalGrowthRate: 2.5 };

function debounce<F extends (...args: unknown[]) => unknown>(fn: F, ms: number): (...args: Parameters<F>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export default function InteractiveDCFCalculator({ ticker, defaultAssumptions = DEFAULT_ASSUMPTIONS }: InteractiveDCFCalculatorProps) {
  const [assumptions, setAssumptions] = useState<DCFAssumptions>(defaultAssumptions);

  useEffect(() => { setAssumptions(defaultAssumptions); }, [ticker, defaultAssumptions]);

  const mutation = useMutation({
    mutationFn: (payload: { ticker: string; assumptions: DCFAssumptions }) => calculateCustomDCF(payload),
  });

  const assumptionsRef = useRef(assumptions);
  assumptionsRef.current = assumptions;

  const debouncedCalculate = useCallback(
    debounce(() => { mutation.mutate({ ticker, assumptions: assumptionsRef.current }); }, 400),
    [ticker]
  );

  useEffect(() => { debouncedCalculate(); }, [assumptions.wacc, assumptions.growthRate1to5, assumptions.terminalGrowthRate]);
  useEffect(() => { mutation.mutate({ ticker, assumptions }); }, []);

  const result: DCFResult | null = mutation.data ?? null;
  const mos = result?.marginOfSafety ?? 0;
  const mosColor = getMoSColor(mos);

  const updateAssumption = (key: keyof DCFAssumptions, value: number[]) => {
    setAssumptions((prev) => ({ ...prev, [key]: value[0] }));
  };

  return (
    <TooltipProvider>
      <Card className="w-full border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">DCF Assumptions</CardTitle>
              <Badge variant="outline" className="ml-2 border-amber-700/50 text-amber-400">PRO</Badge>
            </div>
            {mutation.isPending && <Activity className="h-4 w-4 animate-pulse text-muted-foreground" />}
          </div>
          <CardDescription>
            Adjust the sliders below to recalculate intrinsic value for{" "}
            <span className="font-mono font-semibold text-foreground">{ticker}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* WACC */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">WACC</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    <p className="text-xs leading-relaxed"><strong>Weighted Average Cost of Capital</strong> — the blended rate a company pays to finance operations. Higher WACC = lower fair value. Typical range: 7%–12%.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="font-mono text-sm font-semibold text-primary">{assumptions.wacc.toFixed(1)}%</span>
            </div>
            <Slider value={[assumptions.wacc]} onValueChange={(v) => updateAssumption("wacc", v)} min={5} max={15} step={0.25} />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>5%</span><span>15%</span></div>
          </div>

          {/* Growth Rate 1-5 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Growth Rate (Yr 1–5)</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    <p className="text-xs leading-relaxed"><strong>Projected annual FCF growth</strong> for the first 5 years of the explicit forecast period. Higher growth = higher intrinsic value.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="font-mono text-sm font-semibold text-primary">{assumptions.growthRate1to5.toFixed(1)}%</span>
            </div>
            <Slider value={[assumptions.growthRate1to5]} onValueChange={(v) => updateAssumption("growthRate1to5", v)} min={0} max={20} step={0.25} />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>0%</span><span>20%</span></div>
          </div>

          {/* Terminal Growth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Terminal Growth Rate</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    <p className="text-xs leading-relaxed"><strong>Perpetual growth rate</strong> beyond year 5. Usually capped at long-term GDP growth (2%–3%). Higher rate = higher terminal value.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="font-mono text-sm font-semibold text-primary">{assumptions.terminalGrowthRate.toFixed(1)}%</span>
            </div>
            <Slider value={[assumptions.terminalGrowthRate]} onValueChange={(v) => updateAssumption("terminalGrowthRate", v)} min={0} max={5} step={0.1} />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>0%</span><span>5%</span></div>
          </div>
        </CardContent>

        {/* Live Result */}
        <CardFooter className="flex-col items-stretch border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /><span>Live Fair Value Estimate</span>
          </div>
          {mutation.isPending && !result ? (
            <div className="mt-3 space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-5 w-32" /></div>
          ) : result ? (
            <div className="mt-2 space-y-1 animate-fade-in">
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(result.fairValue)}</p>
              <div className="flex items-center gap-2">
                <Badge variant={undefined} className={mosColor.badge}>MoS: {formatPercent(mos)}</Badge>
                <span className={`text-xs font-medium ${mosColor.text}`}>Upside: {formatPercent(result.upside)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Adjust a slider to calculate.</p>
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
