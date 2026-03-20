import { RefreshCw, Trash2, Database, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  onFetchAll: () => void;
  onClearCache: () => void;
  isFetching: boolean;
  progress: { done: number; total: number; current: string } | null;
  fetchError: string | null;
  loadedCount: number;
  metadata: { date: string; exchange_rate: { USD: number; HKD: number }; total_items: number };
}

export default function Header({
  onFetchAll, onClearCache,
  isFetching, progress, fetchError, loadedCount, metadata
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-[#0d1117] sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Analyst Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              기준일 {metadata.date} · USD {metadata.exchange_rate.USD.toLocaleString()}원 · HKD {metadata.exchange_rate.HKD}원 · {metadata.total_items}종목
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {loadedCount > 0 && (
              <span className="text-xs text-slate-500">
                {loadedCount}종목 데이터 로드됨
              </span>
            )}

            {fetchError && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span className="text-[11px] text-red-400">{fetchError}</span>
              </div>
            )}

            {/* FMP Fetch (supplementary — Yahoo/KR data loaded from JSON automatically) */}
            <button
              onClick={onFetchAll}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching && progress
                ? `${progress.current} (${progress.done}/${progress.total})`
                : 'FMP 실시간 보충 조회'}
            </button>

            <button
              onClick={onClearCache}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              title="FMP 캐시 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
