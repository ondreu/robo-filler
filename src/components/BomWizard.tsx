import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Download, FileSpreadsheet, ArrowLeft, GripVertical } from 'lucide-react';
import type { Article, BomRow, BomHeader, BulkQueryResult, SearchResult } from '../types';
import { exportZbomTxt, exportZbomExcel, orderLabel, type ImportResult } from '../utils/bomExport';

interface BomWizardProps {
  bulkResults: BulkQueryResult[];
  selections: Record<number, SearchResult | null>;
  articles: Article[];
  onClose: () => void;
  importData?: ImportResult;
}

const STATUS_OPTIONS = [
  { value: '01', label: '01 – Aktivní' },
  { value: '02', label: '02 – V přípravě, neaktivní' },
  { value: '03', label: '03 – Aktivní s historií' },
  { value: '04', label: '04 – Blokován produkce, kalkulace povolena' },
  { value: '05', label: '05 – Blokován pro konstrukci, výrobu' },
];

const ZAVOD_OPTIONS = [
  { value: '6000', label: '6000 – Ústí nad Orlicí' },
  { value: '1000', label: '1000 – Effretikon' },
];

function getTodayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
}

function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputToZbom(v: string): string {
  if (!v || v.length !== 10) return '';
  const [yyyy, mm, dd] = v.split('-');
  return `${dd}${mm}${yyyy}`;
}

function zbomToDateInput(z: string): string {
  if (!z || z.length !== 8) return '';
  return `${z.slice(4)}-${z.slice(2, 4)}-${z.slice(0, 2)}`;
}

let idCounter = 0;
function genId(): string { return `r${++idCounter}`; }

function emptyLRow(): BomRow {
  return { id: genId(), type: 'L', artikl: '', popis: '', typoveOznaceni: '', mnozstvi: 1, poznamka1: '', poznamka2: '' };
}
function emptyTRow(): BomRow {
  return { id: genId(), type: 'T', artikl: '', popis: '', typoveOznaceni: '', mnozstvi: 1, poznamka1: '', poznamka2: '' };
}

// Editable columns only — popis and typoveOznaceni are auto-filled, not pasted
const EDITABLE_COLS = ['artikl', 'mnozstvi', 'poznamka1', 'poznamka2'] as const;
type EditableCol = typeof EDITABLE_COLS[number];
const MAX_ROWS = 2000;

const inputClass = 'w-full px-3 py-2 bg-surface0 text-text rounded-xl border border-surface2 focus:border-mauve focus:outline-none text-sm transition-colors';
const cellInput = 'w-full px-1.5 py-0.5 bg-transparent text-text rounded focus:bg-surface0 focus:outline-none focus:ring-1 focus:ring-mauve/50 transition-colors text-xs';
const cellReadonly = 'px-1.5 py-0.5 text-subtext1 text-xs truncate block w-full select-text';

const thClass = 'px-2 py-2 font-medium border-r border-surface1 last:border-r-0 whitespace-nowrap';
const tdClass = 'px-1 py-0.5 border-r border-surface1 last:border-r-0';

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-text text-sm font-medium flex items-center gap-1">{label}</label>
      {children}
      {hint && <p className="text-overlay0 text-xs">{hint}</p>}
    </div>
  );
}

export function BomWizard({ bulkResults, selections, articles, onClose, importData }: BomWizardProps) {
  const [step, setStep] = useState<1 | 2>(importData ? 2 : 1);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const [header, setHeader] = useState<BomHeader>(
    importData?.header ?? {
      cisloVrcholu: '',
      cisloZavodu: '6000',
      platnostOd: getTodayDDMMYYYY(),
      popis: '',
      status: '01',
      vyrobniDispecer: '',
    }
  );

  const [rows, setRows] = useState<BomRow[]>(() => {
    if (importData) return importData.rows;
    return bulkResults.map((r, i) => {
      const sel = selections[i];
      if (sel) {
        return { id: genId(), type: 'L' as const, artikl: sel.artikl, popis: sel.nazev, typoveOznaceni: sel.typoveOznaceni, mnozstvi: 1, poznamka1: '', poznamka2: '' };
      }
      return { id: genId(), type: 'T' as const, artikl: '', popis: '', typoveOznaceni: '', mnozstvi: 1, poznamka1: r.query, poznamka2: '' };
    });
  });

  const articleMap = useMemo(() => new Map(articles.map(a => [a.artikl, a])), [articles]);

  // drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current !== idx) setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) { setDragOverIdx(null); return; }
    setRows(prev => {
      const arr = [...prev];
      const [dragged] = arr.splice(from, 1);
      arr.splice(idx, 0, dragged);
      return arr;
    });
    dragIdx.current = null;
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { dragIdx.current = null; setDragOverIdx(null); };

  const updateHeader = (field: keyof BomHeader, value: string) =>
    setHeader(h => ({ ...h, [field]: value }));

  const addLRow = () => setRows(prev => prev.length < MAX_ROWS ? [...prev, emptyLRow()] : prev);
  const addTRow = () => setRows(prev => prev.length < MAX_ROWS ? [...prev, emptyTRow()] : prev);

  const deleteRow = useCallback((idx: number) =>
    setRows(prev => prev.filter((_, i) => i !== idx)), []);

  const toggleType = useCallback((idx: number) =>
    setRows(prev => {
      const arr = [...prev];
      const row = arr[idx];
      if (row.type === 'L') {
        arr[idx] = { ...row, type: 'T', poznamka1: row.artikl || row.poznamka1, artikl: '', typoveOznaceni: '', popis: '' };
      } else {
        arr[idx] = { ...row, type: 'L' };
      }
      return arr;
    }), []);

  const updateCell = useCallback((idx: number, field: keyof BomRow, value: string | number) =>
    setRows(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    }), []);

  // Lookup and fill popis + typoveOznaceni for a single row
  const applyLookup = useCallback((idx: number, artiklValue: string) => {
    const found = articleMap.get(artiklValue.trim());
    setRows(prev => {
      const arr = [...prev];
      arr[idx] = {
        ...arr[idx],
        popis: found?.nazev ?? '',
        typoveOznaceni: found?.typoveOznaceni ?? '',
      };
      return arr;
    });
  }, [articleMap]);

  const handleArtiклBlur = useCallback((idx: number, value: string) => {
    if (value.trim()) applyLookup(idx, value);
  }, [applyLookup]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colName: EditableCol) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length <= 1 && !text.includes('\t')) return;
    e.preventDefault();

    const grid = lines.map(l => l.split('\t'));
    const startCol = EDITABLE_COLS.indexOf(colName);

    setRows(prev => {
      const arr = [...prev];
      const lookupIndices: number[] = [];

      for (let r = 0; r < grid.length; r++) {
        const ri = rowIdx + r;
        while (arr.length <= ri && arr.length < MAX_ROWS) arr.push(emptyLRow());
        if (ri >= arr.length) break;
        const updated = { ...arr[ri] };
        let artiklChanged = false;
        for (let c = 0; c < grid[r].length; c++) {
          const ci = startCol + c;
          if (ci >= EDITABLE_COLS.length) break;
          const f = EDITABLE_COLS[ci];
          const v = grid[r][c];
          if (f === 'mnozstvi') {
            (updated as Record<string, unknown>)[f] = parseFloat(v) || 1;
          } else {
            (updated as Record<string, unknown>)[f] = v;
            if (f === 'artikl') artiklChanged = true;
          }
        }
        arr[ri] = updated;
        if (artiklChanged) lookupIndices.push(ri);
      }

      // Schedule lookups after state update
      if (lookupIndices.length > 0) {
        setTimeout(() => {
          setRows(current => {
            const next = [...current];
            for (const ri of lookupIndices) {
              if (ri < next.length && next[ri].artikl) {
                const found = articleMap.get(next[ri].artikl.trim());
                next[ri] = { ...next[ri], popis: found?.nazev ?? '', typoveOznaceni: found?.typoveOznaceni ?? '' };
              }
            }
            return next;
          });
        }, 0);
      }

      return arr;
    });
  }, [articleMap]);

  // ── Step 1: header form ─────────────────────────────────────────────────
  if (step === 1) {
    const dateVal = zbomToDateInput(header.platnostOd) || getTodayInputValue();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-base rounded-2xl w-full max-w-lg shadow-2xl border border-surface1">
          <div className="flex items-center justify-between p-6 border-b border-surface1">
            <div>
              <h2 className="text-text font-semibold text-lg">Export ZBOM</h2>
              <p className="text-overlay1 text-xs mt-0.5">Krok 1 ze 2 – Záhlaví kusovníku</p>
            </div>
            <button onClick={onClose} className="text-overlay1 hover:text-text transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <Field label="Číslo vrcholu *">
              <input type="text" value={header.cisloVrcholu}
                onChange={e => updateHeader('cisloVrcholu', e.target.value)}
                placeholder="např. 1234-5678" className={inputClass} autoFocus />
            </Field>
            <Field label="Číslo závodu">
              <select value={header.cisloZavodu} onChange={e => updateHeader('cisloZavodu', e.target.value)} className={inputClass}>
                {ZAVOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Platnost od">
              <input type="date" value={dateVal}
                onChange={e => updateHeader('platnostOd', dateInputToZbom(e.target.value))}
                className={inputClass} />
            </Field>
            <Field label={<>Popis kusovníku <span className={`ml-1 text-xs ${header.popis.length > 36 ? 'text-yellow' : 'text-overlay1'}`}>{header.popis.length}/40</span></>}>
              <input type="text" value={header.popis}
                onChange={e => updateHeader('popis', e.target.value.slice(0, 40))}
                placeholder="max 40 znaků" className={inputClass} />
            </Field>
            <Field label="Status kusovníku">
              <select value={header.status} onChange={e => updateHeader('status', e.target.value)} className={inputClass}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Výrobní dispečer" hint="1 písmeno + 2 číslice, např. U98">
              <input type="text" value={header.vyrobniDispecer}
                onChange={e => updateHeader('vyrobniDispecer', e.target.value.toUpperCase().slice(0, 3))}
                placeholder="U98" className={`${inputClass} font-mono w-24`} maxLength={3} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-surface1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-subtext1 hover:text-text hover:bg-surface1 transition-all text-sm">
              Zrušit
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!header.cisloVrcholu.trim()}
              className="px-6 py-2 rounded-xl font-medium bg-mauve text-crust hover:bg-mauve/80
                disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
            >
              Pokračovat →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: editable table ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface1 bg-mantle flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-overlay1 hover:text-text transition-colors text-sm">
            <ArrowLeft size={14} /> Záhlaví
          </button>
          <span className="text-surface1">|</span>
          <span className="text-text font-mono text-sm">{header.cisloVrcholu}</span>
          <span className="text-overlay0 text-xs">
            Závod {header.cisloZavodu}
            {header.platnostOd ? ` · ${header.platnostOd.slice(0, 2)}.${header.platnostOd.slice(2, 4)}.${header.platnostOd.slice(4)}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportZbomExcel(header, rows)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
              bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text transition-all"
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            onClick={() => exportZbomTxt(header, rows)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
              bg-mauve text-crust hover:bg-mauve/80 transition-all"
          >
            <Download size={13} /> Export ZBOM .txt
          </button>
          <button onClick={onClose} className="ml-1 text-overlay1 hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-surface1 bg-mantle flex-shrink-0">
        <button onClick={addLRow} disabled={rows.length >= MAX_ROWS}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium
            bg-blue/10 text-blue hover:bg-blue/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <Plus size={12} /> Řádek materiálu (L)
        </button>
        <button onClick={addTRow} disabled={rows.length >= MAX_ROWS}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium
            bg-yellow/10 text-yellow hover:bg-yellow/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <Plus size={12} /> Textové pole (T)
        </button>
        <span className="text-overlay0 text-xs ml-auto">{rows.length} / {MAX_ROWS} pozic</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 960 }}>
          <thead className="sticky top-0 z-10 bg-crust border-b-2 border-surface1">
            <tr className="text-overlay1 text-left">
              <th className={`${thClass} w-6`}></th>
              <th className={`${thClass} w-14 text-center`}>Pořadí</th>
              <th className={`${thClass} w-10 text-center`}>L/T</th>
              <th className={`${thClass}`} style={{ width: 96 }}>Artikl</th>
              <th className={`${thClass} text-overlay0`} style={{ minWidth: 170 }}>Popis artiklu</th>
              <th className={`${thClass} text-overlay0`} style={{ minWidth: 130 }}>Typové označení</th>
              <th className={`${thClass}`} style={{ width: 104 }}>Množství</th>
              <th className={`${thClass}`} style={{ minWidth: 150 }}>Poznámka 1</th>
              <th className={`${thClass}`} style={{ minWidth: 130 }}>Poznámka 2</th>
              <th className={`${thClass} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`border-t transition-colors ${
                  dragOverIdx === i
                    ? 'border-t-2 border-t-mauve bg-mauve/5'
                    : row.type === 'T'
                      ? 'border-surface0 bg-yellow/5'
                      : i % 2 === 0
                        ? 'border-surface0 bg-base'
                        : 'border-surface0 bg-mantle/40'
                } ${dragIdx.current === i ? 'opacity-40' : ''}`}
              >
                {/* drag handle */}
                <td className={`${tdClass} text-center cursor-grab active:cursor-grabbing`}>
                  <GripVertical size={12} className="text-overlay0 mx-auto" />
                </td>

                {/* order */}
                <td className={`${tdClass} text-center font-mono text-overlay0`}>
                  {orderLabel(i)}
                </td>

                {/* L/T toggle */}
                <td className={`${tdClass} text-center`}>
                  <button
                    onClick={() => toggleType(i)}
                    title={row.type === 'L' ? 'Materiál – kliknutím změnit na T' : 'Textové pole – kliknutím změnit na L'}
                    className={`w-7 h-5 rounded text-xs font-bold font-mono transition-all ${
                      row.type === 'L'
                        ? 'bg-blue/15 text-blue hover:bg-blue/30'
                        : 'bg-yellow/15 text-yellow hover:bg-yellow/30'
                    }`}
                  >
                    {row.type}
                  </button>
                </td>

                {/* artikl */}
                <td className={tdClass}>
                  <input type="text" value={row.artikl}
                    onChange={e => updateCell(i, 'artikl', e.target.value)}
                    onBlur={e => handleArtiклBlur(i, e.target.value)}
                    onPaste={e => handlePaste(e, i, 'artikl')}
                    disabled={row.type === 'T'}
                    placeholder={row.type === 'T' ? '—' : ''}
                    className={cellInput + (row.type === 'T' ? ' opacity-20 cursor-not-allowed' : '')} />
                </td>

                {/* popis artiklu – read-only */}
                <td className={tdClass}>
                  {row.type === 'T' ? (
                    <span className={cellReadonly + ' italic text-overlay1'}>{row.poznamka1 || '—'}</span>
                  ) : (
                    <span className={cellReadonly} title={row.popis}>{row.popis || <span className="text-overlay0">—</span>}</span>
                  )}
                </td>

                {/* typové označení – read-only */}
                <td className={tdClass}>
                  <span className={cellReadonly} title={row.typoveOznaceni}>
                    {row.typoveOznaceni || <span className="text-overlay0">—</span>}
                  </span>
                </td>

                {/* množství */}
                <td className={tdClass}>
                  <input type="number" value={row.mnozstvi}
                    onChange={e => updateCell(i, 'mnozstvi', parseFloat(e.target.value) || 1)}
                    onPaste={e => handlePaste(e, i, 'mnozstvi')}
                    min={0} step={1}
                    className={cellInput + ' text-center'} />
                </td>

                {/* poznámka 1 */}
                <td className={tdClass}>
                  <input type="text" value={row.poznamka1}
                    onChange={e => updateCell(i, 'poznamka1', e.target.value)}
                    onPaste={e => handlePaste(e, i, 'poznamka1')}
                    className={cellInput} />
                </td>

                {/* poznámka 2 */}
                <td className={tdClass}>
                  <input type="text" value={row.poznamka2}
                    onChange={e => updateCell(i, 'poznamka2', e.target.value)}
                    onPaste={e => handlePaste(e, i, 'poznamka2')}
                    className={cellInput} />
                </td>

                {/* delete */}
                <td className={`${tdClass} text-center`}>
                  <button onClick={() => deleteRow(i)}
                    className="p-0.5 text-overlay0 hover:text-red transition-all"
                    title="Smazat řádek">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="text-center py-16 text-overlay1 text-sm">
            Žádné řádky — přidejte pomocí tlačítek výše nebo vložte data z Excelu
          </div>
        )}
      </div>
    </div>
  );
}
