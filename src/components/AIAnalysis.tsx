import { Brain, TrendingUp, AlertTriangle, BarChart3, Clock } from 'lucide-react';
import type { MergedItem, AnalystDataMap } from '@/types';
import { formatKRW, formatPercent, cn } from '@/lib/utils';
import aiAnalysisRaw from '@/data/ai-analysis.json';

interface Props {
  items: MergedItem[];
  analystData: AnalystDataMap;
}

const aiData = aiAnalysisRaw as { fetchedAt: string; analysis: string; status: string };

export default function AIAnalysis({ items, analystData }: Props) {
  const totalValue = items.reduce((s, i) => s + i['평가금액(원)'], 0);
  const overbought = items.filter(i => (analystData[i.티커]?.rsi14 ?? 50) >= 70);
  const oversold = items.filter(i => (analystData[i.티커]?.rsi14 ?? 50) <= 30);
  const highLoss = items.filter(i => i.수익률 < -0.2).sort((a, b) => a.수익률 - b.수익률);
  const highConcentration = items.filter(i => i['평가금액(원)'] / totalValue > 0.05).sort((a, b) => b['평가금액(원)'] - a['평가금액(원)']);

  const hasAnalysis = aiData.status === 'ok' && aiData.analysis;
  const analysisDate = aiData.fetchedAt ? new Date(aiData.fetchedAt).toLocaleString('ko-KR') : null;

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

      {/* AI Analysis from pre-generated JSON */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-200">Claude AI 포트폴리오 분석 & 리밸런싱 의견</h3>
          </div>
          {analysisDate && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              {analysisDate}
            </div>
          )}
        </div>

        <div className="p-5">
          {!hasAnalysis ? (
            <div className="text-center py-12">
              <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">AI 분석이 아직 생성되지 않았습니다.</p>
              <p className="text-xs text-slate-600 mt-2">매일 KST 07:00에 자동 생성되며,</p>
              <p className="text-xs text-slate-600">GitHub Actions에서 수동 실행도 가능합니다.</p>
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-left max-w-md mx-auto">
                <p className="text-[11px] text-slate-400 font-semibold mb-1">설정 방법:</p>
                <p className="text-[10px] text-slate-500">1. GitHub → Settings → Secrets → Actions</p>
                <p className="text-[10px] text-slate-500">2. <span className="font-mono text-violet-400">ANTHROPIC_API_KEY</span> 추가</p>
                <p className="text-[10px] text-slate-500">3. Actions → Crawl Analyst Data → Run workflow</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {aiData.analysis.split('\n').map((line, i) => {
                if (!line.trim()) return <div key={i} className="h-2" />;
                if (line.startsWith('### '))
                  return <h3 key={i} className="text-sm font-bold text-slate-100 mt-5 mb-2 flex items-center gap-2 border-b border-slate-700/50 pb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />{line.replace('### ', '')}
                  </h3>;
                if (line.startsWith('## '))
                  return <h2 key={i} className="text-base font-bold text-slate-100 mt-6 mb-2 border-b border-slate-700 pb-2">{line.replace('## ', '')}</h2>;
                if (line.startsWith('**') && line.endsWith('**'))
                  return <p key={i} className="text-sm font-semibold text-slate-200 mt-3">{line.replace(/\*\*/g, '')}</p>;
                if (line.startsWith('- **'))
                  return <p key={i} className="text-xs text-slate-300 pl-3 py-0.5 border-l-2 border-violet-500/30">
                    <span className="font-semibold text-slate-200">{line.match(/\*\*(.*?)\*\*/)?.[1]}</span>
                    {line.replace(/\*\*.*?\*\*/, '').replace('- ', '')}
                  </p>;
                if (line.startsWith('- '))
                  return <p key={i} className="text-xs text-slate-400 pl-3 py-0.5 border-l-2 border-slate-700">{line.replace('- ', '')}</p>;
                if (line.match(/^\d+\./))
                  return <p key={i} className="text-xs text-slate-300 pl-3 py-0.5">{line}</p>;
                return <p key={i} className="text-xs text-slate-400 leading-relaxed">{line}</p>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
