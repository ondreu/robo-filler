// Světlý / tmavý režim — stejný princip jako DZL Konfigurátor: atribut
// `data-theme` na <html>, volba v localStorage, bez volby podle systému.
// Počáteční hodnotu nastavuje už inline skript v index.html (bez bliknutí).

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'schoogle-theme';

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* soukromé okno */ }
  }
}
