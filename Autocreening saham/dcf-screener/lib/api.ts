import axios from "axios";
import type { StockScreenerItem, CompanyDetail, CalculateDCFRequest, DCFResult } from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

export async function fetchScreener(): Promise<StockScreenerItem[]> {
  const { data } = await api.get<StockScreenerItem[]>("/screener"); return data;
}
export async function fetchCompanyDetail(ticker: string): Promise<CompanyDetail> {
  const { data } = await api.get<CompanyDetail>(`/company/${ticker}`); return data;
}
export async function calculateCustomDCF(payload: CalculateDCFRequest): Promise<DCFResult> {
  const { data } = await api.post<DCFResult>("/calculate-custom-dcf", payload); return data;
}

export const MOCK_SCREENER: StockScreenerItem[] = [
  { ticker: "ICBP", companyName: "Indofood CBP Sukses Makmur Tbk", currentPrice: 11750, fairValue: 15200, marginOfSafety: 29.36, sector: "Food & Beverage" },
  { ticker: "INDF", companyName: "Indofood Sukses Makmur Tbk", currentPrice: 6450, fairValue: 7100, marginOfSafety: 10.08, sector: "Food & Beverage" },
  { ticker: "MYOR", companyName: "Mayora Indah Tbk", currentPrice: 2550, fairValue: 2180, marginOfSafety: -14.51, sector: "Food & Beverage" },
  { ticker: "ULTJ", companyName: "Ultra Jaya Milk Industry Tbk", currentPrice: 1825, fairValue: 2350, marginOfSafety: 28.77, sector: "Food & Beverage" },
  { ticker: "CLEO", companyName: "Sariguna Primatirta Tbk", currentPrice: 705, fairValue: 920, marginOfSafety: 30.5, sector: "Food & Beverage" },
  { ticker: "STTP", companyName: "Siantar Top Tbk", currentPrice: 11400, fairValue: 10800, marginOfSafety: -5.26, sector: "Food & Beverage" },
  { ticker: "AALI", companyName: "Astra Agro Lestari Tbk", currentPrice: 5900, fairValue: 6250, marginOfSafety: 5.93, sector: "Food & Beverage" },
  { ticker: "CPIN", companyName: "Charoen Pokphand Indonesia Tbk", currentPrice: 4970, fairValue: 5800, marginOfSafety: 16.7, sector: "Food & Beverage" },
  { ticker: "JPFA", companyName: "Japfa Comfeed Indonesia Tbk", currentPrice: 1650, fairValue: 1320, marginOfSafety: -20.0, sector: "Food & Beverage" },
  { ticker: "ROTI", companyName: "Nippon Indosari Corpindo Tbk", currentPrice: 1200, fairValue: 1410, marginOfSafety: 17.5, sector: "Food & Beverage" },
];

export const MOCK_HISTORICAL = [
  { year: 2022, revenue: 64800000000000, fcff: 5200000000000, fcf: 4800000000000, netIncome: 6100000000000 },
  { year: 2023, revenue: 67900000000000, fcff: 5800000000000, fcf: 5300000000000, netIncome: 6500000000000 },
  { year: 2024, revenue: 72100000000000, fcff: 6400000000000, fcf: 5900000000000, netIncome: 7000000000000 },
  { year: 2025, revenue: 76500000000000, fcff: 7100000000000, fcf: 6500000000000, netIncome: 7600000000000 },
  { year: 2026, revenue: 81300000000000, fcff: 7900000000000, fcf: 7200000000000, netIncome: 8300000000000 },
];
