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

// Windows-1250 high-byte map (code points 0x80–0xFF → Unicode)
// Index 0 = CP1250 byte 0x80, index 127 = byte 0xFF
const CP1250_HI: number[] = [
  0x20AC,0x0081,0x201A,0x0083,0x201E,0x2026,0x2020,0x2021,
  0x0088,0x2030,0x0160,0x2039,0x015A,0x0164,0x017D,0x0179,
  0x0090,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
  0x0098,0x2122,0x0161,0x203A,0x015B,0x0165,0x017E,0x017A,
  0x00A0,0x02C7,0x02D8,0x0141,0x00A4,0x0104,0x00A6,0x00A7,
  0x00A8,0x00A9,0x015E,0x00AB,0x00AC,0x00AD,0x00AE,0x017B,
  0x00B0,0x00B1,0x02DB,0x0142,0x00B4,0x00B5,0x00B6,0x00B7,
  0x00B8,0x0105,0x015F,0x00BB,0x013D,0x02DD,0x013E,0x017C,
  0x0154,0x00C1,0x00C2,0x0102,0x00C4,0x0139,0x0106,0x00C7,
  0x010C,0x00C9,0x0118,0x00CB,0x011A,0x00CD,0x00CE,0x010E,
  0x0110,0x0143,0x0147,0x00D3,0x00D4,0x0150,0x00D6,0x00D7,
  0x0158,0x016E,0x00DA,0x0170,0x00DC,0x00DD,0x0162,0x00DF,
  0x0155,0x00E1,0x00E2,0x0103,0x00E4,0x013A,0x0107,0x00E7,
  0x010D,0x00E9,0x0119,0x00EB,0x011B,0x00ED,0x00EE,0x010F,
  0x0111,0x0144,0x0148,0x00F3,0x00F4,0x0151,0x00F6,0x00F7,
  0x0159,0x016F,0x00FA,0x0171,0x00FC,0x00FD,0x0163,0x02D9,
];

// Build reverse lookup: Unicode codepoint → CP1250 byte
const _unicodeTo1250 = new Map<number, number>();
for (let i = 0; i < 128; i++) _unicodeTo1250.set(CP1250_HI[i], 0x80 + i);

function encodeCP1250(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x80) {
      out[i] = cp;
    } else {
      out[i] = _unicodeTo1250.get(cp) ?? 0x3F; // '?' for unmappable chars
    }
  }
  return out;
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

  const encoded = encodeCP1250(lines.join('\r\n'));
  const blob = new Blob([encoded.buffer as ArrayBuffer], { type: 'text/plain;charset=windows-1250' });
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
