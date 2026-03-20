import { X, Target, BarChart3, TrendingUp, DollarSign, ExternalLink, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { MergedItem, AnalystData } from '@/types';
import { formatKRW, formatPrice, formatRatio, formatLargeNumber, formatPercent, getUpsidePercent, cn } from '@/lib/utils';

interface DetailPanelProps {
  item: MergedItem;
  analystData: AnalystData | null;
  onClose: () => void;
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/40 rounded-lg px-3 py-2.5 border border-slate-700/30">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-sm font-semibold font-mono', color || 'text-slate-200')}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DetailPanel({ item, analystData, onClose }: DetailPanelProps) {
  const quote = analystData?.quote;
  const pt = analystData?.priceTarget;
  const km = analystData?.keyMetrics;
  const incomeStatements = analystData?.incomeStatements || [];
  const upside = pt?.targetConsensus ? getUpsidePercent(item.현재가, pt.targetConsensus) : null;
  const hasAnyData = quote || km || incomeStatements.length > 0 || pt;

  const revenueChartData = incomeStatements
    .slice(0, 4).reverse()
    .map(s => ({
      year: s.calendarYear || s.date.substring(0, 4),
      revenue: s.revenue, ebitda: s.ebitda, operatingIncome: s.operatingIncome,
    }));

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{item.종목명}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="ticker-badge text-slate-500">{item.티커}</span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-xs text-slate-500">{item.섹터}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="p-5 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* ── Account Breakdown ── */}
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            <Wallet className="w-3.5 h-3.5" /> 보유 현황 ({item.총수량.toLocaleString()}주)
          </h3>
          <div className="bg-slate-800/30 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">계좌</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">수량</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">매수단가</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">수익률</th>
                </tr>
              </thead>
              <tbody>
                {item.원본항목.map((sub, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="px-3 py-2 text-slate-400">{sub.계좌}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{sub.수량.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-slate-400 font-mono">{formatPrice(sub.평균단가, sub.통화)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono', sub.수익률 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPercent(sub.수익률)}
                    </td>
                  </tr>
                ))}
                {item.원본항목.length > 1 && (
                  <tr className="bg-slate-800/20 font-semibold">
                    <td className="px-3 py-2 text-slate-300">합계</td>
                    <td className="px-3 py-2 text-right text-slate-200 font-mono">{item.총수량.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{formatPrice(item.가중평균단가, item.통화)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono', item.수익률 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPercent(item.수익률)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {!hasAnyData ? (
          <div className="text-center py-8">
            <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">애널리스트 데이터가 없습니다</p>
            <p className="text-xs text-slate-600 mt-1">'데이터 조회' 버튼으로 불러오세요</p>
          </div>
        ) : (
          <>
            {/* ── Quote ── */}
            {quote && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <DollarSign className="w-3.5 h-3.5" /> 시세
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard label="현재가" value={`$${quote.price.toFixed(2)}`} />
                  <MetricCard label="EPS" value={quote.eps ? `$${quote.eps.toFixed(2)}` : '—'} />
                  <MetricCard label="52주 고가" value={`$${quote.yearHigh.toFixed(2)}`} color="text-emerald-400" />
                  <MetricCard label="52주 저가" value={`$${quote.yearLow.toFixed(2)}`} color="text-red-400" />
                </div>
              </section>
            )}

            {/* ── Price Target ── */}
            {pt && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <Target className="w-3.5 h-3.5" /> 목표주가 컨센서스
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard label="현재가" value={formatPrice(item.현재가, item.통화)} />
                  <MetricCard label="컨센서스" value={formatPrice(pt.targetConsensus, item.통화)}
                    sub={upside !== null ? `${upside >= 0 ? '▲' : '▼'} ${(upside * 100).toFixed(1)}%` : undefined}
                    color={upside && upside > 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <MetricCard label="최고" value={formatPrice(pt.targetHigh, item.통화)} color="text-emerald-400" />
                  <MetricCard label="최저" value={formatPrice(pt.targetLow, item.통화)} color="text-red-400" />
                </div>
                {pt.targetLow > 0 && pt.targetHigh > 0 && (
                  <div className="mt-3 px-2">
                    <div className="relative h-2 bg-slate-800 rounded-full">
                      <div className="absolute h-full bg-gradient-to-r from-red-500/30 via-blue-500/30 to-emerald-500/30 rounded-full w-full" />
                      {(() => {
                        const pct = Math.max(0, Math.min(100, ((item.현재가 - pt.targetLow) / (pt.targetHigh - pt.targetLow)) * 100));
                        return <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow" style={{ left: `${pct}%`, marginLeft: '-6px' }} />;
                      })()}
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-600 font-mono">
                      <span>{formatPrice(pt.targetLow, item.통화)}</span>
                      <span>{formatPrice(pt.targetHigh, item.통화)}</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Valuation ── */}
            {km && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <BarChart3 className="w-3.5 h-3.5" /> 밸류에이션 (TTM)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard label="PER" value={formatRatio(km.peRatioTTM)} />
                  <MetricCard label="PEG" value={formatRatio(km.pegRatioTTM)} />
                  <MetricCard label="PBR" value={formatRatio(km.priceToBookRatioTTM)} />
                  <MetricCard label="PSR" value={formatRatio(km.priceToSalesRatioTTM)} />
                  <MetricCard label="EV/EBITDA" value={formatRatio(km.enterpriseValueOverEBITDATTM)} />
                  <MetricCard label="ROE" value={km.roeTTM ? `${(km.roeTTM * 100).toFixed(1)}%` : '—'} />
                  <MetricCard label="배당수익률" value={km.dividendYieldTTM ? `${(km.dividendYieldTTM * 100).toFixed(2)}%` : '—'} />
                  <MetricCard label="시가총액" value={km.marketCapTTM ? formatLargeNumber(km.marketCapTTM) : '—'} />
                </div>
              </section>
            )}

            {/* ── Revenue & EBITDA Chart ── */}
            {revenueChartData.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <TrendingUp className="w-3.5 h-3.5" /> 매출 / 영업이익 추이
                </h3>
                <div className="h-48 bg-slate-800/30 rounded-lg p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData} barGap={2}>
                      <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatLargeNumber(v)} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                        formatter={(value: number, name: string) => [formatLargeNumber(value), { revenue: '매출', ebitda: 'EBITDA', operatingIncome: '영업이익' }[name] || name]} />
                      <Bar dataKey="revenue" fill="#334155" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="operatingIncome" fill="#22c55e" opacity={0.7} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* ── Income Statement Table ── */}
            {incomeStatements.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">손익계산서</h3>
                <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-700/50">
                      <th className="px-3 py-2 text-left text-slate-500">연도</th>
                      <th className="px-3 py-2 text-right text-slate-500">매출</th>
                      <th className="px-3 py-2 text-right text-slate-500">영업이익</th>
                      <th className="px-3 py-2 text-right text-slate-500">순이익</th>
                      <th className="px-3 py-2 text-right text-slate-500">EPS</th>
                    </tr></thead>
                    <tbody>
                      {incomeStatements.slice(0, 4).reverse().map(s => (
                        <tr key={s.date} className="border-b border-slate-800/50">
                          <td className="px-3 py-2 text-slate-400 font-mono">{s.calendarYear || s.date.substring(0, 4)}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">{formatLargeNumber(s.revenue)}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">{formatLargeNumber(s.operatingIncome)}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">{formatLargeNumber(s.netIncome)}</td>
                          <td className="px-3 py-2 text-right text-slate-400 font-mono">${s.epsdiluted?.toFixed(2) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="pt-2 border-t border-slate-800/50 text-right">
              <a href={`https://financialmodelingprep.com/financial-statements/${item.티커}`} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400">
                <ExternalLink className="w-3 h-3" /> FMP
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
