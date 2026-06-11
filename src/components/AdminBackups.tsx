import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, History, RotateCcw, Camera, ScrollText, Download, Database } from 'lucide-react';
import type { DbName, DbInfo } from '../utils/dbSchema';
import { listSnapshots, createSnapshot, restoreSnapshot, fetchAudit, downloadMasterCsv, type SnapshotInfo, type AuditRecord } from '../utils/adminApi';

const MASTER_FILES: { which: 'main' | 'effi'; label: string; filename: string }[] = [
  { which: 'main', label: 'Ústí n. O. (master-data.csv)', filename: 'master-data.csv' },
  { which: 'effi', label: 'Effretikon (master-data-effi.csv)', filename: 'master-data-effi.csv' },
];

const ACTION_LABEL: Record<string, string> = {
  save: 'Uložení', snapshot: 'Ruční záloha', restore: 'Obnova', 'master-csv': 'Master CSV',
};

export function AdminBackups({ password, databases, onAfterRestore }: {
  password: string;
  databases: DbInfo[];
  onAfterRestore: (db: DbName) => void;
}) {
  const [db, setDb] = useState<DbName>('wires');
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<'main' | 'effi' | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    Promise.all([listSnapshots(db, password), fetchAudit(password)])
      .then(([s, a]) => { setSnaps(s); setAudit(a); })
      .catch(e => setError(e.message ?? 'Chyba.'))
      .finally(() => setLoading(false));
  }, [db, password]);

  useEffect(() => { load(); }, [load]);

  const snapshotNow = async () => {
    setBusy(true); setError(''); setMsg('');
    try { setSnaps(await createSnapshot(db, password)); setMsg('Záloha vytvořena.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba.'); }
    finally { setBusy(false); }
  };

  const onDownloadCsv = async (which: 'main' | 'effi', filename: string) => {
    setDownloading(which); setError('');
    try { await downloadMasterCsv(password, which, filename); }
    catch (e) { setError(e instanceof Error ? e.message : 'Download selhal.'); }
    finally { setDownloading(null); }
  };

  const restore = async (id: string) => {
    if (!confirm(`Obnovit databázi „${db}" ze zálohy z ${new Date(id.replace(/-/g, ':').replace(/T/, 'T')).toLocaleString('cs')}?\n\nAktuální stav se předtím zazálohuje (jde vrátit).`)) return;
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await restoreSnapshot(db, password, id);
      setMsg(`Obnoveno — ${res.count} řádků.`);
      onAfterRestore(db);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Obnova selhala.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <History size={16} className="text-mauve" />
        <h3 className="text-sm font-semibold text-text">Zálohy &amp; obnova</h3>
        <div className="flex bg-surface0 rounded-lg p-0.5 gap-0.5 ml-2">
          {databases.map(d => (
            <button key={d.name} onClick={() => setDb(d.name)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${db === d.name ? 'bg-mauve text-crust' : 'text-subtext1 hover:text-text'}`}>
              {d.label}
            </button>
          ))}
        </div>
        <button onClick={snapshotNow} disabled={busy} className="flex items-center gap-1 bg-mauve/20 text-mauve border border-mauve/30 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-mauve/30 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Zálohovat teď
        </button>
        <button onClick={load} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5"><RefreshCw size={13} /></button>
      </div>

      <p className="text-[11px] text-overlay0">Retence: denně posledních 5 dní · týdně 3 týdny · měsíčně 1 měsíc. Off-site kopie je v denní GitHub záloze.</p>

      {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-xl px-4 py-2">{error}</div>}
      {msg && <div className="bg-green/10 border border-green/30 text-green text-sm rounded-xl px-4 py-2">{msg}</div>}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-mauve" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Snapshoty */}
          <div className="space-y-1.5">
            <p className="text-xs text-overlay0 font-semibold uppercase tracking-wide">Snapshoty ({snaps.length})</p>
            {snaps.length === 0 ? (
              <p className="text-sm text-subtext1">Zatím žádné zálohy. Vytvoř ručně nebo se vytvoří při uložení.</p>
            ) : snaps.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-surface0 rounded-lg px-3 py-2 text-xs">
                <span className="text-text font-mono">{new Date(s.ts).toLocaleString('cs')}</span>
                <span className="text-overlay0">{s.rows ?? '?'} ř.</span>
                <button onClick={() => restore(s.id)} disabled={busy} className="ml-auto flex items-center gap-1 text-mauve hover:text-text disabled:opacity-50">
                  <RotateCcw size={12} /> Obnovit
                </button>
              </div>
            ))}
          </div>

          {/* Audit */}
          <div className="space-y-1.5">
            <p className="text-xs text-overlay0 font-semibold uppercase tracking-wide flex items-center gap-1"><ScrollText size={12} /> Audit akcí</p>
            {audit.length === 0 ? (
              <p className="text-sm text-subtext1">Žádné záznamy.</p>
            ) : audit.map((a, i) => (
              <div key={i} className="flex items-center gap-2 bg-surface0 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-subtext1 font-mono shrink-0">{new Date(a.ts).toLocaleString('cs')}</span>
                <span className="text-text shrink-0">{ACTION_LABEL[a.action] ?? a.action}</span>
                <span className="text-overlay0 ml-auto flex items-center gap-1.5">
                  {a.db ?? a.which ?? ''}
                  {a.rows != null ? ` · ${a.rows} ř.` : ''}
                  {a.diff && (
                    <span className="font-mono ml-1">
                      <span className="text-green">+{a.diff.added}</span>
                      {' '}
                      <span className="text-red">-{a.diff.removed}</span>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Master CSV download */}
      <div className="pt-3 border-t border-surface1 space-y-2">
        <p className="text-xs text-overlay0 font-semibold uppercase tracking-wide flex items-center gap-1">
          <Database size={12} /> Záloha master CSV
        </p>
        <div className="flex flex-wrap gap-2">
          {MASTER_FILES.map(({ which, label, filename }) => (
            <button
              key={which}
              onClick={() => onDownloadCsv(which, filename)}
              disabled={downloading !== null}
              className="flex items-center gap-2 bg-teal/15 text-teal border border-teal/25 rounded-lg px-3 py-2 text-xs font-medium hover:bg-teal/25 disabled:opacity-50 transition-colors"
            >
              {downloading === which ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-overlay0">Stáhne aktuální soubor přímo ze serveru (před nahráním nové verze).</p>
      </div>
    </div>
  );
}
