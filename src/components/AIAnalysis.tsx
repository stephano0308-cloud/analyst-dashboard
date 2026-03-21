import { useState, useCallback } from 'react';
import { Brain, RefreshCw, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import type { MergedItem, AnalystDataMap } from '@/types';
import { formatKRW, formatPercent, cn } from '@/lib/utils';
import { isETFOrIndex } from '@/lib/api';

interface Props {
  items: MergedItem[];
  analystData: AnalystDataMap;
}

function buildPrompt(items: MergedItem[], ad: AnalystDataMap): string {
  const totalValue = items.reduce((s, i) => s + i['평가금액(원)'], 0);
  const totalPL = items.reduce((s, i) => s + i['손익(원)'], 0);
  const totalInvested = items.reduce((s, i) => s + i['매수금액(원)'], 0);
  const returnRate = totalInvested > 0 ? totalPL / totalInvested : 0;

  // Sector allocation
  const sectorMap = new Map<string, number>();
  const marketMap = new Map<string, number>();
  items.forEach(i => {
    sectorMap.set(i.섹터, (sectorMap.get(i.섹터) || 0) + i['평가금액(원)']);
    const m = i.통화 === 'USD' ? '미국' : i.통화 === 'KRW' ? '한국' : '홍콩';
    marketMap.set(m, (marketMap.get(m) || 0) + i['평가금액(원)']);
  });

  // Top holdings
  const sorted = [...items].sort((a, b) => b['평가금액(원)'] - a['평가금액(원)']);

  // Build stock summary
  const stockLines = sorted.slice(0, 30).map(i => {
    const d = ad[i.티커];
    const parts = [
      `${i.종목명}(${i.티커})`,
      `평가:${formatKRW(i['평가금액(원)'])}`,
      `수익률:${(i.수익률 * 100).toFixed(1)}%`,
      `비중:${(i['평가금액(원)'] / totalValue * 100).toFixed(1)}%`,
    ];
    if (d?.dailyChangePct != null) parts.push(`일간:${d.dailyChangePct > 0 ? '+' : ''}${d.dailyChangePct.toFixed(1)}%`);
    if (d?.rsi14) parts.push(`RSI:${d.rsi14}`);
    if (d?.technicalSignal) parts.push(`기술:${d.technicalSignal}`);
    if (d?.priceTarget?.targetConsensus && i.현재가) {
      const up = ((d.priceTarget.targetConsensus - i.현재가) / i.현재가 * 100).toFixed(1);
      parts.push(`상승여력:${up}%`);
    }
    if (d?.keyMetrics?.peRatioTTM) parts.push(`PER:${d.keyMetrics.peRatioTTM.toFixed(1)}`);
    if (d?.forwardPer) parts.push(`fPER:${d.forwardPer.toFixed(1)}`);
    if (d?.recommendation) parts.push(`추천:${d.recommendation}`);
    if (d?.revenueGrowth) parts.push(`매출성장:${(d.revenueGrowth * 100).toFixed(1)}%`);
    return parts.join(' | ');
  }).join('\n');

  const sectorLines = Array.from(sectorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([s, v]) => `${s}: ${formatKRW(v)} (${(v / totalValue * 100).toFixed(1)}%)`)
    .join(', ');

  const marketLines = Array.from(marketMap.entries())
    .map(([m, v]) => `${m}: ${(v / totalValue * 100).toFixed(1)}%`)
    .join(', ');

  // Overbought/oversold stocks
  const overbought = items.filter(i => {
    const r = ad[i.티커]?.rsi14;
    return r != null && r >= 70;
  });
  const oversold = items.filter(i => {
    const r = ad[i.티커]?.rsi14;
    return r != null && r <= 30;
  });

  return `당신은 포트폴리오 분석 전문가입니다. 아래 포트폴리오를 분석하고 리밸런싱 의견을 한국어로 제시해주세요.

## 포트폴리오 개요
- 총 평가금액: ${formatKRW(totalValue)}
- 총 손익: ${formatKRW(totalPL)} (수익률: ${(returnRate * 100).toFixed(2)}%)
- 종목 수: ${items.length}개
- 시장 배분: ${marketLines}
- 섹터 배분: ${sectorLines}
${overbought.length > 0 ? `- RSI 과매수(≥70): ${overbought.map(i => i.종목명).join(', ')}` : ''}
${oversold.length > 0 ? `- RSI 과매도(≤30): ${oversold.map(i => i.종목명).join(', ')}` : ''}

## 종목별 현황 (상위 30)
${stockLines}

## 분석 요청사항
1. **포트폴리오 전체 평가**: 분산투자 적정성, 섹터/시장 편중도, 리스크 요인
2. **리밸런싱 의견**: 비중 축소/확대가 필요한 종목과 그 이유 (기술적 지표, 밸류에이션, 상승여력 기반)
3. **주의 종목**: RSI 과매수/과매도, 손실폭이 큰 종목, 밸류에이션이 높은 종목
4. **실행 가능한 액션 플랜**: 단기(1개월) / 중기(3개월) 구분

간결하고 실행 가능한 의견을 주세요. 각 섹션에 구체적 종목명을 포함해주세요.`;
}

export default function AIAnalysis({ items, analystData }: Props) {
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis('');

    const prompt = buildPrompt(items, analystData);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.map((c: any) => c.type === 'text' ? c.text : '').join('\n') || '';
      setAnalysis(text);
    } catch (err: any) {
      setError(err?.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [items, analystData]);

  // Quick stats for display
  const totalValue = items.reduce((s, i) => s + i['평가금액(원)'], 0);
  const overbought = items.filter(i => (analystData[i.티커]?.rsi14 ?? 50) >= 70);
  const oversold = items.filter(i => (analystData[i.티커]?.rsi14 ?? 50) <= 30);
  const highLoss = items.filter(i => i.수익률 < -0.2).sort((a, b) => a.수익률 - b.수익률);
  const highConcentration = items.filter(i => i['평가금액(원)'] / totalValue > 0.05).sort((a, b) => b['평가금액(원)'] - a['평가금액(원)']);

  return (
    <div className="space-y-6">
      {/* Quick Risk Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400">RSI 과매수 (≥70)</span>
          </div>
          {overbought.length > 0 ? (
            <div className="space-y-1">
              {overbought.map(i => (
                <div key={i.티커} className="text-xs text-red-400 font-mono">
                  {i.종목명} <span className="text-red-300">RSI {analystData[i.티커]?.rsi14}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">해당 없음</p>}
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">RSI 과매도 (≤30)</span>
          </div>
          {oversold.length > 0 ? (
            <div className="space-y-1">
              {oversold.map(i => (
                <div key={i.티커} className="text-xs text-emerald-400 font-mono">
                  {i.종목명} <span className="text-emerald-300">RSI {analystData[i.티커]?.rsi14}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">해당 없음</p>}
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">고손실 (≤-20%)</span>
          </div>
          {highLoss.length > 0 ? (
            <div className="space-y-1">
              {highLoss.slice(0, 5).map(i => (
                <div key={i.티커} className="text-xs text-amber-400 font-mono">
                  {i.종목명} <span className="text-red-400">{formatPercent(i.수익률)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">해당 없음</p>}
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">고비중 (≥5%)</span>
          </div>
          <div className="space-y-1">
            {highConcentration.slice(0, 5).map(i => (
              <div key={i.티커} className="text-xs text-blue-400 font-mono">
                {i.종목명} <span className="text-slate-400">{(i['평가금액(원)'] / totalValue * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-200">Claude AI 포트폴리오 분석 & 리밸런싱 의견</h3>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            {isLoading ? '분석 중...' : '포트폴리오 분석 실행'}
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {!analysis && !isLoading && !error && (
            <div className="text-center py-12">
              <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">위의 '포트폴리오 분석 실행' 버튼을 클릭하면</p>
              <p className="text-sm text-slate-400">Claude가 보유종목을 분석하고 리밸런싱 의견을 제시합니다.</p>
              <p className="text-xs text-slate-600 mt-3">분석 항목: 분산투자 적정성, 섹터 편중도, 기술적 과매수/과매도,</p>
              <p className="text-xs text-slate-600">밸류에이션 비교, 실행 가능한 단기/중기 액션 플랜</p>
            </div>
          )}

          {isLoading && (
            <div className="space-y-3 py-8">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
                <p className="text-sm text-slate-400">포트폴리오 분석 중...</p>
              </div>
              <p className="text-xs text-slate-600 text-center">RSI, MACD, 상승여력, 밸류에이션 등 종합 분석 중입니다</p>
            </div>
          )}

          {analysis && (
            <div className="prose prose-invert prose-sm max-w-none">
              {analysis.split('\n').map((line, i) => {
                if (!line.trim()) return <br key={i} />;
                if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-slate-100 mt-6 mb-2 border-b border-slate-700 pb-2">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-slate-200 mt-4 mb-1">{line.replace('### ', '')}</h3>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-slate-200 mt-3">{line.replace(/\*\*/g, '')}</p>;
                if (line.startsWith('- ')) return <p key={i} className="text-xs text-slate-300 pl-4 py-0.5 border-l-2 border-slate-700">{line.replace('- ', '')}</p>;
                if (line.match(/^\d+\./)) return <p key={i} className="text-xs text-slate-300 pl-4 py-0.5">{line}</p>;
                return <p key={i} className="text-xs text-slate-400 leading-relaxed">{line}</p>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
