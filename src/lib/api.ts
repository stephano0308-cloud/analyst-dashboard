import type { AnalystData, AnalystDataMap, FMPQuote, FMPRating, FMPKeyMetrics, FMPIncomeStatement, FMPEstimate, FMPPriceTarget } from '@/types';
import { addLog } from '@/components/DebugPanel';

const FMP_BASE = 'https://financialmodelingprep.com/stable';
const FMP_API_KEY = '0MqrFlVPBeukWtObFyGLdzQbvlwOab7n';
const CACHE_KEY = 'analyst_data_cache_v4';
const CACHE_TTL = 24 * 60 * 60 * 1000;

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
  return FMP_API_KEY;
}

export function setApiKey(_key: string): void {
  // No-op: API key is hardcoded
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
    addLog('WARN localStorage 용량 초과');
  }
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ─── Rate Limit Tracking ───

let rateLimitHit = false;

// ─── Fetch Helper ───

async function fetchJSON<T>(url: string, label: string): Promise<T | null> {
  // Skip if we already hit rate limit
  if (rateLimitHit) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 429) {
        rateLimitHit = true;
        addLog(`⚠️ ${label}: 일일 한도 도달 (250/day) — 나머지 건너뜀`);
        return null;
      }
      if (res.status === 402) {
        // 402 = paid tier required for this specific ticker, skip silently
        return null;
      }
      if (res.status === 404) {
        return null;
      }
      addLog(`✗ ${label}: HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (data && typeof data === 'object' && !Array.isArray(data) && 'Error Message' in data) {
      return null;
    }
    if (Array.isArray(data) && data.length === 0) {
      return null;
    }
    return data as T;
  } catch (err: any) {
    addLog(`ERROR ${label}: ${err?.message || String(err)}`);
    return null;
  }
}

// ─── Endpoints (only proven working ones) ───
// Skipped: rating (404), analyst-estimates (400) — not available on /stable/ free tier

async function fetchQuote(symbol: string, apiKey: string): Promise<FMPQuote | null> {
  const data = await fetchJSON<FMPQuote[]>(
    `${FMP_BASE}/quote?symbol=${symbol}&apikey=${apiKey}`,
    `quote/${symbol}`
  );
  return data?.[0] || null;
}

async function fetchKeyMetrics(symbol: string, apiKey: string): Promise<FMPKeyMetrics | null> {
  const data = await fetchJSON<FMPKeyMetrics[]>(
    `${FMP_BASE}/key-metrics-ttm?symbol=${symbol}&apikey=${apiKey}`,
    `metrics/${symbol}`
  );
  return data?.[0] || null;
}

async function fetchIncomeStatements(symbol: string, apiKey: string): Promise<FMPIncomeStatement[]> {
  const data = await fetchJSON<FMPIncomeStatement[]>(
    `${FMP_BASE}/income-statement?symbol=${symbol}&limit=4&apikey=${apiKey}`,
    `income/${symbol}`
  );
  return data || [];
}

async function fetchPriceTarget(symbol: string, apiKey: string): Promise<FMPPriceTarget | null> {
  const data = await fetchJSON<FMPPriceTarget[]>(
    `${FMP_BASE}/price-target-consensus?symbol=${symbol}&apikey=${apiKey}`,
    `target/${symbol}`
  );
  return data?.[0] || null;
}

// ─── Main Fetch (4 endpoints per ticker = ~116 calls for 29 tickers) ───

export async function fetchAnalystData(
  symbol: string,
  apiKey: string
): Promise<AnalystData> {
  const [quote, keyMetrics, incomeStatements, priceTarget] = await Promise.all([
    fetchQuote(symbol, apiKey),
    fetchKeyMetrics(symbol, apiKey),
    fetchIncomeStatements(symbol, apiKey),
    fetchPriceTarget(symbol, apiKey),
  ]);

  return {
    quote,
    rating: null,        // Not available on /stable/ free
    keyMetrics,
    incomeStatements,
    estimates: [],       // Not available on /stable/ free
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
    addLog('✓ 캐시에서 모든 데이터 로드됨');
    return result;
  }

  const estimatedCalls = toFetch.length * 4;
  addLog(`${toFetch.length}개 티커 조회 시작 (예상 ${estimatedCalls}콜, 한도 250/일)`);

  // Reset rate limit flag
  rateLimitHit = false;

  // Test API key
  try {
    addLog('API Key 검증 중...');
    const testRes = await fetch(`${FMP_BASE}/quote?symbol=AAPL&apikey=${apiKey}`);
    if (!testRes.ok) {
      const errText = await testRes.text().catch(() => '');
      addLog(`✗ API Key 실패: HTTP ${testRes.status} — ${errText.substring(0, 80)}`);
      throw new Error(`HTTP ${testRes.status}`);
    }
    const testData = await testRes.json();
    if (!Array.isArray(testData) || testData.length === 0) {
      throw new Error('Empty response');
    }
    addLog(`✓ API Key 유효 — AAPL: $${testData[0]?.price}`);
  } catch (err: any) {
    throw new Error('API Key가 유효하지 않습니다. 확인 후 다시 시도해주세요.');
  }

  let successCount = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const ticker = toFetch[i];
    onProgress?.(i + 1, toFetch.length, ticker);

    // Stop if rate limit hit
    if (rateLimitHit) {
      addLog(`⚠️ ${ticker} 이후 ${toFetch.length - i}개 종목 건너뜀 (한도 초과)`);
      break;
    }

    try {
      result[ticker] = await fetchAnalystData(ticker, apiKey);
      const ad = result[ticker];
      const parts = [
        ad.quote && `$${ad.quote.price}`,
        ad.keyMetrics && 'metrics',
        ad.incomeStatements.length > 0 && `income(${ad.incomeStatements.length}yr)`,
        ad.priceTarget && `target:$${ad.priceTarget.targetConsensus}`,
      ].filter(Boolean);

      if (parts.length > 0) {
        addLog(`✓ ${ticker}: ${parts.join(', ')}`);
        successCount++;
      } else {
        addLog(`— ${ticker}: 데이터 없음 (402 유료 전용)`);
      }
    } catch (err: any) {
      addLog(`✗ ${ticker}: ${err?.message || String(err)}`);
    }

    // 500ms delay between tickers to avoid 429
    if (i < toFetch.length - 1 && !rateLimitHit) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  addLog(`완료! ${successCount}/${toFetch.length} 종목 데이터 로드됨`);
  if (rateLimitHit) {
    addLog('💡 일일 한도에 도달했습니다. 24시간 후 캐시 삭제 → 재조회하면 나머지 종목도 로드됩니다.');
  }

  setCachedData(result);
  return result;
}

export { getCachedData };
