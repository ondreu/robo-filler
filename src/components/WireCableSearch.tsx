import { useState, useEffect, useMemo, useRef } from 'react';
import { Copy, Check, Loader2, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { type WireArticle, type CableArticle, loadWiresRaw, loadCables } from '../utils/csvParser';

// ─── Wire constants ───────────────────────────────────────────────────────────

const WIRE_BARVA: Record<string, string> = {
  BK: 'Černá', BKWH: 'Černá/Bílá', BN: 'Hnědá', BNWH: 'Hnědá/Bílá',
  BURD: 'Bordó', BUWH: 'Modrá/Bílá', DBU: 'Tm. modrá', DBUWH: 'Tm.mod./Bílá',
  GN: 'Zelená', GNWH: 'Zelená/Bílá', GNYE: 'Zel-žlutá', GY: 'Šedá',
  LBU: 'Sv. modrá', OG: 'Oranžová', OGWH: 'Oranž./Bílá',
  PK: 'Růžová', RD: 'Červená', RDWH: 'Červená/Bílá',
  VT: 'Fialová', VTWH: 'Fialová/Bílá',
  WH: 'Bílá', WHBK: 'Bílá/Černá', WHBU: 'Bílá/Modrá',
  WHGN: 'Bílá/Zelená', WHOG: 'Bílá/Oranž.', WHRD: 'Bílá/Červená', WHVT: 'Bílá/Fialová',
  YE: 'Žlutá',
};

interface SkupinaGroup { key: string; label: string; match: (s: string) => boolean }
const WIRE_SKUPINY: SkupinaGroup[] = [
  { key: 'ce',     label: 'Standardní',    match: s => s === 'CE' || s === 'CE_zakaznik' || s === 'FLKK' },
  { key: 'bezhal', label: 'Bezhalogenový', match: s => s === 'CE_Halogen-free' },
  { key: 'flex',   label: 'Flexibilní',    match: s => s === 'CE_flexibilni' },
  { key: 'vflex',  label: 'Vysoce flex.',  match: s => s === 'CE_vysoce_flexibilni' },
  { key: 'liycy',  label: 'LiYCY',        match: s => s === 'LiYCY' },
  { key: 'radox',  label: 'RADOX',        match: s => s.startsWith('RADOX') },
  { key: 'olflex', label: 'ÖLFLEX HEAT',  match: s => s.startsWith('ÖLFLEX HEAT') },
  { key: 'ptfe',   label: 'PTFE',         match: s => s.startsWith('DESCAFLEX') },
  { key: 'alpha',  label: 'ALPHAWIRE',    match: s => s.startsWith('ALPHAWIRE') },
  { key: 'solar',  label: 'Solar',        match: s => s === 'SOLAR' },
  { key: 'ul',     label: 'UL',           match: s => s.startsWith('UL_') },
  { key: 'hvsil',  label: 'HV Silikon',   match: s => s === 'HV Silikon' },
  { key: 'nsg',    label: 'NSGAFÖU',      match: s => s.startsWith('NSGAFÖU') },
  { key: 'nsh',    label: 'NSHXAFÖ',      match: s => s.startsWith('NSHXAFÖ') },
  { key: 'm22759', label: 'M22759 ETFE',  match: s => s === 'M22759' },
];

const WIRE_PRUREZ = [0.14, 0.25, 0.34, 0.35, 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 185, 240];

// ─── Cable constants ──────────────────────────────────────────────────────────

interface MaterialGroup { key: string; label: string; match: (m: string | null) => boolean }
const KABEL_MATERIALY: MaterialGroup[] = [
  { key: 'pvc',    label: 'PVC',           match: m => (m ?? '').toLowerCase().includes('pvc') },
  { key: 'pur',    label: 'PUR',           match: m => (m ?? '').toLowerCase().includes('pur') },
  { key: 'bezhal', label: 'Bezhalogenový', match: m => ['halogen free', 'bezhalogen', 'polyolefin'].some(k => (m ?? '').toLowerCase().includes(k)) },
  { key: 'guma',   label: 'Guma/Pryž',    match: m => ['pryž', 'gum', 'epr', 'epdm'].some(k => (m ?? '').toLowerCase().includes(k)) },
  { key: 'silikon',label: 'Silikon',       match: m => (m ?? '').toLowerCase().includes('silikon') },
];

interface CertDef { key: keyof CableArticle; label: string }
const CERT_BASIC: CertDef[] = [
  { key: 'ce',    label: 'CE' },
  { key: 'ul',    label: 'UL' },
  { key: 'cULus', label: 'cULus' },
  { key: 'csa',   label: 'CSA' },
  { key: 'ukca',  label: 'UKCA' },
  { key: 'ru',    label: 'RU' },
  { key: 'cRUus', label: 'cRUus' },
  { key: 'rohs',  label: 'RoHS' },
  { key: 'har',   label: 'HAR' },
];
const CERT_ADV: CertDef[] = [
  { key: 'vde',      label: 'VDE' },
  { key: 'profibus', label: 'PROFIBUS' },
];

// ─── Detail Modals ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-overlay0 shrink-0 w-36">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-base border border-surface1 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function WireDetailModal({ wire, onClose }: { wire: WireArticle; onClose: () => void }) {
  const barvaLabel = wire.barva ? `${wire.barva}${WIRE_BARVA[wire.barva] ? ` — ${WIRE_BARVA[wire.barva]}` : ''}` : null;
  const skupinaLabel = wire.skupinaDleTypu
    ? (WIRE_SKUPINY.find(g => g.match(wire.skupinaDleTypu!))?.label ?? wire.skupinaDleTypu)
    : null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] bg-teal/10 text-teal border border-teal/20 rounded px-1.5 py-0.5">Vodič DB</span>
              {wire.vyrobce && <span className="text-[10px] text-subtext0">{wire.vyrobce}</span>}
            </div>
            <p className="text-sm font-semibold text-text leading-snug">{wire.nazev}</p>
          </div>
          <button onClick={onClose} className="text-overlay1 hover:text-red transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* SAP artikly */}
        <div className="bg-mantle rounded-xl p-3 space-y-1.5">
          <div className="flex gap-2 items-center">
            <span className="text-overlay0 text-xs w-36 shrink-0">SAP artikl ruční</span>
            <span className="font-mono text-mauve font-bold text-sm">{wire.artiklRucni ?? wire.artiklStroj}</span>
            <CopyBtn text={wire.artiklRucni ?? wire.artiklStroj} />
          </div>
          {wire.artiklRucni && wire.artiklRucni !== wire.artiklStroj && (
            <div className="flex gap-2 items-center">
              <span className="text-overlay0 text-xs w-36 shrink-0">SAP artikl stroj</span>
              <span className="font-mono text-subtext1 text-sm">{wire.artiklStroj}</span>
              <CopyBtn text={wire.artiklStroj} />
            </div>
          )}
        </div>

        {/* Technické parametry */}
        <div className="space-y-1.5">
          <InfoRow label="Typ" value={wire.typ} />
          <InfoRow label="Skupina dle typu" value={skupinaLabel} />
          <InfoRow label="Skupina dle použití" value={wire.skupinaDlePouziti} />
        </div>

        <div className="border-t border-surface1" />

        <div className="space-y-1.5">
          <InfoRow label="Průřez" value={wire.prurez != null ? `${wire.prurez} mm²` : null} />
          <InfoRow label="Barva" value={barvaLabel} />
        </div>

        <div className="border-t border-surface1" />

        <div className="space-y-1.5">
          <InfoRow label="Výrobce" value={wire.vyrobce} />
          <InfoRow label="Obj. číslo" value={wire.objednaciCislo} />
          <InfoRow label="Balení" value={wire.baleni != null ? `${wire.baleni} m` : null} />
        </div>
      </div>
    </ModalOverlay>
  );
}

function CableDetailModal({ cable, onClose }: { cable: CableArticle; onClose: () => void }) {
  const activeCerts = ([...CERT_BASIC, ...CERT_ADV] as CertDef[]).filter(c => cable[c.key]);
  const objCisla = [cable.objCislo1, cable.objCislo2, cable.objCislo3, cable.objCislo4].filter(Boolean);
  const nazevDisplay = cable.nazevKatalog || cable.nazev;
  const nazevAlt = cable.nazev && cable.nazev !== cable.nazevKatalog ? cable.nazev : null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] bg-teal/5 text-overlay1 border border-surface2 rounded px-1.5 py-0.5">Kabel DB</span>
              {cable.dodavatel && <span className="text-[10px] text-subtext0">{cable.dodavatel}</span>}
            </div>
            <p className="text-sm font-semibold text-text leading-snug">{nazevDisplay}</p>
            {nazevAlt && <p className="text-xs text-subtext1">{nazevAlt}</p>}
          </div>
          <button onClick={onClose} className="text-overlay1 hover:text-red transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* SAP + obj. čísla */}
        <div className="bg-mantle rounded-xl p-3 space-y-1.5">
          <div className="flex gap-2 items-center">
            <span className="text-overlay0 text-xs w-36 shrink-0">SAP artikl</span>
            <span className="font-mono text-mauve font-bold text-sm">{cable.artikl}</span>
            <CopyBtn text={cable.artikl} />
          </div>
          {objCisla.length > 0 && (
            <div className="flex gap-2 items-start">
              <span className="text-overlay0 text-xs w-36 shrink-0">Obj. číslo</span>
              <div className="flex flex-wrap gap-1">
                {objCisla.map((c, i) => (
                  <span key={i} className="font-mono text-subtext1 text-xs bg-surface0 rounded px-1.5 py-0.5">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Struktura kabelu */}
        <div className="space-y-1.5">
          <InfoRow
            label="Počet žil"
            value={cable.pocetZil ? `${cable.pocetZil}${cable.ochrannyVodic ? ` (ochranný vodič: ${cable.ochrannyVodic})` : ''}` : null}
          />
          <InfoRow
            label="Průřez"
            value={cable.prurez != null ? (typeof cable.prurez === 'number' ? `${cable.prurez} mm²` : `${cable.prurez} mm²`) : null}
          />
          <InfoRow label="Stínění" value={cable.stineni} />
          <InfoRow label="Pletené páry" value={cable.pletezenePary} />
          <InfoRow label="Značení vodičů" value={cable.znaceniVodicu} />
        </div>

        {activeCerts.length > 0 && (
          <>
            <div className="border-t border-surface1" />
            <div className="space-y-1.5">
              <p className="text-[11px] text-overlay0 font-semibold uppercase tracking-wide">Certifikace</p>
              <div className="flex flex-wrap gap-1.5">
                {activeCerts.map(c => (
                  <span key={c.key} className="text-xs bg-green/10 text-green border border-green/20 rounded px-2 py-0.5 font-medium">
                    {c.label}
                  </span>
                ))}
              </div>
              {cable.ulStyle && (
                <div className="text-xs text-subtext1">UL Style: <span className="text-text font-medium">{cable.ulStyle}</span></div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-surface1" />

        <div className="space-y-1.5">
          <InfoRow label="Teplotní rozsah" value={cable.teplotniRozsah} />
          <InfoRow label="Jmenovité napětí" value={cable.jmenoviteNapeti} />
          <InfoRow label="Průměr" value={cable.prumer != null ? `${cable.prumer} mm` : null} />
        </div>

        <div className="border-t border-surface1" />

        <div className="space-y-1.5">
          <InfoRow label="Materiál pláště" value={cable.materialPlaste} />
          <InfoRow label="Barva pláště" value={cable.barva} />
          <InfoRow label="Bezhalogenový" value={cable.bezhalogenovy} />
          <InfoRow label="Energetický řetěz" value={cable.retiez} />
          <InfoRow label="Odolný oleji" value={cable.olej} />
        </div>
      </div>
    </ModalOverlay>
  );
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

// ─── Cards ────────────────────────────────────────────────────────────────────

function WireCard({ w, onClick }: { w: WireArticle; onClick: () => void }) {
  const barvaLabel = w.barva ? (WIRE_BARVA[w.barva] ?? w.barva) : null;
  const artiklDisplay = w.artiklRucni ?? w.artiklStroj;
  return (
    <div
      onClick={onClick}
      className="bg-surface0 border border-surface2 rounded-xl p-3 space-y-1.5 hover:bg-surface1 hover:border-teal/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold text-xs">{artiklDisplay}</span>
          <CopyBtn text={artiklDisplay} />
        </div>
        <span className="text-subtext0 text-[10px] shrink-0 truncate max-w-[60px]">{w.vyrobce}</span>
      </div>
      {w.typ && (
        <div className="text-subtext1 text-[10px] font-medium truncate">{w.typ}</div>
      )}
      <div className="text-text text-xs font-medium leading-snug line-clamp-2">{w.nazev}</div>
      <div className="flex flex-wrap gap-1">
        {w.prurez != null && (
          <span className="text-[10px] bg-teal/10 text-teal border border-teal/20 rounded px-1.5 py-0.5 font-medium">
            {w.prurez} mm²
          </span>
        )}
        {barvaLabel && (
          <span className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{barvaLabel}</span>
        )}
        <span className="text-[10px] bg-teal/5 text-overlay1 rounded px-1.5 py-0.5">Vodič DB</span>
      </div>
    </div>
  );
}

function CableCard({ c, onClick }: { c: CableArticle; onClick: () => void }) {
  const pocetPrurez = c.pocetZil != null && c.prurez != null
    ? `${c.pocetZil}×${c.prurez} mm²`
    : c.pocetZil != null ? `${c.pocetZil} žil`
    : c.prurez != null ? `${c.prurez} mm²` : null;
  const matLabel = KABEL_MATERIALY.find(g => g.match(c.materialPlaste))?.label;
  const nazev = c.nazevKatalog || c.nazev || c.artikl;
  const topCerts = ([...CERT_BASIC] as CertDef[]).filter(cd => c[cd.key]).slice(0, 3).map(cd => cd.label);
  return (
    <div
      onClick={onClick}
      className="bg-surface0 border border-surface2 rounded-xl p-3 space-y-1.5 hover:bg-surface1 hover:border-teal/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold text-xs">{c.artikl}</span>
          <CopyBtn text={c.artikl} />
        </div>
        <span className="text-subtext0 text-[10px] shrink-0 truncate max-w-[70px]">{c.dodavatel}</span>
      </div>
      <div className="text-text text-xs font-medium leading-snug line-clamp-2">{nazev}</div>
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
        {topCerts.map(cert => (
          <span key={cert} className="text-[10px] bg-surface1 text-subtext0 rounded px-1.5 py-0.5">{cert}</span>
        ))}
        <span className="text-[10px] bg-teal/5 text-overlay1 rounded px-1.5 py-0.5">Kabel DB</span>
      </div>
    </div>
  );
}

// ─── Filter UI helpers ────────────────────────────────────────────────────────

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

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

// ─── Search helpers ───────────────────────────────────────────────────────────

function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some(f => f && f.toLowerCase().includes(q));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WireCableSearch() {
  const [subMode, setSubMode] = useState<'wire' | 'cable'>('wire');

  // Data
  const [wires, setWires] = useState<WireArticle[]>([]);
  const [cables, setCables] = useState<CableArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedWire, setSelectedWire] = useState<WireArticle | null>(null);
  const [selectedCable, setSelectedCable] = useState<CableArticle | null>(null);

  // Search
  const [wireQuery, setWireQuery] = useState('');
  const [cableQuery, setCableQuery] = useState('');

  // Wire filters
  const [wirePrurez, setWirePrurez] = useState<number[]>([]);
  const [wireBarva, setWireBarva] = useState<string[]>([]);
  const [wireSkupina, setWireSkupina] = useState<string[]>([]);
  const [wireVyrobce, setWireVyrobce] = useState<string[]>([]);

  // Cable filters (basic)
  const [kabelPocetZil, setKabelPocetZil] = useState<string[]>([]);
  const [kabelPrurez, setKabelPrurez] = useState<number[]>([]);
  const [kabelStineni, setKabelStineni] = useState<'' | 'ANO' | 'NE'>('');
  const [kabelMaterial, setKabelMaterial] = useState<string[]>([]);
  const [kabelVyrobce, setKabelVyrobce] = useState<string[]>([]);
  const [kabelCerts, setKabelCerts] = useState<string[]>([]);

  // Cable filters (advanced)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [kabelAdvCerts, setKabelAdvCerts] = useState<string[]>([]);
  const [kabelBezhal, setKabelBezhal] = useState<'' | 'ANO' | 'NE'>('');
  const [kabelRetiez, setKabelRetiez] = useState<'' | 'ANO' | 'NE'>('');
  const [kabelOlej, setKabelOlej] = useState<'' | 'ANO' | 'NE'>('');

  useEffect(() => {
    setLoading(true);
    Promise.all([loadWiresRaw(), loadCables()]).then(([w, c]) => {
      setWires(w);
      setCables(c);
      setLoading(false);
    });
  }, []);

  // ── Derived options ────────────────────────────────────────────────────

  const wireVyrobceOptions = useMemo(() =>
    [...new Set(wires.map(w => w.vyrobce).filter((v): v is string => Boolean(v)))].sort(), [wires]);

  const kabelVyrobceOptions = useMemo(() =>
    [...new Set(cables.map(c => c.dodavatel).filter((v): v is string => Boolean(v)))].sort(), [cables]);

  const wirePrurezOptions = useMemo(() =>
    WIRE_PRUREZ.filter(p => wires.some(w => w.prurez === p)), [wires]);

  const kabelPrurezOptions = useMemo(() => {
    const nums = new Set<number>();
    cables.forEach(c => { if (typeof c.prurez === 'number') nums.add(c.prurez); });
    return [...nums].sort((a, b) => a - b);
  }, [cables]);

  const wireBarvaOptions = useMemo(() =>
    Object.keys(WIRE_BARVA).filter(code => wires.some(w => w.barva === code)), [wires]);

  const kabelPocetZilOptions = useMemo(() => {
    const vals = [...new Set(cables.map(c => c.pocetZil).filter((v): v is string => Boolean(v)))];
    const nums = vals.filter(v => /^\d+$/.test(v)).sort((a, b) => parseInt(a) - parseInt(b));
    const complex = vals.filter(v => !/^\d+$/.test(v)).sort();
    return [...nums, ...complex];
  }, [cables]);

  // ── Filtering ──────────────────────────────────────────────────────────

  const filteredWires = useMemo(() => {
    let r = wires;
    if (wireQuery)           r = r.filter(w => matchesQuery([w.artiklStroj, w.artiklRucni, w.objednaciCislo, w.nazev], wireQuery));
    if (wirePrurez.length)   r = r.filter(w => w.prurez != null && wirePrurez.includes(w.prurez));
    if (wireBarva.length)    r = r.filter(w => w.barva != null && wireBarva.includes(w.barva));
    if (wireVyrobce.length)  r = r.filter(w => w.vyrobce != null && wireVyrobce.includes(w.vyrobce));
    if (wireSkupina.length)  r = r.filter(w => {
      const s = w.skupinaDleTypu ?? '';
      return wireSkupina.some(key => WIRE_SKUPINY.find(g => g.key === key)?.match(s));
    });
    return r;
  }, [wires, wireQuery, wirePrurez, wireBarva, wireSkupina, wireVyrobce]);

  const filteredCables = useMemo(() => {
    let r = cables;
    if (cableQuery)           r = r.filter(c => matchesQuery([c.artikl, c.objCislo1, c.objCislo2, c.objCislo3, c.objCislo4, c.nazevKatalog, c.nazev, c.ulStyle], cableQuery));
    if (kabelPocetZil.length) r = r.filter(c => c.pocetZil != null && kabelPocetZil.includes(c.pocetZil));
    if (kabelPrurez.length)   r = r.filter(c => typeof c.prurez === 'number' && kabelPrurez.includes(c.prurez));
    if (kabelStineni)         r = r.filter(c => c.stineni === kabelStineni);
    if (kabelMaterial.length) r = r.filter(c => kabelMaterial.some(key => KABEL_MATERIALY.find(g => g.key === key)?.match(c.materialPlaste)));
    if (kabelVyrobce.length)  r = r.filter(c => c.dodavatel != null && kabelVyrobce.includes(c.dodavatel));
    if (kabelCerts.length)    r = r.filter(c => kabelCerts.every(k => (c as unknown as Record<string, unknown>)[k] != null));
    if (kabelAdvCerts.length) r = r.filter(c => kabelAdvCerts.every(k => (c as unknown as Record<string, unknown>)[k] != null));
    if (kabelBezhal)          r = r.filter(c => c.bezhalogenovy === kabelBezhal);
    if (kabelRetiez)          r = r.filter(c => c.retiez === kabelRetiez);
    if (kabelOlej)            r = r.filter(c => c.olej === kabelOlej);
    return r;
  }, [cables, cableQuery, kabelPocetZil, kabelPrurez, kabelStineni, kabelMaterial, kabelVyrobce, kabelCerts, kabelAdvCerts, kabelBezhal, kabelRetiez, kabelOlej]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const resetWireFilters = () => {
    setWireQuery(''); setWirePrurez([]); setWireBarva([]); setWireSkupina([]); setWireVyrobce([]);
  };
  const resetCableFilters = () => {
    setCableQuery(''); setKabelPocetZil([]); setKabelPrurez([]); setKabelStineni('');
    setKabelMaterial([]); setKabelVyrobce([]); setKabelCerts([]);
    setKabelAdvCerts([]); setKabelBezhal(''); setKabelRetiez(''); setKabelOlej('');
  };

  const wireFiltersActive = !!(wireQuery || wirePrurez.length || wireBarva.length || wireSkupina.length || wireVyrobce.length);
  const cableFiltersActive = !!(cableQuery || kabelPocetZil.length || kabelPrurez.length || kabelStineni || kabelMaterial.length || kabelVyrobce.length || kabelCerts.length || kabelAdvCerts.length || kabelBezhal || kabelRetiez || kabelOlej);

  const total = subMode === 'wire' ? filteredWires.length : filteredCables.length;
  const displayed = subMode === 'wire' ? filteredWires.slice(0, 150) : filteredCables.slice(0, 150);
  const noun = subMode === 'wire'
    ? (total === 1 ? 'vodič' : total < 5 ? 'vodiče' : 'vodičů')
    : (total === 1 ? 'kabel' : total < 5 ? 'kabely' : 'kabelů');

  const wireInputRef = useRef<HTMLInputElement>(null);
  const cableInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Sub-mode toggle + count */}
      <div className="flex items-center gap-3 flex-wrap">
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
            <span className="text-text font-medium">{total}</span>{' '}{noun}
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

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-overlay1 pointer-events-none" />
        {subMode === 'wire' ? (
          <input
            ref={wireInputRef}
            value={wireQuery}
            onChange={e => setWireQuery(e.target.value)}
            placeholder="Hledat dle SAP artiklu, obj. čísla nebo názvu…"
            className="w-full bg-surface0 border border-surface2 rounded-xl pl-8 pr-8 py-2.5 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-teal/50 focus:bg-surface1 transition-colors"
          />
        ) : (
          <input
            ref={cableInputRef}
            value={cableQuery}
            onChange={e => setCableQuery(e.target.value)}
            placeholder="Hledat dle SAP artiklu, obj. čísla, názvu nebo UL style…"
            className="w-full bg-surface0 border border-surface2 rounded-xl pl-8 pr-8 py-2.5 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-teal/50 focus:bg-surface1 transition-colors"
          />
        )}
        {((subMode === 'wire' && wireQuery) || (subMode === 'cable' && cableQuery)) && (
          <button
            onClick={() => subMode === 'wire' ? setWireQuery('') : setCableQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-overlay1 hover:text-red transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-mantle rounded-2xl p-4 space-y-4">
        {subMode === 'wire' ? (
          <>
            <Chips
              label="Typ"
              values={WIRE_SKUPINY.filter(g => wires.some(w => g.match(w.skupinaDleTypu ?? ''))).map(g => g.key)}
              selected={wireSkupina}
              onToggle={v => setWireSkupina(toggle(wireSkupina, v))}
              format={v => WIRE_SKUPINY.find(g => g.key === v)?.label ?? v}
            />
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
            <Chips
              label="Certifikace"
              values={CERT_BASIC.filter(cd => cables.some(c => (c as unknown as Record<string, unknown>)[cd.key])).map(cd => cd.key as string)}
              selected={kabelCerts}
              onToggle={v => setKabelCerts(toggle(kabelCerts, v))}
              format={v => CERT_BASIC.find(cd => cd.key === v)?.label ?? v}
            />
            <Chips
              label="Dodavatel"
              values={kabelVyrobceOptions}
              selected={kabelVyrobce}
              onToggle={v => setKabelVyrobce(toggle(kabelVyrobce, v))}
            />

            {/* Advanced toggle */}
            <div>
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-xs text-overlay1 hover:text-subtext1 transition-colors"
              >
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Rozšířené filtry
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 border-t border-surface1 pt-3">
                  <Chips
                    label="Další certifikace"
                    values={CERT_ADV.filter(cd => cables.some(c => (c as unknown as Record<string, unknown>)[cd.key])).map(cd => cd.key as string)}
                    selected={kabelAdvCerts}
                    onToggle={v => setKabelAdvCerts(toggle(kabelAdvCerts, v))}
                    format={v => CERT_ADV.find(cd => cd.key === v)?.label ?? v}
                  />
                  <RadioChips
                    label="Bezhalogenový"
                    options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'Ano' }, { value: 'NE' as const, label: 'Ne' }]}
                    value={kabelBezhal}
                    onChange={setKabelBezhal}
                  />
                  <RadioChips
                    label="Energetický řetěz"
                    options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'Vhodný' }, { value: 'NE' as const, label: 'Nevhodný' }]}
                    value={kabelRetiez}
                    onChange={setKabelRetiez}
                  />
                  <RadioChips
                    label="Odolnost oleji"
                    options={[{ value: '' as const, label: 'Vše' }, { value: 'ANO' as const, label: 'Odolný' }, { value: 'NE' as const, label: 'Neodolný' }]}
                    value={kabelOlej}
                    onChange={setKabelOlej}
                  />
                </div>
              )}
            </div>
          </>
        )}
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
            {subMode === 'wire'
              ? (displayed as WireArticle[]).map((w, i) => (
                  <WireCard key={`${w.artiklStroj ?? w.artiklRucni}-${i}`} w={w} onClick={() => setSelectedWire(w)} />
                ))
              : (displayed as CableArticle[]).map(c => (
                  <CableCard key={c.artikl} c={c} onClick={() => setSelectedCable(c)} />
                ))
            }
          </div>
          {total > 150 && (
            <p className="text-center text-xs text-overlay0">
              Zobrazeno 150 z {total} výsledků — upřesni filtry nebo hledání.
            </p>
          )}
        </>
      )}

      {/* Detail modals */}
      {selectedWire && <WireDetailModal wire={selectedWire} onClose={() => setSelectedWire(null)} />}
      {selectedCable && <CableDetailModal cable={selectedCable} onClose={() => setSelectedCable(null)} />}
    </div>
  );
}
