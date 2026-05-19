import * as XLSX from 'xlsx';
import type { BomRow, BomHeader } from '../types';

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
  const safe = header.cisloVrcholu.replace(/[^a-zA-Z0-9_-]/g, '_');
  triggerDownload(blob, `ZBOM_${safe}_${header.platnostOd}.txt`);
}

export function exportZbomExcel(header: BomHeader, rows: BomRow[]): void {
  const headerRow = [
    'Číslo vrcholu', 'Závod', 'Popis kusovníku', 'Status', 'Výrobní dispečer',
    'Platnost od (DDMMYYYY)', 'Pořadí', 'L/T', 'Artikl', 'Popis artiklu',
    'Typové označení', 'Množství', 'Poznámka 1', 'Poznámka 2',
  ];

  const dataRows = rows.map((row, i) => [
    header.cisloVrcholu,
    header.cisloZavodu,
    header.popis,
    header.status,
    header.vyrobniDispecer,
    header.platnostOd,
    i + 1,
    row.type,
    row.type === 'T' ? '' : row.artikl,
    row.popis,
    row.typoveOznaceni,
    row.mnozstvi,
    row.poznamka1,
    row.poznamka2,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, ws, 'ZBOM');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
  const safe = header.cisloVrcholu.replace(/[^a-zA-Z0-9_-]/g, '_');
  triggerDownload(blob, `ZBOM_${safe}_${header.platnostOd}.xlsx`);
}
