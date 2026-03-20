import { TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import type { PortfolioItem, AnalystDataMap } from '@/types';
import { formatKRW, formatPercent, getUpsidePercent, cn } from '@/lib/utils';
import { isETFOrIndex } from '@/lib/api';

interface SummaryCardsProps {
  items: PortfolioItem[];
  analystData: AnalystDataMap;
}

export default function SummaryCards({ items, analystData }: SummaryCardsProps) {
  const totalValue = items.reduce((s, i) => s + i['평가금액(원)'], 0);
  const totalInvested = items.reduce((s, i) => s + i['매수금액(원)'], 0);
  const totalPL = items.reduce((s, i) => s + i['손익(원)'], 0);
  const returnRate = totalInvested > 0 ? totalPL / totalInvested : 0;

  // Upside stats
  const stocksWithTarget = items.filter(i => {
    if (isETFOrIndex(i.티커, i.섹터)) return false;
    const ad = analystData[i.티커];
    return ad?.priceTarget?.targetConsensus && ad.priceTarget.targetConsensus > 0;
  });

  const avgUpside = stocksWithTarget.length > 0
    ? stocksWithTarget.reduce((sum, i) => {
        const target = analystData[i.티커]?.priceTarget?.targetConsensus || 0;
        return sum + getUpsidePercent(i.현재가, target);
      }, 0) / stocksWithTarget.length
    : 0;

  // Rating stats
  const stocksWithRating = items.filter(i => analystData[i.티커]?.rating?.ratingScore != null);
  const avgRating = stocksWithRating.length > 0
    ? stocksWithRating.reduce((sum, i) => sum + (analystData[i.티커]?.rating?.ratingScore || 0), 0) / stocksWithRating.length
    : 0;

  // Data loaded count
  const loadedCount = Object.keys(analystData).length;

  const cards = [
    {
      label: '총 평가금액',
      value: formatKRW(totalValue),
      sub: `${items.length}종목`,
      icon: BarChart3,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: '총 손익',
      value: `${totalPL >= 0 ? '+' : ''}${formatKRW(totalPL)}`,
      sub: formatPercent(returnRate),
      icon: totalPL >= 0 ? TrendingUp : TrendingDown,
      color: totalPL >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: totalPL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: '평균 상승여력',
      value: stocksWithTarget.length > 0 ? `${(avgUpside * 100).toFixed(1)}%` : '—',
      sub: stocksWithTarget.length > 0 ? `${stocksWithTarget.length}종목 기준` : '목표주가 데이터 없음',
      icon: Target,
      color: avgUpside > 0 ? 'text-emerald-400' : avgUpside < 0 ? 'text-red-400' : 'text-slate-400',
      bgColor: avgUpside > 0 ? 'bg-emerald-500/10' : 'bg-slate-500/10',
    },
    {
      label: '평균 FMP 등급',
      value: stocksWithRating.length > 0 ? `${avgRating.toFixed(1)}/5` : '—',
      sub: stocksWithRating.length > 0 ? `${stocksWithRating.length}종목 기준` : loadedCount > 0 ? '등급 데이터 로드됨' : '데이터 조회 필요',
      icon: BarChart3,
      color: avgRating >= 3.5 ? 'text-emerald-400' : avgRating >= 2.5 ? 'text-blue-400' : avgRating > 0 ? 'text-amber-400' : 'text-slate-400',
      bgColor: avgRating >= 3.5 ? 'bg-emerald-500/10' : 'bg-blue-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', card.bgColor)}>
            <card.icon className={cn('w-4 h-4', card.color)} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{card.label}</p>
            <p className={cn('text-lg font-bold font-mono mt-0.5', card.color)}>{card.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
