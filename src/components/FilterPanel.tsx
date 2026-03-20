import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { FilterState, PortfolioItem } from '@/types';

interface FilterPanelProps {
  items: PortfolioItem[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-slate-800 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
      >
        {title}
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                selected.includes(opt)
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ items, filters, onChange }: FilterPanelProps) {
  const sectors = [...new Set(items.map(i => i.섹터))].sort();
  const markets = [...new Set(items.map(i => {
    const map: Record<string, string> = { USD: '미국', KRW: '한국', HKD: '홍콩' };
    return map[i.통화] || i.통화;
  }))].sort();
  const accounts = [...new Set(items.map(i => i.계좌))].sort();

  const toggleFilter = (key: 'sectors' | 'markets' | 'accounts', value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const activeCount = filters.sectors.length + filters.markets.length + filters.accounts.length + (filters.search ? 1 : 0);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">필터</h3>
        {activeCount > 0 && (
          <button
            onClick={() => onChange({ search: '', sectors: [], markets: [], accounts: [] })}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300"
          >
            <X className="w-3 h-3" />
            초기화 ({activeCount})
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder="종목명, 티커 검색..."
          className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <FilterGroup
        title="시장"
        options={markets}
        selected={filters.markets}
        onToggle={v => toggleFilter('markets', v)}
      />
      <FilterGroup
        title="섹터"
        options={sectors}
        selected={filters.sectors}
        onToggle={v => toggleFilter('sectors', v)}
      />
      <FilterGroup
        title="계좌"
        options={accounts}
        selected={filters.accounts}
        onToggle={v => toggleFilter('accounts', v)}
      />
    </div>
  );
}
