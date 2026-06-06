import { useState, useEffect } from 'react';
import { MonitorDown } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  };

  if (!prompt) return null;

  return (
    <button
      onClick={handleInstall}
      className="inline-flex items-center gap-1.5 text-overlay0 hover:text-subtext0 transition-colors text-sm"
      title="Nainstalovat jako aplikaci"
    >
      <MonitorDown size={13} />
      <span>Instalovat</span>
    </button>
  );
}
