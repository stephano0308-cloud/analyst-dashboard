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

// ─── Analyst Data (FMP API) ───

export interface AnalystEstimate {
  symbol: string;
  date: string;
  estimatedRevenueAvg: number;
  estimatedRevenueHigh: number;
  estimatedRevenueLow: number;
  estimatedEbitdaAvg: number;
  estimatedEbitdaHigh: number;
  estimatedEbitdaLow: number;
  estimatedEpsAvg: number;
  estimatedEpsHigh: number;
  estimatedEpsLow: number;
  estimatedNetIncomeAvg: number;
  numberAnalystsEstimatedRevenue: number;
  numberAnalystEstimatedEps: number;
}

export interface PriceTargetConsensus {
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetConsensus: number;
  targetMedian: number;
}

export interface KeyMetrics {
  symbol: string;
  peRatioTTM: number;
  pegRatioTTM: number;
  priceToBookRatioTTM: number;
  priceToSalesRatioTTM: number;
  enterpriseValueOverEBITDATTM: number;
  dividendYieldTTM: number;
  marketCapTTM: number;
  debtToEquityTTM: number;
  roeTTM: number;
  currentRatioTTM: number;
}

export interface StockRating {
  symbol: string;
  date: string;
  rating: string;
  ratingScore: number;
  ratingRecommendation: string;
  ratingDetailsDCFScore: number;
  ratingDetailsDCFRecommendation: string;
  ratingDetailsROEScore: number;
  ratingDetailsROERecommendation: string;
  ratingDetailsROAScore: number;
  ratingDetailsROARecommendation: string;
  ratingDetailsDEScore: number;
  ratingDetailsDERecommendation: string;
  ratingDetailsPEScore: number;
  ratingDetailsPERecommendation: string;
  ratingDetailsPBScore: number;
  ratingDetailsPBRecommendation: string;
}

export interface AnalystData {
  estimates: AnalystEstimate[];
  priceTarget: PriceTargetConsensus | null;
  keyMetrics: KeyMetrics | null;
  rating: StockRating | null;
  fetchedAt: string;
}

export type AnalystDataMap = Record<string, AnalystData>;

// ─── UI State ───

export type SortField = keyof PortfolioItem | 'targetPrice' | 'upside' | 'peRatio' | 'ratingScore';
export type SortOrder = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  order: SortOrder;
}

export interface FilterState {
  search: string;
  sectors: string[];
  markets: string[];
  accounts: string[];
}
