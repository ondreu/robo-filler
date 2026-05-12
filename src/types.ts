export interface Article {
  typoveOznaceni: string;
  artikl: string;
  vyrobce: string;
  nazev: string;
  cisloDiluVyrobce: string;
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

export type AppMode = 'single' | 'bulk';

export const MANUFACTURER_PREFIXES = [
  'RIT.',
  'SE.',
  'SIE.',
  'PXC.',
  'FES.',
  'WAGO.',
  'WEI.',
] as const;
