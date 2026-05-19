import * as XLSX from 'xlsx';
import type { BomRow, BomHeader } from '../types';

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

export function exportZbomTxt(header: BomHeader, rows: BomRow[]): void {
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
      String(row.mnozstvi),
      row.type,
      row.poznamka1,
      row.poznamka2,
    ].join('\t')
  );

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${header.cisloVrcholu}.txt`);
}

export function exportZbomExcel(header: BomHeader, rows: BomRow[]): void {
  const colHeaders = [
    'Pořadí', 'L/T', 'Artikl', 'Popis artiklu', 'Typové označení',
    'Množství', 'Poznámka 1', 'Poznámka 2',
  ];

  const dataRows = rows.map((row, i) => [
    orderLabel(i),
    row.type,
    row.type === 'T' ? '' : row.artikl,
    row.popis,
    row.typoveOznaceni,
    row.mnozstvi,
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
