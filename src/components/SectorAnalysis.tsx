import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { MergedItem, AnalystDataMap } from '@/types';
import { formatKRW, formatPercent, cn } from '@/lib/utils';
import { isETFOrIndex } from '@/lib/api';

interface Props {
  items: MergedItem[];
  analystData: AnalystDataMap;
}

interface SectorData {
  name: string;
  avgReturn: number;
  avgDailyChange: number;
  avgUpside: number;
  count: number;
  totalValue: number;
  avgRsi: number;
  bullCount: number;
  bearCount: number;
}

export default function SectorAnalysis({ items, analystData }: Props) {
  // Aggregate by sector
  const sectorMap = new Map<string, { returns: number[]; daily: number[]; upsides: number[]; rsis: number[]; value: number; count: number; bulls: number; bears: number }>();

  for (const item of items) {
    if (isETFOrIndex(item.티커, item.섹터)) continue;
    const ad = analystData[item.티커];
    const s = sectorMap.get(item.섹터) || { returns: [], daily: [], upsides: [], rsis: [], value: 0, count: 0, bulls: 0, bears: 0 };

    s.returns.push(item.수익률);
    s.value += item['평가금액(원)'];
    s.count++;

    if (ad?.dailyChangePct != null) s.daily.push(ad.dailyChangePct);
    if (ad?.priceTarget?.targetConsensus && item.현재가) {
      s.upsides.push((ad.priceTarget.targetConsensus - item.현재가) / item.현재가);
    }
    if (ad?.rsi14 != null) s.rsis.push(ad.rsi14);
    if (ad?.technicalSignal?.includes('MACD+')) s.bulls++;
    if (ad?.technicalSignal?.includes('MACD-')) s.bears++;

    sectorMap.set(item.섹터, s);
  }

  const sectors: SectorData[] = Array.from(sectorMap.entries())
    .map(([name, d]) => ({
      name,
      avgReturn: d.returns.length ? d.returns.reduce((a, b) => a + b, 0) / d.returns.length : 0,
      avgDailyChange: d.daily.length ? d.daily.reduce((a, b) => a + b, 0) / d.daily.length : 0,
      avgUpside: d.upsides.length ? d.upsides.reduce((a, b) => a + b, 0) / d.upsides.length : 0,
      count: d.count,
      totalValue: d.value,
      avgRsi: d.rsis.length ? d.rsis.reduce((a, b) => a + b, 0) / d.rsis.length : 0,
      bullCount: d.bulls,
      bearCount: d.bears,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  const rsChartData = [...sectors].sort((a, b) => b.avgReturn - a.avgReturn);

  return (
    <div className="space-y-6">
      {/* Sector Return Bar Chart */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">섹터별 상대강도 (보유수익률 기준)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rsChartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={75} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, '평균 수익률']}
              />
              <Bar dataKey="avgReturn" radius={[0, 4, 4, 0]}>
                {rsChartData.map((d, i) => (
                  <Cell key={i} fill={d.avgReturn >= 0 ? '#22c55e' : '#ef4444'} opacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sector Detail Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200">섹터별 상세 분석</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2.5 text-left text-slate-500">섹터</th>
                <th className="px-4 py-2.5 text-right text-slate-500">종목수</th>
                <th className="px-4 py-2.5 text-right text-slate-500">평가금액</th>
                <th className="px-4 py-2.5 text-right text-slate-500">평균수익률</th>
                <th className="px-4 py-2.5 text-right text-slate-500">평균일간등락</th>
                <th className="px-4 py-2.5 text-right text-slate-500">평균상승여력</th>
                <th className="px-4 py-2.5 text-right text-slate-500">평균RSI</th>
                <th className="px-4 py-2.5 text-center text-slate-500">MACD 신호</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map(s => {
                const rsiColor = s.avgRsi >= 70 ? 'text-red-400' : s.avgRsi <= 30 ? 'text-emerald-400' : 'text-slate-300';
                return (
                  <tr key={s.name} className="border-b border-slate-800/50 table-row-hover">
                    <td className="px-4 py-2.5 text-slate-200 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{s.count}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono">{formatKRW(s.totalValue)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-mono', s.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPercent(s.avgReturn)}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-mono', s.avgDailyChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {s.avgDailyChange ? `${s.avgDailyChange >= 0 ? '+' : ''}${s.avgDailyChange.toFixed(2)}%` : '—'}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-mono', s.avgUpside > 0 ? 'text-emerald-400' : s.avgUpside < 0 ? 'text-red-400' : 'text-slate-500')}>
                      {s.avgUpside ? `${(s.avgUpside * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-mono', rsiColor)}>
                      {s.avgRsi ? s.avgRsi.toFixed(0) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {s.bullCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">▲{s.bullCount}</span>}
                        {s.bearCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">▼{s.bearCount}</span>}
                        {!s.bullCount && !s.bearCount && <span className="text-slate-600">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
