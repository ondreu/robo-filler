import { useState, useEffect } from 'react';
import { Sparkles, X, RefreshCw } from 'lucide-react';

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');
const CLIENT_VERSION = 'V150626';

export function VersionChecker() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!BACKEND_URL) return;

    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/version`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== CLIENT_VERSION) {
          setNewVersion(data.version);
        }
      } catch { /* ignore */ }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!newVersion || dismissed) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-mauve text-crust px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4">
      <Sparkles size={15} className="shrink-0" />
      <span>Nová verze <span className="font-bold">{newVersion}</span> je k dispozici</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 bg-crust/20 hover:bg-crust/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      >
        <RefreshCw size={13} /> Aktualizovat
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-crust/60 hover:text-crust transition-colors"
        aria-label="Zavřít"
      >
        <X size={14} />
      </button>
    </div>
  );
}
