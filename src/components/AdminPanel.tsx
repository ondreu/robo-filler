import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Lock, Save, Plus, Trash2, Download, Upload, RefreshCw, Loader2,
  Search, X, Settings2, Filter, AlertTriangle, CheckCircle2, Table2, MessageSquare,
  History, Undo2, Replace, SlidersHorizontal, Eye, EyeOff,
} from 'lucide-react';
import type { DbName, DbRow, DbSchema, DbColumn, ColumnType, DbInfo } from '../utils/dbSchema';
import { coerceCell } from '../utils/dbSchema';
import { ADMIN_AVAILABLE, loginAdmin, listDatabases, fetchDb, saveDb } from '../utils/adminApi';
import { rowsToCsv, rowsToJson, parseCsv, downloadFile } from '../utils/dbCsv';
import { DataGrid, type GridCol } from './DataGrid';
import { AdminLogs } from './AdminLogs';
import { AdminMasterCsv } from './AdminMasterCsv';
import { AdminBackups } from './AdminBackups';

const PW_KEY = 'robo-filler-admin-pw';
const NOTE_KEY = '_poznamka';        // interní admin poznámka k řádku
const UNDO_LIMIT = 50;

type SubView = 'data' | 'logs' | 'backups';
type SortDir = 'asc' | 'desc' | null;

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
  schema, onChange, onAddColumn, onDeleteColumn, hiddenCols, onToggleHidden,
}: {
  schema: DbSchema;
  onChange: (cols: DbColumn[]) => void;
  onAddColumn: (key: string) => void;
  onDeleteColumn: (key: string) => void;
  hiddenCols: Set<string>;
  onToggleHidden: (key: string) => void;
}) {
  const [newKey, setNewKey] = useState('');

  const update = (key: string, patch: Partial<DbColumn>) =>
    onChange(schema.columns.map(c => (c.key === key ? { ...c, ...patch } : c)));

  return (
    <div className="bg-mantle rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-mauve">
        <Settings2 size={16} />
        <h3 className="text-sm font-semibold">Sloupce &amp; filtry</h3>
        <span className="text-xs text-overlay0 ml-auto">Oko = dočasně skrýt sloupec</span>
      </div>
      <div className="space-y-2">
        {schema.columns.map(col => {
          const hidden = hiddenCols.has(col.key);
          return (
          <div key={col.key} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${hidden ? 'bg-surface0/40 opacity-60' : 'bg-surface0'}`}>
            <button
              onClick={() => onToggleHidden(col.key)}
              className={`shrink-0 transition-colors ${hidden ? 'text-overlay0 hover:text-subtext1' : 'text-subtext1 hover:text-text'}`}
              title={hidden ? 'Zobrazit sloupec' : 'Dočasně skrýt sloupec'}
            >
              {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
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
          );
        })}
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
  const [dbName, setDbName] = useState<DbName | 'master'>('wires');

  const [rows, setRows] = useState<DbRow[]>([]);
  const [schema, setSchema] = useState<DbSchema>({ columns: [] });
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [query, setQuery] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [importData, setImportData] = useState<DbRow[] | null>(null);
  const [subView, setSubView] = useState<SubView>('data');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  // #3 řazení + filtry sloupců + najít&nahradit
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [showColFilters, setShowColFilters] = useState(false);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showReplace, setShowReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // #2 souhrn/validace před uložením
  const [confirmSave, setConfirmSave] = useState<null | { issues: string[]; summary: string }>(null);

  // #7 undo
  const [undoStack, setUndoStack] = useState<DbRow[][]>([]);

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
    if (!password) return;
    setLoading(true); setError(''); setSavedMsg('');
    fetchDb(name, password)
      .then(({ rows, schema }) => {
        setRows(rows); setSchema(schema); setDirty(false); setQuery('');
        setUndoStack([]); setSortKey(null); setSortDir(null); setColFilters({});
        setHiddenCols(new Set());
      })
      .catch(e => setError(e.message ?? 'Chyba načtení.'))
      .finally(() => setLoading(false));
  }, [password]);

  useEffect(() => { if (password && dbName !== 'master') loadDb(dbName as DbName); }, [password, dbName, loadDb]);

  // #2 varování při odchodu s neuloženými změnami
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // #7 Ctrl/⌘+Z (mimo editaci v inputu/textarea)
  useEffect(() => {
    if (subView !== 'data') return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault(); undo();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }); // bez deps — closure čte aktuální undoStack přes setState

  // ── Edit operace ────────────────────────────────────────────────────────

  const typeByKey = useMemo(() => new Map(schema.columns.map(c => [c.key, c.type])), [schema]);

  // #7 undo — uloží předchozí stav před každou mutací
  const pushUndo = (snapshot: DbRow[]) => setUndoStack(s => [...s.slice(-(UNDO_LIMIT - 1)), snapshot]);
  const commit = (next: DbRow[]) => { pushUndo(rows); setRows(next); setDirty(true); setSavedMsg(''); };
  const undo = () => {
    if (!undoStack.length) return;
    setRows(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
    setDirty(true); setSavedMsg('');
  };

  const updateCell = (idx: number, key: string, value: string) => {
    const type = typeByKey.get(key) ?? 'text';
    const coerced = coerceCell(value, type);
    commit(rows.map((r, i) => (i === idx ? { ...r, [key]: coerced } : r)));
  };

  const addRow = () => {
    const blank: DbRow = {};
    schema.columns.forEach(c => { blank[c.key] = null; });
    blank[NOTE_KEY] = null;
    commit([...rows, blank]);
  };

  const appendRows = (newRows: DbRow[]) => {
    if (!newRows.length) return;
    commit([...rows, ...newRows]);
  };

  const deleteRow = (idx: number) => commit(rows.filter((_, i) => i !== idx));

  const deleteRows = (idxs: number[]) => {
    const set = new Set(idxs);
    commit(rows.filter((_, i) => !set.has(i)));
  };

  const duplicateRow = (idx: number) => {
    const copy = [...rows];
    copy.splice(idx + 1, 0, { ...rows[idx] });
    commit(copy);
  };

  // #3 najít & nahradit napříč všemi sloupci (textová záměna)
  const doReplace = () => {
    if (!findText) return;
    let count = 0;
    const next = rows.map(r => {
      const nr = { ...r };
      for (const col of gridColumns) {
        const v = nr[col.key];
        if (typeof v === 'string' && v.includes(findText)) {
          nr[col.key] = coerceCell(v.split(findText).join(replaceText), col.type);
          count++;
        }
      }
      return nr;
    });
    if (count > 0) { commit(next); setSavedMsg(`Nahrazeno v ${count} buňkách.`); }
    else setSavedMsg('Žádná shoda.');
  };

  // #3 řazení — klik cyklí asc → desc → vypnuto
  const onSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir(null); }
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
  };

  // ── Save (#2 validace + souhrn) ────────────────────────────────────────────

  const idKey = useMemo(() => databases.find(d => d.name === dbName)?.idKey ?? schema.columns[0]?.key, [databases, dbName, schema]);

  const validate = (): string[] => {
    const issues: string[] = [];
    // duplicitní / prázdné ID
    if (idKey) {
      const seen = new Map<string, number>();
      let empty = 0;
      rows.forEach(r => {
        const v = r?.[idKey];
        if (v == null || String(v).trim() === '') { empty++; return; }
        const k = String(v); seen.set(k, (seen.get(k) ?? 0) + 1);
      });
      const dups = [...seen.entries()].filter(([, n]) => n > 1);
      if (empty) issues.push(`${empty} řádků s prázdným „${idKey}"`);
      if (dups.length) issues.push(`${dups.length} duplicitních hodnot „${idKey}" (např. ${dups.slice(0, 3).map(([k]) => k).join(', ')})`);
    }
    // nečíselné hodnoty v číselných sloupcích
    schema.columns.filter(c => c.type === 'number').forEach(c => {
      const bad = rows.filter(r => { const v = r?.[c.key]; return v != null && v !== '' && typeof v !== 'number' && isNaN(Number(String(v).replace(',', '.'))); }).length;
      if (bad) issues.push(`${bad} nečíselných hodnot ve sloupci „${c.label}"`);
    });
    return issues;
  };

  const save = () => {
    if (!password) return;
    const issues = validate();
    setConfirmSave({ issues, summary: `Uloží se ${rows.length} řádků.` });
  };

  const performSave = async () => {
    if (!password) return;
    setConfirmSave(null);
    setSaving(true); setError(''); setSavedMsg('');
    try {
      const res = await saveDb(dbName, password, { rows, schema });
      setSchema(res.schema);
      setDirty(false); setUndoStack([]);
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
    const activeCol = Object.entries(colFilters).filter(([, v]) => v.trim() !== '');
    let r = indexed;
    if (q) r = r.filter(({ row }) => schema.columns.some(c => String(row?.[c.key] ?? '').toLowerCase().includes(q)));
    if (activeCol.length) {
      r = r.filter(({ row }) => activeCol.every(([k, v]) => String(row?.[k] ?? '').toLowerCase().includes(v.trim().toLowerCase())));
    }
    if (sortKey && sortDir) {
      const type = typeByKey.get(sortKey) ?? 'text';
      const dir = sortDir === 'asc' ? 1 : -1;
      r = [...r].sort((a, b) => {
        const va = a.row?.[sortKey], vb = b.row?.[sortKey];
        if (va == null) return 1; if (vb == null) return -1;
        if (type === 'number') return (Number(va) - Number(vb)) * dir;
        return String(va).localeCompare(String(vb), 'cs', { numeric: true }) * dir;
      });
    }
    return r;
  }, [indexed, query, schema, colFilters, sortKey, sortDir, typeByKey]);

  const pageRows = filtered;

  // Sloupce gridu = sloupce schématu + virtuální sloupec admin poznámky
  const gridColumns: GridCol[] = useMemo(() => [
    ...schema.columns.map(c => ({ key: c.key, label: c.label, type: c.type })),
    { key: NOTE_KEY, label: 'Poznámka (admin)', type: 'text' as ColumnType, note: true },
  ], [schema]);

  const visibleGridCols = useMemo(() =>
    gridColumns.filter(c => !hiddenCols.has(c.key)),
    [gridColumns, hiddenCols],
  );

  const toggleHidden = (key: string) =>
    setHiddenCols(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

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
      {/* Sub-navigace */}
      <div className="flex bg-surface0 rounded-2xl p-1 gap-1 w-fit">
        {([
          { v: 'data', label: 'Databáze', icon: Table2 },
          { v: 'backups', label: 'Zálohy', icon: History },
          { v: 'logs', label: 'AI logy', icon: MessageSquare },
        ] as const).map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              subView === v ? 'bg-mauve text-crust shadow' : 'text-subtext1 hover:text-text'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {subView === 'logs' && <AdminLogs password={password} />}
      {subView === 'backups' && (
        <AdminBackups
          password={password}
          databases={databases}
          onAfterRestore={(d) => { if (d === dbName) loadDb(dbName); }}
        />
      )}

      {subView === 'data' && (
        <>
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
              <button
                onClick={() => {
                  if (dirty && !confirm('Máš neuložené změny. Přepnout databázi a zahodit je?')) return;
                  setDbName('master');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  dbName === 'master' ? 'bg-teal text-crust' : 'text-subtext1 hover:text-text'
                }`}
              >
                Master CSV
              </button>
            </div>

            {dbName !== 'master' && <div className="flex items-center gap-2 flex-wrap">
              <button onClick={undo} disabled={!undoStack.length} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5 disabled:opacity-40" title="Zpět (Ctrl+Z)">
                <Undo2 size={14} /> Zpět
              </button>
              <button onClick={() => setShowColFilters(s => !s)} className={`flex items-center gap-1 text-xs rounded-lg px-3 py-1.5 ${showColFilters ? 'bg-mauve/20 text-mauve' : 'bg-surface0 hover:bg-surface1 text-text'}`}>
                <SlidersHorizontal size={14} /> Filtry
              </button>
              <button onClick={() => setShowReplace(s => !s)} className={`flex items-center gap-1 text-xs rounded-lg px-3 py-1.5 ${showReplace ? 'bg-mauve/20 text-mauve' : 'bg-surface0 hover:bg-surface1 text-text'}`}>
                <Replace size={14} /> Nahradit
              </button>
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
              <button onClick={() => dbName !== 'master' && loadDb(dbName as DbName)} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5" title="Znovu načíst ze serveru">
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
            </div>}
          </div>

          {dbName === 'master' && <AdminMasterCsv password={password} />}

          {dbName !== 'master' && <>
          {/* Status */}
          {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-xl px-4 py-2">{error}</div>}
          {savedMsg && <div className="flex items-center gap-2 bg-green/10 border border-green/30 text-green text-sm rounded-xl px-4 py-2"><CheckCircle2 size={15} /> {savedMsg}</div>}

          {showSchema && (
            <SchemaEditor
              schema={schema}
              onChange={setSchemaCols}
              onAddColumn={addColumn}
              onDeleteColumn={deleteColumn}
              hiddenCols={hiddenCols}
              onToggleHidden={toggleHidden}
            />
          )}

          {showReplace && (
            <div className="flex flex-wrap items-end gap-2 bg-mantle rounded-2xl p-3">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] text-overlay0">Najít</label>
                <input value={findText} onChange={e => setFindText(e.target.value)} className="w-full bg-surface0 border border-surface2 rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-mauve/50" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] text-overlay0">Nahradit za</label>
                <input value={replaceText} onChange={e => setReplaceText(e.target.value)} className="w-full bg-surface0 border border-surface2 rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-mauve/50" />
              </div>
              <button onClick={doReplace} disabled={!findText} className="bg-mauve/20 text-mauve border border-mauve/30 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-mauve/30 disabled:opacity-50">
                Nahradit vše
              </button>
              <p className="w-full text-[11px] text-overlay0">Textová záměna ve všech sloupcích napříč celou databází (lze vrátit přes Zpět).</p>
            </div>
          )}

          {showColFilters && (
            <div className="bg-mantle rounded-2xl p-3 flex flex-wrap gap-2">
              {schema.columns.map(c => (
                <div key={c.key} className="flex flex-col">
                  <label className="text-[10px] text-overlay0 truncate max-w-[140px]">{c.label}</label>
                  <input
                    value={colFilters[c.key] ?? ''}
                    onChange={e => { setColFilters(f => ({ ...f, [c.key]: e.target.value })); }}
                    placeholder="filtr…"
                    className="w-32 bg-surface0 border border-surface2 rounded-lg px-2 py-1 text-xs text-text placeholder:text-overlay0 focus:outline-none focus:border-teal/50"
                  />
                </div>
              ))}
              {Object.values(colFilters).some(v => v) && (
                <button onClick={() => setColFilters({})} className="self-end text-xs text-overlay0 hover:text-red px-2 py-1">Zrušit filtry</button>
              )}
            </div>
          )}

          {/* Search + add row + count */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-overlay1 pointer-events-none" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); }}
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

          <p className="text-[11px] text-overlay0">
            Excel-like: táhni myší pro výběr buněk · <kbd className="bg-surface1 px-1 rounded">Ctrl/⌘+C</kbd> kopírovat · <kbd className="bg-surface1 px-1 rounded">Ctrl/⌘+V</kbd> vložit z Excelu · dvojklik nebo Enter pro editaci · <kbd className="bg-surface1 px-1 rounded">Del</kbd> smazat obsah
          </p>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-mauve" /></div>
          ) : (
            <DataGrid
              columns={visibleGridCols}
              pageRows={pageRows}
              pageOffset={0}
              onCellChange={updateCell}
              onDeleteRow={deleteRow}
              onDuplicateRow={duplicateRow}
              onAppendRows={appendRows}
              onDeleteRows={deleteRows}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              resetKey={`${dbName}-${query}-${schema.columns.length}-${sortKey}-${sortDir}-${hiddenCols.size}`}
            />
          )}

          {importData && (
            <ImportModal
              count={importData.length}
              onClose={() => setImportData(null)}
              onReplace={() => applyImport('replace')}
              onAppend={() => applyImport('append')}
            />
          )}

          {confirmSave && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setConfirmSave(null); }}>
              <div className="bg-base border border-surface1 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-base font-semibold text-text flex items-center gap-2"><Save size={18} className="text-green" /> Uložit změny</h3>
                <p className="text-sm text-subtext1">{confirmSave.summary}</p>
                {confirmSave.issues.length > 0 && (
                  <div className="bg-yellow/10 border border-yellow/20 rounded-xl p-3 space-y-1">
                    <p className="text-xs text-yellow font-semibold flex items-center gap-1"><AlertTriangle size={13} /> Upozornění ({confirmSave.issues.length}):</p>
                    <ul className="text-xs text-yellow/90 list-disc list-inside space-y-0.5">
                      {confirmSave.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                    </ul>
                    <p className="text-[11px] text-overlay1">Můžeš uložit i tak, ale zkontroluj data.</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmSave(null)} className="px-4 py-2 rounded-xl text-sm text-subtext1 hover:text-text">Zrušit</button>
                  <button onClick={performSave} className="px-4 py-2 rounded-xl text-sm font-semibold bg-green text-crust hover:bg-green/90">Uložit</button>
                </div>
              </div>
            </div>
          )}
          </>}
        </>
      )}
    </div>
  );
}
