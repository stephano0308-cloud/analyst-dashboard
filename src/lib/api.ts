import type { AnalystData, AnalystDataMap, FMPQuote, FMPRating, FMPKeyMetrics, FMPIncomeStatement, FMPEstimate, FMPPriceTarget } from '@/types';

const FMP_BASE = 'https://financialmodelingprep.com/api';
const CACHE_KEY = 'analyst_data_cache_v2';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

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
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    console.warn('[FMP] localStorage full, cache not saved');
  }
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ─── Fetch Helper ───

async function fetchJSON<T>(url: string, label: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 403) {
        console.warn(`[FMP] ${label}: 403 — 유료 플랜 필요`);
      } else {
        console.warn(`[FMP] ${label}: HTTP ${res.status}`);
      }
      return null;
    }
    const data = await res.json();
    if (data && typeof data === 'object' && !Array.isArray(data) && 'Error Message' in data) {
      console.warn(`[FMP] ${label}: ${(data as any)['Error Message']}`);
      return null;
    }
    if (Array.isArray(data) && data.length === 0) {
      return null;
    }
    return data as T;
  } catch (err) {
    console.error(`[FMP] ${label}: fetch error`, err);
    return null;
  }
}

// ─── Individual Endpoints ───

// ★ Free tier — works
async function fetchQuote(symbol: string, apiKey: string): Promise<FMPQuote | null> {
  const data = await fetchJSON<FMPQuote[]>(
    `${FMP_BASE}/v3/quote/${symbol}?apikey=${apiKey}`,
    `quote/${symbol}`
  );
  return data?.[0] || null;
}

// ★ Free tier — works
async function fetchRating(symbol: string, apiKey: string): Promise<FMPRating | null> {
  const data = await fetchJSON<FMPRating[]>(
    `${FMP_BASE}/v3/rating/${symbol}?apikey=${apiKey}`,
    `rating/${symbol}`
  );
  return data?.[0] || null;
}

// ★ Free tier — works
async function fetchKeyMetrics(symbol: string, apiKey: string): Promise<FMPKeyMetrics | null> {
  const data = await fetchJSON<FMPKeyMetrics[]>(
    `${FMP_BASE}/v3/key-metrics-ttm/${symbol}?apikey=${apiKey}`,
    `key-metrics/${symbol}`
  );
  return data?.[0] || null;
}

// ★ Free tier — works (actual financial data)
async function fetchIncomeStatements(symbol: string, apiKey: string): Promise<FMPIncomeStatement[]> {
  const data = await fetchJSON<FMPIncomeStatement[]>(
    `${FMP_BASE}/v3/income-statement/${symbol}?limit=4&apikey=${apiKey}`,
    `income/${symbol}`
  );
  return data || [];
}

// ☆ Starter+ plan — graceful fallback
async function fetchEstimates(symbol: string, apiKey: string): Promise<FMPEstimate[]> {
  const data = await fetchJSON<FMPEstimate[]>(
    `${FMP_BASE}/v3/analyst-estimates/${symbol}?limit=3&apikey=${apiKey}`,
    `estimates/${symbol}`
  );
  return data || [];
}

// ☆ Starter+ plan — graceful fallback
async function fetchPriceTarget(symbol: string, apiKey: string): Promise<FMPPriceTarget | null> {
  const data = await fetchJSON<FMPPriceTarget[]>(
    `${FMP_BASE}/v4/price-target-consensus?symbol=${symbol}&apikey=${apiKey}`,
    `price-target/${symbol}`
  );
  return data?.[0] || null;
}

// ─── Main Fetch ───

export async function fetchAnalystData(
  symbol: string,
  apiKey: string
): Promise<AnalystData> {
  const [quote, rating, keyMetrics, incomeStatements, estimates, priceTarget] = await Promise.all([
    fetchQuote(symbol, apiKey),
    fetchRating(symbol, apiKey),
    fetchKeyMetrics(symbol, apiKey),
    fetchIncomeStatements(symbol, apiKey),
    fetchEstimates(symbol, apiKey),
    fetchPriceTarget(symbol, apiKey),
  ]);

  return {
    quote,
    rating,
    keyMetrics,
    incomeStatements,
    estimates,
    priceTarget,
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

  if (toFetch.length === 0) {
    console.log('[FMP] All data cached — nothing to fetch');
    return result;
  }

  console.log(`[FMP] Fetching ${toFetch.length} tickers:`, toFetch);

  // Test API key first
  try {
    const testRes = await fetch(`${FMP_BASE}/v3/quote/AAPL?apikey=${apiKey}`);
    if (!testRes.ok) {
      throw new Error(`HTTP ${testRes.status}`);
    }
    const testData = await testRes.json();
    if (!Array.isArray(testData) || testData.length === 0) {
      throw new Error('Invalid response');
    }
    console.log('[FMP] API key validated ✓');
  } catch (err) {
    console.error('[FMP] API key test failed:', err);
    throw new Error('API Key가 유효하지 않습니다. 확인 후 다시 시도해주세요.');
  }

  for (let i = 0; i < toFetch.length; i++) {
    const ticker = toFetch[i];
    onProgress?.(i + 1, toFetch.length, ticker);

    try {
      result[ticker] = await fetchAnalystData(ticker, apiKey);
      const ad = result[ticker];
      const available = [
        ad.quote && 'quote',
        ad.rating && 'rating',
        ad.keyMetrics && 'metrics',
        ad.incomeStatements.length > 0 && 'income',
        ad.estimates.length > 0 && 'estimates',
        ad.priceTarget && 'priceTarget',
      ].filter(Boolean);
      console.log(`[FMP] ✓ ${ticker}: ${available.join(', ')}`);
    } catch (err) {
      console.error(`[FMP] ✗ ${ticker} failed:`, err);
    }

    // Rate limit: 300ms between tickers
    if (i < toFetch.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  setCachedData(result);
  return result;
}

export { getCachedData };
