import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PortfolioItem, AnalystDataMap, SortState, SortField } from '@/types';
import { formatKRW, formatPercent, formatRatio, getUpsidePercent, getRatingLabel, cn } from '@/lib/utils';
import { isKoreanStock, isETFOrIndex } from '@/lib/api';

interface StockTableProps {
  items: PortfolioItem[];
  analystData: AnalystDataMap;
  sortState: SortState;
  onSort: (field: SortField) => void;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
}

function SortIcon({ field, sortState }: { field: SortField; sortState: SortState }) {
  if (sortState.field !== field) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
  return sortState.order === 'asc'
    ? <ArrowUp className="w-3 h-3 text-blue-400" />
    : <ArrowDown className="w-3 h-3 text-blue-400" />;
}

function UpsideCell({ value }: { value: number }) {
  if (!value || !isFinite(value)) return <span className="text-slate-600">—</span>;
  const pct = value * 100;
  const color = pct > 10 ? 'text-emerald-400' : pct > 0 ? 'text-emerald-500/70' : pct > -10 ? 'text-amber-400' : 'text-red-400';
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;

  return (
    <span className={`flex items-center gap-1 font-mono text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export default function StockTable({
  items, analystData, sortState, onSort, selectedTicker, onSelect,
}: StockTableProps) {
  const columns: { key: SortField; label: string; align?: 'right' | 'center' }[] = [
    { key: '종목명', label: '종목' },
    { key: '평가금액(원)', label: '평가금액', align: 'right' },
    { key: '수익률', label: '수익률', align: 'right' },
    { key: 'targetPrice', label: '목표주가', align: 'right' },
    { key: 'upside', label: '상승여력', align: 'right' },
    { key: 'peRatio', label: 'PER', align: 'right' },
    { key: 'ratingScore', label: '등급', align: 'center' },
  ];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className={cn(
                    'px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} sortState={sortState} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const ad = analystData[item.티커];
              const isKR = isKoreanStock(item.티커);
              const isETF = isETFOrIndex(item.티커, item.섹터);
              const pt = ad?.priceTarget;
              const km = ad?.keyMetrics;
              const rating = ad?.rating;

              const targetPrice = pt?.targetConsensus || 0;
              const upside = targetPrice && item.현재가 ? getUpsidePercent(item.현재가, targetPrice) : 0;
              const ratingInfo = rating ? getRatingLabel(rating.ratingRecommendation) : null;

              const isSelected = selectedTicker === item.티커;

              return (
                <tr
                  key={`${item.티커}-${item.계좌}-${idx}`}
                  onClick={() => onSelect(item.티커)}
                  className={cn(
                    'border-b border-slate-800/50 cursor-pointer transition-colors table-row-hover',
                    isSelected && 'bg-blue-500/5 border-l-2 border-l-blue-500',
                  )}
                >
                  {/* 종목 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div>
                        <div className="text-sm font-medium text-slate-200 leading-tight">
                          {item.종목명}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="ticker-badge text-slate-500">{item.티커}</span>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className="text-[10px] text-slate-600">{item.섹터}</span>
                          {isKR && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400/60 font-medium">KR</span>}
                          {isETF && <span className="text-[9px] px-1 py-0.5 rounded bg-slate-500/10 text-slate-500 font-medium">ETF</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 평가금액 */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs text-slate-300">{formatKRW(item['평가금액(원)'])}</span>
                  </td>

                  {/* 수익률 */}
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'font-mono text-xs',
                      item.수익률 >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {formatPercent(item.수익률)}
                    </span>
                  </td>

                  {/* 목표주가 */}
                  <td className="px-4 py-3 text-right">
                    {targetPrice && !isETF ? (
                      <span className="font-mono text-xs text-slate-300">
                        {item.통화 === 'KRW' ? formatKRW(targetPrice) : `$${targetPrice.toFixed(2)}`}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* 상승여력 */}
                  <td className="px-4 py-3 text-right">
                    {!isETF && targetPrice ? <UpsideCell value={upside} /> : <span className="text-slate-600 text-xs">—</span>}
                  </td>

                  {/* PER */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs text-slate-400">
                      {km?.peRatioTTM && !isETF ? formatRatio(km.peRatioTTM) : '—'}
                    </span>
                  </td>

                  {/* 등급 */}
                  <td className="px-4 py-3 text-center">
                    {ratingInfo && !isETF ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ratingInfo.color}`}>
                        {ratingInfo.label}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
