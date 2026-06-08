export interface Article {
  typoveOznaceni: string;
  artikl: string;
  vyrobce: string;
  nazev: string;
  cisloDiluVyrobce: string;
  vybehovyDil: string;
  status: string;
  // Wire DB extra fields (only present for articles from wires.json)
  prurez?: number | null;
  barva?: string;
  skupina?: string;
}

export type SearchMode = 'fuzzy' | 'wildcard' | 'combined';
export type SearchField = 'all' | 'nazev' | 'typoveOznaceni' | 'vyrobce' | 'artikl';
export type DataSource = 'usti' | 'effi' | 'both';

export interface SearchResult extends Article {
  score: number;
  matchType: 'wildcard' | 'exact' | 'minimal' | 'medium' | 'large';
  highlightedFields: {
    typoveOznaceni?: string;
    artikl?: string;
    vyrobce?: string;
    nazev?: string;
    cisloDiluVyrobce?: string;
    vybehovyDil?: string;
  };
}

export interface SearchOptions {
  mode: SearchMode;
  field: SearchField;
  query: string;
  maxResults: number;
  manufacturers?: string[];
}

export interface BulkQueryResult {
  query: string;
  results: SearchResult[];
}

export type AppMode = 'single' | 'bulk' | 'ai';

export type BomRowType = 'L' | 'T';

export interface BomRow {
  id: string;
  type: BomRowType;
  artikl: string;
  popis: string;
  typoveOznaceni: string;
  mnozstvi: number;
  poznamka1: string;
  poznamka2: string;
}

export interface BomHeader {
  cisloVrcholu: string;
  cisloZavodu: string;
  platnostOd: string; // DDMMYYYY
  popis: string; // max 40 chars
  status: string;
  vyrobniDispecer: string;
}

export const MANUFACTURER_PREFIXES = [
  'RIT.',
  'SE.',
  'SIE.',
  'PXC.',
  'FES.',
  'WAGO.',
  'WEI.',
] as const;
