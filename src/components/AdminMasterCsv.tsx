import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Upload, RefreshCw, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchMasterCsvInfo, uploadMasterCsv, type MasterCsvInfo } from '../utils/adminApi';

function fmtBytes(n: number): string {
  if (n === 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// File → base64 (zachová přesné byty / kódování)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FILES: { which: 'main' | 'effi'; label: string }[] = [
  { which: 'main', label: 'Ústí nad Orlicí (master-data.csv)' },
  { which: 'effi', label: 'Effretikon (master-data-effi.csv)' },
];

export function AdminMasterCsv({ password }: { password: string }) {
  const [info, setInfo] = useState<MasterCsvInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'main' | 'effi' | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const refs = { main: useRef<HTMLInputElement>(null), effi: useRef<HTMLInputElement>(null) };

  const load = useCallback(() => {
    setLoading(true); setError('');
    fetchMasterCsvInfo(password)
      .then(setInfo)
      .catch(e => setError(e.message ?? 'Chyba.'))
      .finally(() => setLoading(false));
  }, [password]);

  useEffect(() => { load(); }, [load]);

  const onPick = async (which: 'main' | 'effi', file: File) => {
    if (!confirm(`Nahradit ${which === 'main' ? 'hlavní' : 'Effretikon'} databázi souborem „${file.name}" (${fmtBytes(file.size)})?\n\nProjeví se okamžitě ve vyhledávání i Karel Botovi.`)) return;
    setBusy(which); setError(''); setMsg('');
    try {
      const b64 = await fileToBase64(file);
      const res = await uploadMasterCsv(password, which, b64);
      setMsg(`Nahráno — celkem ${res.articleCount.toLocaleString('cs')} artiklů v hlavní DB.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload selhal.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database size={16} className="text-mauve" />
        <h3 className="text-sm font-semibold text-text">Hlavní databáze (master CSV)</h3>
        <button onClick={load} className="flex items-center gap-1 bg-surface0 hover:bg-surface1 text-text text-xs rounded-lg px-3 py-1.5 ml-auto">
          <RefreshCw size={13} /> Obnovit
        </button>
      </div>

      <div className="flex items-start gap-2 bg-yellow/10 border border-yellow/20 rounded-xl p-3 text-xs text-yellow">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <div>
          Formát CSV: <code>typové označení;artikl;výrobce;název;číslo dílu;výběhový;status</code> (oddělovač <code>;</code>).
          Nahrání <b>přepíše celou</b> příslušnou databázi a okamžitě přeindexuje vyhledávání. Soubor se uloží do perzistentního úložiště (přežije restart).
        </div>
      </div>

      {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-xl px-4 py-2">{error}</div>}
      {msg && <div className="flex items-center gap-2 bg-green/10 border border-green/30 text-green text-sm rounded-xl px-4 py-2"><CheckCircle2 size={15} /> {msg}</div>}

      {loading && !info ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-mauve" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {FILES.map(({ which, label }) => {
            const f = info?.files[which];
            return (
              <div key={which} className="bg-surface0 border border-surface1 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-text">{label}</p>
                  <p className="text-xs text-overlay0 mt-0.5">
                    {f && f.bytes > 0
                      ? `${fmtBytes(f.bytes)} · ${f.modified ? new Date(f.modified).toLocaleString('cs') : ''}`
                      : 'soubor chybí'}
                  </p>
                </div>
                <input
                  ref={refs[which]}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => { const file = e.target.files?.[0]; if (file) onPick(which, file); e.target.value = ''; }}
                />
                <button
                  onClick={() => refs[which].current?.click()}
                  disabled={busy !== null}
                  className="flex items-center gap-2 bg-mauve/20 text-mauve border border-mauve/30 rounded-lg px-3 py-2 text-sm font-medium hover:bg-mauve/30 disabled:opacity-50"
                >
                  {busy === which ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Nahradit CSV
                </button>
              </div>
            );
          })}
        </div>
      )}

      {info && (
        <p className="text-xs text-subtext1">
          Aktuálně načteno celkem <span className="text-text font-medium">{info.articleCount.toLocaleString('cs')}</span> artiklů v hlavní DB.
        </p>
      )}
    </div>
  );
}
