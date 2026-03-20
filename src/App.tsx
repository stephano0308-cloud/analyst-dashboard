import { useState, useMemo, useCallback } from 'react';
import type { PortfolioData, AnalystDataMap, SortState, SortField, FilterState, MergedItem } from '@/types';
import portfolioData from '@/data/portfolio.json';
import Header from '@/components/Header';
import SummaryCards from '@/components/SummaryCards';
import FilterPanel from '@/components/FilterPanel';
import StockTable from '@/components/StockTable';
import DetailPanel from '@/components/DetailPanel';
import DebugPanel from '@/components/DebugPanel';
import { getApiKey, setApiKey, fetchAllAnalystData, clearCache, getCachedData, isKoreanStock, isETFOrIndex } from '@/lib/api';
import { mergePortfolioItems, getUpsidePercent } from '@/lib/utils';

const data = portfolioData as PortfolioData;

export default function App() {
  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [analystData, setAnalystData] = useState<AnalystDataMap>(getCachedData);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({ search: '', sectors: [], markets: [], accounts: [] });
  const [sortState, setSortState] = useState<SortState>({ field: '평가금액(원)', order: 'desc' });

  // Merge duplicate tickers
  const mergedItems = useMemo(() => mergePortfolioItems(data.items), []);

  // Unique tickers for API calls
  const apiTickers = useMemo(() => {
    return mergedItems
      .filter(i => !isKoreanStock(i.티커) && !isETFOrIndex(i.티커, i.섹터))
      .map(i => i.티커);
  }, [mergedItems]);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    setApiKeyState(key);
    setFetchError(null);
  };

  const handleFetchAll = useCallback(async () => {
    if (!apiKey || isFetching) return;
    setIsFetching(true);
    setFetchError(null);
    setProgress(null);
    try {
      const result = await fetchAllAnalystData(apiTickers, apiKey,
        (done, total, current) => setProgress({ done, total, current }));
      setAnalystData(result);
    } catch (err: any) {
      setFetchError(err?.message || '데이터 조회 중 오류');
    } finally {
      setIsFetching(false);
      setProgress(null);
    }
  }, [apiKey, apiTickers, isFetching]);

  const handleClearCache = () => { clearCache(); setAnalystData({}); setFetchError(null); };

  // Filter
  const filteredItems = useMemo(() => {
    return mergedItems.filter(item => {
      if (filters.search) {
        const t = filters.search.toLowerCase();
        if (!item.종목명.toLowerCase().includes(t) && !item.티커.toLowerCase().includes(t)) return false;
      }
      if (filters.sectors.length > 0 && !filters.sectors.includes(item.섹터)) return false;
      if (filters.markets.length > 0) {
        const map: Record<string, string> = { USD: '미국', KRW: '한국', HKD: '홍콩' };
        if (!filters.markets.includes(map[item.통화] || item.통화)) return false;
      }
      if (filters.accounts.length > 0) {
        // Show if any of the item's accounts match the filter
        if (!item.계좌목록.some(a => filters.accounts.includes(a))) return false;
      }
      return true;
    });
  }, [mergedItems, filters]);

  // Sort
  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    arr.sort((a, b) => {
      let aVal = 0, bVal = 0;
      switch (sortState.field) {
        case '종목명':
          return sortState.order === 'asc' ? a.종목명.localeCompare(b.종목명, 'ko-KR') : b.종목명.localeCompare(a.종목명, 'ko-KR');
        case '현재가': aVal = a.현재가; bVal = b.현재가; break;
        case '가중평균단가': aVal = a.가중평균단가; bVal = b.가중평균단가; break;
        case '평가금액(원)': aVal = a['평가금액(원)']; bVal = b['평가금액(원)']; break;
        case '매수금액(원)': aVal = a['매수금액(원)']; bVal = b['매수금액(원)']; break;
        case '손익(원)': aVal = a['손익(원)']; bVal = b['손익(원)']; break;
        case '수익률': aVal = a.수익률; bVal = b.수익률; break;
        case 'targetPrice':
          aVal = analystData[a.티커]?.priceTarget?.targetConsensus || 0;
          bVal = analystData[b.티커]?.priceTarget?.targetConsensus || 0;
          break;
        case 'upside': {
          const at = analystData[a.티커]?.priceTarget?.targetConsensus || 0;
          const bt = analystData[b.티커]?.priceTarget?.targetConsensus || 0;
          aVal = at ? getUpsidePercent(a.현재가, at) : -999;
          bVal = bt ? getUpsidePercent(b.현재가, bt) : -999;
          break;
        }
        case 'peRatio':
          aVal = analystData[a.티커]?.keyMetrics?.peRatioTTM || analystData[a.티커]?.quote?.pe || 9999;
          bVal = analystData[b.티커]?.keyMetrics?.peRatioTTM || analystData[b.티커]?.quote?.pe || 9999;
          break;
        case 'pbrRatio':
          aVal = analystData[a.티커]?.keyMetrics?.priceToBookRatioTTM || 9999;
          bVal = analystData[b.티커]?.keyMetrics?.priceToBookRatioTTM || 9999;
          break;
      }
      return sortState.order === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return arr;
  }, [filteredItems, sortState, analystData]);

  const handleSort = (field: SortField) => {
    setSortState(prev => ({ field, order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc' }));
  };

  const selectedItem = selectedTicker ? mergedItems.find(i => i.티커 === selectedTicker) : null;
  const lastFetched = useMemo(() => Object.values(analystData)[0]?.fetchedAt || null, [analystData]);
  const loadedCount = Object.keys(analystData).length;

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Header apiKey={apiKey} onApiKeyChange={handleApiKeyChange} onFetchAll={handleFetchAll}
        onClearCache={handleClearCache} isFetching={isFetching} progress={progress}
        lastFetched={lastFetched} fetchError={fetchError} loadedCount={loadedCount} metadata={data.metadata} />

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <SummaryCards items={filteredItems} analystData={analystData} />

        <div className="flex gap-6">
          <aside className="w-56 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <FilterPanel items={data.items} filters={filters} onChange={setFilters} />
            </div>
          </aside>

          <div className={selectedItem ? 'flex-1 min-w-0' : 'flex-1'}>
            <StockTable items={sortedItems} analystData={analystData} sortState={sortState}
              onSort={handleSort} selectedTicker={selectedTicker} onSelect={setSelectedTicker} />
          </div>

          {selectedItem && (
            <aside className="w-[420px] shrink-0 hidden xl:block">
              <div className="sticky top-24">
                <DetailPanel item={selectedItem} analystData={analystData[selectedItem.티커] || null}
                  onClose={() => setSelectedTicker(null)} />
              </div>
            </aside>
          )}
        </div>
      </main>
      <DebugPanel />
    </div>
  );
}
