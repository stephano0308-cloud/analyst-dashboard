import { useState, useMemo, useCallback } from 'react';
import type { PortfolioData, AnalystDataMap, SortState, SortField, FilterState } from '@/types';
import portfolioData from '@/data/portfolio.json';
import Header from '@/components/Header';
import SummaryCards from '@/components/SummaryCards';
import FilterPanel from '@/components/FilterPanel';
import StockTable from '@/components/StockTable';
import DetailPanel from '@/components/DetailPanel';
import DebugPanel from '@/components/DebugPanel';
import { getApiKey, setApiKey, fetchAllAnalystData, clearCache, getCachedData, isKoreanStock, isETFOrIndex } from '@/lib/api';
import { getUpsidePercent } from '@/lib/utils';

const data = portfolioData as PortfolioData;

export default function App() {
  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [analystData, setAnalystData] = useState<AnalystDataMap>(getCachedData);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    sectors: [],
    markets: [],
    accounts: [],
  });

  const [sortState, setSortState] = useState<SortState>({
    field: '평가금액(원)',
    order: 'desc',
  });

  // Deduplicate tickers for API (skip Korean stocks and ETFs)
  const apiTickers = useMemo(() => {
    const seen = new Set<string>();
    return data.items
      .filter(i => {
        if (seen.has(i.티커)) return false;
        seen.add(i.티커);
        return !isKoreanStock(i.티커) && !isETFOrIndex(i.티커, i.섹터);
      })
      .map(i => i.티커);
  }, []);

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
      const result = await fetchAllAnalystData(
        apiTickers,
        apiKey,
        (done, total, current) => setProgress({ done, total, current }),
      );
      setAnalystData(result);
    } catch (err: any) {
      setFetchError(err?.message || '데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setIsFetching(false);
      setProgress(null);
    }
  }, [apiKey, apiTickers, isFetching]);

  const handleClearCache = () => {
    clearCache();
    setAnalystData({});
    setFetchError(null);
  };

  // Filter logic
  const filteredItems = useMemo(() => {
    return data.items.filter(item => {
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (!item.종목명.toLowerCase().includes(term) && !item.티커.toLowerCase().includes(term)) return false;
      }
      if (filters.sectors.length > 0 && !filters.sectors.includes(item.섹터)) return false;
      if (filters.markets.length > 0) {
        const map: Record<string, string> = { USD: '미국', KRW: '한국', HKD: '홍콩' };
        const market = map[item.통화] || item.통화;
        if (!filters.markets.includes(market)) return false;
      }
      if (filters.accounts.length > 0 && !filters.accounts.includes(item.계좌)) return false;
      return true;
    });
  }, [filters]);

  // Sort logic
  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    items.sort((a, b) => {
      let aVal: number = 0;
      let bVal: number = 0;

      switch (sortState.field) {
        case 'targetPrice': {
          aVal = analystData[a.티커]?.priceTarget?.targetConsensus || 0;
          bVal = analystData[b.티커]?.priceTarget?.targetConsensus || 0;
          break;
        }
        case 'upside': {
          const aTarget = analystData[a.티커]?.priceTarget?.targetConsensus || 0;
          const bTarget = analystData[b.티커]?.priceTarget?.targetConsensus || 0;
          aVal = aTarget ? getUpsidePercent(a.현재가, aTarget) : -999;
          bVal = bTarget ? getUpsidePercent(b.현재가, bTarget) : -999;
          break;
        }
        case 'peRatio': {
          const aPe = analystData[a.티커]?.keyMetrics?.peRatioTTM || analystData[a.티커]?.quote?.pe || 0;
          const bPe = analystData[b.티커]?.keyMetrics?.peRatioTTM || analystData[b.티커]?.quote?.pe || 0;
          aVal = aPe || 9999;
          bVal = bPe || 9999;
          break;
        }
        case 'ratingScore': {
          aVal = analystData[a.티커]?.rating?.ratingScore || 0;
          bVal = analystData[b.티커]?.rating?.ratingScore || 0;
          break;
        }
        default: {
          const field = sortState.field as keyof typeof a;
          const av = a[field];
          const bv = b[field];
          if (typeof av === 'string' && typeof bv === 'string') {
            return sortState.order === 'asc' ? av.localeCompare(bv, 'ko-KR') : bv.localeCompare(av, 'ko-KR');
          }
          aVal = typeof av === 'number' ? av : 0;
          bVal = typeof bv === 'number' ? bv : 0;
        }
      }

      return sortState.order === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return items;
  }, [filteredItems, sortState, analystData]);

  const handleSort = (field: SortField) => {
    setSortState(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc',
    }));
  };

  const selectedItem = selectedTicker
    ? data.items.find(i => i.티커 === selectedTicker)
    : null;

  const lastFetched = useMemo(() => {
    const first = Object.values(analystData)[0];
    return first?.fetchedAt || null;
  }, [analystData]);

  const loadedCount = Object.keys(analystData).length;

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Header
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        onFetchAll={handleFetchAll}
        onClearCache={handleClearCache}
        isFetching={isFetching}
        progress={progress}
        lastFetched={lastFetched}
        fetchError={fetchError}
        loadedCount={loadedCount}
        metadata={data.metadata}
      />

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Summary */}
        <SummaryCards items={filteredItems} analystData={analystData} />

        {/* Content Area */}
        <div className="flex gap-6">
          {/* Left: Filter */}
          <aside className="w-56 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <FilterPanel items={data.items} filters={filters} onChange={setFilters} />
            </div>
          </aside>

          {/* Center: Table */}
          <div className={selectedItem ? 'flex-1 min-w-0' : 'flex-1'}>
            <StockTable
              items={sortedItems}
              analystData={analystData}
              sortState={sortState}
              onSort={handleSort}
              selectedTicker={selectedTicker}
              onSelect={setSelectedTicker}
            />
          </div>

          {/* Right: Detail Panel */}
          {selectedItem && (
            <aside className="w-[420px] shrink-0 hidden xl:block">
              <div className="sticky top-24">
                <DetailPanel
                  item={selectedItem}
                  analystData={analystData[selectedItem.티커] || null}
                  onClose={() => setSelectedTicker(null)}
                />
              </div>
            </aside>
          )}
        </div>
      </main>
      <DebugPanel />
    </div>
  );
}
