import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, History, RotateCcw, Camera, ScrollText, Download, ChevronDown, ChevronRight } from 'lucide-react';
import type { DbName, DbInfo } from '../utils/dbSchema';
import {
  listSnapshots, createSnapshot, restoreSnapshot, fetchAudit,
  listMasterSnapshots, restoreMasterSnapshot, fetchMasterRaw,
  type SnapshotInfo, type AuditRecord,
} from '../utils/adminApi';
import { downloadFile } from '../utils/dbCsv';

const ACTION_LABEL: Record<string, string> = {
  save: 'Uložení', snapshot: 'Ruční záloha', restore: 'Obnova', 'master-csv': 'Master CSV upload', 'master-restore': 'Master CSV obnova',
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅';
  return String(v);
}

// Git-style diff řádku
function DiffView({ diff }: { diff: NonNullable<AuditRecord['diff']> }) {
  return (
    <div className="font-mono text-[11px] space-y-0.5 mt-1">
      {(diff.addedIds ?? []).map(id => <div key={'a' + id} className="text-green">+ {id}</div>)}
      {(diff.removedIds ?? []).map(id => <div key={'r' + id} className="text-red">− {id}</div>)}
      {(diff.changes ?? []).map(ch => (
        <div key={'m' + ch.id} className="text-subtext1">
          <span className="text-yellow">~ {ch.id}</span>
          {ch.changes.map((c, i) => (
            <div key={i} className="pl-4 text-[10px]">
              <span className="text-overlay1">{c.key}:</span>{' '}
              <span className="text-red/80 line-through">{fmtVal(c.from)}</span>{' → '}
              <span className="text-green/90">{fmtVal(c.to)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Target { key: string; label: string; kind: 'db' | 'master' }

export function AdminBackups({ password, databases, onAfterRestore }: {
  password: string;
  databases: DbInfo[];
  onAfterRestore: (db: DbName) => void;
}) {
  const targets: Target[] = [
    ...databases.map(d => ({ key: d.name, label: d.label, kind: 'db' as const })),
    { key: 'main', label: 'Hlavní CSV (Ústí)', kind: 'master' as const },
    { key: 'effi', label: 'Hlavní CSV (Effi)', kind: 'master' as const },
  ];
  const [targetKey, setTargetKey] = useState('wires');
  const target = targets.find(t => t.key === targetKey) ?? targets[0];

  const [snaps, setSnaps] = useState<SnapshotInfo[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [auditOpen, setAuditOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    const snapP = target.kind === 'db'
      ? listSnapshots(target.key as DbName, password)
      : listMasterSnapshots(target.key as 'main' | 'effi', password);
    Promise.all([snapP, fetchAudit(password)])
      .then(([s, a]) => { setSnaps(s); setAudit(a); })
      .catch(e => setError(e.message ?? 'Chyba.'))
      .finally(() => setLoading(false));
  }, [target.kind, target.key, password]);

  useEffect(() => { load(); }, [load]);

  const snapshotNow = async () => {
    if (target.kind !== 'db') return;
    setBusy(true); setError(''); setMsg('');
    try { setSnaps(await createSnapshot(target.key as DbName, password)); setMsg('Záloha vytvořena.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba.'); }
    finally { setBusy(false); }
  };

  const restore = async (id: string) => {
    if (!confirm(`Obnovit „${target.label}" ze zálohy z ${new Date(id.slice(0, 19).replace(/-/g, ':').replace('T', ' ')).toLocaleString?.('cs') || id}?\n\nAktuální stav se předtím zazálohuje (jde vrátit).`)) return;
    setBusy(true); setError(''); setMsg('');
    try {
      if (target.kind === 'db') { await restoreSnapshot(target.key as DbName, password, id); onAfterRestore(target.key as DbName); }
      else await restoreMasterSnapshot(target.key as 'main' | 'effi', password, id);
      setMsg('Obnoveno.');
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Obnova selhala.'); }
    finally { setBusy(false); }
  };

  const downloadCurrent = async () => {
    if (target.kind !== 'master') return;
    setBusy(true);
    try {
      const text = await fetchMasterRaw(target.key as 'main' | 'effi', password);
      downloadFile(text, target.key === 'effi' ? 'master-data-effi.csv' : 'master-data.csv', 'text/csv;charset=utf-8');
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <History size={16} className="text-mauve" />
        <h3 className="text-sm font-semibold text-text">Zálohy &amp; obnova</h3>
        <div className="flex bg-surface0 rounded-lg p-0.5 gap-0.5 ml-2 flex-wrap">
          {targets.map(t => (
            <button key={t.key} onClick={() => { setTargetKey(t.key); }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${targetKey === t.key ? 'bg-mauve text-crust' : 'text-subtext1 hover:text-text'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {target.kind === 'db' && (
          <button onClick={snapshotNow} disabled={busy} className="flex items-center gap-1 bg-mauve/20 text-mauve border border-mauve/30 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-mauve/30 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Zálohovat teď
          </button>
        )}
        {target.kind === 'master' && (
          <button onClick={downloadCurrent} disabled={busy} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text rounded-lg px-3 py-1.5 text-xs disabled:opacity-50">
            <Download size={13} /> Stáhnout aktuální
          </button>
        )}
        <button onClick={load} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5"><RefreshCw size={13} /></button>
      </div>

      <p className="text-[11px] text-overlay0">Retence: vše posledních 5 dní · týdně 3 týdny · měsíčně 1 měsíc. Master CSV se zálohuje při každém nahrání. Off-site kopie je v denní GitHub záloze.</p>

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
              <p className="text-sm text-subtext1">Zatím žádné zálohy.</p>
            ) : snaps.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-surface0 rounded-lg px-3 py-2 text-xs">
                <span className="text-text font-mono">{new Date(s.ts).toLocaleString('cs')}</span>
                <span className="text-overlay0">{s.rows != null ? `${s.rows} ř.` : `${(s.bytes / 1024).toFixed(0)} kB`}</span>
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
            ) : audit.map((a, i) => {
              const hasDiff = a.diff && (a.diff.added || a.diff.removed || a.diff.modified);
              const open = auditOpen === i;
              return (
                <div key={i} className="bg-surface0 rounded-lg text-xs overflow-hidden">
                  <button onClick={() => hasDiff && setAuditOpen(open ? null : i)} className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${hasDiff ? 'hover:bg-surface1' : ''}`}>
                    {hasDiff ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
                    <span className="text-subtext1 font-mono">{new Date(a.ts).toLocaleString('cs')}</span>
                    <span className="text-text">{ACTION_LABEL[a.action] ?? a.action}</span>
                    <span className="text-overlay0 ml-auto">
                      {a.db ?? a.which ?? ''}
                      {a.diff ? ` · ${a.diff.added ? `+${a.diff.added} ` : ''}${a.diff.removed ? `−${a.diff.removed} ` : ''}${a.diff.modified ? `~${a.diff.modified}` : ''}`.trim() : (a.rows != null ? ` · ${a.rows} ř.` : '')}
                    </span>
                  </button>
                  {open && a.diff && (
                    <div className="px-3 pb-2 border-t border-surface1 max-h-60 overflow-y-auto">
                      <DiffView diff={a.diff} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
