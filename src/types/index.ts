export interface PortfolioItem {
  No: number;
  종목명: string;
  티커: string;
  섹터: string;
  계좌: string;
  수량: number;
  현재가: number;
  평균단가: number;
  통화: string;
  '평가금액(원)': number;
  '매수금액(원)': number;
  '손익(원)': number;
  수익률: number;
}

/** Merged item — duplicate tickers combined across accounts */
export interface MergedItem {
  티커: string;
  종목명: string;
  섹터: string;
  통화: string;
  현재가: number;
  // Merged fields
  총수량: number;
  가중평균단가: number;        // weighted average purchase price
  '평가금액(원)': number;      // sum
  '매수금액(원)': number;      // sum
  '손익(원)': number;          // sum
  수익률: number;              // recalculated
  계좌목록: string[];          // list of accounts
  원본항목: PortfolioItem[];   // original items for detail view
}

export interface PortfolioMetadata {
  date: string;
  exchange_rate: { USD: number; HKD: number };
  total_items: number;
  total_accounts: number;
  total_sectors: number;
  total_markets: number;
}

export interface PortfolioData {
  metadata: PortfolioMetadata;
  items: PortfolioItem[];
}

// ─── FMP API Types ───
export interface FMPQuote {
  symbol: string; price: number; pe: number; marketCap: number; eps: number;
  priceAvg50: number; priceAvg200: number; sharesOutstanding: number;
  yearHigh: number; yearLow: number;
}
export interface FMPRating {
  symbol: string; date: string; rating: string; ratingScore: number; ratingRecommendation: string;
  ratingDetailsDCFScore: number; ratingDetailsDCFRecommendation: string;
  ratingDetailsROEScore: number; ratingDetailsROERecommendation: string;
  ratingDetailsROAScore: number; ratingDetailsROARecommendation: string;
  ratingDetailsDEScore: number; ratingDetailsDERecommendation: string;
  ratingDetailsPEScore: number; ratingDetailsPERecommendation: string;
  ratingDetailsPBScore: number; ratingDetailsPBRecommendation: string;
}
export interface FMPKeyMetrics {
  peRatioTTM: number; pegRatioTTM: number; priceToBookRatioTTM: number;
  priceToSalesRatioTTM: number; enterpriseValueOverEBITDATTM: number;
  dividendYieldTTM: number; marketCapTTM: number; debtToEquityTTM: number;
  roeTTM: number; currentRatioTTM: number;
}
export interface FMPIncomeStatement {
  date: string; calendarYear: string; period: string; revenue: number;
  operatingIncome: number; ebitda: number; eps: number; epsdiluted: number;
  netIncome: number; grossProfit: number;
}
export interface FMPEstimate {
  symbol: string; date: string;
  estimatedRevenueAvg: number; estimatedRevenueHigh: number; estimatedRevenueLow: number;
  estimatedEbitdaAvg: number; estimatedEbitdaHigh: number; estimatedEbitdaLow: number;
  estimatedEpsAvg: number; estimatedEpsHigh: number; estimatedEpsLow: number;
  estimatedNetIncomeAvg: number;
  numberAnalystsEstimatedRevenue: number; numberAnalystEstimatedEps: number;
}
export interface FMPPriceTarget {
  symbol: string; targetHigh: number; targetLow: number;
  targetConsensus: number; targetMedian: number;
}

export interface AnalystData {
  quote: FMPQuote | null;
  rating: FMPRating | null;
  keyMetrics: FMPKeyMetrics | null;
  incomeStatements: FMPIncomeStatement[];
  estimates: FMPEstimate[];
  priceTarget: FMPPriceTarget | null;
  fetchedAt: string;
}

export type AnalystDataMap = Record<string, AnalystData>;

// ─── UI State ───
export type SortField = '종목명' | '현재가' | '가중평균단가' | '평가금액(원)' | '매수금액(원)' | '손익(원)' | '수익률' | 'targetPrice' | 'upside' | 'peRatio' | 'pbrRatio';
export type SortOrder = 'asc' | 'desc';
export interface SortState { field: SortField; order: SortOrder; }
export interface FilterState { search: string; sectors: string[]; markets: string[]; accounts: string[]; }
