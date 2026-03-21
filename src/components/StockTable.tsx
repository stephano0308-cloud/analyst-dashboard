import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MergedItem, AnalystDataMap, SortState, SortField } from '@/types';
import { formatKRW, formatPercent, formatRatio, formatPrice, getUpsidePercent, cn } from '@/lib/utils';
import { isETFOrIndex } from '@/lib/api';

interface Props {
  items: MergedItem[];
  analystData: AnalystDataMap;
  sortState: SortState;
  onSort: (field: SortField) => void;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
}

function SI({ field, s }: { field: SortField; s: SortState }) {
  if (s.field !== field) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
  return s.order === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
}

function Upside({ value }: { value: number }) {
  if (!value || !isFinite(value)) return <span className="text-slate-600">—</span>;
  const p = value * 100;
  const c = p > 10 ? 'text-emerald-400' : p > 0 ? 'text-emerald-500/70' : p > -10 ? 'text-amber-400' : 'text-red-400';
  const I = p > 0 ? TrendingUp : p < 0 ? TrendingDown : Minus;
  return <span className={`flex items-center justify-end gap-1 font-mono text-xs ${c}`}><I className="w-3 h-3" />{p >= 0 ? '+' : ''}{p.toFixed(1)}%</span>;
}

function TechBadge({ signal, rsi }: { signal?: string | null; rsi?: number | null }) {
  if (!signal && !rsi) return <span className="text-slate-600 text-xs">—</span>;
  const isOB = signal?.includes('과매수');
  const isOS = signal?.includes('과매도');
  const macdPlus = signal?.includes('MACD+');
  const color = isOB ? 'bg-red-500/15 text-red-400 border-red-500/25'
    : isOS ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
    : macdPlus ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : 'bg-slate-500/10 text-slate-500 border-slate-600/20';

  return (
    <div className="flex flex-col items-center gap-0.5">
      {rsi != null && <span className="font-mono text-[10px] text-slate-500">RSI {rsi}</span>}
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${color}`}>
        {isOB ? '과매수' : isOS ? '과매도' : macdPlus ? 'MACD↑' : 'MACD↓'}
      </span>
    </div>
  );
}

export default function StockTable({ items, analystData, sortState, onSort, selectedTicker, onSelect }: Props) {
  const cols: { key: SortField; label: string; align?: 'right'|'center' }[] = [
    { key: '종목명', label: '종목' },
    { key: '현재가', label: '현재가', align: 'right' },
    { key: '손익(원)', label: '등락/수익', align: 'right' },
    { key: '가중평균단가', label: '매수단가', align: 'right' },
    { key: '평가금액(원)', label: '평가금액', align: 'right' },
    { key: '수익률', label: '수익률', align: 'right' },
    { key: 'targetPrice', label: '목표가', align: 'right' },
    { key: 'upside', label: '상승여력', align: 'right' },
    { key: 'peRatio', label: 'PER', align: 'right' },
    { key: 'pbrRatio', label: '기술적', align: 'center' },
  ];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {cols.map(c => (
                <th key={c.key} onClick={() => onSort(c.key)}
                  className={cn('px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 select-none whitespace-nowrap',
                    c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                  <span className="inline-flex items-center gap-1">{c.label}<SI field={c.key} s={sortState} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const ad = analystData[item.티커];
              const isETF = isETFOrIndex(item.티커, item.섹터);
              const pt = ad?.priceTarget;
              const km = ad?.keyMetrics;
              const quote = ad?.quote;
              const tp = pt?.targetConsensus || 0;
              const upside = tp && item.현재가 ? getUpsidePercent(item.현재가, tp) : 0;
              const pe = km?.peRatioTTM || quote?.pe || 0;
              const dc = ad?.dailyChangePct;
              const sel = selectedTicker === item.티커;
              const multi = item.계좌목록.length > 1;

              return (
                <tr key={item.티커} onClick={() => onSelect(item.티커)}
                  className={cn('border-b border-slate-800/50 cursor-pointer transition-colors table-row-hover', sel && 'bg-blue-500/5 border-l-2 border-l-blue-500')}>

                  {/* 종목 */}
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-medium text-slate-200 leading-tight flex items-center gap-1.5">
                      {item.종목명}
                      {multi && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400/70 font-medium">{item.계좌목록.length}계좌</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="ticker-badge text-slate-500">{item.티커}</span>
                      <span className="text-[10px] text-slate-600">{item.섹터} · {item.총수량.toLocaleString()}주</span>
                    </div>
                  </td>

                  {/* 현재가 */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs text-slate-300">{formatPrice(item.현재가, item.통화)}</span>
                  </td>

                  {/* 등락/수익금 */}
                  <td className="px-3 py-2.5 text-right">
                    {dc != null ? (
                      <div>
                        <span className={cn('font-mono text-xs', dc >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {dc >= 0 ? '+' : ''}{dc.toFixed(2)}%
                        </span>
                        <div className={cn('font-mono text-[10px]', item['손익(원)'] >= 0 ? 'text-emerald-500/60' : 'text-red-400/60')}>
                          {item['손익(원)'] >= 0 ? '+' : ''}{formatKRW(item['손익(원)'])}
                        </div>
                      </div>
                    ) : (
                      <span className={cn('font-mono text-xs', item['손익(원)'] >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {item['손익(원)'] >= 0 ? '+' : ''}{formatKRW(item['손익(원)'])}
                      </span>
                    )}
                  </td>

                  {/* 매수단가 */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs text-slate-500">{formatPrice(item.가중평균단가, item.통화)}</span>
                  </td>

                  {/* 평가금액 */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs text-slate-300">{formatKRW(item['평가금액(원)'])}</span>
                  </td>

                  {/* 수익률 */}
                  <td className="px-3 py-2.5 text-right">
                    <span className={cn('font-mono text-xs', item.수익률 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPercent(item.수익률)}
                    </span>
                  </td>

                  {/* 목표가 */}
                  <td className="px-3 py-2.5 text-right">
                    {tp && !isETF
                      ? <span className="font-mono text-xs text-slate-300">{formatPrice(tp, item.통화)}</span>
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>

                  {/* 상승여력 */}
                  <td className="px-3 py-2.5 text-right">
                    {!isETF && tp ? <Upside value={upside} /> : <span className="text-slate-600 text-xs">—</span>}
                  </td>

                  {/* PER */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs text-slate-400">
                      {pe && !isETF ? formatRatio(pe) : '—'}
                    </span>
                    {ad?.forwardPer && !isETF && (
                      <div className="font-mono text-[10px] text-blue-400/60">F:{formatRatio(ad.forwardPer)}</div>
                    )}
                  </td>

                  {/* 기술적 */}
                  <td className="px-3 py-2.5 text-center">
                    {!isETF ? <TechBadge signal={ad?.technicalSignal} rsi={ad?.rsi14} /> : <span className="text-slate-600 text-xs">—</span>}
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
