import Fuse from 'fuse.js';
import type { Article, SearchResult, SearchOptions, SearchField } from '../types';
import { MANUFACTURER_PREFIXES } from '../types';

// Normalize string for comparison (remove formatting differences)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\-_\s]/g, '')
    .trim();
}

// Remove manufacturer prefixes
function removePrefix(str: string): string {
  const upper = str.toUpperCase();
  for (const prefix of MANUFACTURER_PREFIXES) {
    if (upper.startsWith(prefix)) {
      return str.slice(prefix.length);
    }
  }
  return str;
}

// Calculate similarity score with custom weights
function calculateScore(query: string, target: string): {
  score: number;
  matchType: SearchResult['matchType'];
} {
  const normalizedQuery = normalizeString(removePrefix(query));
  const normalizedTarget = normalizeString(removePrefix(target));

  // Exact match (including formatting differences and prefixes)
  if (normalizedQuery === normalizedTarget) {
    return { score: 100, matchType: 'exact' };
  }

  // Check for missing leading zeros
  const queryWithoutLeadingZeros = normalizedQuery.replace(/^0+/, '');
  const targetWithoutLeadingZeros = normalizedTarget.replace(/^0+/, '');

  if (queryWithoutLeadingZeros === targetWithoutLeadingZeros) {
    return { score: 98, matchType: 'minimal' };
  }

  // Check for partial matches (missing beginning or end)
  if (normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget)) {
    const lengthDiff = Math.abs(normalizedQuery.length - normalizedTarget.length);
    const lengthRatio = lengthDiff / Math.max(normalizedQuery.length, normalizedTarget.length);

    if (lengthRatio < 0.2) {
      return { score: 95, matchType: 'minimal' };
    } else if (lengthRatio < 0.4) {
      return { score: 85, matchType: 'medium' };
    }
  }

  // Levenshtein-like distance calculation
  const maxLen = Math.max(normalizedQuery.length, normalizedTarget.length);
  let differences = 0;
  let i = 0, j = 0;

  while (i < normalizedQuery.length && j < normalizedTarget.length) {
    if (normalizedQuery[i] !== normalizedTarget[j]) {
      differences++;
    }
    i++;
    j++;
  }

  differences += Math.abs(normalizedQuery.length - normalizedTarget.length);

  const similarity = 100 - (differences / maxLen) * 100;

  let matchType: SearchResult['matchType'];
  if (similarity >= 95) {
    matchType = 'minimal';
  } else if (similarity >= 85) {
    matchType = 'medium';
  } else {
    matchType = 'large';
  }

  return { score: similarity, matchType };
}

// Wildcard search
function wildcardSearch(articles: Article[], query: string, field: SearchField): SearchResult[] {
  const pattern = `*${query}*`;
  const regex = new RegExp(
    pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
    'i'
  );

  const results: SearchResult[] = [];

  for (const article of articles) {
    const fields = getSearchableFields(article, field);

    for (const [fieldName, value] of Object.entries(fields)) {
      if (regex.test(value)) {
        results.push({
          ...article,
          score: 100,
          matchType: 'wildcard',
          highlightedFields: {
            [fieldName]: highlightMatch(value, query),
          },
        });
        break;
      }
    }
  }

  return results;
}

// Fuzzy search using Fuse.js
function fuzzySearch(articles: Article[], query: string, field: SearchField): SearchResult[] {
  const keys = field === 'all'
    ? ['nazev', 'typoveOznaceni', 'vyrobce', 'artikl', 'cisloDiluVyrobce']
    : field === 'typoveOznaceni'
    ? ['typoveOznaceni', 'cisloDiluVyrobce']
    : [field];

  const fuse = new Fuse(articles, {
    keys,
    threshold: 0.4,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const fuseResults = fuse.search(query);
  const results: SearchResult[] = [];

  for (const result of fuseResults) {
    const article = result.item;
    const fields = getSearchableFields(article, field);

    let bestScore = 0;
    let bestMatchType: SearchResult['matchType'] = 'large';
    const highlightedFields: SearchResult['highlightedFields'] = {};

    for (const [fieldName, value] of Object.entries(fields)) {
      const { score, matchType } = calculateScore(query, value);
      if (score > bestScore) {
        bestScore = score;
        bestMatchType = matchType;
      }
      highlightedFields[fieldName as keyof typeof highlightedFields] = highlightMatch(value, query);
    }

    results.push({
      ...article,
      score: bestScore,
      matchType: bestMatchType,
      highlightedFields,
    });
  }

  return results;
}

// Combined search (wildcard first, then fuzzy)
function combinedSearch(articles: Article[], query: string, field: SearchField): SearchResult[] {
  const wildcardResults = wildcardSearch(articles, query, field);

  if (wildcardResults.length > 0) {
    return wildcardResults;
  }

  return fuzzySearch(articles, query, field);
}

// Get searchable fields based on search field selection
function getSearchableFields(article: Article, field: SearchField): Record<string, string> {
  if (field === 'all') {
    return {
      nazev: article.nazev,
      typoveOznaceni: article.typoveOznaceni,
      vyrobce: article.vyrobce,
      artikl: article.artikl,
      cisloDiluVyrobce: article.cisloDiluVyrobce,
    };
  } else if (field === 'typoveOznaceni') {
    return {
      typoveOznaceni: article.typoveOznaceni,
      cisloDiluVyrobce: article.cisloDiluVyrobce,
    };
  } else {
    return {
      [field]: article[field as keyof Article],
    };
  }
}

// Highlight matching parts
function highlightMatch(text: string, query: string): string {
  const normalizedText = normalizeString(text);
  const normalizedQuery = normalizeString(query);

  let startIndex = normalizedText.indexOf(normalizedQuery);

  if (startIndex === -1) {
    // Try fuzzy matching for highlighting
    return text;
  }

  // Map normalized positions back to original text
  let charCount = 0;
  let realStartIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!/[.,\-_\s]/.test(char)) {
      if (charCount === startIndex) {
        realStartIndex = i;
        break;
      }
      charCount++;
    }
  }

  let realEndIndex = realStartIndex;
  charCount = 0;

  for (let i = realStartIndex; i < text.length && charCount < normalizedQuery.length; i++) {
    const char = text[i];
    if (!/[.,\-_\s]/.test(char)) {
      charCount++;
    }
    realEndIndex = i + 1;
  }

  const before = text.slice(0, realStartIndex);
  const match = text.slice(realStartIndex, realEndIndex);
  const after = text.slice(realEndIndex);

  return `${before}<mark>${match}</mark>${after}`;
}

// Main search function
export function search(
  articles: Article[],
  options: SearchOptions
): SearchResult[] {
  if (!options.query.trim()) {
    return [];
  }

  let results: SearchResult[] = [];

  switch (options.mode) {
    case 'wildcard':
      results = wildcardSearch(articles, options.query, options.field);
      break;
    case 'fuzzy':
      results = fuzzySearch(articles, options.query, options.field);
      break;
    case 'combined':
      results = combinedSearch(articles, options.query, options.field);
      break;
  }

  // Filter by manufacturers if specified
  if (options.manufacturers && options.manufacturers.length > 0) {
    results = results.filter(r =>
      options.manufacturers!.includes(r.vyrobce)
    );
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  // Limit results
  return results.slice(0, options.maxResults);
}

// Get unique manufacturers from articles
export function getUniqueManufacturers(articles: Article[]): string[] {
  const manufacturers = new Set<string>();
  for (const article of articles) {
    if (article.vyrobce) {
      manufacturers.add(article.vyrobce);
    }
  }
  return Array.from(manufacturers).sort();
}
