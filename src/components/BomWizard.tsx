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

// ── column definitions ────────────────────────────────────────────────────────
const COL_DEFS = [
  { key: 'artikl'          as const, label: 'Artikl',           editable: true,  style: { width: 96 } },
  { key: 'popis'           as const, label: 'Popis artiklu',    editable: false, style: { minWidth: 170 } },
  { key: 'typoveOznaceni'  as const, label: 'Typové označení',  editable: false, style: { minWidth: 130 } },
  { key: 'mnozstvi'        as const, label: 'Mn.',              editable: true,  style: { width: 104 } },
  { key: 'poznamka1'       as const, label: 'Poznámka 1',       editable: true,  style: { minWidth: 150 } },
  { key: 'poznamka2'       as const, label: 'Poznámka 2',       editable: true,  style: { minWidth: 130 } },
] as const;
type ColKey = typeof COL_DEFS[number]['key'];
const NUM_DATA_COLS = COL_DEFS.length;

// ── cell helpers ──────────────────────────────────────────────────────────────
function cellValue(row: BomRow, ci: number): string {
  const key = COL_DEFS[ci].key;
  if (key === 'popis' && row.type === 'T') return row.poznamka1 || '';
  const v = row[key];
  return v !== undefined && v !== null ? String(v) : '';
}

function cellEditable(row: BomRow, ci: number): boolean {
  if (!COL_DEFS[ci].editable) return false;
  if (COL_DEFS[ci].key === 'artikl' && row.type === 'T') return false;
  return true;
}

// ── selection helpers ─────────────────────────────────────────────────────────
interface CellCoord { row: number; col: number }
interface Sel { anchor: CellCoord; focus: CellCoord }

function norm(s: Sel) {
  return {
    r1: Math.min(s.anchor.row, s.focus.row),
    r2: Math.max(s.anchor.row, s.focus.row),
    c1: Math.min(s.anchor.col, s.focus.col),
    c2: Math.max(s.anchor.col, s.focus.col),
  };
}
function inSel(s: Sel | null, r: number, c: number) {
  if (!s) return false;
  const { r1, r2, c1, c2 } = norm(s);
  return r >= r1 && r <= r2 && c >= c1 && c <= c2;
}
function clampCoord(rows: BomRow[], r: number, c: number): CellCoord {
  return {
    row: Math.max(0, Math.min(rows.length - 1, r)),
    col: Math.max(0, Math.min(NUM_DATA_COLS - 1, c)),
  };
}

// ── edit state ────────────────────────────────────────────────────────────────
interface EditState { row: number; col: number; value: string; prev: string }

// ── wizard options ────────────────────────────────────────────────────────────
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

function getTodayDDMMYYYY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
}
function getTodayInput() { return new Date().toISOString().slice(0,10); }
function dateInputToZbom(v: string) {
  if (!v || v.length !== 10) return '';
  const [y,m,d] = v.split('-'); return `${d}${m}${y}`;
}
function zbomToDateInput(z: string) {
  if (!z || z.length !== 8) return '';
  return `${z.slice(4)}-${z.slice(2,4)}-${z.slice(0,2)}`;
}

let idCtr = 0;
function genId() { return `r${++idCtr}`; }
function emptyLRow(): BomRow { return { id: genId(), type: 'L', artikl: '', popis: '', typoveOznaceni: '', mnozstvi: 1, poznamka1: '', poznamka2: '' }; }
function emptyTRow(): BomRow { return { id: genId(), type: 'T', artikl: '', popis: '', typoveOznaceni: '', mnozstvi: 1, poznamka1: '', poznamka2: '' }; }

const MAX_ROWS = 2000;
const inputClass = 'w-full px-3 py-2 bg-surface0 text-text rounded-xl border border-surface2 focus:border-mauve focus:outline-none text-sm transition-colors';
const thCls = 'px-2 py-2 font-medium border-r border-surface1 last:border-r-0 whitespace-nowrap select-none';
const tdCls = 'border-r border-surface1 last:border-r-0 relative';

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-text text-sm font-medium flex items-center gap-1">{label}</label>
      {children}
      {hint && <p className="text-overlay0 text-xs">{hint}</p>}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function BomWizard({ bulkResults, selections, articles, onClose, importData }: BomWizardProps) {
  const [step, setStep] = useState<1 | 2>(importData ? 2 : 1);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const [header, setHeader] = useState<BomHeader>(importData?.header ?? {
    cisloVrcholu: '', cisloZavodu: '6000', platnostOd: getTodayDDMMYYYY(), popis: '', status: '01', vyrobniDispecer: '',
  });

  const [rows, setRows] = useState<BomRow[]>(() => {
    if (importData) return importData.rows;
    return bulkResults.map((r, i) => {
      const sel = selections[i];
      if (sel) return { id: genId(), type: 'L' as const, artikl: sel.artikl, popis: sel.nazev, typoveOznaceni: sel.typoveOznaceni, mnozstvi: 1, poznamka1: '', poznamka2: '' };
      return { id: genId(), type: 'T' as const, artikl: '', popis: '', typoveOznaceni: '', mnozstvi: 1, poznamka1: r.query, poznamka2: '' };
    });
  });

  const articleMap = useMemo(() => new Map(articles.map(a => [a.artikl, a])), [articles]);

  // ── spreadsheet selection & edit state ──────────────────────────────────────
  const [sel, setSel] = useState<Sel | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const mouseDownRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus container when selection active (no edit)
  useEffect(() => {
    if (sel && !edit && step === 2) {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [sel, edit, step]);

  // Focus edit input when edit starts
  useEffect(() => {
    if (edit) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [edit]);

  // Global mouseup to end drag
  useEffect(() => {
    const up = () => { mouseDownRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ── article lookup ───────────────────────────────────────────────────────────
  const lookupAndFill = useCallback((rowIdx: number, artiklValue: string) => {
    const found = articleMap.get(artiklValue.trim());
    setRows(prev => {
      const arr = [...prev];
      if (arr[rowIdx]) arr[rowIdx] = { ...arr[rowIdx], popis: found?.nazev ?? '', typoveOznaceni: found?.typoveOznaceni ?? '' };
      return arr;
    });
  }, [articleMap]);

  // ── row mutations ────────────────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const addLRow = () => setRows(p => p.length < MAX_ROWS ? [...p, emptyLRow()] : p);
  const addTRow = () => setRows(p => p.length < MAX_ROWS ? [...p, emptyTRow()] : p);

  const deleteRow = useCallback((idx: number) => {
    setRows(p => p.filter((_, i) => i !== idx));
    setSel(null);
  }, []);

  const toggleType = useCallback((idx: number) =>
    setRows(prev => {
      const arr = [...prev];
      const row = arr[idx];
      arr[idx] = row.type === 'L'
        ? { ...row, type: 'T', poznamka1: row.artikl || row.poznamka1, artikl: '', popis: '', typoveOznaceni: '' }
        : { ...row, type: 'L' };
      return arr;
    }), []);

  // ── cell value write ─────────────────────────────────────────────────────────
  const applyCellValue = useCallback((ri: number, ci: number, value: string) => {
    if (ci < 0 || ci >= NUM_DATA_COLS) return;
    setRows(prev => {
      if (ri >= prev.length) return prev;
      const arr = [...prev];
      const row = arr[ri];
      if (!cellEditable(row, ci)) return prev;
      const key = COL_DEFS[ci].key as ColKey;
      if (key === 'mnozstvi') {
        arr[ri] = { ...row, mnozstvi: parseFloat(value) || 1 };
      } else {
        arr[ri] = { ...row, [key]: value };
        if (key === 'artikl' && value.trim()) {
          setTimeout(() => lookupAndFill(ri, value), 0);
        }
      }
      return arr;
    });
  }, [lookupAndFill]);

  // ── edit flow ────────────────────────────────────────────────────────────────
  const startEdit = useCallback((r: number, c: number, replaceWith?: string) => {
    if (r < 0 || r >= rows.length || c < 0 || c >= NUM_DATA_COLS) return;
    if (!cellEditable(rows[r], c)) return;
    const prev = cellValue(rows[r], c);
    setEdit({ row: r, col: c, value: replaceWith ?? prev, prev });
  }, [rows]);

  const commitEdit = useCallback(() => {
    if (!edit) return;
    applyCellValue(edit.row, edit.col, edit.value);
    const next: Sel = { anchor: { row: edit.row, col: edit.col }, focus: { row: edit.row, col: edit.col } };
    setSel(next);
    setEdit(null);
  }, [edit, applyCellValue]);

  const cancelEdit = useCallback(() => {
    if (!edit) return;
    setSel({ anchor: { row: edit.row, col: edit.col }, focus: { row: edit.row, col: edit.col } });
    setEdit(null);
  }, [edit]);

  // ── copy ─────────────────────────────────────────────────────────────────────
  const copySelection = useCallback(() => {
    if (!sel) return;
    const { r1, r2, c1, c2 } = norm(sel);
    const lines: string[] = [];
    for (let r = r1; r <= r2; r++) {
      const cells: string[] = [];
      for (let c = c1; c <= c2; c++) cells.push(cellValue(rows[r], c));
      lines.push(cells.join('\t'));
    }
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }, [sel, rows]);

  // ── paste ────────────────────────────────────────────────────────────────────
  const applyPaste = useCallback((text: string) => {
    const startRow = sel ? Math.min(sel.anchor.row, sel.focus.row) : 0;
    const startCol = sel ? Math.min(sel.anchor.col, sel.focus.col) : 0;

    const grid = text.split(/\r?\n/).filter(l => l.length > 0).map(l => l.split('\t'));
    if (grid.length === 0) return;

    setRows(prev => {
      const arr = [...prev];
      const lookupQueue: number[] = [];

      for (let r = 0; r < grid.length; r++) {
        const ri = startRow + r;
        while (arr.length <= ri && arr.length < MAX_ROWS) arr.push(emptyLRow());
        if (ri >= arr.length) break;
        const updated = { ...arr[ri] };
        for (let c = 0; c < grid[r].length; c++) {
          const ci = startCol + c;
          if (ci >= NUM_DATA_COLS) break;
          if (!cellEditable(arr[ri], ci)) continue;
          const key = COL_DEFS[ci].key as ColKey;
          const v = grid[r][c];
          if (key === 'mnozstvi') {
            updated.mnozstvi = parseFloat(v) || 1;
          } else {
            (updated as Record<string, unknown>)[key] = v;
            if (key === 'artikl' && v.trim()) lookupQueue.push(ri);
          }
        }
        arr[ri] = updated;
      }

      if (lookupQueue.length > 0) {
        setTimeout(() => {
          setRows(cur => {
            const next = [...cur];
            for (const ri of lookupQueue) {
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
  }, [sel, articleMap]);

  // ── keyboard handler on container ────────────────────────────────────────────
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!sel) return;
    const { r1, r2, c1, c2 } = norm(sel);

    // Copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copySelection();
      return;
    }

    // Select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      setSel({ anchor: { row: 0, col: 0 }, focus: { row: rows.length - 1, col: NUM_DATA_COLS - 1 } });
      return;
    }

    // Delete / clear
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) {
      e.preventDefault();
      setRows(prev => {
        const arr = [...prev];
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            if (!cellEditable(arr[r], c)) continue;
            const key = COL_DEFS[c].key as ColKey;
            if (key === 'mnozstvi') arr[r] = { ...arr[r], mnozstvi: 1 };
            else arr[r] = { ...arr[r], [key]: '' };
          }
        }
        return arr;
      });
      return;
    }

    // Escape: clear selection
    if (e.key === 'Escape') { setSel(null); return; }

    // Enter / F2: start edit on anchor
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(sel.anchor.row, sel.anchor.col);
      return;
    }

    // Arrow navigation
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const newFocus = clampCoord(rows, sel.anchor.row + dr, sel.anchor.col + dc);
      if (e.shiftKey) {
        setSel(s => s ? { ...s, focus: newFocus } : { anchor: newFocus, focus: newFocus });
      } else {
        setSel({ anchor: newFocus, focus: newFocus });
      }
      return;
    }

    // Tab: move right
    if (e.key === 'Tab') {
      e.preventDefault();
      const next = e.shiftKey
        ? clampCoord(rows, r1, c1 - 1)
        : clampCoord(rows, r2, c2 + 1);
      setSel({ anchor: next, focus: next });
      return;
    }

    // Start typing → enter edit (replace mode)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      startEdit(sel.anchor.row, sel.anchor.col, e.key);
    }
  }, [sel, rows, copySelection, startEdit]);

  // Paste event on container
  const handleContainerPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    applyPaste(e.clipboardData.getData('text'));
  }, [applyPaste]);

  // ── edit input keyboard ───────────────────────────────────────────────────────
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCellValue(edit.row, edit.col, edit.value);
      if (edit.col === COL_DEFS.findIndex(c => c.key === 'artikl') && edit.value.trim()) {
        setTimeout(() => lookupAndFill(edit.row, edit.value), 0);
      }
      const next = clampCoord(rows, edit.row + 1, edit.col);
      setSel({ anchor: next, focus: next });
      setEdit(null);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      applyCellValue(edit.row, edit.col, edit.value);
      const next = e.shiftKey
        ? clampCoord(rows, edit.row, edit.col - 1)
        : clampCoord(rows, edit.row, edit.col + 1);
      setSel({ anchor: next, focus: next });
      setEdit(null);
      return;
    }
  }, [edit, rows, applyCellValue, cancelEdit, lookupAndFill]);

  // ── cell mouse handlers ───────────────────────────────────────────────────────
  const handleCellMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    mouseDownRef.current = true;
    if (e.shiftKey && sel) {
      setSel(s => s ? { ...s, focus: { row: r, col: c } } : { anchor: { row: r, col: c }, focus: { row: r, col: c } });
    } else {
      setSel({ anchor: { row: r, col: c }, focus: { row: r, col: c } });
    }
    if (edit) commitEdit();
  }, [sel, edit, commitEdit]);

  const handleCellMouseEnter = useCallback((r: number, c: number) => {
    if (!mouseDownRef.current) return;
    setSel(s => s ? { ...s, focus: { row: r, col: c } } : null);
  }, []);

  const handleCellDblClick = useCallback((r: number, c: number) => {
    startEdit(r, c);
  }, [startEdit]);

  // ── drag-row reorder ──────────────────────────────────────────────────────────
  const handleRowDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleRowDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current !== idx) setDragOverIdx(idx);
  };
  const handleRowDrop = (idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) { setDragOverIdx(null); return; }
    setRows(prev => {
      const arr = [...prev];
      const [d] = arr.splice(from, 1);
      arr.splice(idx, 0, d);
      return arr;
    });
    setSel(null);
    dragIdx.current = null;
    setDragOverIdx(null);
  };
  const handleRowDragEnd = () => { dragIdx.current = null; setDragOverIdx(null); };

  const updateHeader = (f: keyof BomHeader, v: string) => setHeader(h => ({ ...h, [f]: v }));

  // ── Step 1: header ────────────────────────────────────────────────────────────
  if (step === 1) {
    const dateVal = zbomToDateInput(header.platnostOd) || getTodayInput();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-base rounded-2xl w-full max-w-lg shadow-2xl border border-surface1">
          <div className="flex items-center justify-between p-6 border-b border-surface1">
            <div>
              <h2 className="text-text font-semibold text-lg">Export ZBOM</h2>
              <p className="text-overlay1 text-xs mt-0.5">Krok 1 ze 2 – Záhlaví kusovníku</p>
            </div>
            <button onClick={onClose} className="text-overlay1 hover:text-text transition-colors"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <Field label="Číslo vrcholu *">
              <input type="text" value={header.cisloVrcholu} onChange={e => updateHeader('cisloVrcholu', e.target.value)} placeholder="např. 1234-5678" className={inputClass} autoFocus />
            </Field>
            <Field label="Číslo závodu">
              <select value={header.cisloZavodu} onChange={e => updateHeader('cisloZavodu', e.target.value)} className={inputClass}>
                {ZAVOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Platnost od">
              <input type="date" value={dateVal} onChange={e => updateHeader('platnostOd', dateInputToZbom(e.target.value))} className={inputClass} />
            </Field>
            <Field label={<>Popis kusovníku <span className={`ml-1 text-xs ${header.popis.length > 36 ? 'text-yellow' : 'text-overlay1'}`}>{header.popis.length}/40</span></>}>
              <input type="text" value={header.popis} onChange={e => updateHeader('popis', e.target.value.slice(0,40))} placeholder="max 40 znaků" className={inputClass} />
            </Field>
            <Field label="Status kusovníku">
              <select value={header.status} onChange={e => updateHeader('status', e.target.value)} className={inputClass}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Výrobní dispečer" hint="1 písmeno + 2 číslice, např. U98">
              <input type="text" value={header.vyrobniDispecer} onChange={e => updateHeader('vyrobniDispecer', e.target.value.toUpperCase().slice(0,3))} placeholder="U98" className={`${inputClass} font-mono w-24`} maxLength={3} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-3 p-6 border-t border-surface1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-subtext1 hover:text-text hover:bg-surface1 transition-all text-sm">Zrušit</button>
            <button onClick={() => setStep(2)} disabled={!header.cisloVrcholu.trim()}
              className="px-6 py-2 rounded-xl font-medium bg-mauve text-crust hover:bg-mauve/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm">
              Pokračovat →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: table ─────────────────────────────────────────────────────────────
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
            {header.platnostOd ? ` · ${header.platnostOd.slice(0,2)}.${header.platnostOd.slice(2,4)}.${header.platnostOd.slice(4)}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportZbomExcel(header, rows)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text transition-all">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={() => exportZbomTxt(header, rows)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-mauve text-crust hover:bg-mauve/80 transition-all">
            <Download size={13} /> Export ZBOM .txt
          </button>
          <button onClick={onClose} className="ml-1 text-overlay1 hover:text-text transition-colors"><X size={18} /></button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-surface1 bg-mantle flex-shrink-0">
        <button onClick={addLRow} disabled={rows.length >= MAX_ROWS}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-blue/10 text-blue hover:bg-blue/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <Plus size={12} /> Řádek materiálu (L)
        </button>
        <button onClick={addTRow} disabled={rows.length >= MAX_ROWS}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-yellow/10 text-yellow hover:bg-yellow/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <Plus size={12} /> Textové pole (T)
        </button>
        <span className="text-overlay0 text-xs ml-auto">{rows.length} / {MAX_ROWS} pozic</span>
      </div>

      {/* Table container — focusable for keyboard events */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onPaste={handleContainerPaste}
        onMouseDown={e => { if (e.target === containerRef.current) setSel(null); }}
        className="flex-1 overflow-auto outline-none"
      >
        <table className="w-full text-xs border-collapse" style={{ minWidth: 960 }}>
          <thead className="sticky top-0 z-10 bg-crust border-b-2 border-surface1">
            <tr className="text-overlay1 text-left">
              <th className={`${thCls} w-6`}></th>
              <th className={`${thCls} w-14 text-center`}>Pořadí</th>
              <th className={`${thCls} w-10 text-center`}>L/T</th>
              {COL_DEFS.map(col => (
                <th key={col.key} className={`${thCls} ${!col.editable ? 'text-overlay0' : ''}`} style={col.style}>
                  {col.label}
                </th>
              ))}
              <th className={`${thCls} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={row.id}
                draggable
                onDragStart={() => handleRowDragStart(ri)}
                onDragOver={e => handleRowDragOver(e, ri)}
                onDrop={() => handleRowDrop(ri)}
                onDragEnd={handleRowDragEnd}
                className={`border-t transition-colors ${
                  dragOverIdx === ri ? 'border-t-2 border-t-mauve bg-mauve/5'
                  : row.type === 'T' ? 'border-surface0 bg-yellow/5'
                  : ri % 2 === 0 ? 'border-surface0 bg-base'
                  : 'border-surface0 bg-mantle/40'
                } ${dragIdx.current === ri ? 'opacity-40' : ''}`}
              >
                {/* Drag handle */}
                <td className="border-r border-surface1 text-center cursor-grab active:cursor-grabbing px-1 py-0.5">
                  <GripVertical size={12} className="text-overlay0 mx-auto" />
                </td>

                {/* Order */}
                <td className="border-r border-surface1 text-center font-mono text-overlay0 px-2 py-0.5 select-none">
                  {orderLabel(ri)}
                </td>

                {/* L/T toggle */}
                <td className="border-r border-surface1 text-center px-1 py-0.5">
                  <button
                    onClick={() => toggleType(ri)}
                    title={row.type === 'L' ? 'Materiál – kliknutím na T' : 'Textové pole – kliknutím na L'}
                    className={`w-7 h-5 rounded text-xs font-bold font-mono transition-all ${
                      row.type === 'L' ? 'bg-blue/15 text-blue hover:bg-blue/30' : 'bg-yellow/15 text-yellow hover:bg-yellow/30'
                    }`}
                  >
                    {row.type}
                  </button>
                </td>

                {/* Data cells */}
                {COL_DEFS.map((col, ci) => {
                  const isEditingThis = edit?.row === ri && edit?.col === ci;
                  const isSelectedCell = inSel(sel, ri, ci);
                  const isAnchor = sel?.anchor.row === ri && sel?.anchor.col === ci;
                  const value = cellValue(row, ci);
                  const editable = cellEditable(row, ci);

                  return (
                    <td
                      key={col.key}
                      className={`${tdCls} ${isSelectedCell ? 'bg-mauve/20' : ''}`}
                      onMouseDown={e => handleCellMouseDown(e, ri, ci)}
                      onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                      onDoubleClick={() => handleCellDblClick(ri, ci)}
                    >
                      {isEditingThis ? (
                        <input
                          ref={editInputRef}
                          type={col.key === 'mnozstvi' ? 'number' : 'text'}
                          value={edit.value}
                          onChange={e => setEdit(s => s ? { ...s, value: e.target.value } : null)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={commitEdit}
                          className="w-full px-1.5 py-0.5 bg-surface0 text-text rounded focus:outline-none focus:ring-1 focus:ring-mauve text-xs"
                          style={{ minWidth: 40 }}
                        />
                      ) : (
                        <span
                          className={`block px-1.5 py-0.5 text-xs truncate select-none ${
                            !editable ? 'text-subtext1' : 'text-text'
                          } ${isAnchor && isSelectedCell ? 'outline outline-1 outline-mauve outline-offset-[-1px]' : ''}`}
                          style={{ minHeight: 20 }}
                        >
                          {col.key === 'popis' && row.type === 'T'
                            ? <span className="italic text-overlay1">{row.poznamka1 || '—'}</span>
                            : value || <span className="text-overlay0 pointer-events-none">—</span>
                          }
                        </span>
                      )}
                    </td>
                  );
                })}

                {/* Delete */}
                <td className="text-center px-1 py-0.5">
                  <button onClick={() => deleteRow(ri)} className="p-0.5 text-overlay0 hover:text-red transition-all" title="Smazat řádek">
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
