import { useState, useEffect, useMemo } from 'react';
import { Copy, Check, Loader2, Search, X } from 'lucide-react';
import { type KanbanArticle, loadKanban } from '../utils/csvParser';

// ─── Kategorie ────────────────────────────────────────────────────────────────
// Skupiny z Kanban DB (sloupec "Skupina") seskupené do top-level kategorií.

interface KategorieDef { key: string; label: string; match: (s: string) => boolean }
const KATEGORIE: KategorieDef[] = [
  { key: 'dutinky',   label: 'Dutinky',             match: s => s.toUpperCase().includes('DUTINK') },
  { key: 'oka',       label: 'Kabelová oka',        match: s => s.toUpperCase().startsWith('KABELOVÁ OKA') && !s.toUpperCase().includes('VIDLIČKY') },
  { key: 'vidlicky',  label: 'Vidličky',            match: s => s.toUpperCase().includes('VIDLIČKY') },
  { key: 'fastony',   label: 'Fastony',             match: s => s.toUpperCase().includes('FASTON') || s.toUpperCase().includes('NÁSTRČNÉ JAZÝČKY') },
  { key: 'buzirky',   label: 'Smršťovací bužírky',  match: s => s.toUpperCase().includes('BUŽÍRKY') },
  { key: 'pasky',     label: 'Stahovací pásky',     match: s => s.toUpperCase().includes('STAHOVACÍ PÁSKY') },
  { key: 'konektory', label: 'Konektory',           match: s => ['HARTING', 'KRUHOVÉ KONEKTORY', 'MOLEX'].some(k => s.toUpperCase().includes(k)) },
  { key: 'koliky',    label: 'Kolíky & špičky',     match: s => s.toUpperCase().includes('KOLÍK') },
  { key: 'spojky',    label: 'Spojky',              match: s => s.toUpperCase().includes('SPOJKY LISOVACÍ') },
  { key: 'znaceni',   label: 'Značení',             match: s => s.toUpperCase().startsWith('ZNAČENÍ') },
  { key: 'cu',        label: 'Cu pásky',            match: s => s.toUpperCase() === 'CU PÁSKY' },
  { key: 'ostatni',   label: 'Ostatní',             match: () => true }, // fallback — musí být poslední
];

function kategorieOf(skupina: string): KategorieDef {
  return KATEGORIE.find(k => k.match(skupina)) ?? KATEGORIE[KATEGORIE.length - 1];
}

// Zkrácené popisky podskupin (raw hodnoty ze sloupce Skupina jsou dlouhé)
const SKUPINA_LABELS: Record<string, string> = {
  'NEIZOLOVANÉ DUTINKY': 'Neizolované',
  'IZOLOVANÉ DUTINKY': 'Izolované',
  'IZOLOVANÉ DUTINKY pro NSGFÖU': 'Izolované pro NSGAFÖU',
  'DVOJDUTINKY': 'Dvojdutinky',
  'DUTINKY V PÁSU': 'V pásu',
  'STÍNÍCÍ DUTINKY': 'Stínící',
  'KABELOVÁ OKA NEIZOLOVANÉ': 'Neizolovaná',
  'KABELOVÁ OKA NEIZOLOVANÉ (Mosaz cínované)': 'Neizolovaná (mosaz)',
  'KABELOVÁ OKA - IZOLOVANÁ': 'Izolovaná',
  'KABELOVÁ OKA - LEHČENÁ - trubková': 'Lehčená trubková',
  'KABELOVÁ OKA - LEHČENÁ 90° winkl úhlová': 'Lehčená 90° úhlová',
  'KABELOVÁ OKA - LEHČENÁ - trubková KU-L úzké připojení - SG': 'Lehčená KU-L úzká',
  'KABELOVÁ OKA - Intercable IT standard': 'Intercable IT',
  'KABELOVÁ OKA - DIN 46235': 'DIN 46235',
  'KABELOVÁ OKA - DIN 46236': 'DIN 46236',
  'KABELOVÁ OKA - DIN 46235 winkl - úhlová': 'DIN 46235 úhlová',
  'VIDLIČKY NEIZOLOVANÉ': 'Neizolované',
  'KABELOVÁ OKA - VIDLIČKY - izolované': 'Izolované',
  'IZOLOVANÉ FASTONY': 'Izolované',
  'Neizolované FASTONY - ploché objímky (samice)': 'Neizolované (samice)',
  'Izolovaný FASTON - s odbočkou': 'S odbočkou',
  'Izolovaný FASTON - 90°úhel': '90° úhel',
  'NEizolovaný FASTON - Y-SPOJKA': 'Y-spojka',
  'PLOCHÝ IZOLOVANÝ faston - samec': 'Plochý (samec)',
  'NÁVLEKY NA FASTONY': 'Návleky',
  'PLOCHÉ NÁSTRČNÉ JAZÝČKY': 'Nástrčné jazýčky',
  'SMRŠŤOVACÍ BUŽÍRKY': 'Smršťovací bužírka',
  'STAHOVACÍ PÁSKY': 'Stahovací páska',
  'HARTING - BUKY': 'Harting buky',
  'KRUHOVÉ KONEKTORY': 'Kruhové',
  'Molex': 'Molex',
  'LISOVACÍ KOLÍKY S IZOLACÍ - ŠPIČKY': 'Špičky izolované',
  'KOLÍK BEZ IZOLACE': 'Bez izolace',
  'SPOJKY LISOVACÍ': 'Lisovací',
  'ZNAČENÍ KABELŮ': 'Kabelů',
  'ZNAČENÍ VODIČŮ': 'Vodičů',
  'CU PÁSKY': 'Cu pásky',
  'OSTATNÍ': 'Ostatní',
};

function skupinaLabel(skupina: string): string {
  return SKUPINA_LABELS[skupina] ?? skupina;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-overlay1 hover:text-mauve transition-colors"
      title="Kopírovat"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-overlay0 shrink-0 w-36">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}

function KanbanDetailModal({ item, onClose }: { item: KanbanArticle; onClose: () => void }) {
  const kat = kategorieOf(item.skupina);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-base border border-surface1 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] bg-peach/10 text-peach border border-peach/20 rounded px-1.5 py-0.5">Kanban DB</span>
                <span className="text-[10px] text-subtext0">{kat.label}</span>
                {item.vyrobce && <span className="text-[10px] text-subtext0">{item.vyrobce}</span>}
              </div>
              <p className="text-sm font-semibold text-text leading-snug">{item.popis ?? item.typ ?? item.artikl}</p>
            </div>
            <button onClick={onClose} className="text-overlay1 hover:text-red transition-colors shrink-0 mt-0.5">
              <X size={16} />
            </button>
          </div>

          {/* SAP artikl + čísla */}
          <div className="bg-mantle rounded-xl p-3 space-y-1.5">
            <div className="flex gap-2 items-center">
              <span className="text-overlay0 text-xs w-36 shrink-0">SAP artikl</span>
              <span className="font-mono text-mauve font-bold text-sm">{item.artikl}</span>
              <CopyBtn text={item.artikl} />
            </div>
            {item.novyArtikl && item.novyArtikl !== item.artikl && (
              <div className="flex gap-2 items-center">
                <span className="text-overlay0 text-xs w-36 shrink-0">Nový artikl</span>
                <span className="font-mono text-subtext1 text-sm">{item.novyArtikl}</span>
                <CopyBtn text={item.novyArtikl} />
              </div>
            )}
            {item.elkov && (
              <div className="flex gap-2 items-center">
                <span className="text-overlay0 text-xs w-36 shrink-0">Elkov číslo</span>
                <span className="font-mono text-subtext1 text-sm">{item.elkov}</span>
                <CopyBtn text={item.elkov} />
              </div>
            )}
          </div>

          {/* Zařazení */}
          <div className="space-y-1.5">
            <InfoRow label="Typ" value={item.typ} />
            <InfoRow label="Kategorie" value={kat.label} />
            <InfoRow label="Skupina" value={item.skupina} />
            <InfoRow label="Provedení" value={item.varianta} />
            {item.din && <InfoRow label="Barva dle DIN" value={item.din === 'ANO' ? 'Ano' : 'Ne'} />}
            <InfoRow label="Značení" value={item.znaceni} />
          </div>

          <div className="border-t border-surface1" />

          {/* Kanban */}
          <div className="space-y-1.5">
            <InfoRow label="V kanbanu" value={item.vKanbanu ? 'Ano' : 'Ne'} />
            <InfoRow label="Pozice v kanbanu" value={item.pozice} />
          </div>

          <div className="border-t border-surface1" />

          {/* Objednání */}
          <div className="space-y-1.5">
            <InfoRow label="Obj. číslo" value={item.objednaciCislo} />
            <InfoRow label="Výrobce" value={item.vyrobce} />
          </div>

          {item.poznamka && (
            <div className="bg-yellow/10 border border-yellow/20 rounded-xl p-3 text-xs text-yellow">
              <span className="font-semibold">Poznámka:</span> {item.poznamka}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({ item, onClick }: { item: KanbanArticle; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-surface0 border border-surface2 rounded-xl p-3 space-y-1.5 hover:bg-surface1 hover:border-peach/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold text-xs">{item.artikl}</span>
          <CopyBtn text={item.artikl} />
        </div>
        {item.pozice && (
          <span className="text-[10px] font-mono font-semibold text-peach bg-peach/10 border border-peach/20 rounded px-1.5 py-0.5 shrink-0">
            {item.pozice}
          </span>
        )}
      </div>
      {item.typ && (
        <div className="text-subtext1 text-[10px] font-medium truncate">{item.typ}</div>
      )}
      <div className="text-text text-xs font-medium leading-snug line-clamp-2">{item.popis ?? item.typ ?? '—'}</div>
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] bg-peach/10 text-peach border border-peach/20 rounded px-1.5 py-0.5 font-medium">
          {skupinaLabel(item.skupina)}
        </span>
        {item.varianta && (
          <span className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{item.varianta}</span>
        )}
        {item.din === 'ANO' && (
          <span className="text-[10px] bg-blue/10 text-blue border border-blue/20 rounded px-1.5 py-0.5">DIN</span>
        )}
        {item.vKanbanu && (
          <span className="text-[10px] bg-green/10 text-green border border-green/20 rounded px-1.5 py-0.5">Kanban</span>
        )}
        {item.poznamka && (
          <span className="text-[10px] bg-yellow/10 text-yellow border border-yellow/20 rounded px-1.5 py-0.5">⚠</span>
        )}
      </div>
    </div>
  );
}

// ─── Filter UI helpers ────────────────────────────────────────────────────────

function Chips({
  label, values, selected, onToggle, format,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (v: string) => void;
  format?: (v: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-overlay0 font-semibold uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map(v => {
          const active = selected.includes(v);
          return (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                active
                  ? 'bg-peach/20 text-peach border-peach/40'
                  : 'bg-surface0 text-subtext1 border-surface2 hover:bg-surface1 hover:text-text'
              }`}
            >
              {format ? format(v) : v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RadioChips<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-overlay0 font-semibold uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
              value === opt.value
                ? 'bg-peach/20 text-peach border-peach/40'
                : 'bg-surface0 text-subtext1 border-surface2 hover:bg-surface1 hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KanbanSearch() {
  const [items, setItems] = useState<KanbanArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KanbanArticle | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [kategorie, setKategorie] = useState<string[]>([]);
  const [skupiny, setSkupiny] = useState<string[]>([]);
  const [varianty, setVarianty] = useState<string[]>([]);
  const [din, setDin] = useState<'' | 'ANO' | 'NE'>('');
  const [kanban, setKanban] = useState<'' | 'ANO' | 'NE'>('');

  useEffect(() => {
    setLoading(true);
    loadKanban().then(data => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  // ── Derived options ────────────────────────────────────────────────────

  const kategorieOptions = useMemo(() =>
    KATEGORIE.filter(k => items.some(i => kategorieOf(i.skupina).key === k.key)).map(k => k.key), [items]);

  // Podskupiny dostupné v rámci vybraných kategorií (zobrazí se až po výběru kategorie)
  const skupinaOptions = useMemo(() => {
    if (!kategorie.length) return [];
    const inCat = items.filter(i => kategorie.includes(kategorieOf(i.skupina).key));
    return [...new Set(inCat.map(i => i.skupina))].sort((a, b) => skupinaLabel(a).localeCompare(skupinaLabel(b), 'cs'));
  }, [items, kategorie]);

  // Provedení (varianta) — jen hodnoty vyskytující se v aktuálním výběru kategorií
  const variantaOptions = useMemo(() => {
    const pool = kategorie.length ? items.filter(i => kategorie.includes(kategorieOf(i.skupina).key)) : items;
    return [...new Set(pool.map(i => i.varianta).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'cs'));
  }, [items, kategorie]);

  const dinAvailable = useMemo(() => {
    const pool = kategorie.length ? items.filter(i => kategorie.includes(kategorieOf(i.skupina).key)) : items;
    return pool.some(i => i.din != null);
  }, [items, kategorie]);

  // ── Filtering ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let r = items;
    if (query) {
      // Každé slovo dotazu se musí vyskytovat v některém z polí (AND přes slova)
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      r = r.filter(i => {
        const haystack = [i.artikl, i.novyArtikl, i.elkov, i.objednaciCislo, i.typ, i.popis, i.vyrobce]
          .filter(Boolean).join(' ').toLowerCase();
        return words.every(w => haystack.includes(w));
      });
    }
    if (kategorie.length) r = r.filter(i => kategorie.includes(kategorieOf(i.skupina).key));
    if (skupiny.length)   r = r.filter(i => skupiny.includes(i.skupina));
    if (varianty.length)  r = r.filter(i => i.varianta != null && varianty.includes(i.varianta));
    if (din)              r = r.filter(i => i.din === din);
    if (kanban)           r = r.filter(i => (kanban === 'ANO') === i.vKanbanu);
    return r;
  }, [items, query, kategorie, skupiny, varianty, din, kanban]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const resetFilters = () => {
    setQuery(''); setKategorie([]); setSkupiny([]); setVarianty([]); setDin(''); setKanban('');
  };
  const filtersActive = !!(query || kategorie.length || skupiny.length || varianty.length || din || kanban);

  // Při změně kategorií zruš podskupiny/provedení, které už nejsou k dispozici
  const onToggleKategorie = (key: string) => {
    const next = toggle(kategorie, key);
    setKategorie(next);
    if (next.length) {
      setSkupiny(prev => prev.filter(s => next.includes(kategorieOf(s).key)));
    } else {
      setSkupiny([]);
    }
  };

  const total = filtered.length;
  const displayed = filtered.slice(0, 150);
  const noun = total === 1 ? 'artikl' : total < 5 ? 'artikly' : 'artiklů';

  return (
    <div className="space-y-4">
      {/* Count + reset */}
      <div className="flex items-center gap-3 flex-wrap">
        {loading && <Loader2 size={16} className="text-peach animate-spin" />}
        {!loading && (
          <span className="text-sm text-subtext1">
            <span className="text-text font-medium">{total}</span>{' '}{noun}
            {filtersActive && (
              <button
                onClick={resetFilters}
                className="ml-2 text-xs text-overlay0 hover:text-red transition-colors"
              >
                Zrušit filtry
              </button>
            )}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-overlay1 pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Hledat dle SAP artiklu, Elkov čísla, obj. čísla, typu nebo popisu…"
          className="w-full bg-surface0 border border-surface2 rounded-xl pl-8 pr-8 py-2.5 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-peach/50 focus:bg-surface1 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-overlay1 hover:text-red transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-mantle rounded-2xl p-4 space-y-4">
        <Chips
          label="Kategorie"
          values={kategorieOptions}
          selected={kategorie}
          onToggle={onToggleKategorie}
          format={v => KATEGORIE.find(k => k.key === v)?.label ?? v}
        />
        {skupinaOptions.length > 1 && (
          <Chips
            label="Podskupina"
            values={skupinaOptions}
            selected={skupiny}
            onToggle={v => setSkupiny(toggle(skupiny, v))}
            format={skupinaLabel}
          />
        )}
        {variantaOptions.length > 0 && (
          <Chips
            label="Provedení"
            values={variantaOptions}
            selected={varianty}
            onToggle={v => setVarianty(toggle(varianty, v))}
          />
        )}
        {dinAvailable && (
          <RadioChips
            label="Barva dle DIN"
            options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'Dle DIN' }, { value: 'NE' as const, label: 'Mimo DIN' }]}
            value={din}
            onChange={setDin}
          />
        )}
        <RadioChips
          label="Kanban"
          options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'V kanbanu' }, { value: 'NE' as const, label: 'Mimo kanban' }]}
          value={kanban}
          onChange={setKanban}
        />
      </div>

      {/* Results */}
      {!loading && total === 0 && (
        <div className="bg-mantle rounded-2xl p-8 text-center text-subtext1 text-sm">
          Žádné výsledky — zkus uvolnit filtry nebo upravit hledaný text.
        </div>
      )}

      {!loading && total > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {displayed.map((item, i) => (
              <KanbanCard key={`${item.artikl}-${i}`} item={item} onClick={() => setSelected(item)} />
            ))}
          </div>
          {total > 150 && (
            <p className="text-center text-xs text-overlay0">
              Zobrazeno 150 z {total} výsledků — upřesni filtry nebo hledání.
            </p>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && <KanbanDetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
