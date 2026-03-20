import { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

// Global log storage
let _logs: string[] = [];
let _listeners: (() => void)[] = [];

export function addLog(msg: string) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  _logs.push(`[${ts}] ${msg}`);
  if (_logs.length > 200) _logs = _logs.slice(-100);
  _listeners.forEach(fn => fn());
}

export function useLogs() {
  const [, setTick] = useState(0);
  useState(() => {
    const fn = () => setTick(t => t + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(f => f !== fn); };
  });
  return _logs;
}

export default function DebugPanel() {
  const logs = useLogs();
  const [open, setOpen] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs text-slate-400">
          <Terminal className="w-3.5 h-3.5" />
          API 로그 ({logs.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); _logs = []; _listeners.forEach(fn => fn()); }}
            className="p-1 hover:text-slate-300 text-slate-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto px-4 pb-3 font-mono text-[11px] leading-relaxed">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`${
                log.includes('✓') ? 'text-emerald-400' :
                log.includes('✗') || log.includes('ERROR') || log.includes('403') ? 'text-red-400' :
                log.includes('WARN') ? 'text-amber-400' :
                'text-slate-500'
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
