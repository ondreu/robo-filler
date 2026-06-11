import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

// Kontrola nové verze každou hodinu
const CHECK_INTERVAL = 60 * 60 * 1000;

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      if (reg) setInterval(() => { reg.update(); }, CHECK_INTERVAL);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)]">
      <div className="bg-mantle border border-mauve/40 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="bg-mauve/20 text-mauve rounded-xl p-2 shrink-0">
          <RefreshCw size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">Nová verze aplikace</p>
          <p className="text-xs text-subtext1">Je k dispozici aktualizace. Obnov, ať máš nejnovější funkce.</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-mauve text-crust text-sm font-medium rounded-xl px-3 py-2 hover:bg-mauve/90 shrink-0"
        >
          Aktualizovat
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-overlay1 hover:text-text shrink-0"
          title="Později"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
