import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0,
    notation: value > 999_999_999_999 ? "compact" : "standard",
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function getMoSColor(mos: number): { text: string; badge: string; glow: string } {
  if (mos > 15) return { text: "text-emerald-400", badge: "bg-emerald-950/60 text-emerald-400 border-emerald-700/50", glow: "shadow-emerald-500/20" };
  if (mos >= 0) return { text: "text-amber-400", badge: "bg-amber-950/60 text-amber-400 border-amber-700/50", glow: "shadow-amber-500/20" };
  return { text: "text-rose-400", badge: "bg-rose-950/60 text-rose-400 border-rose-700/50", glow: "shadow-rose-500/20" };
}

export function getMoSLabel(mos: number): string {
  if (mos > 15) return "Undervalued";
  if (mos >= 0) return "Fairly Valued";
  return "Overvalued";
}
