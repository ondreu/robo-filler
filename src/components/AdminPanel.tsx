import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Lock, Save, Plus, Trash2, Copy, Download, Upload, RefreshCw, Loader2,
  Search, X, Settings2, Filter, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import type { DbName, DbRow, DbSchema, DbColumn, ColumnType, DbInfo } from '../utils/dbSchema';
import { coerceCell } from '../utils/dbSchema';
import { ADMIN_AVAILABLE, loginAdmin, listDatabases, fetchDb, saveDb } from '../utils/adminApi';
import { rowsToCsv, rowsToJson, parseCsv, downloadFile } from '../utils/dbCsv';

const PW_KEY = 'robo-filler-admin-pw';
const PAGE_SIZE = 25;

// ─── Login ──────────────────────────────────────────────────────────────────

function LoginGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) return;
    setBusy(true); setErr('');
    const ok = await loginAdmin(pw);
    setBusy(false);
    if (ok) { sessionStorage.setItem(PW_KEY, pw); onAuth(pw); }
    else setErr('Neplatné heslo.');
  };

  return (
    <div className="max-w-md mx-auto bg-mantle rounded-2xl p-8 space-y-4 mt-8">
      <div className="flex items-center gap-2 text-mauve">
        <Lock size={20} />
        <h2 className="text-lg font-semibold">Admin — správa databází</h2>
      </div>
      <p className="text-sm text-subtext1">Zadej admin heslo pro přístup ke správě databází.</p>
      <input
        type="password"
        value={pw}
        autoFocus
        onChange={e => setPw(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="Heslo"
        className="w-full bg-surface0 border border-surface2 rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-mauve/50"
      />
      {err && <p className="text-sm text-red">{err}</p>}
      <button
        onClick={submit}
        disabled={busy || !pw}
        className="w-full bg-mauve text-crust font-medium rounded-xl py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        Přihlásit
      </button>
    </div>
  );
}

// ─── Schema editor ────────────────────────────────────────────────────────────

function SchemaEditor({
  schema, onChange, onAddColumn, onDeleteColumn,
}: {
  schema: DbSchema;
  onChange: (cols: DbColumn[]) => void;
  onAddColumn: (key: string) => void;
  onDeleteColumn: (key: string) => void;
}) {
  const [newKey, setNewKey] = useState('');

  const update = (key: string, patch: Partial<DbColumn>) =>
    onChange(schema.columns.map(c => (c.key === key ? { ...c, ...patch } : c)));

  return (
    <div className="bg-mantle rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-mauve">
        <Settings2 size={16} />
        <h3 className="text-sm font-semibold">Sloupce &amp; filtry</h3>
      </div>
      <div className="space-y-2">
        {schema.columns.map(col => (
          <div key={col.key} className="flex flex-wrap items-center gap-2 bg-surface0 rounded-xl px-3 py-2">
            <span className="font-mono text-xs text-overlay1 w-32 truncate" title={col.key}>{col.key}</span>
            <input
              value={col.label}
              onChange={e => update(col.key, { label: e.target.value })}
              placeholder="Popisek"
              className="flex-1 min-w-[120px] bg-base border border-surface2 rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:border-mauve/50"
            />
            <select
              value={col.type}
              onChange={e => update(col.key, { type: e.target.value as ColumnType })}
              className="bg-base border border-surface2 rounded-lg px-2 py-1 text-xs text-text focus:outline-none"
            >
              <option value="text">text</option>
              <option value="number">číslo</option>
              <option value="boolean">ano/ne</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-subtext1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={col.filterable}
                onChange={e => update(col.key, { filterable: e.target.checked })}
                className="accent-teal"
              />
              <Filter size={12} /> filtr
            </label>
            <button
              onClick={() => onDeleteColumn(col.key)}
              className="text-overlay1 hover:text-red transition-colors"
              title="Smazat sloupec"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newKey.trim()) { onAddColumn(newKey.trim()); setNewKey(''); } }}
          placeholder="klíč nového sloupce (např. nakupci)"
          className="flex-1 bg-surface0 border border-surface2 rounded-lg px-3 py-1.5 text-xs text-text placeholder:text-overlay0 focus:outline-none focus:border-mauve/50"
        />
        <button
          onClick={() => { if (newKey.trim()) { onAddColumn(newKey.trim()); setNewKey(''); } }}
          className="flex items-center gap-1 bg-surface1 hover:bg-surface2 text-text text-xs rounded-lg px-3 py-1.5"
        >
          <Plus size={14} /> Sloupec
        </button>
      </div>
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({
  count, onClose, onReplace, onAppend,
}: {
  count: number; onClose: () => void; onReplace: () => void; onAppend: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-base border border-surface1 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-text">Import CSV — {count} řádků</h3>
        <p className="text-sm text-subtext1">Chceš nahradit celou databázi, nebo přidat řádky k existujícím? Změna se uloží až tlačítkem „Uložit".</p>
        <div className="flex flex-col gap-2">
          <button onClick={onReplace} className="bg-red/20 text-red border border-red/30 rounded-xl py-2.5 text-sm font-medium hover:bg-red/30">Nahradit vše</button>
          <button onClick={onAppend} className="bg-teal/20 text-teal border border-teal/30 rounded-xl py-2.5 text-sm font-medium hover:bg-teal/30">Přidat řádky</button>
          <button onClick={onClose} className="text-overlay1 hover:text-text text-sm py-1">Zrušit</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminPanel() {
  const [password, setPassword] = useState<string | null>(() => sessionStorage.getItem(PW_KEY));
  const [authChecked, setAuthChecked] = useState(false);

  const [databases, setDatabases] = useState<DbInfo[]>([]);
  const [dbName, setDbName] = useState<DbName>('wires');

  const [rows, setRows] = useState<DbRow[]>([]);
  const [schema, setSchema] = useState<DbSchema>({ columns: [] });
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [showSchema, setShowSchema] = useState(false);
  const [importData, setImportData] = useState<DbRow[] | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Ověření uloženého hesla při startu
  useEffect(() => {
    if (!password) { setAuthChecked(true); return; }
    loginAdmin(password).then(ok => {
      if (!ok) { sessionStorage.removeItem(PW_KEY); setPassword(null); }
      setAuthChecked(true);
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (password) listDatabases().then(setDatabases);
  }, [password]);

  const loadDb = useCallback((name: DbName) => {
    setLoading(true); setError(''); setSavedMsg('');
    fetchDb(name)
      .then(({ rows, schema }) => { setRows(rows); setSchema(schema); setDirty(false); setPage(0); setQuery(''); })
      .catch(e => setError(e.message ?? 'Chyba načtení.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (password) loadDb(dbName); }, [password, dbName, loadDb]);

  // ── Edit operace ────────────────────────────────────────────────────────

  const typeByKey = useMemo(() => new Map(schema.columns.map(c => [c.key, c.type])), [schema]);

  const updateCell = (idx: number, key: string, value: string) => {
    const type = typeByKey.get(key) ?? 'text';
    const coerced = coerceCell(value, type);
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [key]: coerced } : r)));
    setDirty(true); setSavedMsg('');
  };

  const addRow = () => {
    const blank: DbRow = {};
    schema.columns.forEach(c => { blank[c.key] = null; });
    setRows(prev => [...prev, blank]);
    setDirty(true); setSavedMsg('');
    setPage(Math.floor((rows.length) / PAGE_SIZE));
  };

  const deleteRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setDirty(true); setSavedMsg('');
  };

  const duplicateRow = (idx: number) => {
    setRows(prev => {
      const copy = [...prev];
      copy.splice(idx + 1, 0, { ...prev[idx] });
      return copy;
    });
    setDirty(true); setSavedMsg('');
  };

  const setSchemaCols = (cols: DbColumn[]) => { setSchema({ columns: cols }); setDirty(true); setSavedMsg(''); };

  const addColumn = (key: string) => {
    if (schema.columns.some(c => c.key === key)) { setError(`Sloupec „${key}" už existuje.`); return; }
    setError('');
    setSchema(s => ({ columns: [...s.columns, { key, label: key, type: 'text', filterable: false }] }));
    setDirty(true); setSavedMsg('');
  };

  const deleteColumn = (key: string) => {
    setSchema(s => ({ columns: s.columns.filter(c => c.key !== key) }));
    // odstraň klíč i z dat, aby se sloupec znovu neobjevil při uložení
    setRows(prev => prev.map(r => { const { [key]: _omit, ...rest } = r; return rest; }));
    setDirty(true); setSavedMsg('');
  };

  // ── CSV / JSON ────────────────────────────────────────────────────────────

  const exportCsv = () => downloadFile(rowsToCsv(rows, schema.columns), `${dbName}.csv`, 'text/csv;charset=utf-8');
  const exportJson = () => downloadFile(rowsToJson(rows), `${dbName}.json`, 'application/json');

  const onFilePicked = async (file: File) => {
    const text = await file.text();
    const { headers, rows: parsed } = parseCsv(text, schema.columns);
    // Doplň chybějící sloupce do schématu
    const known = new Set(schema.columns.map(c => c.key));
    const newCols = headers.filter(h => h && !known.has(h)).map<DbColumn>(h => ({ key: h, label: h, type: 'text', filterable: false }));
    if (newCols.length) setSchema(s => ({ columns: [...s.columns, ...newCols] }));
    setImportData(parsed);
  };

  const applyImport = (mode: 'replace' | 'append') => {
    if (!importData) return;
    setRows(prev => (mode === 'replace' ? importData : [...prev, ...importData]));
    setImportData(null); setDirty(true); setSavedMsg('');
    setPage(0);
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!password) return;
    setSaving(true); setError(''); setSavedMsg('');
    try {
      const res = await saveDb(dbName, password, { rows, schema });
      setSchema(res.schema);
      setDirty(false);
      setSavedMsg(`Uloženo — ${res.count} řádků.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Uložení selhalo.';
      setError(msg);
      if (msg.includes('heslo')) { sessionStorage.removeItem(PW_KEY); setPassword(null); }
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered / paged view ──────────────────────────────────────────────────

  const indexed = useMemo(() => rows.map((row, idx) => ({ row, idx })), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter(({ row }) =>
      schema.columns.some(c => String(row?.[c.key] ?? '').toLowerCase().includes(q)),
    );
  }, [indexed, query, schema]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!ADMIN_AVAILABLE) {
    return (
      <div className="max-w-md mx-auto bg-mantle rounded-2xl p-8 mt-8 text-center space-y-2">
        <AlertTriangle size={24} className="text-yellow mx-auto" />
        <p className="text-sm text-subtext1">Admin vyžaduje backend. Nastav <code className="text-mauve">VITE_BACKEND_URL</code>.</p>
      </div>
    );
  }

  if (!authChecked) {
    return <div className="flex justify-center mt-12"><Loader2 className="animate-spin text-mauve" /></div>;
  }

  if (!password) return <LoginGate onAuth={setPassword} />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between bg-mantle rounded-2xl p-3">
        <div className="flex bg-surface0 rounded-xl p-1 gap-1">
          {databases.map(d => (
            <button
              key={d.name}
              onClick={() => {
                if (dirty && !confirm('Máš neuložené změny. Přepnout databázi a zahodit je?')) return;
                setDbName(d.name);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dbName === d.name ? 'bg-mauve text-crust' : 'text-subtext1 hover:text-text'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowSchema(s => !s)} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5">
            <Settings2 size={14} /> Sloupce
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5">
            <Upload size={14} /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFilePicked(f); e.target.value = ''; }} />
          <button onClick={exportCsv} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportJson} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5">
            <Download size={14} /> JSON
          </button>
          <button onClick={() => loadDb(dbName)} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5" title="Znovu načíst ze serveru">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              dirty ? 'bg-green text-crust hover:bg-green/90' : 'bg-surface0 text-overlay0'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Uložit{dirty ? ' •' : ''}
          </button>
        </div>
      </div>

      {/* Status */}
      {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-xl px-4 py-2">{error}</div>}
      {savedMsg && <div className="flex items-center gap-2 bg-green/10 border border-green/30 text-green text-sm rounded-xl px-4 py-2"><CheckCircle2 size={15} /> {savedMsg}</div>}

      {showSchema && (
        <SchemaEditor schema={schema} onChange={setSchemaCols} onAddColumn={addColumn} onDeleteColumn={deleteColumn} />
      )}

      {/* Search + add row + count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-overlay1 pointer-events-none" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0); }}
            placeholder="Hledat ve všech sloupcích…"
            className="w-full bg-surface0 border border-surface2 rounded-xl pl-8 pr-8 py-2 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-mauve/50"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-overlay1 hover:text-red"><X size={13} /></button>}
        </div>
        <span className="text-sm text-subtext1"><span className="text-text font-medium">{filtered.length}</span> / {rows.length} řádků</span>
        <button onClick={addRow} className="flex items-center gap-1 bg-mauve/20 text-mauve border border-mauve/30 rounded-lg px-3 py-2 text-xs font-medium hover:bg-mauve/30">
          <Plus size={14} /> Řádek
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-mauve" /></div>
      ) : (
        <div className="overflow-x-auto border border-surface1 rounded-xl">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-surface0">
                <th className="sticky left-0 z-10 bg-surface0 px-2 py-2 text-overlay0 font-medium border-b border-surface2">#</th>
                {schema.columns.map(c => (
                  <th key={c.key} className="px-2 py-2 text-left text-subtext1 font-semibold border-b border-surface2 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {c.label}
                      {c.filterable && <Filter size={10} className="text-teal" />}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2 border-b border-surface2"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ row, idx }) => (
                <tr key={idx} className="even:bg-surface0/40 hover:bg-surface0">
                  <td className="sticky left-0 z-10 bg-base px-2 py-1 text-overlay0 font-mono">{idx + 1}</td>
                  {schema.columns.map(c => (
                    <td key={c.key} className="px-1 py-0.5 border-b border-surface1/50">
                      <input
                        value={row?.[c.key] == null ? '' : String(row[c.key])}
                        onChange={e => updateCell(idx, c.key, e.target.value)}
                        className={`bg-transparent border border-transparent hover:border-surface2 focus:border-mauve/50 rounded px-1.5 py-1 text-text focus:outline-none focus:bg-surface0 min-w-[80px] ${c.type === 'number' ? 'text-right font-mono w-24' : 'w-40'}`}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-0.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => duplicateRow(idx)} className="text-overlay1 hover:text-teal" title="Duplikovat"><Copy size={13} /></button>
                      <button onClick={() => deleteRow(idx)} className="text-overlay1 hover:text-red" title="Smazat řádek"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} className="px-3 py-1 rounded-lg bg-surface0 disabled:opacity-40 text-subtext1">‹</button>
          <span className="text-subtext1">Strana {safePage + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} className="px-3 py-1 rounded-lg bg-surface0 disabled:opacity-40 text-subtext1">›</button>
        </div>
      )}

      {importData && (
        <ImportModal
          count={importData.length}
          onClose={() => setImportData(null)}
          onReplace={() => applyImport('replace')}
          onAppend={() => applyImport('append')}
        />
      )}
    </div>
  );
}
