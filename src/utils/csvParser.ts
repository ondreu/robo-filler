import type { Article } from '../types';

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\ufffd/g, '');
}

export function parseCSV(csvContent: string): Article[] {
  const lines = csvContent.trim().split('\n');
  const articles: Article[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    if (parts.length >= 5) {
      // Remove diacritics from all fields to fix encoding issues
      articles.push({
        typoveOznaceni: removeDiacritics(parts[0]?.trim() || ''),
        artikl: removeDiacritics(parts[1]?.trim() || ''),
        vyrobce: removeDiacritics(parts[2]?.trim() || ''),
        nazev: removeDiacritics(parts[3]?.trim() || ''),
        cisloDiluVyrobce: removeDiacritics(parts[4]?.trim() || ''),
        vybehovyDil: removeDiacritics(parts[5]?.trim() || ''),
      });
    }
  }

  return articles;
}

export interface CSVLoadResult {
  articles: Article[];
  lastModified: Date | null;
}

export async function loadCSVMeta(metaFilename: string): Promise<Date | null> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}${metaFilename}`);
    if (!response.ok) return null;
    const json = await response.json();
    return json.lastModified ? new Date(json.lastModified) : null;
  } catch {
    return null;
  }
}

export async function loadCSV(filename: string): Promise<CSVLoadResult> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    const text = await response.text();
    return { articles: parseCSV(text), lastModified: null };
  } catch (error) {
    console.error('Error loading CSV:', error);
    return { articles: [], lastModified: null };
  }
}
