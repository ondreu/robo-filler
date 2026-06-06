import type { Article } from '../types';

export function parseCSV(csvContent: string): Article[] {
  const lines = csvContent.trim().split('\n');
  const articles: Article[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    if (parts.length >= 5) {
      articles.push({
        typoveOznaceni: parts[0]?.trim() || '',
        artikl: parts[1]?.trim() || '',
        vyrobce: parts[2]?.trim() || '',
        nazev: parts[3]?.trim() || '',
        cisloDiluVyrobce: parts[4]?.trim() || '',
        vybehovyDil: parts[5]?.trim() || '',
        status: parts[6]?.trim() || '',
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
