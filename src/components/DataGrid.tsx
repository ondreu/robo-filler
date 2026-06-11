import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { DbRow, ColumnType } from '../utils/dbSchema';

export interface GridCol {
  key: string;
  label: string;
  type: ColumnType;
  note?: boolean;       // admin poznámka (interní)
}

interface Cell { r: number; c: number }

interface DataGridProps {
  columns: GridCol[];
  pageRows: { row: DbRow; idx: number }[];
  /** absolutní offset prvního řádku stránky (pro číslování) */
  pageOffset: number;
  onCellChange: (absIdx: number, key: string, value: string) => void;
  onDeleteRow: (absIdx: number) => void;
  onDuplicateRow: (absIdx: number) => void;
  /** přetečení vkládání pod poslední řádek → přidat nové řádky */
  onAppendRows: (rows: DbRow[]) => void;
  /** klíč, jehož změna resetuje výběr (např. dbName-page-query) */
  resetKey: string;
}

function cellText(row: DbRow, key: string): string {
  const v = row?.[key];
  return v === null || v === undefined ? '' : String(v);
}

export function DataGrid({
  columns, pageRows, pageOffset, onCellChange, onDeleteRow, onDuplicateRow, onAppendRows, resetKey,
}: DataGridProps) {
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell | null>(null);
  const [editing, setEditing] = useState<Cell | null>(null);
  const draggingRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Reset výběru při změně stránky / databáze / filtru
  useEffect(() => { setAnchor(null); setFocus(null); setEditing(null); }, [resetKey]);

  useEffect(() => {
    const up = () => { draggingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const inSel = useCallback((r: number, c: number) => {
    if (!anchor || !focus) return false;
    const r1 = Math.min(anchor.r, focus.r), r2 = Math.max(anchor.r, focus.r);
    const c1 = Math.min(anchor.c, focus.c), c2 = Math.max(anchor.c, focus.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  }, [anchor, focus]);

  const isActive = (r: number, c: number) => focus?.r === r && focus?.c === c;

  const startSel = (r: number, c: number, extend: boolean) => {
    wrapRef.current?.focus({ preventScroll: true });
    if (extend && anchor) { setFocus({ r, c }); }
    else { setAnchor({ r, c }); setFocus({ r, c }); }
  };

  const commitEdit = (r: number, c: number, value: string) => {
    const absIdx = pageRows[r]?.idx;
    if (absIdx !== undefined) onCellChange(absIdx, columns[c].key, value);
  };

  // ── Clipboard ─────────────────────────────────────────────────────────────

  const selRect = () => {
    if (!anchor || !focus) return null;
    return {
      r1: Math.min(anchor.r, focus.r), r2: Math.max(anchor.r, focus.r),
      c1: Math.min(anchor.c, focus.c), c2: Math.max(anchor.c, focus.c),
    };
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    if (editing) return; // necháme input zkopírovat svůj text
    const rect = selRect();
    if (!rect) return;
    const lines: string[] = [];
    for (let r = rect.r1; r <= rect.r2; r++) {
      const cells: string[] = [];
      for (let c = rect.c1; c <= rect.c2; c++) cells.push(cellText(pageRows[r].row, columns[c].key));
      lines.push(cells.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\n'));
    e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (editing || !focus) return; // při editaci paste řeší input
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const matrix = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const startR = focus.r, startC = focus.c;
    const newRows: DbRow[] = [];
    matrix.forEach((cells, dr) => {
      const r = startR + dr;
      cells.forEach((val, dc) => {
        const c = startC + dc;
        if (c >= columns.length) return;
        if (r < pageRows.length) {
          commitEdit(r, c, val);
        } else {
          // přetečení pod stránku → nový řádek
          const ri = r - pageRows.length;
          if (!newRows[ri]) { newRows[ri] = {}; columns.forEach(col => { newRows[ri][col.key] = null; }); }
          newRows[ri][columns[c].key] = val === '' ? null : val;
        }
      });
    });
    if (newRows.length) onAppendRows(newRows.filter(Boolean));
  };

  const clearSelection = () => {
    const rect = selRect();
    if (!rect) return;
    for (let r = rect.r1; r <= rect.r2; r++)
      for (let c = rect.c1; c <= rect.c2; c++) commitEdit(r, c, '');
  };

  const move = (dr: number, dc: number, extend: boolean) => {
    if (!focus) return;
    const r = Math.max(0, Math.min(pageRows.length - 1, focus.r + dr));
    const c = Math.max(0, Math.min(columns.length - 1, focus.c + dc));
    if (extend && anchor) setFocus({ r, c });
    else { setAnchor({ r, c }); setFocus({ r, c }); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Escape') { setEditing(null); wrapRef.current?.focus(); }
      return;
    }
    if (!focus) return;
    const meta = e.ctrlKey || e.metaKey;
    if (meta) return; // copy/paste řeší onCopy/onPaste
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); move(-1, 0, e.shiftKey); break;
      case 'ArrowDown':  e.preventDefault(); move(1, 0, e.shiftKey); break;
      case 'ArrowLeft':  e.preventDefault(); move(0, -1, e.shiftKey); break;
      case 'ArrowRight':
      case 'Tab':        e.preventDefault(); move(0, 1, e.shiftKey); break;
      case 'Enter':      e.preventDefault(); setEditing({ ...focus }); break;
      case 'Delete':
      case 'Backspace':  e.preventDefault(); clearSelection(); break;
      default:
        // začni psát → edit mode (necháme znak propadnout do inputu přes defaultValue '')
        if (e.key.length === 1 && !e.altKey) {
          setEditing({ ...focus });
        }
    }
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      onPaste={handlePaste}
      className="overflow-x-auto focus:outline-none border-y border-surface1 select-none"
    >
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr className="bg-surface0 sticky top-0 z-10">
            <th className="px-2 py-2 text-overlay0 font-medium border-b border-surface2 w-10">#</th>
            {columns.map(c => (
              <th
                key={c.key}
                className={`px-2 py-2 text-left font-semibold border-b border-surface2 whitespace-nowrap ${
                  c.note ? 'text-yellow' : 'text-subtext1'
                }`}
              >
                {c.label}
              </th>
            ))}
            <th className="px-2 py-2 border-b border-surface2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map(({ row, idx }, r) => (
            <tr key={idx}>
              <td className="px-2 py-1 text-overlay0 font-mono bg-surface0/40 border-b border-surface1/40 text-center">
                {pageOffset + r + 1}
              </td>
              {columns.map((col, c) => {
                const active = isActive(r, c);
                const selected = inSel(r, c);
                const isEditing = editing?.r === r && editing?.c === c;
                return (
                  <td
                    key={col.key}
                    onMouseDown={e => {
                      if (isEditing) return;
                      e.preventDefault();
                      draggingRef.current = true;
                      startSel(r, c, e.shiftKey);
                    }}
                    onMouseEnter={() => { if (draggingRef.current) setFocus({ r, c }); }}
                    onDoubleClick={() => setEditing({ r, c })}
                    className={`border-b border-r border-surface1/40 p-0 ${
                      col.note ? 'bg-yellow/5' : ''
                    } ${selected ? 'bg-mauve/15' : ''} ${active ? 'outline outline-2 -outline-offset-2 outline-mauve' : ''}`}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={cellText(row, col.key)}
                        onFocus={e => e.target.select()}
                        onBlur={e => { commitEdit(r, c, e.target.value); setEditing(null); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { commitEdit(r, c, (e.target as HTMLInputElement).value); setEditing(null); wrapRef.current?.focus(); move(1, 0, false); }
                          else if (e.key === 'Escape') { setEditing(null); wrapRef.current?.focus(); }
                          else if (e.key === 'Tab') { e.preventDefault(); commitEdit(r, c, (e.target as HTMLInputElement).value); setEditing(null); wrapRef.current?.focus(); move(0, 1, false); }
                        }}
                        className={`w-full bg-surface0 text-text px-1.5 py-1 outline-none ${col.type === 'number' ? 'text-right font-mono' : ''}`}
                      />
                    ) : (
                      <div className={`px-1.5 py-1 truncate min-h-[26px] ${col.type === 'number' ? 'text-right font-mono' : ''} ${col.note ? 'text-yellow/90' : 'text-text'}`}>
                        {cellText(row, col.key) || ' '}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="px-1 py-0.5 whitespace-nowrap border-b border-surface1/40">
                <div className="flex items-center gap-1 justify-center">
                  <button onClick={() => onDuplicateRow(idx)} className="text-overlay1 hover:text-teal" title="Duplikovat"><Copy size={13} /></button>
                  <button onClick={() => onDeleteRow(idx)} className="text-overlay1 hover:text-red" title="Smazat řádek"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
