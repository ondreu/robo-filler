import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { fetchLogs, type ChatLogRecord } from '../utils/adminApi';

const TYPES = [
  { value: 'all', label: 'Vše' },
  { value: 'chat', label: 'Karel Bot' },
  { value: 'guided', label: 'Řízený' },
  { value: 'bom', label: 'BOM' },
];

const TYPE_COLOR: Record<string, string> = {
  chat: 'bg-mauve/15 text-mauve',
  guided: 'bg-teal/15 text-teal',
  bom: 'bg-peach/15 text-peach',
};

function summary(rec: ChatLogRecord): string {
  if (rec.message) return rec.message;
  if (rec.type === 'bom') {
    const rows = (rec as { rows?: unknown[] }).rows;
    return `BOM build — ${Array.isArray(rows) ? rows.length : '?'} řádků`;
  }
  if (rec.phase) return `(${rec.phase})`;
  return '—';
}

export function AdminLogs({ password }: { password: string }) {
  const [records, setRecords] = useState<ChatLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    fetchLogs(password, { type, limit: 300 })
      .then(d => { setRecords(d.records); setTotal(d.total); })
      .catch(e => setError(e.message ?? 'Chyba.'))
      .finally(() => setLoading(false));
  }, [password, type]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquare size={16} className="text-mauve" />
        <h3 className="text-sm font-semibold text-text">Logy AI chatů</h3>
        <div className="flex bg-surface0 rounded-lg p-0.5 gap-0.5 ml-2">
          {TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                type === t.value ? 'bg-mauve text-crust' : 'text-subtext1 hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5">
          <RefreshCw size={13} /> Obnovit
        </button>
        <span className="text-xs text-overlay0 ml-auto">{records.length} z {total} záznamů</span>
      </div>

      {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-xl px-4 py-2">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-mauve" /></div>
      ) : records.length === 0 ? (
        <div className="bg-mantle rounded-2xl p-8 text-center text-subtext1 text-sm">Žádné logy.</div>
      ) : (
        <div className="space-y-1.5">
          {records.map((rec, i) => {
            const open = expanded === i;
            return (
              <div key={i} className="bg-surface0 rounded-xl border border-surface1 overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : i)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface1 transition-colors"
                >
                  {open ? <ChevronDown size={14} className="text-overlay1 shrink-0" /> : <ChevronRight size={14} className="text-overlay1 shrink-0" />}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLOR[rec.type ?? ''] ?? 'bg-surface2 text-subtext1'}`}>
                    {rec.type ?? '?'}
                  </span>
                  <span className="text-xs text-subtext1 shrink-0 font-mono">
                    {rec.ts ? new Date(rec.ts).toLocaleString('cs') : ''}
                  </span>
                  <span className="text-xs text-text truncate flex-1">{summary(rec)}</span>
                </button>
                {open && (
                  <pre className="text-[11px] text-subtext1 bg-base/60 p-3 overflow-x-auto border-t border-surface1 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {JSON.stringify(rec, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
