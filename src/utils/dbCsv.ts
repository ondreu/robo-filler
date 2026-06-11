// CSV import/export pro admin databáze. Oddělovač ';' (Excel CZ), UTF-8 s BOM.
import type { DbColumn, DbRow } from './dbSchema';
import { coerceCell } from './dbSchema';

function needsQuote(field: string, sep: string): boolean {
  return field.includes(sep) || field.includes('"') || field.includes('\n') || field.includes('\r');
}

function escapeField(value: unknown, sep: string): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (needsQuote(s, sep)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: DbRow[], columns: DbColumn[], sep = ';'): string {
  const header = columns.map(c => escapeField(c.key, sep)).join(sep);
  const body = rows.map(r => columns.map(c => escapeField(r?.[c.key], sep)).join(sep));
  return '﻿' + [header, ...body].join('\r\n');
}

export function rowsToJson(rows: DbRow[]): string {
  return JSON.stringify(rows, null, 2);
}

// Robustní CSV parser (zvládá uvozovky, escapované "" a víceřádková pole).
function parseCsvText(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  // Odstraň BOM
  if (text.charCodeAt(0) === 0xFEFF) i = 1;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
      else if (ch === '\r') { /* skip, \n zpracuje konec */ }
      else field += ch;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

export interface CsvImportResult {
  headers: string[];
  rows: DbRow[];
}

// Naparsuje CSV; hodnoty se přiřadí dle hlavičky. Typy se odvodí podle schématu
// (number coerce), neznámé sloupce se zachovají jako text.
export function parseCsv(text: string, columns: DbColumn[]): CsvImportResult {
  const sep = (() => {
    const firstLine = text.split(/\r?\n/)[0] ?? '';
    const semis = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;
    return semis >= commas ? ';' : ',';
  })();

  const matrix = parseCsvText(text, sep);
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = matrix[0].map(h => h.trim());
  const typeByKey = new Map(columns.map(c => [c.key, c.type]));

  const rows: DbRow[] = matrix.slice(1).map(cells => {
    const obj: DbRow = {};
    headers.forEach((h, idx) => {
      const raw = (cells[idx] ?? '').trim();
      const type = typeByKey.get(h) ?? 'text';
      obj[h] = coerceCell(raw, type);
    });
    return obj;
  });

  return { headers, rows };
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
