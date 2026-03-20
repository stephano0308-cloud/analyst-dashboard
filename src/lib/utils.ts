export function formatKRW(value: number): string {
  if (Math.abs(value) >= 1e8) {
    return `${(value / 1e8).toFixed(1)}억`;
  }
  if (Math.abs(value) >= 1e4) {
    return `${(value / 1e4).toFixed(0)}만`;
  }
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

export function formatFullKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
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

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getUpsidePercent(current: number, target: number): number {
  if (!current || !target) return 0;
  return (target - current) / current;
}

export function getRatingColor(score: number): string {
  if (score >= 4) return 'text-emerald-400';
  if (score >= 3) return 'text-blue-400';
  if (score >= 2) return 'text-amber-400';
  return 'text-red-400';
}

export function getRatingLabel(recommendation: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    'Strong Buy': { label: '강력 매수', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'Buy': { label: '매수', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'Neutral': { label: '중립', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'Sell': { label: '매도', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    'Strong Sell': { label: '강력 매도', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  return map[recommendation] || { label: recommendation || '—', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
}
