import { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, Play, Loader2, Download, Check, X, ChevronRight, MessageCircle, BookOpen } from 'lucide-react';
import type { BomRow, BomHeader } from '../types';
import type { ImportResult } from '../utils/bomExport';

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');

// ── types ────────────────────────────────────────────────────────────────────

interface InputRow {
  id: string;
  popis: string;
  vyrobce: string;
  typoveOznaceni: string;
  altTypoveOznaceni: string;
  pocet: number;
  oznaceniPristroje: string;
}

interface ProgressItem {
  rowIndex: number;
  total: number;
  typoveOznaceni: string;
  status: 'waiting' | 'searching' | 'found' | 'not_found' | 'skipped' | 'knowledge';
  mfrName?: string;
}

interface BomResultRow {
  type: 'L' | 'T';
  artikl: string;
  popis: string;
  typoveOznaceni: string;
  mnozstvi: number;
  poznamka1: string;
  poznamka2: string;
  aiFilledPopis?: boolean;
}

interface ToCreateRow {
  nazev: string;
  vyrobce: string;
  typoveOznaceni: string;
  unit: string;
  oznaceniPristroje: string;
  aiFilledPopis?: boolean;
}

interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'choice' | 'text';
  choices?: string[];
}

interface ClarificationAnswer {
  id: string;
  question: string;
  answer: string;
}

interface BomBuilderProps {
  onOpenInZbom?: (importData: ImportResult) => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

let rowIdCtr = 0;
function newRow(): InputRow {
  return { id: `ir-${++rowIdCtr}`, popis: '', vyrobce: '', typoveOznaceni: '', altTypoveOznaceni: '', pocet: 1, oznaceniPristroje: '' };
}

function initRows(): InputRow[] {
  return [newRow(), newRow(), newRow()];
}

// ── BOM history (localStorage, last 5) ───────────────────────────────────────

interface BomHistoryEntry {
  key: string;
  label: string;
  rows: InputRow[];
  preferences: string;
  produktovaHierarchie: string;
  artiklVrcholu: string;
  bomRows: BomResultRow[];
  toCreate: ToCreateRow[];
}

const HISTORY_KEY = 'robo-filler-bom-history';

function bomCacheKey(rows: InputRow[], preferences: string): string {
  return JSON.stringify(rows.map(r => [r.typoveOznaceni, r.altTypoveOznaceni, r.vyrobce, r.pocet, r.oznaceniPristroje])) + '|' + preferences;
}

function loadHistory(): BomHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}

function saveHistory(entry: BomHistoryEntry) {
  const history = loadHistory().filter(e => e.key !== entry.key);
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
}

function historyLabel(rows: InputRow[]): string {
  const active = rows.filter(r => r.typoveOznaceni.trim() || r.altTypoveOznaceni.trim());
  const sample = active.slice(0, 3).map(r => r.typoveOznaceni || r.altTypoveOznaceni).join(', ');
  return `${active.length} pol. — ${sample}${active.length > 3 ? '…' : ''}`;
}

const thCls = 'px-2 py-2 font-medium text-left border-r border-surface1 last:border-r-0 whitespace-nowrap text-xs text-overlay1';
const tdCls = 'border-r border-surface1 last:border-r-0 p-0';
const inputCls = 'w-full px-2 py-1.5 bg-transparent text-text text-xs placeholder:text-overlay0 focus:outline-none focus:bg-surface1/40 rounded transition-colors';

function exportKzalozeniCsv(
  rows: ToCreateRow[],
  produktovaHierarchie: string,
  artiklVrcholu: string,
) {
  const headers = [
    'Název', 'Výrobce', 'Typové označení', '', '',
    'Základní jednotka', 'Produktová hierarchie',
    'KANBAN', 'Vstupní kontrola', 'Artikl zákazníka', 'EAN', 'Poznámka',
  ];
  const dataRows = rows.map(r => {
    const poznamka = [artiklVrcholu, r.oznaceniPristroje].filter(Boolean).join(' ');
    return [
      r.nazev, r.vyrobce, r.typoveOznaceni, '', '',
      r.unit, produktovaHierarchie,
      '', '', '', '', poznamka,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';');
  });
  const csv = [headers.join(';'), ...dataRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `k-zalozeni-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildImportResult(bomRows: BomResultRow[]): ImportResult {
  let idCtr = 0;
  const genId = () => `bom-${++idCtr}`;
  const header: BomHeader = {
    cisloVrcholu: '',
    cisloZavodu: '6000',
    platnostOd: (() => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    })(),
    popis: '',
    status: '01',
    vyrobniDispecer: '',
  };
  const rows: BomRow[] = bomRows.map(r => ({
    id: genId(),
    type: r.type,
    artikl: r.artikl,
    popis: r.popis,
    typoveOznaceni: r.typoveOznaceni,
    mnozstvi: r.mnozstvi,
    poznamka1: r.poznamka1,
    poznamka2: r.poznamka2,
  }));
  return { header, rows };
}

// ── status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ProgressItem['status'] }) {
  if (status === 'searching') return <Loader2 size={12} className="animate-spin text-mauve" />;
  if (status === 'found') return <Check size={12} className="text-green" />;
  if (status === 'not_found') return <X size={12} className="text-red" />;
  if (status === 'skipped') return <span className="text-overlay0 text-xs">—</span>;
  if (status === 'knowledge') return <BookOpen size={12} className="text-teal" />;
  return <span className="w-3 h-3 rounded-full border border-surface2 inline-block" />;
}

// ── input table ───────────────────────────────────────────────────────────────

const INPUT_COLS = ['popis', 'vyrobce', 'typoveOznaceni', 'altTypoveOznaceni', 'pocet', 'oznaceniPristroje'] as const;

function InputTable({ rows, onChange }: { rows: InputRow[]; onChange: (rows: InputRow[]) => void }) {
  const update = (id: string, field: keyof InputRow, value: string | number) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const remove = (id: string) => onChange(rows.filter(r => r.id !== id));
  const add = () => onChange([...rows, newRow()]);
  const clear = () => onChange(initRows());

  // Excel-like selection
  const [selAnchor, setSelAnchor] = useState<{ r: number; c: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ r: number; c: number } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const isSelected = useCallback((r: number, c: number) => {
    if (!selAnchor || !selEnd) return false;
    const r1 = Math.min(selAnchor.r, selEnd.r), r2 = Math.max(selAnchor.r, selEnd.r);
    const c1 = Math.min(selAnchor.c, selEnd.c), c2 = Math.max(selAnchor.c, selEnd.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  }, [selAnchor, selEnd]);

  const focusCell = (r: number, c: number) => {
    const clamped = { r: Math.max(0, Math.min(r, rows.length - 1)), c: Math.max(0, Math.min(c, INPUT_COLS.length - 1)) };
    inputRefs.current[clamped.r]?.[clamped.c]?.focus();
    setSelAnchor(clamped);
    setSelEnd(clamped);
  };

  const handleCellMouseDown = (ri: number, ci: number, e: React.MouseEvent) => {
    if (e.shiftKey && selAnchor) {
      e.preventDefault();
      setSelEnd({ r: ri, c: ci });
    } else {
      setSelAnchor({ r: ri, c: ci });
      setSelEnd({ r: ri, c: ci });
    }
  };

  const handleKeyDown = (ri: number, ci: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        ci > 0 ? focusCell(ri, ci - 1) : ri > 0 && focusCell(ri - 1, INPUT_COLS.length - 1);
      } else {
        ci < INPUT_COLS.length - 1 ? focusCell(ri, ci + 1) : focusCell(ri + 1, 0);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      focusCell(ri + 1, ci);
    } else if (e.key === 'ArrowDown' && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) {
      e.preventDefault();
      focusCell(ri + 1, ci);
    } else if (e.key === 'ArrowUp' && (e.target as HTMLInputElement).selectionStart === 0) {
      e.preventDefault();
      focusCell(ri - 1, ci);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    const td = target.closest('td');
    const tr = target.closest('tr');
    if (!td || !tr) return;

    const colIndex = Array.from(tr.querySelectorAll('td')).indexOf(td as HTMLTableCellElement) - 1;
    if (colIndex < 0) return;

    const rowIndex = rows.findIndex(r => r.id === (tr as HTMLTableRowElement).dataset.rowId);
    if (rowIndex < 0) return;

    const text = e.clipboardData.getData('text');
    // Trim only the single trailing newline Excel always appends, preserve empty inner rows
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines;
    if (lines.length <= 1 && !text.includes('\t')) return;

    e.preventDefault();

    const grid = lines.map(l => l.split('\t'));
    const updated = [...rows];
    for (let r = 0; r < grid.length; r++) {
      const ri = rowIndex + r;
      while (updated.length <= ri) updated.push(newRow());
      for (let c = 0; c < grid[r].length; c++) {
        const ci = colIndex + c;
        if (ci >= INPUT_COLS.length) break;
        const field = INPUT_COLS[ci];
        const val = grid[r][c];
        (updated[ri] as unknown as Record<string, unknown>)[field] = field === 'pocet' ? (parseFloat(val) || 1) : val;
      }
    }
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-surface1">
      <table className="w-full text-xs border-collapse" onPaste={handlePaste}>
        <thead className="bg-crust sticky top-0 z-10">
          <tr>
            <th className={thCls} style={{ width: 28 }}></th>
            <th className={thCls} style={{ minWidth: 140 }}>Popis</th>
            <th className={thCls} style={{ minWidth: 110 }}>Výrobce</th>
            <th className={`${thCls} text-text`} style={{ minWidth: 150 }}>
              Typové označení <span className="text-red ml-0.5">*</span>
            </th>
            <th className={thCls} style={{ minWidth: 150 }}>Alt. typové označení</th>
            <th className={thCls} style={{ width: 64 }}>Počet</th>
            <th className={thCls} style={{ minWidth: 130 }}>Označení přístroje</th>
            <th className={thCls} style={{ width: 28 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (!inputRefs.current[ri]) inputRefs.current[ri] = [];
            const cellCls = (ci: number) =>
              `${tdCls} ${isSelected(ri, ci) ? 'bg-mauve/15 ring-1 ring-inset ring-mauve/40' : ''}`;
            const cellProps = (ci: number) => ({
              onMouseDown: (e: React.MouseEvent) => handleCellMouseDown(ri, ci, e),
            });
            const inputProps = (ci: number, extra?: string) => ({
              className: `${inputCls}${extra ? ' ' + extra : ''}`,
              onFocus: () => { setSelAnchor({ r: ri, c: ci }); setSelEnd({ r: ri, c: ci }); },
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(ri, ci, e),
              ref: (el: HTMLInputElement | null) => { inputRefs.current[ri][ci] = el; },
            });
            return (
              <tr
                key={row.id}
                data-row-id={row.id}
                className={`border-t border-surface1 ${ri % 2 === 0 ? 'bg-base' : 'bg-mantle/40'} hover:bg-surface0/30 transition-colors`}
              >
                <td className={`${tdCls} text-center px-1 text-overlay0 select-none`}>{ri + 1}</td>
                <td className={cellCls(0)} {...cellProps(0)}>
                  <input {...inputProps(0)} value={row.popis} onChange={e => update(row.id, 'popis', e.target.value)} placeholder="název / popis" />
                </td>
                <td className={cellCls(1)} {...cellProps(1)}>
                  <input {...inputProps(1)} value={row.vyrobce} onChange={e => update(row.id, 'vyrobce', e.target.value)} placeholder="výrobce" />
                </td>
                <td className={cellCls(2)} {...cellProps(2)}>
                  <input {...inputProps(2, 'font-mono')} value={row.typoveOznaceni} onChange={e => update(row.id, 'typoveOznaceni', e.target.value)} placeholder="5SY4116-1" />
                </td>
                <td className={cellCls(3)} {...cellProps(3)}>
                  <input {...inputProps(3, 'font-mono')} value={row.altTypoveOznaceni} onChange={e => update(row.id, 'altTypoveOznaceni', e.target.value)} placeholder="alternativa..." />
                </td>
                <td className={cellCls(4)} {...cellProps(4)}>
                  <input {...inputProps(4, 'text-center font-mono')} type="number" min={1} value={row.pocet} onChange={e => update(row.id, 'pocet', parseFloat(e.target.value) || 1)} />
                </td>
                <td className={cellCls(5)} {...cellProps(5)}>
                  <input {...inputProps(5, 'font-mono')} value={row.oznaceniPristroje} onChange={e => update(row.id, 'oznaceniPristroje', e.target.value)} placeholder="-Q1" />
                </td>
                <td className={`${tdCls} text-center`}>
                  <button onClick={() => remove(row.id)} className="p-0.5 text-overlay0 hover:text-red transition-colors m-1" title="Odebrat řádek">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-2 border-t border-surface1 flex items-center gap-2">
        <button
          onClick={add}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-subtext1 hover:text-text hover:bg-surface1 transition-colors"
        >
          <Plus size={12} /> Přidat řádek
        </button>
        <button
          onClick={clear}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-overlay0 hover:text-red hover:bg-surface1 transition-colors ml-auto"
        >
          <Trash2 size={12} /> Vyčistit
        </button>
      </div>
    </div>
  );
}

// ── result: bom table ─────────────────────────────────────────────────────────

function BomTable({ rows }: { rows: BomResultRow[] }) {
  if (rows.length === 0) return <p className="text-overlay1 text-sm text-center py-8">Žádné výsledky.</p>;

  let orderCtr = 0;
  const orderLabel = (type: 'L' | 'T') => type === 'L' ? String((++orderCtr) * 10).padStart(4, '0') : '';

  return (
    <div className="overflow-x-auto rounded-xl border border-surface1">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-crust">
          <tr className="text-overlay1 text-left">
            <th className={thCls} style={{ width: 48, textAlign: 'center' }}>Pořadí</th>
            <th className={thCls} style={{ width: 36, textAlign: 'center' }}>L/T</th>
            <th className={thCls} style={{ width: 96 }}>Artikl</th>
            <th className={thCls} style={{ minWidth: 170 }}>Popis artiklu</th>
            <th className={thCls} style={{ minWidth: 130 }}>Typové označení</th>
            <th className={thCls} style={{ width: 60 }}>Mn.</th>
            <th className={thCls} style={{ minWidth: 150 }}>Poznámka 1</th>
            <th className={thCls} style={{ minWidth: 130 }}>Poznámka 2</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const order = orderLabel(row.type);
            return (
              <tr
                key={ri}
                className={`border-t border-surface1 ${
                  row.type === 'T'
                    ? 'bg-yellow/5'
                    : ri % 2 === 0 ? 'bg-base' : 'bg-mantle/40'
                }`}
              >
                <td className="border-r border-surface1 text-center font-mono text-overlay0 px-2 py-1 select-none">{order}</td>
                <td className="border-r border-surface1 text-center px-1 py-1">
                  <span className={`inline-block w-7 h-5 rounded text-xs font-bold font-mono leading-5 text-center ${
                    row.type === 'L' ? 'bg-blue/15 text-blue' : 'bg-yellow/15 text-yellow'
                  }`}>
                    {row.type}
                  </span>
                </td>
                <td className="border-r border-surface1 px-2 py-1 font-mono text-mauve">{row.artikl || '—'}</td>
                <td className="border-r border-surface1 px-2 py-1 text-text truncate max-w-xs">
                  {row.type === 'T'
                    ? <span className="italic text-overlay1">{row.poznamka1 || '—'}</span>
                    : (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{row.popis}</span>
                        {row.aiFilledPopis && (
                          <span className="shrink-0 text-[10px] font-medium bg-teal/15 text-teal rounded px-1 py-0.5 leading-none">AI</span>
                        )}
                      </span>
                    )}
                </td>
                <td className="border-r border-surface1 px-2 py-1 font-mono text-subtext1">{row.typoveOznaceni || '—'}</td>
                <td className="border-r border-surface1 px-2 py-1 text-center font-mono">{row.mnozstvi}</td>
                <td className="border-r border-surface1 px-2 py-1 text-subtext1">{row.poznamka1}</td>
                <td className="px-2 py-1 text-subtext1 font-mono">{row.poznamka2}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── result: k-zalozeni table ──────────────────────────────────────────────────

function KzalozeniTable({
  rows,
  produktovaHierarchie,
  artiklVrcholu,
}: {
  rows: ToCreateRow[];
  produktovaHierarchie: string;
  artiklVrcholu: string;
}) {
  if (rows.length === 0) return <p className="text-green text-sm text-center py-8">Všechny položky nalezeny — žádné k založení.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-surface1">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-crust">
          <tr className="text-overlay1 text-left">
            <th className={thCls} style={{ minWidth: 140 }}>Název</th>
            <th className={thCls} style={{ minWidth: 100 }}>Výrobce</th>
            <th className={thCls} style={{ minWidth: 140 }}>Typové označení</th>
            <th className={thCls} style={{ width: 40 }}></th>
            <th className={thCls} style={{ width: 40 }}></th>
            <th className={thCls} style={{ width: 80 }}>Zákl. jednotka</th>
            <th className={thCls} style={{ minWidth: 120 }}>Prod. hierarchie</th>
            <th className={thCls} style={{ width: 60 }}>KANBAN</th>
            <th className={thCls} style={{ width: 80 }}>Vstupní kontr.</th>
            <th className={thCls} style={{ width: 80 }}>Artikl zákaz.</th>
            <th className={thCls} style={{ width: 60 }}>EAN</th>
            <th className={thCls} style={{ minWidth: 140 }}>Poznámka</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const poznamka = [artiklVrcholu, row.oznaceniPristroje].filter(Boolean).join(' ');
            return (
              <tr
                key={ri}
                className={`border-t border-surface1 ${ri % 2 === 0 ? 'bg-base' : 'bg-mantle/40'}`}
              >
                <td className="border-r border-surface1 px-2 py-1 text-text">
                  <span className="flex items-center gap-1">
                    {row.nazev || '—'}
                    {row.aiFilledPopis && (
                      <span className="shrink-0 text-[10px] font-medium bg-teal/15 text-teal rounded px-1 py-0.5 leading-none">AI</span>
                    )}
                  </span>
                </td>
                <td className="border-r border-surface1 px-2 py-1 text-subtext1">{row.vyrobce || '—'}</td>
                <td className="border-r border-surface1 px-2 py-1 font-mono text-mauve">{row.typoveOznaceni}</td>
                <td className="border-r border-surface1 px-2 py-1"></td>
                <td className="border-r border-surface1 px-2 py-1"></td>
                <td className="border-r border-surface1 px-2 py-1 text-center font-mono text-teal">{row.unit}</td>
                <td className="border-r border-surface1 px-2 py-1 text-subtext1">{produktovaHierarchie}</td>
                <td className="border-r border-surface1 px-2 py-1"></td>
                <td className="border-r border-surface1 px-2 py-1"></td>
                <td className="border-r border-surface1 px-2 py-1"></td>
                <td className="border-r border-surface1 px-2 py-1"></td>
                <td className="px-2 py-1 text-subtext1 font-mono text-xs">{poznamka}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function AiBomBuilder({ onOpenInZbom }: BomBuilderProps) {
  const [rows, setRows] = useState<InputRow[]>(initRows);
  const [preferences, setPreferences] = useState('');
  const [produktovaHierarchie, setProduktova] = useState('');
  const [artiklVrcholu, setArtiklVrcholu] = useState('');

  const [phase, setPhase] = useState<'input' | 'processing' | 'post_check' | 'clarifying' | 'results'>('input');
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [clarifyQuestions, setClarifyQuestions] = useState<ClarificationQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});

  const [bomRows, setBomRows] = useState<BomResultRow[]>([]);
  const [toCreate, setToCreate] = useState<ToCreateRow[]>([]);
  const [resultProdHier, setResultProdHier] = useState('');
  const [resultArtiklVrcholu, setResultArtiklVrcholu] = useState('');
  const [resultTab, setResultTab] = useState<'bom' | 'create'>('bom');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BomHistoryEntry[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeRows = rows.filter(r => r.typoveOznaceni.trim() || r.altTypoveOznaceni.trim());

  function buildPayload(answers: ClarificationAnswer[]) {
    return {
      rows: rows.map(r => ({
        typoveOznaceni: r.typoveOznaceni,
        altTypoveOznaceni: r.altTypoveOznaceni,
        popis: r.popis,
        vyrobce: r.vyrobce,
        pocet: r.pocet,
        oznaceniPristroje: r.oznaceniPristroje,
      })),
      preferences,
      produktovaHierarchie,
      artiklVrcholu,
      answers,
    };
  }

  async function startBuild(answers: ClarificationAnswer[]) {
    setPhase('processing');
    setError(null);
    setTotalCount(rows.length);
    setProcessedCount(0);
    setProgressItems(rows.map((r, i) => ({
      rowIndex: i,
      total: rows.length,
      typoveOznaceni: r.typoveOznaceni || r.altTypoveOznaceni,
      status: 'waiting',
    })));

    try {
      const response = await fetch(`${BACKEND_URL}/api/bom-build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(answers)),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'progress') {
                if (data.status === 'knowledge') {
                  // Insert knowledge notification as a separate line (not a row update)
                  setProgressItems(prev => [...prev, data as ProgressItem]);
                } else {
                  setProgressItems(prev => {
                    const next = [...prev];
                    const idx = data.rowIndex;
                    if (idx < next.length) {
                      next[idx] = { ...next[idx], ...data };
                    }
                    return next;
                  });
                  if (data.status === 'found' || data.status === 'not_found' || data.status === 'skipped') {
                    setProcessedCount(c => c + 1);
                  }
                }
              } else if (eventType === 'result') {
                const newBomRows: BomResultRow[] = data.bomRows ?? [];
                const newToCreate: ToCreateRow[] = data.toCreate ?? [];
                const prodHier = data.produktovaHierarchie ?? '';
                const arVrch = data.artiklVrcholu ?? '';
                setBomRows(newBomRows);
                setToCreate(newToCreate);
                setResultProdHier(prodHier);
                setResultArtiklVrcholu(arVrch);
                setResultTab('bom');
                // Save to history
                const entry: BomHistoryEntry = {
                  key: bomCacheKey(rows, preferences),
                  label: historyLabel(rows),
                  rows: rows.map(r => ({ ...r })),
                  preferences,
                  produktovaHierarchie: prodHier,
                  artiklVrcholu: arVrch,
                  bomRows: newBomRows,
                  toCreate: newToCreate,
                };
                saveHistory(entry);
                setHistory(loadHistory());
                await runPostCheck(newBomRows, newToCreate);
              } else if (eventType === 'error') {
                setError(data.error ?? 'Neznámá chyba.');
                setPhase('input');
              }
            } catch { /* malformed JSON */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba spojení se serverem.');
      setPhase('input');
    }
  }

  async function submit() {
    if (activeRows.length === 0) return;
    setError(null);
    // Check cache first
    const cacheKey = bomCacheKey(rows, preferences);
    const cached = loadHistory().find(e => e.key === cacheKey);
    if (cached) {
      setBomRows(cached.bomRows);
      setToCreate(cached.toCreate);
      setResultProdHier(cached.produktovaHierarchie);
      setResultArtiklVrcholu(cached.artiklVrcholu);
      setResultTab('bom');
      setPhase('results');
      return;
    }
    await startBuild([]);
  }

  async function runPostCheck(currentBomRows: BomResultRow[], _currentToCreate: ToCreateRow[]) {
    const notFoundRows = rows.filter((_, i) => currentBomRows[i]?.type === 'T');
    if (notFoundRows.length === 0) { setPhase('results'); return; }
    setPhase('post_check');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/bom-post-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notFoundRows: notFoundRows.map(r => ({ typoveOznaceni: r.typoveOznaceni, altTypoveOznaceni: r.altTypoveOznaceni, popis: r.popis, vyrobce: r.vyrobce })),
          preferences,
        }),
      });
      if (!resp.ok) throw new Error();
      const check = await resp.json() as { needsClarification: boolean; questions: ClarificationQuestion[] };
      if (check.needsClarification && check.questions.length > 0) {
        setClarifyQuestions(check.questions);
        setClarifyAnswers({});
        setPhase('clarifying');
      } else {
        setPhase('results');
      }
    } catch {
      setPhase('results');
    }
  }

  async function confirmAnswers() {
    const answers: ClarificationAnswer[] = clarifyQuestions.map(q => ({
      id: q.id,
      question: q.question,
      answer: clarifyAnswers[q.id] ?? '',
    })).filter(a => a.answer);
    // Re-run only not-found rows with enriched preferences
    const notFoundIndices = bomRows.map((r, i) => r.type === 'T' ? i : -1).filter(i => i >= 0);
    const notFoundInputRows = notFoundIndices.map(i => rows[i]);
    const answerLines = answers.map(a => `${a.question}: ${a.answer}`).join('\n');
    const enrichedPrefs = [preferences, `\n[Upřesnění od uživatele]\n${answerLines}`].filter(Boolean).join('\n');
    setPhase('processing');
    setTotalCount(notFoundInputRows.length);
    setProcessedCount(0);
    setProgressItems(notFoundInputRows.map((r, i) => ({
      rowIndex: i, total: notFoundInputRows.length,
      typoveOznaceni: r.typoveOznaceni || r.altTypoveOznaceni,
      status: 'waiting' as const,
    })));
    try {
      const response = await fetch(`${BACKEND_URL}/api/bom-build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: notFoundInputRows.map(r => ({ typoveOznaceni: r.typoveOznaceni, altTypoveOznaceni: r.altTypoveOznaceni, popis: r.popis, vyrobce: r.vyrobce, pocet: r.pocet, oznaceniPristroje: r.oznaceniPristroje })), preferences: enrichedPrefs, produktovaHierarchie, artiklVrcholu, answers }),
      });
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', eventType = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); }
          else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'progress') {
                if (data.status === 'knowledge') {
                  setProgressItems(prev => [...prev, data as ProgressItem]);
                } else {
                  setProgressItems(prev => { const next = [...prev]; if (data.rowIndex < next.length) next[data.rowIndex] = { ...next[data.rowIndex], ...data }; return next; });
                  if (data.status === 'found' || data.status === 'not_found' || data.status === 'skipped') setProcessedCount(c => c + 1);
                }
              } else if (eventType === 'result') {
                // Merge refined results back into original bomRows/toCreate
                const newBomRows = [...bomRows];
                (data.bomRows as BomResultRow[]).forEach((refined, idx) => { newBomRows[notFoundIndices[idx]] = refined; });
                setBomRows(newBomRows);
                setToCreate(data.toCreate ?? []);
                setPhase('results');
              }
            } catch { /* ignore */ }
            eventType = '';
          }
        }
      }
    } catch {
      setPhase('results');
    }
  }

  // ── input phase ──────────────────────────────────────────────────────────────

  if (phase === 'input') {
    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-xl px-4 py-3 text-red text-sm">{error}</div>
        )}

        <InputTable rows={rows} onChange={setRows} />

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-sm font-medium text-text">Pokyny pro AI</label>
            <textarea
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder="Např.: Preferuj artikly bez zákaznického prefixu nebo sufixu."
              rows={3}
              className="w-full px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">
              Produktová hierarchie
              <span className="ml-1.5 text-overlay0 font-normal text-xs">(pro tabulku k založení)</span>
            </label>
            <input
              type="text"
              value={produktovaHierarchie}
              onChange={e => setProduktova(e.target.value)}
              placeholder="např. 12-35-10"
              className="w-full px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">
              Artikl vrcholu
              <span className="ml-1.5 text-overlay0 font-normal text-xs">(pro poznámku v tabulce k založení)</span>
            </label>
            <input
              type="text"
              value={artiklVrcholu}
              onChange={e => setArtiklVrcholu(e.target.value)}
              placeholder="např. 1234-5678"
              className="w-full px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent font-mono"
            />
          </div>

          <div className="flex items-end gap-3">
            <button
              onClick={submit}
              disabled={activeRows.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-medium bg-mauve text-crust hover:bg-pink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={16} />
              Spustit ({activeRows.length} {activeRows.length === 1 ? 'položka' : activeRows.length < 5 ? 'položky' : 'položek'})
            </button>
            {history.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setHistoryOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-subtext1 hover:text-text hover:bg-surface1 transition-colors border border-surface2"
                >
                  Nedávné ({history.length})
                </button>
                {historyOpen && (
                  <div className="absolute bottom-full mb-1 left-0 z-20 bg-mantle border border-surface1 rounded-xl shadow-xl min-w-72 overflow-hidden">
                    {history.map((entry, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setRows(entry.rows.map(r => ({ ...r, id: `ir-${++rowIdCtr}` })));
                          setPreferences(entry.preferences);
                          setProduktova(entry.produktovaHierarchie);
                          setArtiklVrcholu(entry.artiklVrcholu);
                          setBomRows(entry.bomRows);
                          setToCreate(entry.toCreate);
                          setResultProdHier(entry.produktovaHierarchie);
                          setResultArtiklVrcholu(entry.artiklVrcholu);
                          setResultTab('bom');
                          setHistoryOpen(false);
                          setPhase('results');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-subtext1 hover:bg-surface1 hover:text-text transition-colors border-b border-surface1 last:border-b-0"
                      >
                        <span className="text-overlay0 mr-2">{i + 1}.</span>
                        {entry.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── post_check phase ─────────────────────────────────────────────────────────

  if (phase === 'post_check') {
    return (
      <div className="bg-mantle border border-surface1 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-mauve shrink-0" />
        <div>
          <p className="text-text font-medium text-sm">Vyhodnocuji výsledky…</p>
          <p className="text-overlay0 text-xs">AI kontroluje zda by upřesnění pomohlo.</p>
        </div>
      </div>
    );
  }

  // ── clarifying phase (post-search) ───────────────────────────────────────────

  if (phase === 'clarifying') {
    const allAnswered = clarifyQuestions.every(q => clarifyAnswers[q.id]?.trim());
    const notFoundCount = bomRows.filter(r => r.type === 'T').length;
    return (
      <div className="bg-mantle border border-surface1 rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <MessageCircle size={18} className="text-mauve shrink-0 mt-0.5" />
          <div>
            <p className="text-text font-medium text-sm">
              AI má pár otázek k {notFoundCount} nenalezeným položkám
            </p>
            <p className="text-overlay0 text-xs mt-0.5">
              Odpovědi pomůžou zlepšit výsledky. Volitelné — můžeš přeskočit.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {clarifyQuestions.map((q, qi) => (
            <div key={q.id} className="space-y-2">
              <p className="text-sm text-text font-medium">
                <span className="text-overlay0 mr-1.5">{qi + 1}.</span>
                {q.question}
              </p>
              {q.type === 'choice' && q.choices && q.choices.length > 0 ? (
                <div className="space-y-1.5 pl-4">
                  {q.choices.map(choice => (
                    <label key={choice} className="flex items-center gap-2.5 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        clarifyAnswers[q.id] === choice ? 'border-mauve bg-mauve' : 'border-surface2 group-hover:border-mauve/50'
                      }`}>
                        {clarifyAnswers[q.id] === choice && <div className="w-1.5 h-1.5 rounded-full bg-crust" />}
                      </div>
                      <input type="radio" name={q.id} value={choice} checked={clarifyAnswers[q.id] === choice}
                        onChange={() => setClarifyAnswers(prev => ({ ...prev, [q.id]: choice }))} className="sr-only" />
                      <span className={`text-sm transition-colors ${clarifyAnswers[q.id] === choice ? 'text-text' : 'text-subtext1 group-hover:text-text'}`}>{choice}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input type="text" value={clarifyAnswers[q.id] ?? ''}
                  onChange={e => setClarifyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Vaše odpověď…"
                  className="w-full px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent" />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={confirmAnswers} disabled={!allAnswered}
            className="flex items-center gap-2 px-5 py-2 rounded-xl font-medium bg-mauve text-crust hover:bg-pink disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
            <Play size={14} /> Znovu prohledat nenalezené
          </button>
          <button onClick={() => setPhase('results')}
            className="px-4 py-2 rounded-xl text-sm text-subtext1 hover:text-text hover:bg-surface1 transition-colors">
            Přeskočit — zobrazit výsledky
          </button>
        </div>
      </div>
    );
  }

  // ── processing phase ─────────────────────────────────────────────────────────

  if (phase === 'processing') {
    return (
      <div className="space-y-4">
        <div className="bg-mantle border border-surface1 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-mauve shrink-0" />
            <div className="flex-1">
              <p className="text-text font-medium text-sm">AI agent vyhledává položky…</p>
              <p className="text-overlay0 text-xs">{processedCount} / {totalCount} zpracováno</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-surface1 rounded-full h-1.5">
            <div
              className="bg-mauve h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (processedCount / totalCount) * 100 : 0}%` }}
            />
          </div>

          {/* Row-by-row status */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {progressItems.map((item, i) => (
              item.status === 'knowledge' ? (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5 text-teal">
                  <BookOpen size={10} className="shrink-0" />
                  <span className="flex-1">Načítám znalosti: {item.mfrName ?? item.typoveOznaceni}</span>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  <StatusIcon status={item.status} />
                  <span className="font-mono text-subtext1 flex-1 truncate">
                    {item.typoveOznaceni || <span className="text-overlay0">—</span>}
                  </span>
                  <span className={`text-xs shrink-0 ${
                    item.status === 'found' ? 'text-green'
                    : item.status === 'not_found' ? 'text-red'
                    : item.status === 'searching' ? 'text-mauve'
                    : 'text-overlay0'
                  }`}>
                    {item.status === 'found' ? 'nalezeno'
                    : item.status === 'not_found' ? 'k založení'
                    : item.status === 'searching' ? 'hledám…'
                    : item.status === 'skipped' ? 'přeskočeno'
                    : ''}
                  </span>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── results phase ────────────────────────────────────────────────────────────

  const foundCount = bomRows.filter(r => r.type === 'L').length;
  const notFoundCount = toCreate.length;

  return (
    <div className="space-y-4">
      {/* Summary + actions */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-green">
            <Check size={14} /> {foundCount} nalezeno
          </span>
          {notFoundCount > 0 && (
            <span className="flex items-center gap-1.5 text-red">
              <X size={14} /> {notFoundCount} k založení
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onOpenInZbom && bomRows.length > 0 && (
            <button
              onClick={() => onOpenInZbom(buildImportResult(bomRows))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text transition-colors"
            >
              <ChevronRight size={13} /> Otevřít kusovník v editoru
            </button>
          )}
          {toCreate.length > 0 && (
            <button
              onClick={() => exportKzalozeniCsv(toCreate, resultProdHier, resultArtiklVrcholu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text transition-colors"
            >
              <Download size={13} /> Export k založení (.csv)
            </button>
          )}
          <button
            onClick={() => { setPhase('input'); setError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text transition-colors"
          >
            Nový kusovník
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-surface0 rounded-xl p-0.5 gap-0.5 w-fit">
        <button
          onClick={() => setResultTab('bom')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            resultTab === 'bom' ? 'bg-mauve text-crust shadow' : 'text-subtext1 hover:text-text'
          }`}
        >
          Kusovník ({bomRows.length})
        </button>
        <button
          onClick={() => setResultTab('create')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            resultTab === 'create' ? 'bg-mauve text-crust shadow' : 'text-subtext1 hover:text-text'
          }`}
        >
          K založení ({toCreate.length})
        </button>
      </div>

      {resultTab === 'bom' && <BomTable rows={bomRows} />}
      {resultTab === 'create' && (
        <KzalozeniTable
          rows={toCreate}
          produktovaHierarchie={resultProdHier}
          artiklVrcholu={resultArtiklVrcholu}
        />
      )}
    </div>
  );
}
