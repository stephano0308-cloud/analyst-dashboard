import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Edit2, Download, Upload } from 'lucide-react';
import type { PortfolioItem, PortfolioData } from '@/types';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'portfolio_overrides';

export interface PortfolioOverrides {
  added: PortfolioItem[];
  deleted: string[];  // "ticker|account" keys to remove
  edited: Record<string, Partial<PortfolioItem>>;  // "ticker|account" → overrides
}

function getOverrides(): PortfolioOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { added: [], deleted: [], edited: {} };
}

function saveOverrides(o: PortfolioOverrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
}

export function applyOverrides(baseItems: PortfolioItem[]): PortfolioItem[] {
  const o = getOverrides();
  let items = baseItems
    .filter(i => !o.deleted.includes(`${i.티커}|${i.계좌}`))
    .map(i => {
      const key = `${i.티커}|${i.계좌}`;
      const edit = o.edited[key];
      return edit ? { ...i, ...edit } : i;
    });
  return [...items, ...o.added];
}

interface Props {
  open: boolean;
  onClose: () => void;
  baseData: PortfolioData;
  onUpdate: () => void;
}

const CURRENCIES = ['KRW', 'USD', 'HKD'];

export default function PortfolioManager({ open, onClose, baseData, onUpdate }: Props) {
  const [overrides, setOverrides] = useState<PortfolioOverrides>(getOverrides);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Form state for adding
  const [form, setForm] = useState({
    종목명: '', 티커: '', 섹터: '', 계좌: '', 수량: 0,
    현재가: 0, 평균단가: 0, 통화: 'KRW',
  });

  // Edit form
  const [editForm, setEditForm] = useState({ 수량: 0, 평균단가: 0, 현재가: 0 });

  const allItems = applyOverrides(baseData.items);

  const save = (o: PortfolioOverrides) => {
    setOverrides(o);
    saveOverrides(o);
    onUpdate();
  };

  const handleDelete = (ticker: string, account: string) => {
    const key = `${ticker}|${account}`;
    // If it's an added item, remove from added
    const addedIdx = overrides.added.findIndex(i => i.티커 === ticker && i.계좌 === account);
    if (addedIdx >= 0) {
      const next = { ...overrides, added: overrides.added.filter((_, i) => i !== addedIdx) };
      save(next);
    } else {
      save({ ...overrides, deleted: [...overrides.deleted, key] });
    }
  };

  const handleAdd = () => {
    const rate = form.통화 === 'USD' ? baseData.metadata.exchange_rate.USD
      : form.통화 === 'HKD' ? baseData.metadata.exchange_rate.HKD : 1;
    const evalKRW = form.수량 * form.현재가 * rate;
    const buyKRW = form.수량 * form.평균단가 * rate;
    const newItem: PortfolioItem = {
      No: allItems.length + 1,
      종목명: form.종목명, 티커: form.티커, 섹터: form.섹터, 계좌: form.계좌,
      수량: form.수량, 현재가: form.현재가, 평균단가: form.평균단가, 통화: form.통화,
      '평가금액(원)': evalKRW, '매수금액(원)': buyKRW,
      '손익(원)': evalKRW - buyKRW, 수익률: buyKRW > 0 ? (evalKRW - buyKRW) / buyKRW : 0,
    };
    save({ ...overrides, added: [...overrides.added, newItem] });
    setShowAdd(false);
    setForm({ 종목명:'', 티커:'', 섹터:'', 계좌:'', 수량:0, 현재가:0, 평균단가:0, 통화:'KRW' });
  };

  const startEdit = (item: PortfolioItem) => {
    setEditKey(`${item.티커}|${item.계좌}`);
    setEditForm({ 수량: item.수량, 평균단가: item.평균단가, 현재가: item.현재가 });
  };

  const handleEditSave = (item: PortfolioItem) => {
    const key = `${item.티커}|${item.계좌}`;
    const rate = item.통화 === 'USD' ? baseData.metadata.exchange_rate.USD
      : item.통화 === 'HKD' ? baseData.metadata.exchange_rate.HKD : 1;
    const evalKRW = editForm.수량 * editForm.현재가 * rate;
    const buyKRW = editForm.수량 * editForm.평균단가 * rate;
    const edits: Partial<PortfolioItem> = {
      수량: editForm.수량, 평균단가: editForm.평균단가, 현재가: editForm.현재가,
      '평가금액(원)': evalKRW, '매수금액(원)': buyKRW,
      '손익(원)': evalKRW - buyKRW, 수익률: buyKRW > 0 ? (evalKRW - buyKRW) / buyKRW : 0,
    };
    save({ ...overrides, edited: { ...overrides.edited, [key]: edits } });
    setEditKey(null);
  };

  const handleReset = () => {
    if (confirm('모든 변경사항을 초기화하시겠습니까?')) {
      localStorage.removeItem(STORAGE_KEY);
      setOverrides({ added: [], deleted: [], edited: {} });
      onUpdate();
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ ...baseData, items: allItems }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'portfolio.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as PortfolioData;
        if (!data.items || !Array.isArray(data.items)) { alert('올바른 portfolio.json 형식이 아닙니다.'); return; }
        // Replace all items as "added" and delete all originals
        const allKeys = baseData.items.map(i => `${i.티커}|${i.계좌}`);
        save({ added: data.items, deleted: allKeys, edited: {} });
        alert(`${data.items.length}개 종목이 가져오기 되었습니다.`);
      } catch { alert('파일 파싱 오류'); }
    };
    input.click();
  };

  if (!open) return null;

  const changeCount = overrides.added.length + overrides.deleted.length + Object.keys(overrides.edited).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] border border-slate-700 rounded-xl w-[800px] max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">포트폴리오 종목 관리</h2>
            <p className="text-xs text-slate-500 mt-0.5">{allItems.length}종목 · {changeCount > 0 ? `${changeCount}개 변경` : '변경 없음'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:bg-slate-800"><Download className="w-3 h-3" />내보내기</button>
            <button onClick={handleImport} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:bg-slate-800"><Upload className="w-3 h-3" />가져오기</button>
            {changeCount > 0 && <button onClick={handleReset} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10">초기화</button>}
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-800"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>

        {/* Stock list */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#111827]">
              <tr className="border-b border-slate-800">
                <th className="px-3 py-2 text-left text-slate-500">종목</th>
                <th className="px-3 py-2 text-left text-slate-500">계좌</th>
                <th className="px-3 py-2 text-right text-slate-500">수량</th>
                <th className="px-3 py-2 text-right text-slate-500">매수단가</th>
                <th className="px-3 py-2 text-right text-slate-500">현재가</th>
                <th className="px-3 py-2 text-center text-slate-500 w-20">관리</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, idx) => {
                const key = `${item.티커}|${item.계좌}`;
                const isEditing = editKey === key;
                const isAdded = overrides.added.some(a => a.티커 === item.티커 && a.계좌 === item.계좌);
                const isEdited = key in overrides.edited;

                return (
                  <tr key={`${key}-${idx}`} className={cn('border-b border-slate-800/50', isAdded && 'bg-emerald-500/5', isEdited && 'bg-blue-500/5')}>
                    <td className="px-3 py-2">
                      <span className="text-slate-200">{item.종목명}</span>
                      <span className="ml-1 ticker-badge text-slate-500">{item.티커}</span>
                      {isAdded && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">추가</span>}
                      {isEdited && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">수정</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{item.계좌}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">
                      {isEditing
                        ? <input type="number" value={editForm.수량} onChange={e => setEditForm({...editForm, 수량: +e.target.value})} className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-right text-xs" />
                        : item.수량.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">
                      {isEditing
                        ? <input type="number" value={editForm.평균단가} onChange={e => setEditForm({...editForm, 평균단가: +e.target.value})} className="w-20 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-right text-xs" />
                        : item.평균단가.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">
                      {isEditing
                        ? <input type="number" value={editForm.현재가} onChange={e => setEditForm({...editForm, 현재가: +e.target.value})} className="w-20 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-right text-xs" />
                        : item.현재가.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => handleEditSave(item)} className="p-1 rounded hover:bg-emerald-500/20"><Save className="w-3 h-3 text-emerald-400" /></button>
                          <button onClick={() => setEditKey(null)} className="p-1 rounded hover:bg-slate-700"><X className="w-3 h-3 text-slate-500" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => startEdit(item)} className="p-1 rounded hover:bg-slate-700"><Edit2 className="w-3 h-3 text-slate-500" /></button>
                          <button onClick={() => handleDelete(item.티커, item.계좌)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3 h-3 text-red-400" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add new stock */}
        <div className="border-t border-slate-800 px-5 py-3">
          {showAdd ? (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <input placeholder="종목명" value={form.종목명} onChange={e => setForm({...form, 종목명: e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <input placeholder="티커" value={form.티커} onChange={e => setForm({...form, 티커: e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <input placeholder="섹터" value={form.섹터} onChange={e => setForm({...form, 섹터: e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <input placeholder="계좌" value={form.계좌} onChange={e => setForm({...form, 계좌: e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <input placeholder="수량" type="number" value={form.수량||''} onChange={e => setForm({...form, 수량: +e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <input placeholder="매수단가" type="number" value={form.평균단가||''} onChange={e => setForm({...form, 평균단가: +e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <input placeholder="현재가" type="number" value={form.현재가||''} onChange={e => setForm({...form, 현재가: +e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200" />
              <select value={form.통화} onChange={e => setForm({...form, 통화: e.target.value})} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="col-span-4 flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800">취소</button>
                <button onClick={handleAdd} disabled={!form.종목명 || !form.티커} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">추가</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-blue-400 hover:bg-blue-500/10">
              <Plus className="w-3.5 h-3.5" /> 종목 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
