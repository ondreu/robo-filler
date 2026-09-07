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

// Fields usable as separate criteria in advanced (multi-field) search.
// 'typoveOznaceni' covers manufacturer part number as well (see getSearchableFields).
export const ADVANCED_FIELDS = ['nazev', 'typoveOznaceni', 'vyrobce', 'artikl'] as const;
export type AdvancedField = typeof ADVANCED_FIELDS[number];
export const ADVANCED_FIELD_LABELS: Record<AdvancedField, string> = {
  typoveOznaceni: 'Typové označení',
  vyrobce: 'Výrobce',
  nazev: 'Název',
  artikl: 'Artikl',
};
export type AdvancedQuery = Partial<Record<AdvancedField, string>>;

export interface SearchResult extends Article {
  score: number;
  matchType: 'wildcard' | 'exact' | 'minimal' | 'medium' | 'large';
  fromAlt?: boolean;
  /**
   * Set when the query's words were matched across several fields at once
   * (e.g. „siemens 3RV2011" = výrobce + typové označení). Maps each field to
   * the query words that hit it, so the UI can offer to split the query into
   * the advanced per-field inputs.
   */
  crossField?: AdvancedQuery;
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

export interface AdvancedSearchOptions {
  mode: SearchMode;
  /** Per-field criteria; empty/whitespace values are ignored. All filled ones must match (AND). */
  criteria: AdvancedQuery;
  maxResults: number;
  manufacturers?: string[];
}

export interface BulkQueryResult {
  query: string;
  altQuery?: string;
  pocet?: number;
  oznaceniPristroje?: string;
  popis?: string;
  vyrobce?: string;
  results: SearchResult[];
  usedAlt?: boolean;
}

export type AppMode = 'single' | 'bulk' | 'ai' | 'wirecable' | 'kanban' | 'admin';

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
