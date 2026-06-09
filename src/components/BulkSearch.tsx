import { useState, useRef, useCallback } from 'react';
import { Loader2, Download, ClipboardList, Zap, Eye, EyeOff, Plus, Trash2, X, FileDown } from 'lucide-react';
import type { Article, SearchResult, BulkQueryResult } from '../types';
import { search } from '../utils/searchEngine';
import { exportBulkCSV } from '../utils/excelHandler';
import { SelectableCard } from './SelectableCard';

interface BulkSearchProps {
  articles: Article[];
  onOpenInZbom?: (bulkResults: BulkQueryResult[], selections: Record<number, SearchResult | null>) => void;
}

// ── input row type ────────────────────────────────────────────────────────────

interface BulkInputRow {
  id: string;
  popis: string;
  vyrobce: string;
  typoveOznaceni: string;
  altTypoveOznaceni: string;
  pocet: number;
  oznaceniPristroje: string;
}

let rowIdCtr = 0;
function newBulkRow(): BulkInputRow {
  return { id: `br-${++rowIdCtr}`, popis: '', vyrobce: '', typoveOznaceni: '', altTypoveOznaceni: '', pocet: 1, oznaceniPristroje: '' };
}
function initRows(): BulkInputRow[] { return [newBulkRow(), newBulkRow(), newBulkRow()]; }

const INPUT_COLS = ['popis', 'vyrobce', 'typoveOznaceni', 'altTypoveOznaceni', 'pocet', 'oznaceniPristroje'] as const;

const thCls = 'px-2 py-2 font-medium text-left border-r border-surface1 last:border-r-0 whitespace-nowrap text-xs text-overlay1';
const tdCls = 'border-r border-surface1 last:border-r-0 p-0';
const inputCls = 'w-full px-2 py-1.5 bg-transparent text-text text-xs placeholder:text-overlay0 focus:outline-none focus:bg-surface1/40 rounded transition-colors';

// ── input table ───────────────────────────────────────────────────────────────

function InputTable({ rows, onChange }: { rows: BulkInputRow[]; onChange: (rows: BulkInputRow[]) => void }) {
  const update = (id: string, field: keyof BulkInputRow, value: string | number) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const remove = (id: string) => onChange(rows.filter(r => r.id !== id));
  const add = () => onChange([...rows, newBulkRow()]);
  const clear = () => onChange(initRows());

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
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines;
    if (lines.length <= 1 && !text.includes('\t')) return;
    e.preventDefault();

    const grid = lines.map(l => l.split('\t'));
    const updated = [...rows];
    for (let r = 0; r < grid.length; r++) {
      const ri = rowIndex + r;
      while (updated.length <= ri) updated.push(newBulkRow());
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
              ref: (el: HTMLInputElement | null) => { if (!inputRefs.current[ri]) inputRefs.current[ri] = []; inputRefs.current[ri][ci] = el; },
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
        <button onClick={add} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-subtext1 hover:text-text hover:bg-surface1 transition-colors">
          <Plus size={12} /> Přidat řádek
        </button>
        <button onClick={clear} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-overlay0 hover:text-red hover:bg-surface1 transition-colors ml-auto">
          <Trash2 size={12} /> Vyčistit
        </button>
      </div>
    </div>
  );
}

// ── export k-zalozeni dialog ──────────────────────────────────────────────────

interface ExportDialogProps {
  unmatchedCount: number;
  onClose: () => void;
  onExport: (data: { prodHier: string; artiklVrcholu: string; unit: string }) => void;
}

function ExportDialog({ unmatchedCount, onClose, onExport }: ExportDialogProps) {
  const [prodHier, setProdHier] = useState('');
  const [artiklVrcholu, setArtiklVrcholu] = useState('');
  const [unit, setUnit] = useState('PC');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-base rounded-2xl w-full max-w-md shadow-2xl border border-surface1" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-surface1">
          <div>
            <h2 className="text-text font-semibold text-base">Export materiálů k založení</h2>
            <p className="text-overlay0 text-xs mt-0.5">{unmatchedCount} {unmatchedCount === 1 ? 'nenalezená položka' : unmatchedCount < 5 ? 'nenalezené položky' : 'nenalezených položek'}</p>
          </div>
          <button onClick={onClose} className="text-overlay1 hover:text-text transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">
              Produktová hierarchie <span className="text-red">*</span>
            </label>
            <input
              type="text"
              value={prodHier}
              onChange={e => setProdHier(e.target.value)}
              placeholder="např. 12-35-10"
              autoFocus
              className="w-full px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text flex items-center gap-2">
              Artikl vrcholu
              <span className="text-overlay0 font-normal text-xs">(volitelné — pro Poznámku)</span>
            </label>
            <input
              type="text"
              value={artiklVrcholu}
              onChange={e => setArtiklVrcholu(e.target.value)}
              placeholder="např. 1234-5678 — nebo prázdné pro přeskočení"
              className="w-full px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent font-mono"
            />
            <p className="text-overlay0 text-xs">
              Prázdné = Poznámka bude jen označení přístroje. Vyplněné = „artikl_označení přístroje".
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Základní jednotka</label>
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value.toUpperCase())}
              placeholder="PC"
              className="w-24 px-3 py-2 bg-surface0 border border-surface2 rounded-xl text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent font-mono"
              maxLength={5}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-surface1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-subtext1 hover:text-text hover:bg-surface1 transition-all text-sm">
            Zrušit
          </button>
          <button
            onClick={() => onExport({ prodHier, artiklVrcholu, unit: unit.trim() || 'PC' })}
            disabled={!prodHier.trim()}
            className="flex items-center gap-2 px-6 py-2 rounded-xl font-medium bg-mauve text-crust hover:bg-mauve/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
          >
            <Download size={14} />
            Exportovat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── export helper ─────────────────────────────────────────────────────────────

function exportKzalozeniCsv(
  bulkResults: BulkQueryResult[],
  selections: Record<number, SearchResult | null>,
  prodHier: string,
  artiklVrcholu: string,
  unit: string,
) {
  const headers = [
    'Název', 'Výrobce', 'Typové označení', '', '',
    'Základní jednotka', 'Produktová hierarchie',
    'Kanban', 'Výstupní kontrola', 'Artikl zákazníka', 'EAN', 'Poznámka',
  ];

  const dataRows = bulkResults
    .filter((_, i) => !selections[i])
    .map(r => {
      const poznamka = artiklVrcholu
        ? [artiklVrcholu, r.oznaceniPristroje].filter(Boolean).join('_')
        : (r.oznaceniPristroje ?? '');
      return [
        r.popis ?? '', r.vyrobce ?? '', r.query, '', '',
        unit, prodHier,
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

// ── main component ────────────────────────────────────────────────────────────

const COLS = 3;

export function BulkSearch({ articles, onOpenInZbom }: BulkSearchProps) {
  const [inputRows, setInputRows] = useState<BulkInputRow[]>(initRows);
  const [topN, setTopN] = useState<3 | 6 | 9>(3);
  const [bulkResults, setBulkResults] = useState<BulkQueryResult[]>([]);
  const [selections, setSelections] = useState<Record<number, SearchResult | null>>({});
  const [perRowVisible, setPerRowVisible] = useState<Record<number, number>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hideSelected, setHideSelected] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const activeRows = inputRows.filter(r => r.typoveOznaceni.trim() || r.altTypoveOznaceni.trim());
  const selectionCount = Object.values(selections).filter(v => v != null).length;
  const unmatchedCount = hasSearched ? bulkResults.filter((_, i) => !selections[i]).length : 0;

  const getVisible = (rowIndex: number) => perRowVisible[rowIndex] ?? topN;

  const handleSearch = () => {
    if (activeRows.length === 0 || articles.length === 0) return;
    setIsSearching(true);
    setSelections({});
    setPerRowVisible({});
    setHasSearched(false);
    setHideSelected(false);

    setTimeout(() => {
      const fetchCount = topN * 4;
      const cache = new Map<string, SearchResult[]>();

      const doSearch = (q: string): SearchResult[] => {
        const key = q.toLowerCase();
        if (!cache.has(key)) {
          cache.set(key, search(articles, { mode: 'combined', field: 'all', query: q, maxResults: fetchCount }));
        }
        return cache.get(key)!;
      };

      const results: BulkQueryResult[] = activeRows.map(row => {
        const primary = row.typoveOznaceni.trim();
        const alt = row.altTypoveOznaceni.trim();

        if (primary) {
          const primaryResults = doSearch(primary);
          if (primaryResults.length > 0 || !alt) {
            return { query: primary, altQuery: alt || undefined, pocet: row.pocet, oznaceniPristroje: row.oznaceniPristroje, popis: row.popis, vyrobce: row.vyrobce, results: primaryResults, usedAlt: false };
          }
          return { query: primary, altQuery: alt, pocet: row.pocet, oznaceniPristroje: row.oznaceniPristroje, popis: row.popis, vyrobce: row.vyrobce, results: doSearch(alt), usedAlt: true };
        } else {
          return { query: alt, pocet: row.pocet, oznaceniPristroje: row.oznaceniPristroje, popis: row.popis, vyrobce: row.vyrobce, results: doSearch(alt), usedAlt: false };
        }
      });

      setBulkResults(results);
      setHasSearched(true);
      setIsSearching(false);
    }, 0);
  };

  const handleShowMore = (rowIndex: number) => {
    setPerRowVisible(prev => ({ ...prev, [rowIndex]: getVisible(rowIndex) + 3 }));
  };

  const handleAutoSelect = () => {
    setSelections(prev => {
      const next = { ...prev };
      bulkResults.forEach((row, rowIndex) => {
        const exact = row.results.filter(r => r.score === 100);
        if (exact.length === 1) next[rowIndex] = exact[0];
      });
      return next;
    });
  };

  const handleSelect = (rowIndex: number, result: SearchResult) => {
    setSelections(prev => {
      if (prev[rowIndex]?.artikl === result.artikl) {
        return { ...prev, [rowIndex]: null };
      }
      return { ...prev, [rowIndex]: result };
    });
  };

  return (
    <div className="space-y-6">
      {/* Input panel */}
      <div className="bg-mantle rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-text font-medium text-sm">
            Seznam artiklů k vyhledání
          </label>
          <p className="text-overlay1 text-xs">
            Zadejte typová označení — nebo zkopírujte více sloupců z Excelu (Popis, Výrobce, Typové označení, Alt. označení, Počet, Označení přístroje)
          </p>
        </div>

        <InputTable rows={inputRows} onChange={setInputRows} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-subtext1 text-sm">Počet shod na výraz:</span>
            <div className="flex bg-surface0 rounded-xl p-1 gap-1">
              {([3, 6, 9] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                    topN === n
                      ? 'bg-mauve text-crust shadow'
                      : 'text-subtext1 hover:text-text'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeRows.length > 0 && (
              <span className="text-overlay1 text-xs">
                {activeRows.length} {activeRows.length === 1 ? 'výraz' : activeRows.length < 5 ? 'výrazy' : 'výrazů'}
              </span>
            )}
            <button
              onClick={handleSearch}
              disabled={activeRows.length === 0 || isSearching}
              className="px-6 py-2 rounded-xl font-medium transition-all bg-mauve text-crust
                hover:bg-mauve/80 disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              Vyhledat
            </button>
          </div>
        </div>
      </div>

      {/* Spinner */}
      {isSearching && (
        <div className="bg-mantle rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
          <Loader2 className="text-mauve animate-spin" size={40} />
          <p className="text-subtext1">
            {(() => {
              const unique = new Set(activeRows.map(r => (r.typoveOznaceni || r.altTypoveOznaceni).toLowerCase())).size;
              return unique < activeRows.length
                ? `Vyhledávám ${activeRows.length} výrazů (${unique} unikátních)...`
                : `Vyhledávám ${activeRows.length} výrazů...`;
            })()}
          </p>
        </div>
      )}

      {/* Results */}
      {hasSearched && !isSearching && (
        <div className="space-y-4">
          {/* Summary + export toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-subtext1 text-sm">
              {selectionCount > 0
                ? `${selectionCount} z ${bulkResults.length} označeno${hideSelected ? ` · ${selectionCount} skryto` : ''}${unmatchedCount > 0 ? ` · ${unmatchedCount} nenalezeno` : ''}`
                : `${bulkResults.length} výsledků — klikněte na kartu pro označení`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAutoSelect}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                  bg-green/10 text-green hover:bg-green/20 border border-green/30"
                title="Automaticky zaškrtne výrazy s přesně jednou 100% shodou"
              >
                <Zap size={16} />
                Auto 100 %
              </button>
              <button
                onClick={() => setHideSelected(h => !h)}
                disabled={selectionCount === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed ${
                  hideSelected
                    ? 'bg-yellow/10 text-yellow hover:bg-yellow/20 border border-yellow/30'
                    : 'bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text'
                }`}
                title={hideSelected ? 'Zobrazit zaškrtnuté řádky' : 'Skrýt zaškrtnuté řádky'}
              >
                {hideSelected ? <Eye size={16} /> : <EyeOff size={16} />}
                {hideSelected ? 'Zobrazit vše' : 'Skrýt zaškrtnuté'}
              </button>
              <button
                onClick={() => exportBulkCSV(bulkResults, selections)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                  bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text"
                title="Exportovat do CSV"
              >
                <Download size={16} />
                Export CSV
              </button>
              <button
                onClick={() => setExportDialogOpen(true)}
                disabled={unmatchedCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                  bg-peach/10 text-peach hover:bg-peach/20 border border-peach/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Exportovat nenalezené položky pro K-Založení"
              >
                <FileDown size={16} />
                K založení ({unmatchedCount})
              </button>
              <button
                onClick={() => onOpenInZbom?.(bulkResults, selections)}
                disabled={!onOpenInZbom}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                  bg-mauve/10 text-mauve hover:bg-mauve/20 border border-mauve/30 disabled:opacity-40"
                title="Otevřít tabulkové zpracování kusovníku"
              >
                <ClipboardList size={16} />
                Tabulkové zpracování
              </button>
            </div>
          </div>

          {/* Row results */}
          {bulkResults
            .map((row, rowIndex) => ({ row, rowIndex }))
            .filter(({ rowIndex }) => !hideSelected || selections[rowIndex] == null)
            .map(({ row, rowIndex }) => {
              const isRowSelected = selections[rowIndex] != null;
              const visible = row.results.slice(0, getVisible(rowIndex));
              const canShowMore = getVisible(rowIndex) < row.results.length;

              const lastRowStart = visible.length > 0
                ? Math.floor((visible.length - 1) / COLS) * COLS
                : 0;
              const prevRowCards = visible.slice(0, lastRowStart);
              const lastRowCards = visible.slice(lastRowStart);

              return (
                <div
                  key={rowIndex}
                  className={`rounded-2xl p-4 border-l-4 transition-colors ${
                    isRowSelected
                      ? 'bg-mauve/5 border-l-mauve border border-mauve/30'
                      : row.usedAlt
                      ? 'bg-peach/5 border-l-peach border border-peach/20'
                      : 'bg-mantle border-l-surface2'
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-overlay1 bg-surface0 rounded-lg px-2 py-0.5 font-mono">
                        #{rowIndex + 1}
                      </span>
                      <span className="text-mauve font-semibold">{row.query}</span>
                      {row.usedAlt && (
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-peach/15 text-peach border border-peach/20">
                          Alt: {row.altQuery}
                        </span>
                      )}
                      {(row.pocet ?? 1) > 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface1 text-subtext1 font-mono">
                          ×{row.pocet}
                        </span>
                      )}
                      {row.oznaceniPristroje && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface1 text-overlay1 font-mono">
                          {row.oznaceniPristroje}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-xl ${
                        isRowSelected
                          ? selections[rowIndex]!.vybehovyDil
                            ? 'bg-peach/20 text-peach'
                            : 'bg-mauve/20 text-mauve'
                          : 'bg-surface0 text-overlay1'
                      }`}
                    >
                      {isRowSelected
                        ? `✓ ${selections[rowIndex]!.vybehovyDil || selections[rowIndex]!.artikl}`
                        : 'Nic nevybráno'}
                    </span>
                  </div>

                  {/* Candidate cards */}
                  {row.results.length === 0 ? (
                    <div className="bg-surface0 rounded-xl p-4 text-center">
                      <p className="text-overlay1 text-sm">Žádné výsledky</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {prevRowCards.length > 0 && (
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                          {prevRowCards.map((result, cardIndex) => (
                            <SelectableCard
                              key={`${result.artikl}-${cardIndex}`}
                              result={result}
                              selected={selections[rowIndex]?.artikl === result.artikl}
                              onSelect={() => handleSelect(rowIndex, result)}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col md:flex-row gap-3 items-stretch">
                        {lastRowCards.map((result, i) => (
                          <div key={`${result.artikl}-last-${i}`} className="flex-1 min-w-0">
                            <SelectableCard
                              result={result}
                              selected={selections[rowIndex]?.artikl === result.artikl}
                              onSelect={() => handleSelect(rowIndex, result)}
                            />
                          </div>
                        ))}
                        {canShowMore && (
                          <button
                            onClick={() => handleShowMore(rowIndex)}
                            className="flex-shrink-0 md:w-8 flex items-center justify-center
                              bg-surface0 hover:bg-surface1 text-mauve font-bold text-3xl
                              rounded-2xl border-2 border-surface2 hover:border-mauve
                              transition-all cursor-pointer py-4 md:py-0 shadow"
                            title="Zobrazit další 3 výsledky"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Export dialog */}
      {exportDialogOpen && (
        <ExportDialog
          unmatchedCount={unmatchedCount}
          onClose={() => setExportDialogOpen(false)}
          onExport={({ prodHier, artiklVrcholu, unit }) => {
            exportKzalozeniCsv(bulkResults, selections, prodHier, artiklVrcholu, unit);
            setExportDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
