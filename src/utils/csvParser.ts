import type { Article } from '../types';

// Remove diacritics from string
function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
      });
    }
  }

  return articles;
}

export interface CSVLoadResult {
  articles: Article[];
  lastModified: Date | null;
}

export async function loadCSV(filename: string): Promise<CSVLoadResult> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    const lastModifiedHeader = response.headers.get('Last-Modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : null;
    const text = await response.text();
    return { articles: parseCSV(text), lastModified };
  } catch (error) {
    console.error('Error loading CSV:', error);
    return { articles: [], lastModified: null };
  }
}
