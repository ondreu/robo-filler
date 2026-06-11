import { useState } from 'react';
import { Lock, Loader2, Download, Database } from 'lucide-react';
import { loginAdmin, downloadMasterCsv, ADMIN_AVAILABLE } from '../utils/adminApi';
import { AdminMasterCsv } from './AdminMasterCsv';

const PW_KEY = 'robo-filler-admin-pw';

const MASTER_FILES: { which: 'main' | 'effi'; label: string; filename: string }[] = [
  { which: 'main', label: 'Ústí n. O. (master-data.csv)', filename: 'master-data.csv' },
  { which: 'effi', label: 'Effretikon (master-data-effi.csv)', filename: 'master-data-effi.csv' },
];

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
        <h2 className="text-lg font-semibold">Master CSV — správa dat</h2>
      </div>
      <p className="text-sm text-subtext1">Zadej admin heslo pro přístup.</p>
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

function MasterCsvDownload({ password }: { password: string }) {
  const [downloading, setDownloading] = useState<'main' | 'effi' | null>(null);
  const [error, setError] = useState('');

  const onDownload = async (which: 'main' | 'effi', filename: string) => {
    setDownloading(which); setError('');
    try { await downloadMasterCsv(password, which, filename); }
    catch (e) { setError(e instanceof Error ? e.message : 'Download selhal.'); }
    finally { setDownloading(null); }
  };

  return (
    <div className="bg-mantle rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database size={15} className="text-teal" />
        <p className="text-sm font-semibold text-text">Záloha master CSV</p>
      </div>
      <p className="text-xs text-overlay0">Stáhne aktuální soubor přímo ze serveru.</p>
      {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-xl px-4 py-2">{error}</div>}
      <div className="flex flex-wrap gap-2">
        {MASTER_FILES.map(({ which, label, filename }) => (
          <button
            key={which}
            onClick={() => onDownload(which, filename)}
            disabled={downloading !== null}
            className="flex items-center gap-2 bg-teal/15 text-teal border border-teal/25 rounded-lg px-3 py-2 text-sm font-medium hover:bg-teal/25 disabled:opacity-50 transition-colors"
          >
            {downloading === which ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MasterCsvPage() {
  const [password, setPassword] = useState<string | null>(() => sessionStorage.getItem(PW_KEY));

  if (!ADMIN_AVAILABLE) return null;

  if (!password) return <LoginGate onAuth={setPassword} />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <MasterCsvDownload password={password} />
      <div className="bg-mantle rounded-2xl p-4">
        <AdminMasterCsv password={password} />
      </div>
    </div>
  );
}
