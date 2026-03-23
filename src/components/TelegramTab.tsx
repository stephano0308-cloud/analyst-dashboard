import { useState } from 'react';
import { MessageSquare, Radio, Clock, Search, ExternalLink, Info } from 'lucide-react';
import telegramRaw from '@/data/telegram-analysis.json';
import type { MergedItem } from '@/types';
import { cn } from '@/lib/utils';

const tgData = telegramRaw as any;

interface Props {
  items: MergedItem[];
  onSelectTicker: (ticker: string) => void;
}

export default function TelegramTab({ items, onSelectTicker }: Props) {
  const [search, setSearch] = useState('');

  const hasData = tgData.status === 'ok' && Object.keys(tgData.stocks || {}).length > 0;
  const stocks = tgData.stocks || {};
  const fetchedAt = tgData.fetchedAt ? new Date(tgData.fetchedAt).toLocaleString('ko-KR') : null;

  // Filter by portfolio tickers + search
  const portfolioTickers = new Set(items.map(i => i.티커));
  const entries = Object.entries(stocks)
    .filter(([ticker]) => ticker !== '__market__')
    .filter(([ticker]) => {
      if (search) {
        const t = search.toLowerCase();
        const name = items.find(i => i.티커 === ticker)?.종목명 || '';
        return ticker.toLowerCase().includes(t) || name.toLowerCase().includes(t);
      }
      return true;
    })
    .sort((a: any, b: any) => (b[1].messageCount || 0) - (a[1].messageCount || 0));

  const marketSummary = stocks['__market__'];

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', hasData ? 'bg-emerald-500/10' : 'bg-slate-500/10')}>
            <Radio className={cn('w-4 h-4', hasData ? 'text-emerald-400' : 'text-slate-500')} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              텔레그램 채널 모니터링
              {hasData && <span className="ml-2 text-emerald-400 text-xs">● LIVE</span>}
            </p>
            <p className="text-[10px] text-slate-500">
              {hasData
                ? `${tgData.totalMessages || 0}개 메시지 · ${entries.length}종목 감지 · ${fetchedAt}`
                : '아직 수집된 데이터가 없습니다'}
            </p>
          </div>
        </div>
        {tgData.channels && (
          <div className="flex flex-wrap gap-1 max-w-md">
            {(tgData.channels as string[]).slice(0, 5).map(ch => (
              <span key={ch} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/20">
                @{ch}
              </span>
            ))}
            {(tgData.channels as string[]).length > 5 && (
              <span className="text-[9px] text-slate-500">+{(tgData.channels as string[]).length - 5}</span>
            )}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-8 text-center">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">텔레그램 데이터가 아직 수집되지 않았습니다.</p>
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg text-left max-w-lg mx-auto">
            <p className="text-[11px] text-slate-400 font-semibold mb-2">설정 방법:</p>
            <p className="text-[10px] text-slate-500">1. <a href="https://my.telegram.org" target="_blank" className="text-blue-400 hover:underline">my.telegram.org</a> → API development tools → API ID/Hash 발급</p>
            <p className="text-[10px] text-slate-500">2. Telethon StringSession 생성 (로컬에서 1회 실행)</p>
            <p className="text-[10px] text-slate-500">3. GitHub Secrets에 등록:</p>
            <p className="text-[10px] text-slate-500 pl-3 font-mono text-violet-400">TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION</p>
            <p className="text-[10px] text-slate-500">4. Actions → Crawl Analyst Data → Run workflow</p>
          </div>
        </div>
      ) : (
        <>
          {/* Market Summary */}
          {marketSummary && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <Info className="w-3.5 h-3.5" /> 시장 전반 동향
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">{marketSummary.summary}</p>
              <p className="text-[10px] text-slate-600 mt-2">{marketSummary.messageCount}개 메시지 기반</p>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="종목명 또는 티커 검색..."
              className="w-full pl-9 pr-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
          </div>

          {/* Stock Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map(([ticker, data]: [string, any]) => {
              const item = items.find(i => i.티커 === ticker);
              const isPortfolio = portfolioTickers.has(ticker);

              return (
                <div key={ticker}
                  onClick={() => onSelectTicker(ticker)}
                  className={cn(
                    'bg-[#111827] border rounded-lg p-4 cursor-pointer transition-colors hover:border-blue-500/30',
                    isPortfolio ? 'border-slate-800' : 'border-slate-800/50 opacity-70'
                  )}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">
                        {item?.종목명 || ticker}
                        {isPortfolio && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">보유</span>}
                      </h4>
                      <span className="ticker-badge text-slate-500">{ticker}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <MessageSquare className="w-3 h-3" />
                      {data.messageCount}
                    </div>
                  </div>

                  {/* Summary */}
                  {data.summary && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 mb-3">
                      {data.summary}
                    </p>
                  )}

                  {/* Channels */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(data.channels || []).map((ch: string) => (
                      <span key={ch} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                        @{ch}
                      </span>
                    ))}
                  </div>

                  {/* Recent Messages Preview */}
                  {data.messages && data.messages.length > 0 && (
                    <div className="border-t border-slate-800 pt-2 mt-2 space-y-1">
                      {data.messages.slice(0, 2).map((msg: any, i: number) => (
                        <p key={i} className="text-[10px] text-slate-600 truncate">
                          <span className="text-slate-500">@{msg.channel}</span> {msg.text}
                        </p>
                      ))}
                    </div>
                  )}

                  {data.latestDate && (
                    <p className="text-[9px] text-slate-600 mt-2 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(data.latestDate).toLocaleString('ko-KR')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {entries.length === 0 && (
            <p className="text-center text-xs text-slate-500 py-8">검색 결과가 없습니다</p>
          )}
        </>
      )}
    </div>
  );
}
