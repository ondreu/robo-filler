/** @type {import('tailwindcss').Config} */

// Barvy jsou CSS proměnné (RGB kanály) definované v `src/index.css` pro světlý
// i tmavý režim — `rgb(var(--x) / <alpha-value>)` drží funkční i zápisy typu
// `bg-mauve/20`. Názvy tokenů zůstaly z Catppuccinu (používají je všechny
// komponenty), hodnoty ale odpovídají paletě DZL Konfigurátoru:
// `mauve` = hlavní akcent (červená), `red` = chyba, `teal` = sekundární zvýraznění.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const NAMES = [
  'base', 'mantle', 'crust',
  'surface0', 'surface1', 'surface2',
  'overlay0', 'overlay1', 'overlay2',
  'subtext0', 'subtext1', 'text',
  'mauve', 'lavender', 'blue', 'sapphire', 'sky', 'teal', 'green',
  'yellow', 'peach', 'maroon', 'red', 'pink', 'flamingo', 'rosewater',
  'raised', 'on-accent', 'nav', 'nav-text', 'nav-muted', 'nav-hover',
];

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: Object.fromEntries(NAMES.map(n => [n, token(n)])),
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      // Ploší, „úřednější" tvary než výchozí bublinové zaoblení.
      borderRadius: {
        'lg': '6px',
        'xl': '8px',
        '2xl': '10px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgb(0 0 0 / 0.06)',
        DEFAULT: '0 1px 3px rgb(0 0 0 / 0.08)',
        'md': '0 2px 8px rgb(0 0 0 / 0.08)',
        'lg': '0 2px 8px rgb(0 0 0 / 0.08)',
        'xl': '0 8px 32px rgb(0 0 0 / 0.18)',
        '2xl': '0 12px 40px rgb(0 0 0 / 0.22)',
      },
    },
  },
  plugins: [],
}
