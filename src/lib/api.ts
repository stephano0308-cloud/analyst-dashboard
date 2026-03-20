import type { AnalystData, AnalystDataMap, FMPQuote, FMPRating, FMPKeyMetrics, FMPIncomeStatement, FMPEstimate, FMPPriceTarget } from '@/types';
import { addLog } from '@/components/DebugPanel';

// ★ NEW base URL — FMP deprecated /api/v3/ and /api/v4/ in Aug 2025
const FMP_BASE = 'https://financialmodelingprep.com/stable';
const CACHE_KEY = 'analyst_data_cache_v3';
const CACHE_TTL = 12 * 60 * 60 * 1000;

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
    addLog('WARN localStorage 용량 초과');
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
        addLog(`WARN ${label}: 403 — 유료 플랜 전용 또는 잘못된 키`);
      } else if (res.status === 429) {
        addLog(`WARN ${label}: 429 — 요청 한도 초과 (250/day)`);
      } else {
        addLog(`✗ ${label}: HTTP ${res.status}`);
      }
      return null;
    }
    const text = await res.text();
    if (!text || text.trim() === '') {
      addLog(`WARN ${label}: 빈 응답`);
      return null;
    }
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      addLog(`✗ ${label}: JSON 파싱 실패 — ${text.substring(0, 80)}`);
      return null;
    }
    if (data && typeof data === 'object' && !Array.isArray(data) && 'Error Message' in data) {
      addLog(`✗ ${label}: ${data['Error Message'].substring(0, 100)}`);
      return null;
    }
    if (Array.isArray(data) && data.length === 0) {
      addLog(`WARN ${label}: 빈 배열`);
      return null;
    }
    return data as T;
  } catch (err: any) {
    addLog(`ERROR ${label}: ${err?.message || String(err)}`);
    return null;
  }
}

// ─── Endpoints (NEW /stable/ URLs) ───

// Quote: /stable/quote?symbol=AAPL
async function fetchQuote(symbol: string, apiKey: string): Promise<FMPQuote | null> {
  const data = await fetchJSON<FMPQuote[]>(
    `${FMP_BASE}/quote?symbol=${symbol}&apikey=${apiKey}`,
    `quote/${symbol}`
  );
  return data?.[0] || null;
}

// Company rating: /stable/rating?symbol=AAPL
async function fetchRating(symbol: string, apiKey: string): Promise<FMPRating | null> {
  const data = await fetchJSON<FMPRating[]>(
    `${FMP_BASE}/rating?symbol=${symbol}&apikey=${apiKey}`,
    `rating/${symbol}`
  );
  return data?.[0] || null;
}

// Key metrics TTM: /stable/key-metrics-ttm?symbol=AAPL
async function fetchKeyMetrics(symbol: string, apiKey: string): Promise<FMPKeyMetrics | null> {
  const data = await fetchJSON<FMPKeyMetrics[]>(
    `${FMP_BASE}/key-metrics-ttm?symbol=${symbol}&apikey=${apiKey}`,
    `metrics/${symbol}`
  );
  return data?.[0] || null;
}

// Income statement: /stable/income-statement?symbol=AAPL&limit=4
async function fetchIncomeStatements(symbol: string, apiKey: string): Promise<FMPIncomeStatement[]> {
  const data = await fetchJSON<FMPIncomeStatement[]>(
    `${FMP_BASE}/income-statement?symbol=${symbol}&limit=4&apikey=${apiKey}`,
    `income/${symbol}`
  );
  return data || [];
}

// Analyst estimates: /stable/analyst-estimates?symbol=AAPL&limit=3
async function fetchEstimates(symbol: string, apiKey: string): Promise<FMPEstimate[]> {
  const data = await fetchJSON<FMPEstimate[]>(
    `${FMP_BASE}/analyst-estimates?symbol=${symbol}&limit=3&apikey=${apiKey}`,
    `estimates/${symbol}`
  );
  return data || [];
}

// Price target consensus: /stable/price-target-consensus?symbol=AAPL
async function fetchPriceTarget(symbol: string, apiKey: string): Promise<FMPPriceTarget | null> {
  const data = await fetchJSON<FMPPriceTarget[]>(
    `${FMP_BASE}/price-target-consensus?symbol=${symbol}&apikey=${apiKey}`,
    `target/${symbol}`
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
    addLog('캐시에서 모든 데이터 로드됨 — 새 요청 없음');
    return result;
  }

  addLog(`${toFetch.length}개 티커 조회 시작: ${toFetch.join(', ')}`);

  // Test API key with new /stable/ endpoint
  try {
    addLog('API Key 유효성 검증 중... (NEW /stable/ URL)');
    const testRes = await fetch(`${FMP_BASE}/quote?symbol=AAPL&apikey=${apiKey}`);
    if (!testRes.ok) {
      const errText = await testRes.text().catch(() => '');
      addLog(`✗ API Key 테스트 실패: HTTP ${testRes.status} — ${errText.substring(0, 100)}`);
      throw new Error(`HTTP ${testRes.status}`);
    }
    const testText = await testRes.text();
    let testData: any;
    try {
      testData = JSON.parse(testText);
    } catch {
      addLog(`✗ API Key 테스트: 파싱 실패 — ${testText.substring(0, 100)}`);
      throw new Error('Invalid JSON');
    }
    if (!Array.isArray(testData) || testData.length === 0) {
      addLog(`✗ API Key 테스트: 빈 응답 — ${JSON.stringify(testData).substring(0, 200)}`);
      throw new Error('Empty response');
    }
    addLog(`✓ API Key 유효 — AAPL: $${testData[0]?.price}`);
  } catch (err: any) {
    addLog(`ERROR API Key 검증 실패: ${err?.message}`);
    throw new Error('API Key가 유효하지 않거나 FMP 서버 오류입니다. 키를 확인해주세요.');
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
        ad.incomeStatements.length > 0 && `income(${ad.incomeStatements.length}yr)`,
        ad.estimates.length > 0 && 'estimates',
        ad.priceTarget && 'target',
      ].filter(Boolean);
      addLog(`✓ ${ticker}: ${available.length > 0 ? available.join(', ') : '데이터 없음'}`);
    } catch (err: any) {
      addLog(`✗ ${ticker} 실패: ${err?.message || String(err)}`);
    }

    if (i < toFetch.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  addLog(`완료! ${Object.keys(result).length}개 티커 데이터 캐시됨`);
  setCachedData(result);
  return result;
}

export { getCachedData };
