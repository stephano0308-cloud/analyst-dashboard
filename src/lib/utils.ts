import type { PortfolioItem, MergedItem, KoreanConsensusData, AnalystDataMap, AnalystData } from '@/types';

// ─── Convert Korean consensus to AnalystData format ───

export function koreanConsensusToAnalystData(krData: KoreanConsensusData): AnalystDataMap {
  const result: AnalystDataMap = {};

  for (const [ticker, item] of Object.entries(krData.stocks)) {
    const ad: AnalystData = {
      quote: item.currentPrice ? {
        symbol: item.code,
        price: item.currentPrice,
        pe: item.per || 0,
        marketCap: 0,
        eps: item.eps || 0,
        priceAvg50: 0, priceAvg200: 0,
        sharesOutstanding: 0,
        yearHigh: 0, yearLow: 0,
      } : null,
      rating: null,
      keyMetrics: (item.per || item.pbr) ? {
        peRatioTTM: item.per || 0,
        pegRatioTTM: 0,
        priceToBookRatioTTM: item.pbr || 0,
        priceToSalesRatioTTM: 0,
        enterpriseValueOverEBITDATTM: 0,
        dividendYieldTTM: item.dividendYield ? item.dividendYield / 100 : 0,
        marketCapTTM: 0,
        debtToEquityTTM: 0,
        roeTTM: 0,
        currentRatioTTM: 0,
      } : null,
      incomeStatements: [],
      estimates: [],
      priceTarget: item.targetPrice ? {
        symbol: item.code,
        targetHigh: item.targetPrice * 1.15,   // Rough estimate since we only have consensus
        targetLow: item.targetPrice * 0.85,
        targetConsensus: item.targetPrice,
        targetMedian: item.targetPrice,
      } : null,
      fetchedAt: krData.fetchedAt,
    };

    result[ticker] = ad;
  }

  return result;
}

// ─── Merge duplicate tickers ───

export function mergePortfolioItems(items: PortfolioItem[]): MergedItem[] {
  const map = new Map<string, PortfolioItem[]>();

  for (const item of items) {
    const key = item.티커;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  return Array.from(map.entries()).map(([ticker, group]) => {
    const first = group[0];
    const 총수량 = group.reduce((s, i) => s + i.수량, 0);
    const 평가금액 = group.reduce((s, i) => s + i['평가금액(원)'], 0);
    const 매수금액 = group.reduce((s, i) => s + i['매수금액(원)'], 0);
    const 손익 = group.reduce((s, i) => s + i['손익(원)'], 0);
    // Weighted average purchase price (in original currency)
    const 가중평균단가 = 총수량 > 0
      ? group.reduce((s, i) => s + i.평균단가 * i.수량, 0) / 총수량
      : 0;

    return {
      티커: ticker,
      종목명: first.종목명,
      섹터: first.섹터,
      통화: first.통화,
      현재가: first.현재가,
      총수량,
      가중평균단가,
      '평가금액(원)': 평가금액,
      '매수금액(원)': 매수금액,
      '손익(원)': 손익,
      수익률: 매수금액 > 0 ? 손익 / 매수금액 : 0,
      계좌목록: [...new Set(group.map(i => i.계좌))],
      원본항목: group,
    };
  });
}

// ─── Formatters ───

export function formatKRW(value: number): string {
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}만`;
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

export function formatFullKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number): string {
  const pct = value * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export function formatRatio(value: number | undefined | null): string {
  if (value == null || !isFinite(value)) return '—';
  return value.toFixed(1);
}

export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatPrice(value: number, currency: string): string {
  if (currency === 'KRW') return value.toLocaleString('ko-KR');
  if (currency === 'HKD') return `HK$${value.toFixed(2)}`;
  return `$${value.toFixed(2)}`;
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getUpsidePercent(current: number, target: number): number {
  if (!current || !target) return 0;
  return (target - current) / current;
}

export function getRatingLabel(rec: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    'Strong Buy': { label: '강력 매수', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'Buy': { label: '매수', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'Neutral': { label: '중립', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'Sell': { label: '매도', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    'Strong Sell': { label: '강력 매도', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  return map[rec] || { label: rec || '—', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
}

export function getRatingColor(score: number): string {
  if (score >= 4) return 'text-emerald-400';
  if (score >= 3) return 'text-blue-400';
  if (score >= 2) return 'text-amber-400';
  return 'text-red-400';
}
