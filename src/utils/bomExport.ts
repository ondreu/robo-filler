import * as XLSX from 'xlsx';
import type { Article, BomRow, BomHeader, BomRowType } from '../types';

export function orderLabel(i: number): string {
  return String((i + 1) * 10).padStart(4, '0');
}

function s2ab(s: string): ArrayBuffer {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let importIdCounter = 0;
function genId(): string { return `imp${++importIdCounter}`; }

export type DecimalSep = '.' | ',';

function fmtNum(value: number, sep: DecimalSep): string {
  return sep === ',' ? String(value).replace('.', ',') : String(value);
}

export function exportZbomTxt(header: BomHeader, rows: BomRow[], sep: DecimalSep = '.'): void {
  const lines = rows.map(row =>
    [
      header.cisloVrcholu,
      header.cisloZavodu,
      '1',
      header.platnostOd,
      header.popis,
      '1',
      header.status,
      header.vyrobniDispecer,
      row.type === 'T' ? '' : row.artikl,
      fmtNum(row.mnozstvi, sep),
      row.type,
      row.poznamka1,
      row.poznamka2,
    ].join('\t')
  );

  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${header.cisloVrcholu}.txt`);
}

export function exportZbomExcel(header: BomHeader, rows: BomRow[], sep: DecimalSep = '.'): void {
  const colHeaders = [
    'Pořadí', 'L/T', 'Artikl', 'Popis artiklu', 'Typové označení',
    'Množství', 'Poznámka 1', 'Poznámka 2',
  ];

  const dataRows = rows.map((row, i) => [
    orderLabel(i),
    row.type,
    row.type === 'T' ? '' : row.artikl,
    row.type === 'T' ? row.poznamka1 : row.popis,
    row.typoveOznaceni,
    sep === '.' ? row.mnozstvi : fmtNum(row.mnozstvi, sep),
    row.poznamka1,
    row.poznamka2,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([colHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, ws, 'ZBOM');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
  triggerDownload(blob, `${header.cisloVrcholu}.xlsx`);
}

export interface ImportResult {
  header: BomHeader;
  rows: BomRow[];
}

export function parseBomTxt(text: string, articles: Article[]): ImportResult | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return null;

  const first = lines[0].split('\t');
  if (first.length < 11) return null;

  const header: BomHeader = {
    cisloVrcholu: first[0] ?? '',
    cisloZavodu: first[1] ?? '6000',
    platnostOd: first[3] ?? '',
    popis: first[4] ?? '',
    status: first[6] ?? '01',
    vyrobniDispecer: first[7] ?? '',
  };

  const articleMap = new Map(articles.map(a => [a.artikl, a]));

  const rows: BomRow[] = lines.map(line => {
    const cols = line.split('\t');
    const type: BomRowType = cols[10]?.trim() === 'T' ? 'T' : 'L';
    const artikl = cols[8]?.trim() ?? '';
    const mnozstvi = parseFloat(cols[9] ?? '1') || 1;
    const poznamka1 = cols[11]?.trim() ?? '';
    const poznamka2 = cols[12]?.trim() ?? '';

    let popis = '';
    let typoveOznaceni = '';

    if (type === 'L' && artikl) {
      const found = articleMap.get(artikl);
      if (found) {
        popis = found.nazev;
        typoveOznaceni = found.typoveOznaceni;
      }
    }

    return { id: genId(), type, artikl, popis, typoveOznaceni, mnozstvi, poznamka1, poznamka2 };
  });

  return { header, rows };
}
