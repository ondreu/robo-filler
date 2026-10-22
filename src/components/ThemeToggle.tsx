import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, currentTheme, storedTheme, systemTheme, type Theme } from '../utils/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // Bez ruční volby sleduje systémové nastavení.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => {
      if (storedTheme()) return;
      const t = systemTheme();
      applyTheme(t, false);
      setTheme(t);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim';

  return (
    <button
      type="button"
      onClick={() => { applyTheme(next); setTheme(next); }}
      title={label}
      aria-label={label}
      className={`btn-icon text-nav-muted hover:text-nav-text hover:bg-nav-hover ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
