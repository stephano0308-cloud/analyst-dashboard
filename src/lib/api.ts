import type { AnalystData, AnalystDataMap, FMPQuote, FMPRating, FMPKeyMetrics, FMPIncomeStatement, FMPEstimate, FMPPriceTarget } from '@/types';

const FMP_STABLE = 'https://financialmodelingprep.com/stable';
const FMP_V3 = 'https://financialmodelingprep.com/api/v3';
const FMP_V4 = 'https://financialmodelingprep.com/api/v4';
const CACHE_KEY = 'analyst_data_cache_v3';
const CACHE_TTL = 12 * 60 * 60 * 1000;

const KOREAN_TICKERS = new Set([
  'SK하이닉스','KODEX200','KODEX증권','삼성전자우','TIME코스닥',
  'TIGER증권','한화에어로','KODEX반도체','삼성전자','삼성전기',
  'HD현대중공업','현대차','현대로템','에스티팜','HD건설기계',
  'HD한국조선','한국금융우','세진중공업','삼성중공업','HD현대일렉',
  'KODEX코닥','미래에셋','테크윙','두산에너빌','TIGER지주',
  '한국카본','HD마린엔진','SOL금융','삼양식품','산일전기',
]);

export function isKoreanStock(ticker: string): boolean {
  return KOREAN_TICKERS.has(ticker) || /[가-힣]/.test(ticker);
}

export function isETFOrIndex(ticker: string, sector: string): boolean {
  const etfSectors = ['한국ETF','국내인덱스','국내금융','금','레버리지','크립토','기타'];
  const etfTickers = ['EWY','SMH','GLD','TQQQ','BTCI','FRMI'];
  return etfSectors.includes(sector) || etfTickers.includes(ticker);
}

export function normalizeTicker(ticker: string): string {
  if (/^\d{4}$/.test(ticker)) return `${ticker}.HK`;
  return ticker;
}

export function getApiKey(): string { return localStorage.getItem('fmp_api_key') || ''; }
export function setApiKey(key: string): void { localStorage.setItem('fmp_api_key', key); }

// ─── Cache ───

function getCachedData(): AnalystDataMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const first = Object.values(parsed)[0] as AnalystData | undefined;
    if (first?.fetchedAt) {
      if (Date.now() - new Date(first.fetchedAt).getTime() > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return {};
      }
    }
    return parsed;
  } catch { return {}; }
}

function setCachedData(data: AnalystDataMap): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
  catch { console.warn('[FMP] localStorage full'); }
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem('analyst_data_cache_v2');
}

// ─── Fetch ───

async function fetchJSON<T>(url: string, label: string): Promise<T | null> {
  try {
    console.log(`[FMP] → ${label}`);
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[FMP] ✗ ${label}: HTTP ${res.status} — ${t.substring(0, 100)}`);
      return null;
    }
    const text = await res.text();
    if (text.startsWith('<!') || text.startsWith('<html')) {
      console.warn(`[FMP] ✗ ${label}: HTML response`);
      return null;
    }
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if ('Error Message' in data) { console.warn(`[FMP] ✗ ${label}: ${data['Error Message']}`); return null; }
      if ('message' in data) { console.warn(`[FMP] ✗ ${label}: ${data['message']}`); return null; }
    }
    if (Array.isArray(data) && data.length === 0) { console.warn(`[FMP] ○ ${label}: empty`); return null; }
    console.log(`[FMP] ✓ ${label}: OK`);
    return data as T;
  } catch (err) {
    console.error(`[FMP] ✗ ${label}:`, err);
    return null;
  }
}

// ─── Endpoints (try stable → fallback v3) ───

async function fetchQuote(sym: string, key: string): Promise<FMPQuote | null> {
  let d = await fetchJSON<FMPQuote[]>(`${FMP_STABLE}/quote?symbol=${sym}&apikey=${key}`, `quote/${sym}[stable]`);
  if (d?.[0]) return d[0];
  d = await fetchJSON<FMPQuote[]>(`${FMP_V3}/quote/${sym}?apikey=${key}`, `quote/${sym}[v3]`);
  return d?.[0] || null;
}

async function fetchRating(sym: string, key: string): Promise<FMPRating | null> {
  let d = await fetchJSON<FMPRating[]>(`${FMP_STABLE}/rating?symbol=${sym}&apikey=${key}`, `rating/${sym}[stable]`);
  if (d?.[0]) return d[0];
  d = await fetchJSON<FMPRating[]>(`${FMP_V3}/rating/${sym}?apikey=${key}`, `rating/${sym}[v3]`);
  return d?.[0] || null;
}

async function fetchKeyMetrics(sym: string, key: string): Promise<FMPKeyMetrics | null> {
  let d = await fetchJSON<FMPKeyMetrics[]>(`${FMP_STABLE}/key-metrics-ttm?symbol=${sym}&apikey=${key}`, `metrics/${sym}[stable]`);
  if (d?.[0]) return d[0];
  d = await fetchJSON<FMPKeyMetrics[]>(`${FMP_V3}/key-metrics-ttm/${sym}?apikey=${key}`, `metrics/${sym}[v3]`);
  return d?.[0] || null;
}

async function fetchIncome(sym: string, key: string): Promise<FMPIncomeStatement[]> {
  let d = await fetchJSON<FMPIncomeStatement[]>(`${FMP_STABLE}/income-statement?symbol=${sym}&limit=4&apikey=${key}`, `income/${sym}[stable]`);
  if (d && d.length > 0) return d;
  d = await fetchJSON<FMPIncomeStatement[]>(`${FMP_V3}/income-statement/${sym}?limit=4&apikey=${key}`, `income/${sym}[v3]`);
  return d || [];
}

async function fetchEstimates(sym: string, key: string): Promise<FMPEstimate[]> {
  const d = await fetchJSON<FMPEstimate[]>(`${FMP_V3}/analyst-estimates/${sym}?limit=3&apikey=${key}`, `estimates/${sym}`);
  return d || [];
}

async function fetchPriceTarget(sym: string, key: string): Promise<FMPPriceTarget | null> {
  const d = await fetchJSON<FMPPriceTarget[]>(`${FMP_V4}/price-target-consensus?symbol=${sym}&apikey=${key}`, `ptarget/${sym}`);
  return d?.[0] || null;
}

// ─── Main ───

export async function fetchAnalystData(symbol: string, apiKey: string): Promise<AnalystData> {
  const sym = normalizeTicker(symbol);
  const [quote, rating, keyMetrics, incomeStatements, estimates, priceTarget] = await Promise.all([
    fetchQuote(sym, apiKey),
    fetchRating(sym, apiKey),
    fetchKeyMetrics(sym, apiKey),
    fetchIncome(sym, apiKey),
    fetchEstimates(sym, apiKey),
    fetchPriceTarget(sym, apiKey),
  ]);
  return { quote, rating, keyMetrics, incomeStatements, estimates, priceTarget, fetchedAt: new Date().toISOString() };
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
    console.log('[FMP] 모든 데이터 캐시됨 — 휴지통 아이콘으로 캐시 삭제 후 재시도');
    return result;
  }

  console.log(`%c[FMP] ${toFetch.length}개 종목 조회 시작`, 'color: #3b82f6; font-weight: bold;');
  console.log('[FMP] 종목:', toFetch.join(', '));

  // Test API key
  try {
    const testRes = await fetch(`${FMP_V3}/quote/AAPL?apikey=${apiKey}`);
    if (!testRes.ok) throw new Error(`HTTP ${testRes.status}`);
    const testText = await testRes.text();
    if (testText.startsWith('<!') || testText.startsWith('<html')) throw new Error('HTML response — invalid key');
    const testData = JSON.parse(testText);
    if (testData?.['Error Message']) throw new Error(testData['Error Message']);
    console.log(`%c[FMP] API Key 유효 ✓ (AAPL=$${testData?.[0]?.price || '?'})`, 'color: #22c55e');
  } catch (err: any) {
    console.error('[FMP] API Key 테스트 실패:', err);
    throw new Error(`API Key 오류: ${err.message}`);
  }

  for (let i = 0; i < toFetch.length; i++) {
    const ticker = toFetch[i];
    onProgress?.(i + 1, toFetch.length, ticker);
    console.log(`%c[FMP] ─── ${i+1}/${toFetch.length}: ${ticker} (→${normalizeTicker(ticker)}) ───`, 'color: #94a3b8');

    try {
      result[ticker] = await fetchAnalystData(ticker, apiKey);
      const ad = result[ticker];
      const parts = [
        ad.quote && `시세($${ad.quote.price})`,
        ad.rating && `등급(${ad.rating.rating})`,
        ad.keyMetrics && `PER(${ad.keyMetrics.peRatioTTM?.toFixed(1)})`,
        ad.incomeStatements.length > 0 && `재무(${ad.incomeStatements.length}년)`,
        ad.estimates.length > 0 && 'EPS전망',
        ad.priceTarget && `목표($${ad.priceTarget.targetConsensus})`,
      ].filter(Boolean);
      console.log(`%c[FMP] ✓ ${ticker}: ${parts.length > 0 ? parts.join(' | ') : '❌ 데이터없음'}`, parts.length > 0 ? 'color: #22c55e' : 'color: #ef4444');
    } catch (err) {
      console.error(`[FMP] ✗ ${ticker}:`, err);
    }

    if (i < toFetch.length - 1) await new Promise(r => setTimeout(r, 350));
  }

  setCachedData(result);
  const withData = Object.values(result).filter(v => v.quote || v.rating || v.keyMetrics || v.incomeStatements?.length > 0).length;
  console.log(`%c[FMP] 완료! ${withData}/${Object.keys(result).length} 종목 데이터 로드됨`, 'color: #3b82f6; font-weight: bold;');
  return result;
}

export { getCachedData };
