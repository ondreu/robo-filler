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
      });
    }
  }

  return articles;
}

export async function loadCSV(filename: string): Promise<Article[]> {
  try {
    // Use BASE_URL from Vite to handle both dev and production paths
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    const text = await response.text();
    return parseCSV(text);
  } catch (error) {
    console.error('Error loading CSV:', error);
    return [];
  }
}
