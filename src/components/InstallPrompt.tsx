import { useState, useEffect } from 'react';
import { MonitorDown, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_dismissed_at';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function wasDismissedRecently() {
  const ts = localStorage.getItem(DISMISS_KEY);
  return ts ? Date.now() - Number(ts) < COOLDOWN_MS : false;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      if (!wasDismissedRecently()) setBannerVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    setBannerVisible(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  };

  const handleDismiss = () => {
    setBannerVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!prompt) return null;

  return (
    <>
      {bannerVisible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface0 border border-surface2 rounded-2xl px-4 py-3 shadow-2xl">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            className="w-9 h-9 rounded-lg flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text leading-tight">Nainstalovat Robo Filler</p>
            <p className="text-xs text-subtext0 leading-tight">Otevírej jako aplikaci bez prohlížeče</p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 px-3 py-1.5 bg-mauve text-crust text-sm font-semibold rounded-xl hover:bg-mauve/80 transition-colors"
          >
            Instalovat
          </button>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-overlay1 hover:text-text transition-colors"
            aria-label="Zavřít"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 text-overlay0 hover:text-subtext0 transition-colors text-sm"
        title="Nainstalovat jako aplikaci"
      >
        <MonitorDown size={13} />
        <span>Instalovat</span>
      </button>
    </>
  );
}
