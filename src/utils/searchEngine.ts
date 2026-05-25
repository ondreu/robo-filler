import Fuse from 'fuse.js';
import type { Article, SearchResult, SearchOptions, SearchField } from '../types';
import { MANUFACTURER_PREFIXES } from '../types';

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeString(str: string): string {
  return removeDiacritics(str)
    .toLowerCase()
    .replace(/[.,\-_\s]/g, '')
    .trim();
}

function removePrefix(str: string): string {
  const upper = str.toUpperCase();
  for (const prefix of MANUFACTURER_PREFIXES) {
    if (upper.startsWith(prefix)) {
      return str.slice(prefix.length);
    }
  }
  return str;
}

// Score a single-word query against a target field value
function calculateScore(query: string, target: string): {
  score: number;
  matchType: SearchResult['matchType'];
} {
  const normalizedQuery = normalizeString(removePrefix(query));
  const normalizedTarget = normalizeString(removePrefix(target));

  if (normalizedQuery === normalizedTarget) {
    return { score: 100, matchType: 'exact' };
  }

  const queryWithoutLeadingZeros = normalizedQuery.replace(/^0+/, '');
  const targetWithoutLeadingZeros = normalizedTarget.replace(/^0+/, '');

  if (queryWithoutLeadingZeros === targetWithoutLeadingZeros) {
    return { score: 100, matchType: 'exact' };
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

  if (normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget)) {
    const lengthDiff = Math.abs(normalizedQuery.length - normalizedTarget.length);
    const lengthRatio = lengthDiff / Math.max(normalizedQuery.length, normalizedTarget.length);

    if (lengthRatio < 0.2) {
      return { score: 95, matchType: 'minimal' };
    } else if (lengthRatio < 0.4) {
      return { score: 85, matchType: 'medium' };
    }
  }

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

// Score a query (single or multi-word) against a target field value
function scoreQuery(query: string, target: string): {
  score: number;
  matchType: SearchResult['matchType'];
} {
  const wholeScore = calculateScore(query, target);
  if (wholeScore.score >= 95) {
    return wholeScore;
  }

  const words = removeDiacritics(query).toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);

  if (words.length <= 1) {
    return wholeScore;
  }

  const targetNorm = removeDiacritics(target).toLowerCase();
  const targetWordCount = targetNorm.split(/\s+/).filter(Boolean).length;

  let matchedCount = 0;
  for (const word of words) {
    if (targetNorm.includes(word)) matchedCount++;
  }

  if (matchedCount === 0) {
    return { score: 0, matchType: 'large' };
  }

  const matchRatio = matchedCount / words.length;

  if (matchedCount === words.length) {
    // All words matched — bonus if target is compact (fewer extra words)
    const extraWords = Math.max(0, targetWordCount - words.length);
    const score = Math.min(98, 88 + Math.max(0, 8 - extraWords * 2));
    return { score, matchType: 'minimal' };
  }

  return {
    score: 40 + matchRatio * 40,
    matchType: matchRatio >= 0.67 ? 'medium' : 'large',
  };
}

// Wildcard search — multi-word uses AND logic, explicit wildcards use single pattern
function wildcardSearch(articles: Article[], query: string, field: SearchField): SearchResult[] {
  const hasExplicitWildcard = query.includes('*') || query.includes('?');

  let regexes: RegExp[];

  if (hasExplicitWildcard) {
    let pattern = query;
    if (!pattern.startsWith('*')) pattern = '*' + pattern;
    if (!pattern.endsWith('*')) pattern = pattern + '*';
    const regexPattern = removeDiacritics(pattern)
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    regexes = [new RegExp(regexPattern, 'i')];
  } else {
    // Each word becomes its own regex — ALL must match (AND logic)
    const words = query.trim().split(/\s+/).filter(Boolean);
    regexes = words.map(w => new RegExp(removeDiacritics(w), 'i'));
  }

  const results: SearchResult[] = [];

  for (const article of articles) {
    const fields = getSearchableFields(article, field);

    for (const [fieldName, value] of Object.entries(fields)) {
      const normalizedValue = removeDiacritics(value);

      if (regexes.every(re => re.test(normalizedValue))) {
        // Score based on actual match quality, not hardcoded 100
        const queryForScore = hasExplicitWildcard ? query.replace(/[*?]/g, ' ').trim() : query;
        const { score, matchType } = scoreQuery(queryForScore, value);

        results.push({
          ...article,
          score,
          matchType: hasExplicitWildcard ? 'wildcard' : matchType,
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

// Fuzzy search — single-word uses Fuse.js, multi-word uses AND matching
function fuzzySearch(articles: Article[], query: string, field: SearchField): SearchResult[] {
  const queryWords = removeDiacritics(query).toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
  const isMultiWord = queryWords.length > 1;

  const keys = field === 'all'
    ? ['nazev', 'typoveOznaceni', 'vyrobce', 'artikl', 'vybehovyDil']
    : field === 'typoveOznaceni'
    ? ['typoveOznaceni', 'vybehovyDil']
    : [field];

  if (isMultiWord) {
    // Multi-word fuzzy: find articles where all words appear (AND, diacritic-insensitive)
    // and score them by match quality
    const results: SearchResult[] = [];

    for (const article of articles) {
      const fields = getSearchableFields(article, field);

      for (const [fieldName, value] of Object.entries(fields)) {
        const valueNorm = removeDiacritics(value).toLowerCase();
        const matchedCount = queryWords.filter(w => valueNorm.includes(w)).length;

        if (matchedCount === 0) continue;

        const { score, matchType } = scoreQuery(query, value);
        if (score > 0) {
          results.push({
            ...article,
            score,
            matchType,
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

  // Single-word: Fuse.js for typo tolerance
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

// Combined search — runs both methods and merges, taking best score per article
function combinedSearch(articles: Article[], query: string, field: SearchField): SearchResult[] {
  const wildcardResults = wildcardSearch(articles, query, field);
  const fuzzyResults = fuzzySearch(articles, query, field);

  const byArtikl = new Map<string, SearchResult>();

  for (const r of [...wildcardResults, ...fuzzyResults]) {
    const existing = byArtikl.get(r.artikl);
    if (!existing || r.score > existing.score) {
      byArtikl.set(r.artikl, r);
    }
  }

  return Array.from(byArtikl.values());
}

function getSearchableFields(article: Article, field: SearchField): Record<string, string> {
  if (field === 'all') {
    return {
      nazev: article.nazev,
      typoveOznaceni: article.typoveOznaceni,
      vyrobce: article.vyrobce,
      artikl: article.artikl,
      vybehovyDil: article.vybehovyDil,
    };
  } else if (field === 'typoveOznaceni') {
    return {
      typoveOznaceni: article.typoveOznaceni,
      vybehovyDil: article.vybehovyDil,
    };
  } else {
    return {
      [field]: article[field as keyof Article],
    };
  }
}

function highlightMatchWildcard(text: string, originalQuery: string): string {
  const queryWords = originalQuery.trim().split(/\s+/).filter(w => w && w !== '*' && w !== '?');

  if (queryWords.length === 0) return text;

  const textNormalized = removeDiacritics(text.toLowerCase());

  // Sort words by first occurrence in text so left-side matches get priority and
  // adjacent spans (e.g. "40"→[1,3) + "000"→[3,6)) don't block each other.
  const sortedWords = [...queryWords].sort((a, b) => {
    const aPos = textNormalized.indexOf(removeDiacritics(a.toLowerCase()));
    const bPos = textNormalized.indexOf(removeDiacritics(b.toLowerCase()));
    if (aPos === -1 && bPos === -1) return b.length - a.length;
    if (aPos === -1) return 1;
    if (bPos === -1) return -1;
    return aPos !== bPos ? aPos - bPos : b.length - a.length;
  });

  let result = text;
  const matches: Array<{start: number; end: number}> = [];

  for (const word of sortedWords) {
    const wordNormalized = removeDiacritics(word.toLowerCase());

    const wordLen = wordNormalized.length;
    let pos = 0;
    while ((pos = textNormalized.indexOf(wordNormalized, pos)) !== -1) {
      // Standard interval overlap: [pos, pos+len) overlaps [m.start, m.end) iff pos < m.end && pos+len > m.start
      const overlaps = matches.some(m =>
        pos < m.end && pos + wordLen > m.start
      );

      if (!overlaps) {
        matches.push({ start: pos, end: pos + wordLen });
      }
      pos++;
    }
  }

  matches.sort((a, b) => b.start - a.start);

  for (const match of matches) {
    const before = result.slice(0, match.start);
    const highlighted = result.slice(match.start, match.end);
    const after = result.slice(match.end);
    result = `${before}<mark>${highlighted}</mark>${after}`;
  }

  return result;
}

function highlightMatch(text: string, query: string): string {
  const textNoPrefixNorm = normalizeString(removePrefix(text));
  const queryNoPrefixNorm = normalizeString(removePrefix(query));

  const startIndex = textNoPrefixNorm.indexOf(queryNoPrefixNorm);

  if (startIndex === -1) {
    return text;
  }

  const textNormalized = removeDiacritics(text.toLowerCase());
  const queryNormalized = removeDiacritics(query.toLowerCase());

  let bestMatch = { start: -1, end: -1, score: 0 };

  for (let i = 0; i < text.length; i++) {
    let matchCount = 0;
    let j = i;
    let qIdx = 0;

    while (j < text.length && qIdx < query.length) {
      const tChar = textNormalized[j];
      const qChar = queryNormalized[qIdx];

      if (/[.,\-_\s]/.test(text[j])) {
        j++;
        continue;
      }

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

  if (options.manufacturers && options.manufacturers.length > 0) {
    results = results.filter(r =>
      options.manufacturers!.includes(r.vyrobce)
    );
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, options.maxResults);
}

export function getUniqueManufacturers(articles: Article[]): string[] {
  const manufacturers = new Set<string>();
  for (const article of articles) {
    if (article.vyrobce) {
      manufacturers.add(article.vyrobce);
    }
  }
  return Array.from(manufacturers).sort();
}
