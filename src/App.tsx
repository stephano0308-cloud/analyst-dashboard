import { useState, useMemo, useCallback } from 'react';
import type { PortfolioData, AnalystDataMap, SortState, SortField, FilterState } from '@/types';
import portfolioData from '@/data/portfolio.json';
import koreanConsensusRaw from '@/data/korean-consensus.json';
import foreignAnalystRaw from '@/data/foreign-analyst.json';
import Header from '@/components/Header';
import SummaryCards from '@/components/SummaryCards';
import FilterPanel from '@/components/FilterPanel';
import StockTable from '@/components/StockTable';
import DetailPanel from '@/components/DetailPanel';
import DebugPanel from '@/components/DebugPanel';
import PortfolioManager, { applyOverrides } from '@/components/PortfolioManager';
import SectorAnalysis from '@/components/SectorAnalysis';
import AIAnalysis from '@/components/AIAnalysis';
import { getApiKey, fetchAllAnalystData, clearCache, getCachedData, isKoreanStock, isETFOrIndex } from '@/lib/api';
import { mergePortfolioItems, getUpsidePercent, koreanConsensusToAnalystData, foreignAnalystToAnalystData, cn } from '@/lib/utils';
import { BarChart3, TrendingUp, Brain } from 'lucide-react';

const baseData = portfolioData as any as PortfolioData;
const krAnalystData = koreanConsensusToAnalystData(koreanConsensusRaw as any);
const foreignData = foreignAnalystToAnalystData(foreignAnalystRaw as any);

type Tab = 'portfolio' | 'sector' | 'ai';

export default function App() {
  const [analystData, setAnalystData] = useState<AnalystDataMap>(getCachedData);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');

  const [filters, setFilters] = useState<FilterState>({ search: '', sectors: [], markets: [], accounts: [] });
  const [sortState, setSortState] = useState<SortState>({ field: '평가금액(원)', order: 'desc' });

  const activeItems = useMemo(() => applyOverrides(baseData.items), [portfolioVersion]);
  const mergedItems = useMemo(() => mergePortfolioItems(activeItems), [activeItems]);

  const apiTickers = useMemo(() =>
    mergedItems.filter(i => !isKoreanStock(i.티커) && !isETFOrIndex(i.티커, i.섹터)).map(i => i.티커),
    [mergedItems]);

  const handleFetchAll = useCallback(async () => {
    const key = getApiKey();
    if (!key || isFetching) return;
    setIsFetching(true); setFetchError(null); setProgress(null);
    try {
      const result = await fetchAllAnalystData(apiTickers, key, (d, t, c) => setProgress({ done: d, total: t, current: c }));
      setAnalystData(result);
    } catch (err: any) { setFetchError(err?.message || '오류'); }
    finally { setIsFetching(false); setProgress(null); }
  }, [apiTickers, isFetching]);

  const handleClearCache = () => { clearCache(); setAnalystData({}); setFetchError(null); };

  const filteredItems = useMemo(() => {
    return mergedItems.filter(item => {
      if (filters.search) {
        const t = filters.search.toLowerCase();
        if (!item.종목명.toLowerCase().includes(t) && !item.티커.toLowerCase().includes(t)) return false;
      }
      if (filters.sectors.length > 0 && !filters.sectors.includes(item.섹터)) return false;
      if (filters.markets.length > 0) {
        const m: Record<string,string> = { USD:'미국', KRW:'한국', HKD:'홍콩' };
        if (!filters.markets.includes(m[item.통화]||item.통화)) return false;
      }
      if (filters.accounts.length > 0 && !item.계좌목록.some(a => filters.accounts.includes(a))) return false;
      return true;
    });
  }, [mergedItems, filters]);

  const combinedData = useMemo<AnalystDataMap>(() => ({ ...krAnalystData, ...foreignData, ...analystData }), [analystData]);

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems]; const cd = combinedData;
    arr.sort((a, b) => {
      let av = 0, bv = 0;
      switch (sortState.field) {
        case '종목명': return sortState.order==='asc' ? a.종목명.localeCompare(b.종목명,'ko-KR') : b.종목명.localeCompare(a.종목명,'ko-KR');
        case '현재가': av=a.현재가; bv=b.현재가; break;
        case '가중평균단가': av=a.가중평균단가; bv=b.가중평균단가; break;
        case '평가금액(원)': av=a['평가금액(원)']; bv=b['평가금액(원)']; break;
        case '매수금액(원)': av=a['매수금액(원)']; bv=b['매수금액(원)']; break;
        case '손익(원)': av=a['손익(원)']; bv=b['손익(원)']; break;
        case '수익률': av=a.수익률; bv=b.수익률; break;
        case 'targetPrice': av=cd[a.티커]?.priceTarget?.targetConsensus||0; bv=cd[b.티커]?.priceTarget?.targetConsensus||0; break;
        case 'upside': { const at=cd[a.티커]?.priceTarget?.targetConsensus||0,bt=cd[b.티커]?.priceTarget?.targetConsensus||0; av=at?getUpsidePercent(a.현재가,at):-999; bv=bt?getUpsidePercent(b.현재가,bt):-999; break; }
        case 'peRatio': av=cd[a.티커]?.keyMetrics?.peRatioTTM||cd[a.티커]?.quote?.pe||9999; bv=cd[b.티커]?.keyMetrics?.peRatioTTM||cd[b.티커]?.quote?.pe||9999; break;
        case 'pbrRatio': av=cd[a.티커]?.rsi14||50; bv=cd[b.티커]?.rsi14||50; break;
      }
      return sortState.order==='asc' ? av-bv : bv-av;
    });
    return arr;
  }, [filteredItems, sortState, combinedData]);

  const handleSort = (field: SortField) => setSortState(p => ({ field, order: p.field===field && p.order==='desc' ? 'asc' : 'desc' }));
  const selectedItem = selectedTicker ? mergedItems.find(i => i.티커 === selectedTicker) : null;

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'portfolio', label: '포트폴리오 현황', icon: BarChart3 },
    { id: 'sector', label: '섹터 분석', icon: TrendingUp },
    { id: 'ai', label: 'AI 리밸런싱', icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Header onFetchAll={handleFetchAll} onClearCache={handleClearCache}
        onManagePortfolio={() => setShowManager(true)}
        isFetching={isFetching} progress={progress} fetchError={fetchError}
        loadedCount={Object.keys(combinedData).length} metadata={baseData.metadata} />

      <PortfolioManager open={showManager} onClose={() => setShowManager(false)}
        baseData={baseData} onUpdate={() => setPortfolioVersion(v => v+1)} />

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <SummaryCards items={filteredItems} analystData={combinedData} />

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400 bg-blue-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'portfolio' && (
          <div className="flex gap-6">
            <aside className="w-56 shrink-0 hidden lg:block">
              <div className="sticky top-24">
                <FilterPanel items={activeItems} filters={filters} onChange={setFilters} />
              </div>
            </aside>
            <div className={selectedItem ? 'flex-1 min-w-0' : 'flex-1'}>
              <StockTable items={sortedItems} analystData={combinedData} sortState={sortState}
                onSort={handleSort} selectedTicker={selectedTicker} onSelect={setSelectedTicker} />
            </div>
            {selectedItem && (
              <aside className="w-[420px] shrink-0 hidden xl:block">
                <div className="sticky top-24">
                  <DetailPanel item={selectedItem} analystData={combinedData[selectedItem.티커] || null}
                    onClose={() => setSelectedTicker(null)} />
                </div>
              </aside>
            )}
          </div>
        )}

        {activeTab === 'sector' && (
          <SectorAnalysis items={filteredItems} analystData={combinedData} />
        )}

        {activeTab === 'ai' && (
          <AIAnalysis items={filteredItems} analystData={combinedData} />
        )}
      </main>
      <DebugPanel />
    </div>
  );
}
