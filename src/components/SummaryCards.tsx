import { TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import type { MergedItem, AnalystDataMap } from '@/types';
import { formatKRW, formatPercent, getUpsidePercent, cn } from '@/lib/utils';
import { isETFOrIndex } from '@/lib/api';

interface SummaryCardsProps { items: MergedItem[]; analystData: AnalystDataMap; }

export default function SummaryCards({ items, analystData }: SummaryCardsProps) {
  const totalValue = items.reduce((s, i) => s + i['평가금액(원)'], 0);
  const totalInvested = items.reduce((s, i) => s + i['매수금액(원)'], 0);
  const totalPL = items.reduce((s, i) => s + i['손익(원)'], 0);
  const returnRate = totalInvested > 0 ? totalPL / totalInvested : 0;

  const withTarget = items.filter(i => {
    if (isETFOrIndex(i.티커, i.섹터)) return false;
    return analystData[i.티커]?.priceTarget?.targetConsensus;
  });
  const avgUpside = withTarget.length > 0
    ? withTarget.reduce((s, i) => s + getUpsidePercent(i.현재가, analystData[i.티커]?.priceTarget?.targetConsensus || 0), 0) / withTarget.length
    : 0;

  const loadedCount = Object.keys(analystData).length;

  const cards = [
    { label: '총 평가금액', value: formatKRW(totalValue), sub: `${items.length}종목 (합산)`, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '총 손익', value: `${totalPL >= 0 ? '+' : ''}${formatKRW(totalPL)}`, sub: formatPercent(returnRate), icon: totalPL >= 0 ? TrendingUp : TrendingDown, color: totalPL >= 0 ? 'text-emerald-400' : 'text-red-400', bg: totalPL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
    { label: '평균 상승여력', value: withTarget.length > 0 ? `${(avgUpside * 100).toFixed(1)}%` : '—', sub: withTarget.length > 0 ? `${withTarget.length}종목` : '목표주가 없음', icon: Target, color: avgUpside > 0 ? 'text-emerald-400' : 'text-slate-400', bg: avgUpside > 0 ? 'bg-emerald-500/10' : 'bg-slate-500/10' },
    { label: 'FMP 데이터', value: loadedCount > 0 ? `${loadedCount}종목` : '—', sub: loadedCount > 0 ? '로드 완료' : '조회 필요', icon: BarChart3, color: loadedCount > 0 ? 'text-blue-400' : 'text-slate-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', c.bg)}><c.icon className={cn('w-4 h-4', c.color)} /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
            <p className={cn('text-lg font-bold font-mono mt-0.5', c.color)}>{c.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
