import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, MessageSquare, Bot, User, Braces } from 'lucide-react';
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
  if (rec.message) return String(rec.message);
  if (rec.type === 'bom') {
    const rows = (rec as { rows?: unknown[] }).rows;
    return `BOM build — ${Array.isArray(rows) ? rows.length : '?'} řádků`;
  }
  if (rec.phase) return `(${rec.phase})`;
  return '—';
}

// ── Expandované pohledy ────────────────────────────────────────────────────────

function ChatDetail({ rec }: { rec: ChatLogRecord }) {
  const history = Array.isArray(rec.history) ? rec.history as { role: string; content: string }[] : [];
  const msgs = [
    ...history,
    { role: 'user', content: String(rec.message ?? '') },
    ...(rec.result ? [{ role: 'assistant', content: typeof rec.result === 'string' ? rec.result : JSON.stringify(rec.result, null, 2) }] : []),
  ].filter(m => m.content);

  if (msgs.length === 0) return <p className="p-3 text-xs text-overlay0">Žádné zprávy.</p>;

  return (
    <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
      {msgs.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
            msg.role === 'user' ? 'bg-mauve/30 text-mauve' : 'bg-surface2 text-subtext1'
          }`}>
            {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
          </div>
          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
            msg.role === 'user' ? 'bg-mauve/15 text-text' : 'bg-surface1 text-subtext1'
          }`}>
            <p className="text-[10px] font-semibold mb-1 opacity-60">
              {msg.role === 'user' ? 'Uživatel' : 'Karel Bot'}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{String(msg.content)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function GuidedDetail({ rec }: { rec: ChatLogRecord }) {
  const events = Array.isArray(rec.events) ? rec.events as unknown[] : [];
  const answers = Array.isArray(rec.answers) ? rec.answers as string[] : [];

  return (
    <div className="p-3 space-y-3 max-h-96 overflow-y-auto text-xs">
      <div className="flex flex-wrap gap-3">
        {rec.phase && (
          <div className="bg-surface1 rounded-lg px-2 py-1">
            <span className="text-overlay0">Fáze: </span>
            <span className="text-text font-medium">{String(rec.phase)}</span>
          </div>
        )}
        {rec.categoryKey && (
          <div className="bg-surface1 rounded-lg px-2 py-1">
            <span className="text-overlay0">Kategorie: </span>
            <span className="text-teal font-medium">{String(rec.categoryKey)}</span>
          </div>
        )}
      </div>

      {rec.message && (
        <div className="bg-mauve/10 border border-mauve/20 rounded-xl px-3 py-2">
          <p className="text-[10px] text-mauve font-semibold mb-1 flex items-center gap-1"><User size={10} /> Dotaz uživatele</p>
          <p className="text-text whitespace-pre-wrap">{String(rec.message)}</p>
        </div>
      )}

      {answers.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-overlay0 font-semibold uppercase tracking-wide">Odpovědi na otázky</p>
          {answers.map((a, i) => (
            <div key={i} className="bg-surface1 rounded-lg px-2 py-1 text-text">{a}</div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-overlay0 font-semibold uppercase tracking-wide">Events ({events.length})</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {events.map((ev, i) => (
              <div key={i} className="bg-surface0 rounded px-2 py-1 text-overlay1 font-mono text-[10px] truncate">
                {typeof ev === 'string' ? ev : JSON.stringify(ev)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BomDetail({ rec }: { rec: ChatLogRecord }) {
  const rows = Array.isArray(rec.rows) ? rec.rows as { typoveOznaceni?: string }[] : [];
  const result = rec.result as { bomRows?: unknown[]; toCreate?: unknown[] } | null | undefined;
  const bomRows = Array.isArray(result?.bomRows) ? result!.bomRows : [];
  const toCreate = Array.isArray(result?.toCreate) ? result!.toCreate : [];

  return (
    <div className="p-3 space-y-3 max-h-96 overflow-y-auto text-xs">
      <div className="flex flex-wrap gap-3">
        <div className="bg-surface1 rounded-lg px-3 py-1.5">
          <span className="text-overlay0">Vstup: </span>
          <span className="text-text font-medium">{rows.length} řádků</span>
        </div>
        {result && (
          <>
            <div className="bg-green/10 border border-green/20 rounded-lg px-3 py-1.5">
              <span className="text-green">✓ Nalezeno: </span>
              <span className="text-text font-medium">{bomRows.length}</span>
            </div>
            <div className="bg-yellow/10 border border-yellow/20 rounded-lg px-3 py-1.5">
              <span className="text-yellow">⚠ K založení: </span>
              <span className="text-text font-medium">{toCreate.length}</span>
            </div>
          </>
        )}
      </div>

      {rec.preferences && (
        <div className="bg-surface1 rounded-lg px-3 py-2">
          <span className="text-overlay0">Preference: </span>
          <span className="text-text">{String(rec.preferences)}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-overlay0 font-semibold uppercase tracking-wide">Vstupní řádky</p>
          <div className="bg-surface0 rounded-lg overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-surface1">
                  <th className="px-2 py-1 text-left text-overlay0 font-medium">#</th>
                  <th className="px-2 py-1 text-left text-overlay0 font-medium">Typové označení</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-surface1/40">
                    <td className="px-2 py-0.5 text-overlay0">{i + 1}</td>
                    <td className="px-2 py-0.5 text-text font-mono">{r.typoveOznaceni ?? '—'}</td>
                  </tr>
                ))}
                {rows.length > 20 && (
                  <tr><td colSpan={2} className="px-2 py-1 text-overlay0">…a dalších {rows.length - 20} řádků</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RawDetail({ rec }: { rec: ChatLogRecord }) {
  return (
    <pre className="text-[11px] text-subtext1 bg-base/60 p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
      {JSON.stringify(rec, null, 2)}
    </pre>
  );
}

function LogDetail({ rec }: { rec: ChatLogRecord }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="border-t border-surface1">
      <div className="flex items-center justify-end px-3 py-1 border-b border-surface1/60">
        <button
          onClick={() => setShowRaw(s => !s)}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${
            showRaw ? 'text-mauve bg-mauve/10' : 'text-overlay0 hover:text-subtext1'
          }`}
        >
          <Braces size={11} /> {showRaw ? 'Zobrazit chat' : 'Raw JSON'}
        </button>
      </div>
      {showRaw ? (
        <RawDetail rec={rec} />
      ) : rec.type === 'chat' ? (
        <ChatDetail rec={rec} />
      ) : rec.type === 'guided' ? (
        <GuidedDetail rec={rec} />
      ) : rec.type === 'bom' ? (
        <BomDetail rec={rec} />
      ) : (
        <RawDetail rec={rec} />
      )}
    </div>
  );
}

// ── Hlavní komponenta ──────────────────────────────────────────────────────────

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
      .then(d => { setRecords(d.records); setTotal(d.total); setExpanded(null); })
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
                {open && <LogDetail rec={rec} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
