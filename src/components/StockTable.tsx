import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MergedItem, AnalystDataMap, SortState, SortField } from '@/types';
import { formatKRW, formatPercent, formatRatio, formatPrice, getUpsidePercent, cn } from '@/lib/utils';
import { isETFOrIndex } from '@/lib/api';

interface StockTableProps {
  items: MergedItem[];
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
    <span className={`flex items-center justify-end gap-1 font-mono text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export default function StockTable({ items, analystData, sortState, onSort, selectedTicker, onSelect }: StockTableProps) {
  const columns: { key: SortField; label: string; align?: 'right' | 'center' }[] = [
    { key: '종목명', label: '종목' },
    { key: '현재가', label: '현재가', align: 'right' },
    { key: '가중평균단가', label: '매수단가', align: 'right' },
    { key: '평가금액(원)', label: '평가금액', align: 'right' },
    { key: '손익(원)', label: '수익금', align: 'right' },
    { key: '수익률', label: '수익률', align: 'right' },
    { key: 'targetPrice', label: '목표주가', align: 'right' },
    { key: 'upside', label: '상승여력', align: 'right' },
    { key: 'peRatio', label: 'PER', align: 'right' },
    { key: 'pbrRatio', label: 'PBR', align: 'right' },
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
                    'px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none whitespace-nowrap',
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
            {items.map((item) => {
              const ad = analystData[item.티커];
              const isETF = isETFOrIndex(item.티커, item.섹터);
              const pt = ad?.priceTarget;
              const km = ad?.keyMetrics;
              const quote = ad?.quote;
              const targetPrice = pt?.targetConsensus || 0;
              const upside = targetPrice && item.현재가 ? getUpsidePercent(item.현재가, targetPrice) : 0;
              const pe = km?.peRatioTTM || quote?.pe || 0;
              const pbr = km?.priceToBookRatioTTM || 0;
              const isSelected = selectedTicker === item.티커;
              const isMultiAccount = item.계좌목록.length > 1;

              return (
                <tr
                  key={item.티커}
                  onClick={() => onSelect(item.티커)}
                  className={cn(
                    'border-b border-slate-800/50 cursor-pointer transition-colors table-row-hover',
                    isSelected && 'bg-blue-500/5 border-l-2 border-l-blue-500',
                  )}
                >
                  {/* 종목 */}
                  <td className="px-3 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-200 leading-tight flex items-center gap-1.5">
                        {item.종목명}
                        {isMultiAccount && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400/70 font-medium">
                            {item.계좌목록.length}계좌
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="ticker-badge text-slate-500">{item.티커}</span>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] text-slate-600">{item.섹터}</span>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] text-slate-600">{item.총수량.toLocaleString()}주</span>
                      </div>
                    </div>
                  </td>

                  {/* 현재가 */}
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-xs text-slate-300">
                      {formatPrice(item.현재가, item.통화)}
                    </span>
                  </td>

                  {/* 매수평균단가 */}
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-xs text-slate-500">
                      {formatPrice(item.가중평균단가, item.통화)}
                    </span>
                  </td>

                  {/* 평가금액 */}
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-xs text-slate-300">{formatKRW(item['평가금액(원)'])}</span>
                  </td>

                  {/* 수익금 */}
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-mono text-xs', item['손익(원)'] > 0 ? 'text-emerald-400' : item['손익(원)'] < 0 ? 'text-red-400' : 'text-slate-400')}>
                      {item['손익(원)'] >= 0 ? '+' : ''}{formatKRW(item['손익(원)'])}
                    </span>
                  </td>

                  {/* 수익률 */}
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-mono text-xs', item.수익률 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPercent(item.수익률)}
                    </span>
                  </td>

                  {/* 목표주가 */}
                  <td className="px-3 py-3 text-right">
                    {targetPrice && !isETF ? (
                      <span className="font-mono text-xs text-slate-300">
                        {formatPrice(targetPrice, item.통화)}
                      </span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>

                  {/* 상승여력 */}
                  <td className="px-3 py-3 text-right">
                    {!isETF && targetPrice ? <UpsideCell value={upside} /> : <span className="text-slate-600 text-xs">—</span>}
                  </td>

                  {/* PER */}
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-xs text-slate-400">
                      {pe && !isETF ? formatRatio(pe) : '—'}
                    </span>
                  </td>

                  {/* PBR */}
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-xs text-slate-400">
                      {pbr && !isETF ? formatRatio(pbr) : '—'}
                    </span>
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
