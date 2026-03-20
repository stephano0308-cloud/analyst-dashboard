import type { AnalystEstimate, PriceTargetConsensus, KeyMetrics, StockRating, AnalystData, AnalystDataMap } from '@/types';

const FMP_BASE = 'https://financialmodelingprep.com/api';
const CACHE_KEY = 'analyst_data_cache';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

// Korean stock ticker mapping (KRX code -> name for display)
const KOREAN_TICKERS = new Set([
  'SK하이닉스', 'KODEX200', 'KODEX증권', '삼성전자우', 'TIME코스닥',
  'TIGER증권', '한화에어로', 'KODEX반도체', '삼성전자', '삼성전기',
  'HD현대중공업', '현대차', '현대로템', '에스티팜', 'HD건설기계',
  'HD한국조선', '한국금융우', '세진중공업', '삼성중공업', 'HD현대일렉',
  'KODEX코닥', '미래에셋', '테크윙', '두산에너빌', 'TIGER지주',
  '한국카본', 'HD마린엔진', 'SOL금융', '삼양식품', '산일전기',
]);

export function isKoreanStock(ticker: string): boolean {
  return KOREAN_TICKERS.has(ticker) || /[가-힣]/.test(ticker);
}

export function isETFOrIndex(ticker: string, sector: string): boolean {
  const etfSectors = ['한국ETF', '국내인덱스', '국내금융', '금', '레버리지', '크립토', '기타'];
  const etfTickers = ['EWY', 'SMH', 'GLD', 'TQQQ', 'BTCI', 'FRMI'];
  return etfSectors.includes(sector) || etfTickers.includes(ticker);
}

export function getApiKey(): string {
  return localStorage.getItem('fmp_api_key') || '';
}

export function setApiKey(key: string): void {
  localStorage.setItem('fmp_api_key', key);
}

// ─── Cache ───

function getCachedData(): AnalystDataMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Check if cache is still valid
    const firstEntry = Object.values(parsed)[0] as AnalystData | undefined;
    if (firstEntry?.fetchedAt) {
      const age = Date.now() - new Date(firstEntry.fetchedAt).getTime();
      if (age > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return {};
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

function setCachedData(data: AnalystDataMap): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ─── API Fetch Helpers ───

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    // FMP returns error messages as objects
    if (data && typeof data === 'object' && 'Error Message' in data) return null;
    return data as T;
  } catch {
    return null;
  }
}

async function fetchEstimates(symbol: string, apiKey: string): Promise<AnalystEstimate[]> {
  const data = await fetchJSON<AnalystEstimate[]>(
    `${FMP_BASE}/v3/analyst-estimates/${symbol}?limit=3&apikey=${apiKey}`
  );
  return data || [];
}

async function fetchPriceTarget(symbol: string, apiKey: string): Promise<PriceTargetConsensus | null> {
  const data = await fetchJSON<PriceTargetConsensus[]>(
    `${FMP_BASE}/v4/price-target-consensus?symbol=${symbol}&apikey=${apiKey}`
  );
  return data?.[0] || null;
}

async function fetchKeyMetrics(symbol: string, apiKey: string): Promise<KeyMetrics | null> {
  const data = await fetchJSON<KeyMetrics[]>(
    `${FMP_BASE}/v3/key-metrics-ttm/${symbol}?apikey=${apiKey}`
  );
  return data?.[0] || null;
}

async function fetchRating(symbol: string, apiKey: string): Promise<StockRating | null> {
  const data = await fetchJSON<StockRating[]>(
    `${FMP_BASE}/v3/rating/${symbol}?apikey=${apiKey}`
  );
  return data?.[0] || null;
}

// ─── Main Fetch ───

export async function fetchAnalystData(
  symbol: string,
  apiKey: string
): Promise<AnalystData> {
  const [estimates, priceTarget, keyMetrics, rating] = await Promise.all([
    fetchEstimates(symbol, apiKey),
    fetchPriceTarget(symbol, apiKey),
    fetchKeyMetrics(symbol, apiKey),
    fetchRating(symbol, apiKey),
  ]);

  return {
    estimates,
    priceTarget,
    keyMetrics,
    rating,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAllAnalystData(
  tickers: string[],
  apiKey: string,
  onProgress?: (done: number, total: number, current: string) => void
): Promise<AnalystDataMap> {
  const cached = getCachedData();
  const result: AnalystDataMap = { ...cached };
  const toFetch = tickers.filter(t => !cached[t]);

  for (let i = 0; i < toFetch.length; i++) {
    const ticker = toFetch[i];
    onProgress?.(i + 1, toFetch.length, ticker);

    try {
      result[ticker] = await fetchAnalystData(ticker, apiKey);
    } catch {
      // Skip failed fetches
    }

    // Rate limiting: wait 250ms between calls (FMP free tier)
    if (i < toFetch.length - 1) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  setCachedData(result);
  return result;
}

export { getCachedData };
