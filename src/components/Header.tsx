import { useState } from 'react';
import { Key, RefreshCw, Trash2, Database, ExternalLink } from 'lucide-react';

interface HeaderProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onFetchAll: () => void;
  onClearCache: () => void;
  isFetching: boolean;
  progress: { done: number; total: number; current: string } | null;
  lastFetched: string | null;
  metadata: { date: string; exchange_rate: { USD: number; HKD: number }; total_items: number };
}

export default function Header({
  apiKey, onApiKeyChange, onFetchAll, onClearCache,
  isFetching, progress, lastFetched, metadata
}: HeaderProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const handleSaveKey = () => {
    onApiKeyChange(tempKey.trim());
    setShowKeyInput(false);
  };

  return (
    <header className="border-b border-slate-800 bg-[#0d1117] sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left */}
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Analyst Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              기준일 {metadata.date} · USD {metadata.exchange_rate.USD.toLocaleString()}원 · HKD {metadata.exchange_rate.HKD}원 · {metadata.total_items}종목
            </p>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {lastFetched && (
              <span className="text-xs text-slate-500">
                마지막 조회: {new Date(lastFetched).toLocaleString('ko-KR')}
              </span>
            )}

            {/* API Key Button */}
            <div className="relative">
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  apiKey
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                {apiKey ? 'API Key ✓' : 'API Key 설정'}
              </button>

              {showKeyInput && (
                <div className="absolute right-0 top-10 w-80 bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-2xl z-50">
                  <p className="text-xs text-slate-400 mb-2">
                    Financial Modeling Prep API Key
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={tempKey}
                      onChange={e => setTempKey(e.target.value)}
                      placeholder="API Key 입력..."
                      className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleSaveKey}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                    >
                      저장
                    </button>
                  </div>
                  <a
                    href="https://site.financialmodelingprep.com/developer/docs"
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    무료 API Key 발급 (250 calls/day)
                  </a>
                </div>
              )}
            </div>

            {/* Fetch Button */}
            <button
              onClick={onFetchAll}
              disabled={!apiKey || isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching && progress
                ? `${progress.current} (${progress.done}/${progress.total})`
                : '애널리스트 데이터 조회'}
            </button>

            {/* Clear Cache */}
            <button
              onClick={onClearCache}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              title="캐시 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
