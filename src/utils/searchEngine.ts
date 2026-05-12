import Fuse from 'fuse.js';
import type { Article, SearchResult, SearchOptions, SearchField } from '../types';
import { MANUFACTURER_PREFIXES } from '../types';

// Remove diacritics from string
function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Normalize string for comparison (remove formatting differences and diacritics)
function normalizeString(str: string): string {
  return removeDiacritics(str)
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

  // Word-level matching (before full normalization removes spaces)
  const queryForWords = removeDiacritics(removePrefix(query)).toLowerCase().trim();
  const targetForWords = removeDiacritics(removePrefix(target)).toLowerCase().trim();
  const targetWords = targetForWords.split(/[\s,.\-_/\\]+/).filter(Boolean);

  for (const word of targetWords) {
    if (word === queryForWords) {
      return { score: 92, matchType: 'minimal' };
    }
    if (word.length >= 2 && queryForWords.length >= 2) {
      if (word.includes(queryForWords) || queryForWords.includes(word)) {
        const lenRatio = Math.abs(word.length - queryForWords.length) / Math.max(word.length, queryForWords.length);
        if (lenRatio < 0.3) {
          return { score: 87, matchType: 'medium' };
        }
      }
    }
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
  // Auto-add wildcards between words if not already present
  let pattern = query;
  if (!pattern.includes('*') && !pattern.includes('?')) {
    // Split by whitespace and add * between words
    const words = pattern.trim().split(/\s+/);
    pattern = words.join('*');
  }
  // Add * at beginning and end if not present
  if (!pattern.startsWith('*')) pattern = '*' + pattern;
  if (!pattern.endsWith('*')) pattern = pattern + '*';

  // Create regex that ignores diacritics (strip diacritics from query too)
  const regexPattern = removeDiacritics(pattern)
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(regexPattern, 'i');

  const results: SearchResult[] = [];

  for (const article of articles) {
    const fields = getSearchableFields(article, field);

    for (const [fieldName, value] of Object.entries(fields)) {
      // Test against value without diacritics
      if (regex.test(removeDiacritics(value))) {
        results.push({
          ...article,
          score: 100,
          matchType: 'wildcard',
          highlightedFields: {
            [fieldName]: highlightMatchWildcard(value, query),
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
    getFn: (obj: Article, path: string | string[]) => {
      const pathStr = Array.isArray(path) ? path[0] : path;
      const value = (obj as unknown as Record<string, unknown>)[pathStr];
      if (typeof value === 'string') return removeDiacritics(value);
      return (value ?? '') as string;
    },
  });

  const fuseResults = fuse.search(removeDiacritics(query));
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

// Highlight matching parts for wildcard search
function highlightMatchWildcard(text: string, originalQuery: string): string {
  // Split query into words (ignore wildcards)
  const queryWords = originalQuery.trim().split(/\s+/).filter(w => w && w !== '*' && w !== '?');

  if (queryWords.length === 0) return text;

  let result = text;
  const matches: Array<{start: number; end: number; word: string}> = [];

  // Find all matching positions for each query word
  for (const word of queryWords) {
    const wordNormalized = removeDiacritics(word.toLowerCase());
    const textNormalized = removeDiacritics(text.toLowerCase());

    let pos = 0;
    while ((pos = textNormalized.indexOf(wordNormalized, pos)) !== -1) {
      // Check if this position overlaps with existing matches
      const overlaps = matches.some(m =>
        (pos >= m.start && pos < m.end) ||
        (pos + word.length > m.start && pos + word.length <= m.end)
      );

      if (!overlaps) {
        matches.push({start: pos, end: pos + word.length, word});
      }
      pos++;
    }
  }

  // Sort matches by position (descending) so we can replace from end to start
  matches.sort((a, b) => b.start - a.start);

  // Apply highlights
  for (const match of matches) {
    const before = result.slice(0, match.start);
    const highlighted = result.slice(match.start, match.end);
    const after = result.slice(match.end);
    result = `${before}<mark>${highlighted}</mark>${after}`;
  }

  return result;
}

// Highlight matching parts for fuzzy search
function highlightMatch(text: string, query: string): string {
  // Remove prefixes and normalize for comparison
  const textNoPrefixNorm = normalizeString(removePrefix(text));
  const queryNoPrefixNorm = normalizeString(removePrefix(query));

  // Find the position in normalized text
  const startIndex = textNoPrefixNorm.indexOf(queryNoPrefixNorm);

  if (startIndex === -1) {
    return text;
  }

  // Map back to original text positions
  // We need to find where in the original text the normalized match starts
  const textNormalized = removeDiacritics(text.toLowerCase());
  const queryNormalized = removeDiacritics(query.toLowerCase());

  // Try to find continuous match in text
  let bestMatch = { start: -1, end: -1, score: 0 };

  for (let i = 0; i < text.length; i++) {
    let matchCount = 0;
    let j = i;
    let qIdx = 0;

    while (j < text.length && qIdx < query.length) {
      const tChar = textNormalized[j];
      const qChar = queryNormalized[qIdx];

      // Skip formatting chars in text
      if (/[.,\-_\s]/.test(text[j])) {
        j++;
        continue;
      }

      // Skip formatting chars in query
      if (/[.,\-_\s]/.test(query[qIdx])) {
        qIdx++;
        continue;
      }

      if (tChar === qChar) {
        matchCount++;
        j++;
        qIdx++;
      } else {
        break;
      }
    }

    if (qIdx >= query.replace(/[.,\-_\s]/g, '').length && matchCount > bestMatch.score) {
      bestMatch = { start: i, end: j, score: matchCount };
    }
  }

  if (bestMatch.start === -1) {
    return text;
  }

  const before = text.slice(0, bestMatch.start);
  const match = text.slice(bestMatch.start, bestMatch.end);
  const after = text.slice(bestMatch.end);

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
