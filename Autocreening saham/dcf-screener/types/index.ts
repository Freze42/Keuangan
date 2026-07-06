export interface StockScreenerItem {
  ticker: string; companyName: string; currentPrice: number;
  fairValue: number; marginOfSafety: number; sector: string;
}

export interface FinancialDataPoint {
  year: number; revenue: number; fcff: number; fcf: number; netIncome: number;
}

export interface CompanyDetail {
  ticker: string; companyName: string; sector: string; currentPrice: number;
  fairValue: number; marginOfSafety: number; marketCap: number;
  description: string; historical: FinancialDataPoint[];
}

export interface DCFAssumptions { wacc: number; growthRate1to5: number; terminalGrowthRate: number; }

export interface DCFResult { fairValue: number; marginOfSafety: number; intrinsicValue: number; upside: number; }

export interface CalculateDCFRequest { ticker: string; assumptions: DCFAssumptions; }
