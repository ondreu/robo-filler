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

export interface WireArticle {
  artiklStroj: string;
  skupinaDleTypu: string | null;
  skupinaDlePouziti: string | null;
  artiklRucni: string | null;
  typ: string | null;
  prurez: number | null;
  barva: string | null;
  vyrobce: string | null;
  objednaciCislo: string | null;
  baleni: number | null;
  nazev: string | null;
}

export interface CableArticle {
  artikl: string;
  objCislo1: string | null;
  objCislo2: string | null;
  objCislo3: string | null;
  objCislo4: string | null;
  dodavatel: string | null;
  nazevKatalog: string | null;
  nazev: string | null;
  pocetZil: string | null;
  ochrannyVodic: string | null;
  prurez: number | string | null;
  ce: string | null;
  ul: string | null;
  cULus: string | null;
  csa: string | null;
  ukca: string | null;
  ru: string | null;
  cRUus: string | null;
  rohs: string | null;
  har: string | null;
  vde: string | null;
  profibus: string | null;
  ulStyle: string | null;
  stineni: 'ANO' | 'NE' | null;
  pletezenePary: 'ANO' | 'NE' | null;
  znaceniVodicu: string | null;
  teplotniRozsah: string | null;
  jmenoviteNapeti: string | null;
  retiez: 'ANO' | 'NE' | null;
  olej: 'ANO' | 'NE' | null;
  bezhalogenovy: 'ANO' | 'NE' | null;
  materialPlaste: string | null;
  barva: string | null;
  prumer: number | string | null;
}

export async function loadCables(): Promise<CableArticle[]> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}cables.json`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data as CableArticle[];
  } catch {
    return [];
  }
}

export async function loadWiresRaw(): Promise<WireArticle[]> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}wires.json`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data as WireArticle[];
  } catch {
    return [];
  }
}

export async function loadWires(): Promise<Article[]> {
  const raw = await loadWiresRaw();
  return raw.map(w => ({
    typoveOznaceni: w.typ ?? w.skupinaDleTypu ?? '',
    artikl: w.artiklStroj ?? w.artiklRucni ?? '',
    vyrobce: w.vyrobce ?? '',
    nazev: w.nazev ?? '',
    cisloDiluVyrobce: w.objednaciCislo ?? '',
    vybehovyDil: '',
    status: '',
    prurez: w.prurez,
    barva: w.barva ?? '',
    skupina: w.skupinaDleTypu ?? '',
  }));
}
