import * as XLSX from 'xlsx';
import type { Article } from '../types';
import { search } from './searchEngine';

interface ExcelRow {
  query: string;
  artikl1?: string;
  typoveOznaceni1?: string;
  artikl2?: string;
  typoveOznaceni2?: string;
  artikl3?: string;
  typoveOznaceni3?: string;
}

export async function handleExcelImport(
  file: File,
  articles: Article[]
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        const results: ExcelRow[] = [];

        // Process each row (skip header if exists)
        for (const row of rows) {
          const query = row[0]?.toString().trim();
          if (!query) continue;

          // Search in both typoveOznaceni and cisloDiluVyrobce
          const searchResults = search(articles, {
            mode: 'fuzzy',
            field: 'typoveOznaceni',
            query,
            maxResults: 3,
            manufacturers: undefined,
          });

          // Filter for exact and minimal matches only
          const matches = searchResults.filter(
            r => r.matchType === 'exact' || r.matchType === 'minimal'
          );

          const resultRow: ExcelRow = { query };

          if (matches[0]) {
            resultRow.artikl1 = matches[0].artikl;
            resultRow.typoveOznaceni1 = matches[0].typoveOznaceni;
          }
          if (matches[1]) {
            resultRow.artikl2 = matches[1].artikl;
            resultRow.typoveOznaceni2 = matches[1].typoveOznaceni;
          }
          if (matches[2]) {
            resultRow.artikl3 = matches[2].artikl;
            resultRow.typoveOznaceni3 = matches[2].typoveOznaceni;
          }

          results.push(resultRow);
        }

        // Create output workbook
        const outputData = results.map(r => [
          r.query,
          '',
          r.artikl1 || '',
          r.typoveOznaceni1 || '',
          r.artikl2 || '',
          r.typoveOznaceni2 || '',
          r.artikl3 || '',
          r.typoveOznaceni3 || '',
        ]);

        const outputWorkbook = XLSX.utils.book_new();
        const outputSheet = XLSX.utils.aoa_to_sheet(outputData);
        XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, 'Results');

        // Generate blob
        const wbout = XLSX.write(outputWorkbook, {
          bookType: 'xlsx',
          type: 'binary',
        });

        const blob = new Blob([s2ab(wbout)], {
          type: 'application/octet-stream',
        });

        resolve(blob);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

// Convert string to array buffer
function s2ab(s: string): ArrayBuffer {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xff;
  }
  return buf;
}

export function downloadExcel(blob: Blob, originalFilename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = originalFilename.replace(/\.[^/.]+$/, '');
  a.href = url;
  a.download = `${filename}_DOPLNENO.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
