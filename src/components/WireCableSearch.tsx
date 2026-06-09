import { useState, useEffect, useMemo } from 'react';
import { Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import type { Article } from '../types';
import { type CableArticle, loadWires, loadCables } from '../utils/csvParser';

// ─── Wire constants ───────────────────────────────────────────────────────────

const WIRE_BARVA: Record<string, string> = {
  BK: 'Černá', BKWH: 'Černá/Bílá', BN: 'Hnědá', BNWH: 'Hnědá/Bílá',
  BURD: 'Bordó', DBU: 'Tm. modrá', GN: 'Zelená', GNWH: 'Zelená/Bílá',
  GNYE: 'Zel-žlutá', GY: 'Šedá', LBU: 'Sv. modrá', OG: 'Oranžová',
  PK: 'Růžová', RD: 'Červená', VT: 'Fialová', WH: 'Bílá', YE: 'Žlutá',
};

interface SkupinaGroup { key: string; label: string; match: (s: string) => boolean }
const WIRE_SKUPINY: SkupinaGroup[] = [
  { key: 'ce',     label: 'Standardní',      match: s => s === 'CE' || s === 'CE_zakaznik' || s === 'FLKK' },
  { key: 'bezhal', label: 'Bezhalogenový',   match: s => s === 'CE_Halogen-free' },
  { key: 'flex',   label: 'Flexibilní',      match: s => s === 'CE_flexibilni' },
  { key: 'vflex',  label: 'Vysoce flex.',    match: s => s === 'CE_vysoce_flexibilni' },
  { key: 'liycy',  label: 'LiYCY',          match: s => s === 'LiYCY' },
  { key: 'radox',  label: 'RADOX',          match: s => s.startsWith('RADOX') },
  { key: 'olflex', label: 'ÖLFLEX HEAT',    match: s => s.startsWith('ÖLFLEX HEAT') },
  { key: 'ptfe',   label: 'PTFE',           match: s => s.startsWith('DESCAFLEX') },
  { key: 'alpha',  label: 'ALPHAWIRE',      match: s => s.startsWith('ALPHAWIRE') },
  { key: 'solar',  label: 'Solární',        match: s => s === 'SOLAR' },
  { key: 'ul',     label: 'UL',            match: s => s.startsWith('UL_') },
  { key: 'hvsil',  label: 'HV Silikon',    match: s => s === 'HV Silikon' },
  { key: 'nsg',    label: 'NSGAFÖU',       match: s => s.startsWith('NSGAFÖU') },
  { key: 'nsh',    label: 'NSHXAFÖ',       match: s => s.startsWith('NSHXAFÖ') },
];

const WIRE_PRUREZ = [0.14, 0.25, 0.35, 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 185, 240];

// ─── Cable constants ──────────────────────────────────────────────────────────

interface MaterialGroup { key: string; label: string; match: (m: string | null) => boolean }
const KABEL_MATERIALY: MaterialGroup[] = [
  { key: 'pvc',    label: 'PVC',           match: m => m === null || (m ?? '').toLowerCase().includes('pvc') },
  { key: 'pur',    label: 'PUR',           match: m => (m ?? '').toLowerCase().includes('pur') },
  { key: 'bezhal', label: 'Bezhalogenový', match: m => ['halogen free', 'bezhalogen', 'polyolefin'].some(k => (m ?? '').toLowerCase().includes(k)) },
  { key: 'guma',   label: 'Gumový',        match: m => ['pryž', 'gum', 'epr', 'epdm'].some(k => (m ?? '').toLowerCase().includes(k)) },
  { key: 'silikon',label: 'Silikon',       match: m => (m ?? '').toLowerCase().includes('silikon') },
];

const KABEL_PRUREZ = [0.25, 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 185];
const KABEL_POCET_ZIL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 19, 20, 24];

// ─── Article cards ────────────────────────────────────────────────────────────

function WireCard({ w }: { w: Article }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(w.artikl); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const barvaLabel = w.barva ? (WIRE_BARVA[w.barva] ?? w.barva) : null;
  const skupinaLabel = w.skupina ? (WIRE_SKUPINY.find(g => g.match(w.skupina!))?.label ?? null) : null;
  return (
    <div className="bg-surface0 border border-surface2 rounded-xl p-3 space-y-1.5 hover:bg-surface1 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold text-xs">{w.artikl}</span>
          <button onClick={copy} title="Kopírovat" className="text-overlay1 hover:text-mauve transition-colors">
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
        <span className="text-subtext0 text-[10px] shrink-0">{w.vyrobce}</span>
      </div>
      <div className="text-text text-xs font-medium leading-snug">{w.nazev}</div>
      <div className="flex flex-wrap gap-1">
        {w.prurez != null && (
          <span className="text-[10px] bg-teal/10 text-teal border border-teal/20 rounded px-1.5 py-0.5 font-medium">
            {w.prurez} mm²
          </span>
        )}
        {barvaLabel && (
          <span className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{barvaLabel}</span>
        )}
        {skupinaLabel && (
          <span className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{skupinaLabel}</span>
        )}
        <span className="text-[10px] bg-teal/5 text-overlay1 rounded px-1.5 py-0.5">Vodič DB</span>
      </div>
    </div>
  );
}

function CableCard({ c }: { c: CableArticle }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(c.artikl); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const googleSearch = () => window.open(`https://www.google.com/search?q=${encodeURIComponent(c.nazev)}`, '_blank', 'noopener');
  const pocetPrurez = c.pocetZil != null && c.prurez != null
    ? `${c.pocetZil}×${c.prurez} mm²`
    : c.pocetZil != null ? `${c.pocetZil} žil`
    : c.prurez != null ? `${c.prurez} mm²` : null;
  const matLabel = KABEL_MATERIALY.find(g => g.match(c.materialPlaste))?.label;
  return (
    <div className="bg-surface0 border border-surface2 rounded-xl p-3 space-y-1.5 hover:bg-surface1 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold text-xs">{c.artikl}</span>
          <button onClick={copy} title="Kopírovat" className="text-overlay1 hover:text-mauve transition-colors">
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
        <button onClick={googleSearch} className="text-overlay1 hover:text-mauve transition-colors"><ExternalLink size={11} /></button>
      </div>
      <div className="flex items-start justify-between gap-1">
        <div className="text-text text-xs font-medium leading-snug">{c.nazev}</div>
        <span className="text-subtext0 text-[10px] shrink-0">{c.vyrobce}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {pocetPrurez && (
          <span className="text-[10px] bg-teal/10 text-teal border border-teal/20 rounded px-1.5 py-0.5 font-medium">
            {pocetPrurez}
          </span>
        )}
        {c.stineni === 'ANO' && (
          <span className="text-[10px] bg-blue/10 text-blue border border-blue/20 rounded px-1.5 py-0.5">Stíněný</span>
        )}
        {c.retiez === 'ANO' && (
          <span className="text-[10px] bg-green/10 text-green border border-green/20 rounded px-1.5 py-0.5">E-řetěz</span>
        )}
        {matLabel && matLabel !== 'PVC' && (
          <span className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{matLabel}</span>
        )}
        {c.barva && /^[a-zA-ZáčďéěíňóřšťůúýžÁČĎÉĚÍŇÓŘŠŤŮÚÝŽ]/.test(c.barva) && (
          <span className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{c.barva}</span>
        )}
        <span className="text-[10px] bg-teal/5 text-overlay1 rounded px-1.5 py-0.5">Kabel DB</span>
      </div>
    </div>
  );
}

// ─── Filter chips helper ──────────────────────────────────────────────────────

function Chips<T extends string | number>({
  label, values, selected, onToggle, format,
}: {
  label: string;
  values: T[];
  selected: T[];
  onToggle: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-overlay0 font-semibold uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map(v => {
          const active = selected.includes(v);
          return (
            <button
              key={String(v)}
              onClick={() => onToggle(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                active
                  ? 'bg-teal/20 text-teal border-teal/40'
                  : 'bg-surface0 text-subtext1 border-surface2 hover:bg-surface1 hover:text-text'
              }`}
            >
              {format ? format(v) : String(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Radio helper ─────────────────────────────────────────────────────────────

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
                ? 'bg-teal/20 text-teal border-teal/40'
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

// ─── toggle helper ────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WireCableSearch() {
  const [subMode, setSubMode] = useState<'wire' | 'cable'>('wire');

  // Data
  const [wires, setWires] = useState<Article[]>([]);
  const [cables, setCables] = useState<CableArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadWires(), loadCables()]).then(([w, c]) => {
      setWires(w);
      setCables(c);
      setLoading(false);
    });
  }, []);

  // Wire filters
  const [wirePrurez, setWirePrurez] = useState<number[]>([]);
  const [wireBarva, setWireBarva] = useState<string[]>([]);
  const [wireSkupina, setWireSkupina] = useState<string[]>([]);
  const [wireVyrobce, setWireVyrobce] = useState<string[]>([]);

  // Cable filters
  const [kabelPocetZil, setKabelPocetZil] = useState<number[]>([]);
  const [kabelPrurez, setKabelPrurez] = useState<number[]>([]);
  const [kabelStineni, setKabelStineni] = useState<'' | 'ANO' | 'NE'>('');
  const [kabelMaterial, setKabelMaterial] = useState<string[]>([]);
  const [kabelRetiez, setKabelRetiez] = useState<'' | 'ANO' | 'NE'>('');
  const [kabelVyrobce, setKabelVyrobce] = useState<string[]>([]);

  // Derived manufacturer lists (only manufacturers present in data)
  const wireVyrobceOptions = useMemo(() =>
    [...new Set(wires.map(w => w.vyrobce).filter(Boolean))].sort(), [wires]);
  const kabelVyrobceOptions = useMemo(() =>
    [...new Set(cables.map(c => c.vyrobce).filter(Boolean))].sort(), [cables]);

  // Available prurez values from actual data
  const wirePrurezOptions = useMemo(() =>
    WIRE_PRUREZ.filter(p => wires.some(w => w.prurez === p)), [wires]);
  const kabelPrurezOptions = useMemo(() =>
    KABEL_PRUREZ.filter(p => cables.some(c => c.prurez === p)), [cables]);
  const kabelPocetZilOptions = useMemo(() =>
    KABEL_POCET_ZIL.filter(n => cables.some(c => c.pocetZil === n)), [cables]);

  // Available wire barva codes
  const wireBarvaOptions = useMemo(() =>
    Object.keys(WIRE_BARVA).filter(code => wires.some(w => w.barva === code)), [wires]);

  // Filtered results
  const filteredWires = useMemo(() => {
    let result = wires;
    if (wirePrurez.length > 0)    result = result.filter(w => w.prurez != null && wirePrurez.includes(w.prurez));
    if (wireBarva.length > 0)     result = result.filter(w => w.barva != null && wireBarva.includes(w.barva));
    if (wireVyrobce.length > 0)   result = result.filter(w => wireVyrobce.includes(w.vyrobce));
    if (wireSkupina.length > 0)   result = result.filter(w => {
      const s = w.skupina ?? '';
      return wireSkupina.some(key => WIRE_SKUPINY.find(g => g.key === key)?.match(s));
    });
    return result;
  }, [wires, wirePrurez, wireBarva, wireSkupina, wireVyrobce]);

  const filteredCables = useMemo(() => {
    let result = cables;
    if (kabelPocetZil.length > 0) result = result.filter(c => c.pocetZil != null && kabelPocetZil.includes(c.pocetZil));
    if (kabelPrurez.length > 0)   result = result.filter(c => c.prurez != null && kabelPrurez.includes(c.prurez));
    if (kabelStineni !== '')       result = result.filter(c => c.stineni === kabelStineni);
    if (kabelRetiez !== '')        result = result.filter(c => c.retiez === kabelRetiez);
    if (kabelMaterial.length > 0) result = result.filter(c =>
      kabelMaterial.some(key => KABEL_MATERIALY.find(g => g.key === key)?.match(c.materialPlaste))
    );
    if (kabelVyrobce.length > 0)  result = result.filter(c => kabelVyrobce.includes(c.vyrobce));
    return result;
  }, [cables, kabelPocetZil, kabelPrurez, kabelStineni, kabelMaterial, kabelRetiez, kabelVyrobce]);

  const resetWireFilters = () => { setWirePrurez([]); setWireBarva([]); setWireSkupina([]); setWireVyrobce([]); };
  const resetCableFilters = () => { setKabelPocetZil([]); setKabelPrurez([]); setKabelStineni(''); setKabelMaterial([]); setKabelRetiez(''); setKabelVyrobce([]); };

  const wireFiltersActive = wirePrurez.length + wireBarva.length + wireSkupina.length + wireVyrobce.length > 0;
  const cableFiltersActive = kabelPocetZil.length + kabelPrurez.length + kabelMaterial.length + kabelVyrobce.length + (kabelStineni ? 1 : 0) + (kabelRetiez ? 1 : 0) > 0;

  const displayed = subMode === 'wire' ? filteredWires.slice(0, 100) : filteredCables.slice(0, 100);
  const total     = subMode === 'wire' ? filteredWires.length : filteredCables.length;

  return (
    <div className="space-y-4">
      {/* Sub-mode toggle */}
      <div className="flex items-center gap-3">
        <div className="flex bg-surface0 rounded-xl p-1 gap-1">
          <button
            onClick={() => setSubMode('wire')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              subMode === 'wire' ? 'bg-teal text-crust shadow' : 'text-subtext1 hover:text-text'
            }`}
          >
            Vodiče
          </button>
          <button
            onClick={() => setSubMode('cable')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              subMode === 'cable' ? 'bg-teal text-crust shadow' : 'text-subtext1 hover:text-text'
            }`}
          >
            Kabely
          </button>
        </div>
        {loading && <Loader2 size={16} className="text-teal animate-spin" />}
        {!loading && (
          <span className="text-sm text-subtext1">
            <span className="text-text font-medium">{total}</span>
            {' '}{subMode === 'wire' ? (total === 1 ? 'vodič' : total < 5 ? 'vodiče' : 'vodičů') : (total === 1 ? 'kabel' : total < 5 ? 'kabely' : 'kabelů')}
            {(subMode === 'wire' ? wireFiltersActive : cableFiltersActive) && (
              <button
                onClick={subMode === 'wire' ? resetWireFilters : resetCableFilters}
                className="ml-2 text-xs text-overlay0 hover:text-red transition-colors"
              >
                Zrušit filtry
              </button>
            )}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-mantle rounded-2xl p-4 space-y-4">
        {subMode === 'wire' ? (
          <>
            <Chips
              label="Průřez (mm²)"
              values={wirePrurezOptions}
              selected={wirePrurez}
              onToggle={v => setWirePrurez(toggle(wirePrurez, v))}
              format={v => String(v)}
            />
            <Chips
              label="Barva"
              values={wireBarvaOptions}
              selected={wireBarva}
              onToggle={v => setWireBarva(toggle(wireBarva, v))}
              format={v => WIRE_BARVA[v] ?? v}
            />
            <Chips
              label="Typ"
              values={WIRE_SKUPINY.filter(g => wires.some(w => g.match(w.skupina ?? ''))).map(g => g.key)}
              selected={wireSkupina}
              onToggle={v => setWireSkupina(toggle(wireSkupina, v))}
              format={v => WIRE_SKUPINY.find(g => g.key === v)?.label ?? v}
            />
            <Chips
              label="Výrobce"
              values={wireVyrobceOptions}
              selected={wireVyrobce}
              onToggle={v => setWireVyrobce(toggle(wireVyrobce, v))}
            />
          </>
        ) : (
          <>
            <Chips
              label="Počet žil"
              values={kabelPocetZilOptions}
              selected={kabelPocetZil}
              onToggle={v => setKabelPocetZil(toggle(kabelPocetZil, v))}
            />
            <Chips
              label="Průřez žily (mm²)"
              values={kabelPrurezOptions}
              selected={kabelPrurez}
              onToggle={v => setKabelPrurez(toggle(kabelPrurez, v))}
              format={v => String(v)}
            />
            <RadioChips
              label="Stínění"
              options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'Stíněný' }, { value: 'NE' as const, label: 'Bez stínění' }]}
              value={kabelStineni}
              onChange={setKabelStineni}
            />
            <Chips
              label="Materiál pláště"
              values={KABEL_MATERIALY.filter(g => cables.some(c => g.match(c.materialPlaste))).map(g => g.key)}
              selected={kabelMaterial}
              onToggle={v => setKabelMaterial(toggle(kabelMaterial, v))}
              format={v => KABEL_MATERIALY.find(g => g.key === v)?.label ?? v}
            />
            <RadioChips
              label="Energetický řetěz"
              options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'Vhodný' }, { value: 'NE' as const, label: 'Nevhodný' }]}
              value={kabelRetiez}
              onChange={setKabelRetiez}
            />
            <Chips
              label="Výrobce"
              values={kabelVyrobceOptions}
              selected={kabelVyrobce}
              onToggle={v => setKabelVyrobce(toggle(kabelVyrobce, v))}
            />
          </>
        )}
      </div>

      {/* Results */}
      {!loading && total === 0 && (
        <div className="bg-mantle rounded-2xl p-8 text-center text-subtext1 text-sm">
          Žádné výsledky — zkus uvolnit některé filtry.
        </div>
      )}

      {!loading && total > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {subMode === 'wire'
              ? (displayed as Article[]).map(w => <WireCard key={w.artikl} w={w} />)
              : (displayed as CableArticle[]).map(c => <CableCard key={c.artikl} c={c} />)
            }
          </div>
          {total > 100 && (
            <p className="text-center text-xs text-overlay0">
              Zobrazeno 100 z {total} výsledků — upřesni filtry pro přesnější výsledky.
            </p>
          )}
        </>
      )}
    </div>
  );
}
