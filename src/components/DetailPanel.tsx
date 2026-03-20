import { X, Target, BarChart3, TrendingUp, Star, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { PortfolioItem, AnalystData } from '@/types';
import { formatKRW, formatUSD, formatRatio, formatLargeNumber, getRatingLabel, getRatingColor, getUpsidePercent, cn } from '@/lib/utils';

interface DetailPanelProps {
  item: PortfolioItem;
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

function RatingBar({ label, score, recommendation }: { label: string; score: number; recommendation: string }) {
  const width = (score / 5) * 100;
  const barColor = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-blue-500' : score >= 2 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-10 text-slate-500 font-medium shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-8 text-right text-slate-400 font-mono">{score}/5</span>
      <span className="w-16 text-right text-slate-500 text-[10px]">{recommendation}</span>
    </div>
  );
}

export default function DetailPanel({ item, analystData, onClose }: DetailPanelProps) {
  const pt = analystData?.priceTarget;
  const km = analystData?.keyMetrics;
  const rating = analystData?.rating;
  const estimates = analystData?.estimates || [];

  const isKRW = item.통화 === 'KRW';
  const formatPrice = (v: number) => isKRW ? formatKRW(v) : `$${v.toFixed(2)}`;
  const upside = pt?.targetConsensus ? getUpsidePercent(item.현재가, pt.targetConsensus) : null;
  const ratingInfo = rating ? getRatingLabel(rating.ratingRecommendation) : null;

  // EPS estimate chart data
  const epsChartData = estimates
    .slice(0, 3)
    .reverse()
    .map(e => ({
      year: e.date.substring(0, 4),
      avg: e.estimatedEpsAvg,
      high: e.estimatedEpsHigh,
      low: e.estimatedEpsLow,
    }));

  // Revenue estimate chart data
  const revChartData = estimates
    .slice(0, 3)
    .reverse()
    .map(e => ({
      year: e.date.substring(0, 4),
      revenue: e.estimatedRevenueAvg,
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
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-xs text-slate-500">{item.계좌}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="p-5 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {!analystData ? (
          <div className="text-center py-12">
            <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">애널리스트 데이터가 없습니다</p>
            <p className="text-xs text-slate-600 mt-1">상단의 '데이터 조회' 버튼으로 불러오세요</p>
          </div>
        ) : (
          <>
            {/* ── Price Target Section ── */}
            {pt && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <Target className="w-3.5 h-3.5" /> 목표주가 컨센서스
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard
                    label="현재가"
                    value={formatPrice(item.현재가)}
                  />
                  <MetricCard
                    label="컨센서스"
                    value={formatPrice(pt.targetConsensus)}
                    sub={upside !== null ? `${upside >= 0 ? '▲' : '▼'} ${(upside * 100).toFixed(1)}%` : undefined}
                    color={upside && upside > 0 ? 'text-emerald-400' : 'text-red-400'}
                  />
                  <MetricCard label="최고" value={formatPrice(pt.targetHigh)} color="text-emerald-400" />
                  <MetricCard label="최저" value={formatPrice(pt.targetLow)} color="text-red-400" />
                </div>

                {/* Price range visualizer */}
                {pt.targetLow > 0 && pt.targetHigh > 0 && (
                  <div className="mt-3 px-2">
                    <div className="relative h-2 bg-slate-800 rounded-full">
                      {/* Range bar */}
                      <div
                        className="absolute h-full bg-gradient-to-r from-red-500/30 via-blue-500/30 to-emerald-500/30 rounded-full"
                        style={{
                          left: '0%',
                          width: '100%',
                        }}
                      />
                      {/* Current price marker */}
                      {(() => {
                        const pct = ((item.현재가 - pt.targetLow) / (pt.targetHigh - pt.targetLow)) * 100;
                        const clamped = Math.max(0, Math.min(100, pct));
                        return (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow"
                            style={{ left: `${clamped}%`, marginLeft: '-6px' }}
                            title={`현재가: ${formatPrice(item.현재가)}`}
                          />
                        );
                      })()}
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-600 font-mono">
                      <span>{formatPrice(pt.targetLow)}</span>
                      <span>{formatPrice(pt.targetHigh)}</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Valuation Metrics ── */}
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

            {/* ── Rating ── */}
            {rating && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <Star className="w-3.5 h-3.5" /> FMP 종합 등급
                </h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-3xl font-bold font-mono', getRatingColor(rating.ratingScore))}>
                      {rating.rating}
                    </span>
                    <div>
                      <p className={cn('text-sm font-semibold', getRatingColor(rating.ratingScore))}>
                        {rating.ratingScore}/5
                      </p>
                      {ratingInfo && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ratingInfo.color}`}>
                          {ratingInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <RatingBar label="DCF" score={rating.ratingDetailsDCFScore} recommendation={rating.ratingDetailsDCFRecommendation} />
                  <RatingBar label="ROE" score={rating.ratingDetailsROEScore} recommendation={rating.ratingDetailsROERecommendation} />
                  <RatingBar label="ROA" score={rating.ratingDetailsROAScore} recommendation={rating.ratingDetailsROARecommendation} />
                  <RatingBar label="D/E" score={rating.ratingDetailsDEScore} recommendation={rating.ratingDetailsDERecommendation} />
                  <RatingBar label="P/E" score={rating.ratingDetailsPEScore} recommendation={rating.ratingDetailsPERecommendation} />
                  <RatingBar label="P/B" score={rating.ratingDetailsPBScore} recommendation={rating.ratingDetailsPBRecommendation} />
                </div>
              </section>
            )}

            {/* ── EPS Estimates Chart ── */}
            {epsChartData.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <TrendingUp className="w-3.5 h-3.5" /> EPS 전망치
                </h3>
                <div className="h-48 bg-slate-800/30 rounded-lg p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={epsChartData} barGap={4}>
                      <XAxis
                        dataKey="year"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#e2e8f0',
                        }}
                        formatter={(value: number, name: string) => [
                          `$${value.toFixed(2)}`,
                          name === 'avg' ? '평균' : name === 'high' ? '최고' : '최저',
                        ]}
                      />
                      <Bar dataKey="low" fill="#ef4444" opacity={0.3} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                        {epsChartData.map((_, i) => (
                          <Cell key={i} fill="#3b82f6" />
                        ))}
                      </Bar>
                      <Bar dataKey="high" fill="#22c55e" opacity={0.3} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Analyst count */}
                {estimates[0]?.numberAnalystEstimatedEps > 0 && (
                  <p className="text-[10px] text-slate-600 mt-1 text-right">
                    EPS 추정 애널리스트 수: {estimates[0].numberAnalystEstimatedEps}명
                  </p>
                )}
              </section>
            )}

            {/* ── Revenue Estimates Chart ── */}
            {revChartData.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <BarChart3 className="w-3.5 h-3.5" /> 매출 전망치
                </h3>
                <div className="h-48 bg-slate-800/30 rounded-lg p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revChartData}>
                      <XAxis
                        dataKey="year"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => formatLargeNumber(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#e2e8f0',
                        }}
                        formatter={(value: number) => [formatLargeNumber(value), '매출 전망']}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {revChartData.map((_, i) => (
                          <Cell key={i} fill={i === revChartData.length - 1 ? '#3b82f6' : '#334155'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {estimates[0]?.numberAnalystsEstimatedRevenue > 0 && (
                  <p className="text-[10px] text-slate-600 mt-1 text-right">
                    매출 추정 애널리스트 수: {estimates[0].numberAnalystsEstimatedRevenue}명
                  </p>
                )}
              </section>
            )}

            {/* ── EBITDA Estimates Table ── */}
            {estimates.length > 0 && estimates.some(e => e.estimatedEbitdaAvg > 0) && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  영업이익(EBITDA) 전망
                </h3>
                <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">연도</th>
                        <th className="px-3 py-2 text-right text-slate-500 font-medium">평균</th>
                        <th className="px-3 py-2 text-right text-slate-500 font-medium">최고</th>
                        <th className="px-3 py-2 text-right text-slate-500 font-medium">최저</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimates.slice(0, 3).reverse().map(e => (
                        <tr key={e.date} className="border-b border-slate-800/50">
                          <td className="px-3 py-2 text-slate-400 font-mono">{e.date.substring(0, 4)}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">{formatLargeNumber(e.estimatedEbitdaAvg)}</td>
                          <td className="px-3 py-2 text-right text-emerald-400/60 font-mono">{formatLargeNumber(e.estimatedEbitdaHigh)}</td>
                          <td className="px-3 py-2 text-right text-red-400/60 font-mono">{formatLargeNumber(e.estimatedEbitdaLow)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Data source */}
            <div className="pt-2 border-t border-slate-800/50 flex justify-between items-center">
              <p className="text-[10px] text-slate-600">
                데이터 출처: Financial Modeling Prep
              </p>
              <a
                href={`https://financialmodelingprep.com/financial-statements/${item.티커}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                FMP에서 보기
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
