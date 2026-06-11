import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, MessageSquare, Code2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

const TYPE_LABEL: Record<string, string> = { chat: 'Karel Bot', guided: 'Řízený', bom: 'BOM' };

function summary(rec: ChatLogRecord): string {
  if (rec.message) return String(rec.message);
  if (rec.type === 'bom') {
    const rows = (rec as { rows?: unknown[] }).rows;
    return `Stavba kusovníku — ${Array.isArray(rows) ? rows.length : '?'} řádků`;
  }
  if (rec.type === 'guided') return `Řízené hledání${rec.categoryKey ? ` — ${String(rec.categoryKey)}` : ''}${rec.phase ? ` (${rec.phase})` : ''}`;
  return '—';
}

// ─── Chatová bublina ─────────────────────────────────────────────────────────
function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
        isUser ? 'bg-mauve/20 text-text rounded-br-sm' : 'bg-surface1 text-text rounded-bl-sm'
      }`}>
        {!isUser && <div className="text-[10px] text-mauve font-semibold mb-0.5">Karel Bot</div>}
        <div className="prose-chat leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Md({ text }: { text: string }) {
  return (
    <div className="markdown-body text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// ─── Detail dle typu ────────────────────────────────────────────────────────
function LogDetail({ rec }: { rec: ChatLogRecord }) {
  const history = Array.isArray((rec as { history?: unknown }).history)
    ? (rec.history as { role: 'user' | 'assistant'; content: string }[]) : [];

  if (rec.type === 'chat') {
    const answer = (rec.result as { answer?: string } | undefined)?.answer ?? '';
    const articles = (rec.result as { articles?: unknown[] } | undefined)?.articles ?? [];
    return (
      <div className="space-y-2">
        {history.map((m, i) => (
          <Bubble key={i} role={m.role}>{m.role === 'assistant' ? <Md text={m.content} /> : m.content}</Bubble>
        ))}
        {rec.message && <Bubble role="user">{String(rec.message)}</Bubble>}
        {answer && <Bubble role="assistant"><Md text={answer} /></Bubble>}
        {Array.isArray(articles) && articles.length > 0 && (
          <p className="text-[10px] text-overlay0 pl-1">📎 {articles.length} doporučených artiklů</p>
        )}
      </div>
    );
  }

  if (rec.type === 'guided') {
    const answers = Array.isArray((rec as { answers?: unknown }).answers) ? (rec.answers as unknown[]) : [];
    const events = Array.isArray((rec as { events?: unknown }).events) ? (rec.events as { event: string; data?: { answer?: string; message?: string } }[]) : [];
    const finalAnswer = events.map(e => e.data?.answer || e.data?.message).filter(Boolean).pop();
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-[11px]">
          {!!rec.categoryKey && <span className="bg-surface1 rounded px-2 py-0.5 text-subtext1">Kategorie: <b className="text-text">{String(rec.categoryKey)}</b></span>}
          {rec.phase && <span className="bg-surface1 rounded px-2 py-0.5 text-subtext1">Fáze: {String(rec.phase)}</span>}
        </div>
        {rec.message && <Bubble role="user">{String(rec.message)}</Bubble>}
        {answers.length > 0 && (
          <div className="bg-surface0 rounded-xl p-2 space-y-1">
            <p className="text-[10px] text-overlay0 font-semibold uppercase">Odpovědi</p>
            {answers.map((a, i) => {
              const o = a as { question?: string; key?: string; answer?: string };
              return <div key={i} className="text-xs text-text"><span className="text-overlay1">{o.question || o.key || `#${i + 1}`}:</span> {o.answer ?? String(a)}</div>;
            })}
          </div>
        )}
        {finalAnswer && <Bubble role="assistant"><Md text={String(finalAnswer)} /></Bubble>}
      </div>
    );
  }

  if (rec.type === 'bom') {
    const rows = Array.isArray((rec as { rows?: unknown }).rows) ? (rec.rows as unknown[]) : [];
    const prefs = (rec as { preferences?: string }).preferences;
    const result = rec.result as { bomRows?: unknown[]; toCreate?: unknown[] } | undefined;
    return (
      <div className="space-y-2 text-xs">
        {prefs && <p className="text-subtext1"><span className="text-overlay1">Preference:</span> {String(prefs)}</p>}
        <p className="text-subtext1">Vstup: <b className="text-text">{rows.length}</b> řádků</p>
        {result && (
          <p className="text-subtext1">
            Výsledek: <span className="text-green">{result.bomRows?.length ?? 0} nalezeno</span>
            {result.toCreate?.length ? <span className="text-peach"> · {result.toCreate.length} k založení</span> : null}
          </p>
        )}
        {rows.length > 0 && (
          <div className="bg-surface0 rounded-xl p-2 max-h-40 overflow-y-auto">
            {rows.slice(0, 50).map((r, i) => {
              const o = r as { typoveOznaceni?: string; popis?: string };
              return <div key={i} className="text-text truncate">{o.typoveOznaceni ?? JSON.stringify(r)}{o.popis ? ` — ${o.popis}` : ''}</div>;
            })}
          </div>
        )}
      </div>
    );
  }

  return <pre className="text-[11px] text-subtext1 whitespace-pre-wrap">{JSON.stringify(rec, null, 2)}</pre>;
}

export function AdminLogs({ password }: { password: string }) {
  const [records, setRecords] = useState<ChatLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rawId, setRawId] = useState<number | null>(null);

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
              onClick={() => { setType(t.value); setExpanded(null); }}
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
                    {TYPE_LABEL[rec.type ?? ''] ?? rec.type ?? '?'}
                  </span>
                  <span className="text-xs text-subtext1 shrink-0 font-mono">
                    {rec.ts ? new Date(rec.ts).toLocaleString('cs') : ''}
                  </span>
                  <span className="text-xs text-text truncate flex-1">{summary(rec)}</span>
                </button>
                {open && (
                  <div className="border-t border-surface1 p-3 space-y-2">
                    <LogDetail rec={rec} />
                    <div className="pt-1">
                      <button onClick={() => setRawId(rawId === i ? null : i)} className="flex items-center gap-1 text-[10px] text-overlay0 hover:text-subtext1">
                        <Code2 size={11} /> {rawId === i ? 'skrýt JSON' : 'surový JSON'}
                      </button>
                      {rawId === i && (
                        <pre className="mt-1 text-[10px] text-subtext1 bg-base/60 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                          {JSON.stringify(rec, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
