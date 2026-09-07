import Fuse from 'fuse.js';
import type {
  Article,
  SearchResult,
  SearchOptions,
  SearchField,
  AdvancedField,
  AdvancedQuery,
  AdvancedSearchOptions,
} from '../types';
import { ADVANCED_FIELDS, MANUFACTURER_PREFIXES } from '../types';

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function stripDiacriticChars(str: string): string {
  const nfd = str.normalize('NFD');
  let result = '';
  let i = 0;
  while (i < nfd.length) {
    const nextCode = i + 1 < nfd.length ? nfd.charCodeAt(i + 1) : 0;
    if (nextCode >= 0x0300 && nextCode <= 0x036F) {
      i++;
      while (i < nfd.length && nfd.charCodeAt(i) >= 0x0300 && nfd.charCodeAt(i) <= 0x036F) i++;
    } else {
      result += nfd[i++];
    }
  }
  return result;
}


function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Words of this length or shorter must sit on a boundary to count as a match.
// Without it „ut" matches inside „dutinka" and „2,5" inside „1,5-2,5mm", which
// floods multi-word results with articles that have nothing to do with the query.
const SHORT_WORD_MAX = 3;

// Characters that begin a new token. Deliberately EXCLUDES „," and „." so a
// cross-section like „2,5" counts as one token — that keeps it out of „12,5"
// while it still matches in „UT 2,5-QUATTRO".
const TOKEN_BOUNDARY = '\\s\\-_/\\\\()\\[\\]{}+;:=#%*';

const boundaryRegexCache = new Map<string, RegExp>();

/**
 * Where a short word may sit: at the start, right after a separator, or across a
 * letter/digit transition. That last case carries weight in part numbers —
 * „24v" in „DC24V" and „2,5" in „UT2,5QUATRO" are real matches, while „2,5" in
 * „12,5" (digit→digit) and „ut" in „dutinka" (letter→letter) are not.
 */
function boundaryRegex(needle: string): RegExp {
  let re = boundaryRegexCache.get(needle);
  if (!re) {
    // a needle starting with a digit is bounded by any non-digit, and vice versa
    const transition = /^[0-9]/.test(needle) ? '[^0-9]' : '[0-9]';
    re = new RegExp(`(?:^|[${TOKEN_BOUNDARY}]|${transition})${escapeRegex(needle)}`, 'i');
    boundaryRegexCache.set(needle, re);
  }
  return re;
}

/**
 * Does `needle` occur in `hay` somewhere that actually means something?
 *
 * `strict` applies the boundary rule for short words and belongs to multi-word
 * queries only. There a short word acts as an AND filter, so matching it inside
 * an unrelated word lets junk through („UT 2,5" pulling in „Dutinka 1,5-2,5mm"
 * because of d-„ut"-inka). A single-word query is a plain contains-search where
 * the user sees exactly what they asked for, so „M12" should still find
 * „IFRM12P1701" — no boundary there.
 */
function containsWord(needle: string, hay: string, strict: boolean): boolean {
  if (!needle) return false;
  if (!hay.includes(needle)) return false;
  if (!strict || needle.length > SHORT_WORD_MAX) return true;
  return boundaryRegex(needle).test(hay);
}

// Separators that industrial part numbers use interchangeably. „ST9" and „ST 9"
// are the same designation, and the database is inconsistent about which form it
// stores, so a word has to be comparable with these removed.
const SEPARATORS = /[\s.,\-_/\\]+/g;

const HAS_SEPARATOR = /[\s.,\-_/\\]/;

function stripSeparators(str: string): string {
  return str.replace(SEPARATORS, '');
}

const HAS_LETTER = /[a-z]/i;
const HAS_DIGIT = /[0-9]/;

/**
 * Is the separator-insensitive retry worth doing for this word at all?
 *
 * It only pays off where the database and the user disagree about a separator,
 * and that happens in designations — a word that mixes letters and digits
 * („ST9" vs „ST 9", „3RV2011"), or that already carries one („2,5"). A purely
 * alphabetic word like „siemens" or „spoustec" is never written „siem ens", so
 * retrying it would only cost a full extra pass over every field value.
 */
function needsCompactRetry(word: string): boolean {
  if (HAS_SEPARATOR.test(word)) return true;
  return HAS_LETTER.test(word) && HAS_DIGIT.test(word);
}

const tolerantRegexCache = new Map<string, RegExp>();

/**
 * A pattern that matches the word even if the value spells it with different
 * separators — „ST9" against „ST 9", „UT2,5" against „UT 2,5". Built from the
 * word with separators removed and an optional separator run allowed between
 * every character, so it works in both directions.
 *
 * This is tested against the value as written rather than against a stripped
 * copy of it: allocating a compacted string for all five fields of 80k articles
 * costs more than the search itself, while a cached regex costs one test.
 * Testing the written form is also the better semantics — in „KEL ST 9" the
 * word „ST9" sits behind a space, which is a boundary; compacting to
 * „kelst9" would have hidden that.
 */
function tolerantRegex(needle: string): RegExp {
  let re = tolerantRegexCache.get(needle);
  if (!re) {
    const sep = `[${TOKEN_BOUNDARY},.]`;

    // Runs of non-separator characters. Inside a run the value may insert
    // separators freely („ST9" → „ST 9"), but where the word itself has one the
    // value must have one too — otherwise „2,5" would match „M25" and a
    // cross-section would be confused with a thread size.
    const runs = needle.split(SEPARATORS).filter(Boolean);
    const body = runs.map(run => Array.from(run, escapeRegex).join(`${sep}*`)).join(`${sep}+`);

    // Short words keep the boundary requirement (see containsWord)
    const transition = /^[0-9]/.test(runs[0] ?? '') ? '[^0-9]' : '[0-9]';
    const prefix =
      stripSeparators(needle).length <= SHORT_WORD_MAX ? `(?:^|${sep}|${transition})` : '';

    re = new RegExp(prefix + body, 'i');
    tolerantRegexCache.set(needle, re);
  }
  return re;
}

/**
 * Does the value spell the word with separators the query did not use (or the
 * other way round)? Only asked for words where that can happen — see
 * needsCompactRetry — and only after the plain comparison has already failed.
 */
function matchesAcrossSeparators(needle: string, hay: string): boolean {
  if (!stripSeparators(needle)) return false;
  return tolerantRegex(needle).test(hay);
}

/** Both diacritic normalizations of a query word, deduplicated. */
function wordVariants(word: string): string[] {
  const stripped = removeDiacritics(word).toLowerCase();
  const charless = stripDiacriticChars(word).toLowerCase();
  return stripped === charless ? [stripped] : [stripped, charless];
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
  const wantsCompact = words.some(needsCompactRetry);
  const targetWordCount = targetNorm.split(/\s+/).filter(Boolean).length;

  let matchedCount = 0;
  for (const word of words) {
    if (
      containsWord(word, targetNorm, true) ||
      containsWord(stripDiacriticChars(word).toLowerCase(), targetNorm, true) ||
      (wantsCompact && matchesAcrossSeparators(word, targetNorm))
    ) matchedCount++;
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

  // A matcher tests one query word against an already-normalized field value,
  // either as written or with separators removed on both sides
  type Matcher = { plain: (hay: string) => boolean; acrossSeparators: (hay: string) => boolean };
  let matchers: Matcher[];
  let anyNeedsCompact = false;

  if (hasExplicitWildcard) {
    let pattern = query;
    if (!pattern.startsWith('*')) pattern = '*' + pattern;
    if (!pattern.endsWith('*')) pattern = pattern + '*';
    const regexPattern = removeDiacritics(pattern)
      .replace(/[.+^${}()|[\]\\*?]/g, (char) => {
        if (char === '*') return '.*';
        if (char === '?') return '.';
        return '\\' + char;
      });
    // An explicit wildcard means the user is being precise on purpose — match it as written
    const explicit = new RegExp(regexPattern, 'i');
    matchers = [{ plain: (hay: string) => explicit.test(hay), acrossSeparators: () => false }];
  } else {
    // Each word gets its own matcher — ALL must match (AND logic)
    const words = query.trim().split(/\s+/).filter(Boolean);
    const strict = words.length > 1;
    anyNeedsCompact = words.some(needsCompactRetry);
    matchers = words.map(w => {
      const variants = wordVariants(w);
      return {
        plain: (hay: string) => variants.some(v => containsWord(v, hay, strict)),
        acrossSeparators: (hay: string) => variants.some(v => matchesAcrossSeparators(v, hay)),
      };
    });
  }

  const results: SearchResult[] = [];

  for (const article of articles) {
    const fields = getSearchableFields(article, field);

    for (const [fieldName, value] of Object.entries(fields)) {
      const normalizedValue = removeDiacritics(value).toLowerCase();

      // Retry with separators removed only when the value as written did not
      // satisfy every word — stripping is a whole extra pass over the string
      let matched = matchers.every(m => m.plain(normalizedValue));
      if (!matched && anyNeedsCompact) {
        matched = matchers.every(
          m => m.plain(normalizedValue) || m.acrossSeparators(normalizedValue)
        );
      }

      if (matched) {
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
    ? ['nazev', 'typoveOznaceni', 'vyrobce', 'artikl', 'cisloDiluVyrobce']
    : field === 'typoveOznaceni'
    ? ['typoveOznaceni', 'cisloDiluVyrobce']
    : [field];

  if (isMultiWord) {
    // Multi-word fuzzy: find articles where all words appear (AND, diacritic-insensitive)
    // and score them by match quality
    const results: SearchResult[] = [];

    for (const article of articles) {
      const fields = getSearchableFields(article, field);

      for (const [fieldName, value] of Object.entries(fields)) {
        const valueNorm = removeDiacritics(value).toLowerCase();
        const matchedCount = queryWords.filter(
          w =>
            containsWord(w, valueNorm, true) ||
            containsWord(stripDiacriticChars(w).toLowerCase(), valueNorm, true)
        ).length;

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
      cisloDiluVyrobce: article.cisloDiluVyrobce,
    };
  } else if (field === 'typoveOznaceni') {
    return {
      typoveOznaceni: article.typoveOznaceni,
      cisloDiluVyrobce: article.cisloDiluVyrobce,
    };
  } else {
    const val = article[field as keyof Article];
    return {
      [field]: val != null ? String(val) : '',
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

// ---------------------------------------------------------------------------
// Cross-field matching — query words spread over several fields
// ---------------------------------------------------------------------------

// Articles are not guaranteed to have a unique `artikl` (wire DB is merged in),
// so identity for merging result sets uses several fields.
function articleKey(a: Article): string {
  return `${a.artikl}|${a.typoveOznaceni}|${a.vyrobce}|${a.nazev}`;
}

// Cross-field hits stay below the single-field "all words matched" band
// (scoreQuery gives those 88–98), so a match inside one field always wins.
const CROSS_FIELD_MAX_SCORE = 86;

// Which advanced input a searchable field belongs to — číslo dílu výrobce is
// part of the typové označení input, same as everywhere else in the app.
function advancedFieldOf(fieldName: string): AdvancedField | null {
  if (fieldName === 'cisloDiluVyrobce') return 'typoveOznaceni';
  return (ADVANCED_FIELDS as readonly string[]).includes(fieldName)
    ? (fieldName as AdvancedField)
    : null;
}

const NON_ASCII = /[^\x00-\x7F]/;

function dedupeHaystacks(a: string, b: string): string[] {
  return a === b ? [a] : [a, b];
}

/**
 * How well a query word sits in one already-normalized field value that is
 * known to contain it. `words` is that value pre-split into tokens.
 */
function scoreNeedleInHaystack(needle: string, hay: string, words: string[]): number {
  if (hay === needle) return 100;
  if (words.includes(needle)) return 95;
  if (words.some(w => w.startsWith(needle))) return 85;
  // A short word only counts on a boundary, otherwise it is letter-noise
  if (needle.length <= SHORT_WORD_MAX) return boundaryRegex(needle).test(hay) ? 80 : 0;
  return 75;
}

// Searchable fields in a stable order, so a word→field assignment can be
// represented as plain indices while refining it below. The order is also the
// tie-break: when a word sits equally well in several fields, the identifying
// ones win — „UT 2,5" belongs in Typové označení rather than in Název, even
// though „Kryt na UT 2,5 / 10 GY" matches it just as strongly.
const CROSS_FIELD_KEYS = ['typoveOznaceni', 'vyrobce', 'artikl', 'nazev', 'cisloDiluVyrobce'] as const;

/**
 * Picks which field each query word belongs to.
 *
 * Scoring uses the greedy per-word maximum, which is already the best possible
 * combination: the article score is the *minimum* over words, and min is
 * monotone, so maximizing each word independently maximizes it. Brute force over
 * all assignments confirmed this — it never beat greedy on any article.
 *
 * Ties are a different story, and that is what this refinement is for. Many
 * assignments reach the same minimum while scattering the words over different
 * fields, and greedy picks arbitrarily among them — which is how „phoenix UT 2,5"
 * ended up as Výrobce „phoenix" + Název „UT" + Typové označení „2,5", tearing
 * „UT 2,5" in half. Among equally-scoring assignments, prefer the one that keeps
 * words the user typed next to each other in the same field, then the one using
 * fewer fields.
 */
function refineAssignment(matrix: number[][], greedy: number[]): number[] {
  const wordCount = matrix.length;
  const fieldCount = CROSS_FIELD_KEYS.length;

  // 5^6 assignments is already 15 k per article — not worth it past 5 words
  if (wordCount < 2 || wordCount > 5) return greedy;

  const scoreOf = (pick: number[]) => {
    let min = 100;
    for (let i = 0; i < wordCount; i++) min = Math.min(min, matrix[i][pick[i]]);
    return min;
  };
  const adjacencyOf = (pick: number[]) => {
    let same = 0;
    for (let i = 1; i < wordCount; i++) if (pick[i] === pick[i - 1]) same++;
    return same;
  };

  let best = greedy;
  let bestScore = scoreOf(greedy);
  let bestAdjacency = adjacencyOf(greedy);
  let bestFields = new Set(greedy).size;

  const total = fieldCount ** wordCount;
  const pick = new Array<number>(wordCount);

  for (let code = 0; code < total; code++) {
    let rest = code;
    for (let i = 0; i < wordCount; i++) {
      pick[i] = rest % fieldCount;
      rest = Math.floor(rest / fieldCount);
    }

    const score = scoreOf(pick);
    if (score < bestScore) continue;

    const adjacency = adjacencyOf(pick);
    const fields = new Set(pick).size;

    if (
      score > bestScore ||
      adjacency > bestAdjacency ||
      (adjacency === bestAdjacency && fields < bestFields)
    ) {
      best = [...pick];
      bestScore = score;
      bestAdjacency = adjacency;
      bestFields = fields;
    }
  }

  return best;
}

/**
 * Matches a multi-word query whose words live in *different* fields — the
 * typical "výrobce + typové označení" query that no single field can satisfy.
 * Strict AND: every word must be found in some field, otherwise the article is
 * rejected. Only meaningful for field 'all'; single-field hits are skipped
 * because the ordinary search paths already score those higher.
 */
function crossFieldSearch(articles: Article[], query: string): SearchResult[] {
  // A one-character word carries real information in a designation — „ST 9" is
  // meaningless without the „9" — and here it cannot flood anything: every word
  // has to match (AND) and the boundary rule applies, so „9" hits „ST 9" but not
  // the „9" inside „1819".
  const rawWords = query.trim().split(/\s+/).filter(w => removeDiacritics(w).length >= 1);
  if (rawWords.length < 2) return [];

  // Normalize the query once — the article loop below runs 80k+ times
  const needles = rawWords.map(w => removeDiacritics(w).toLowerCase());
  const wordCount = needles.length;
  const fieldCount = CROSS_FIELD_KEYS.length;

  // „2,5" can never be a token under the ordinary split (it breaks on „,"), so
  // when a word carries a decimal separator, tokenize a second way that keeps it.
  const needsCoarseTokens = needles.some(n => /[.,]/.test(n));

  // Compact forms for the separator-insensitive retry („ST9" vs „ST 9"), empty
  // for words that cannot benefit from it — see needsCompactRetry
  const compactNeedles = needles.map(n => (needsCompactRetry(n) ? stripSeparators(n) : ''));

  const results: SearchResult[] = [];
  const matrix: number[][] = needles.map(() => new Array<number>(fieldCount).fill(0));

  for (const article of articles) {
    const fields = getSearchableFields(article, 'all');

    for (let i = 0; i < wordCount; i++) matrix[i].fill(0);

    for (let f = 0; f < fieldCount; f++) {
      const fieldName = CROSS_FIELD_KEYS[f];
      const value = fields[fieldName];
      if (!value) continue;

      // 95 % of the database is plain ASCII, and normalizing is by far the most
      // expensive step here (~80k articles × 5 fields per query), so pay for it
      // only where diacritics actually occur.
      const hays = NON_ASCII.test(value)
        ? dedupeHaystacks(removeDiacritics(value).toLowerCase(), stripDiacriticChars(value).toLowerCase())
        : [value.toLowerCase()];

      // Splitting into tokens is also costly, so do it only for a field that
      // actually contains one of the words — lazily, and at most once per hay.
      const wordLists: Array<string[] | undefined> = [undefined, undefined];

      for (let i = 0; i < wordCount; i++) {
        const needle = needles[i];
        for (let h = 0; h < hays.length; h++) {
          const hay = hays[h];
          if (!hay.includes(needle)) continue;

          let words = wordLists[h];
          if (!words) {
            words = hay.split(/[\s,.\-_/\\]+/).filter(Boolean);
            if (needsCoarseTokens) {
              words = words.concat(hay.split(/[\s\-_/\\]+/).filter(Boolean));
            }
            wordLists[h] = words;
          }

          const score = scoreNeedleInHaystack(needle, hay, words);
          if (score > matrix[i][f]) matrix[i][f] = score;
        }

        // The value may spell the word with a separator the query did not use
        // („ST9" against typové označení „ST 9"), so retry tolerantly.
        if (matrix[i][f] > 0) continue;
        if (!compactNeedles[i]) continue;

        for (let h = 0; h < hays.length; h++) {
          if (!matchesAcrossSeparators(needle, hays[h])) continue;

          // Whole field is the word once separators are ignored → exact
          if (stripSeparators(hays[h]) === compactNeedles[i]) {
            matrix[i][f] = 100;
            break;
          }
          // A separator was ignored to get here, so stay just below a clean
          // token match (95) — the value as written did not contain the word
          if (matrix[i][f] < 90) matrix[i][f] = 90;
        }
      }
    }

    // Strict AND — every word has to land somewhere. Greedy per-word maximum is
    // the optimal score (see refineAssignment).
    const greedy = new Array<number>(wordCount);
    let weakest = 100;
    for (let i = 0; i < wordCount; i++) {
      let bestField = 0;
      let bestScore = 0;
      for (let f = 0; f < fieldCount; f++) {
        if (matrix[i][f] > bestScore) {
          bestScore = matrix[i][f];
          bestField = f;
        }
      }
      if (bestScore === 0) {
        weakest = 0;
        break;
      }
      greedy[i] = bestField;
      if (bestScore < weakest) weakest = bestScore;
    }
    if (weakest === 0) continue;

    // All words in one field — the ordinary search paths handle that better
    if (new Set(greedy).size < 2) continue;

    // Only survivors get here (a handful per query), so the combination search
    // over ties is affordable — it costs ~0.02 ms per article.
    const pick = refineAssignment(matrix, greedy);

    const wordsPerField = new Map<string, string[]>();
    for (let i = 0; i < wordCount; i++) {
      const fieldName = CROSS_FIELD_KEYS[pick[i]];
      const existing = wordsPerField.get(fieldName);
      if (existing) existing.push(rawWords[i]);
      else wordsPerField.set(fieldName, [rawWords[i]]);
    }

    const assignment: AdvancedQuery = {};
    const highlightedFields: SearchResult['highlightedFields'] = {};

    for (const [fieldName, words] of wordsPerField) {
      const joined = words.join(' ');
      highlightedFields[fieldName as keyof SearchResult['highlightedFields']] =
        highlightMatchWildcard(fields[fieldName], joined);

      const target = advancedFieldOf(fieldName);
      if (target) {
        assignment[target] = assignment[target] ? `${assignment[target]} ${joined}` : joined;
      }
    }

    results.push({
      ...article,
      score: Math.min(CROSS_FIELD_MAX_SCORE, weakest),
      matchType: weakest >= 95 ? 'medium' : 'large',
      highlightedFields,
      crossField: assignment,
    });
  }

  return results;
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

  // Users often type a query whose words live in different fields
  // („siemens 3RV2011" = výrobce + typové označení). No single field can match
  // that, so the paths above find nothing (wildcard) or rank the right article
  // no higher than wrong ones (fuzzy). Add those matches on top; single-field
  // hits keep their higher scores and stay above them.
  if (options.field === 'all' && !options.query.includes('*') && !options.query.includes('?')) {
    const crossFieldResults = crossFieldSearch(articles, options.query);

    if (crossFieldResults.length > 0) {
      const byKey = new Map<string, SearchResult>();
      for (const r of results) byKey.set(articleKey(r), r);

      for (const r of crossFieldResults) {
        const key = articleKey(r);
        const existing = byKey.get(key);
        // A single-field hit that already scored higher wins and keeps no
        // crossField mark — the query worked as typed for that article, so the
        // UI has no reason to suggest splitting it.
        if (!existing || r.score > existing.score) {
          byKey.set(key, r);
        }
      }

      results = Array.from(byKey.values());
    }
  }

  if (options.manufacturers && options.manufacturers.length > 0) {
    results = results.filter(r =>
      options.manufacturers!.includes(r.vyrobce)
    );
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, options.maxResults);
}

// ---------------------------------------------------------------------------
// Advanced (multi-field) search — several field criteria combined with AND
// ---------------------------------------------------------------------------

function runSingleFieldSearch(
  articles: Article[],
  query: string,
  field: SearchField,
  mode: SearchOptions['mode'],
): SearchResult[] {
  switch (mode) {
    case 'wildcard':
      return wildcardSearch(articles, query, field);
    case 'fuzzy':
      return fuzzySearch(articles, query, field);
    case 'combined':
      return combinedSearch(articles, query, field);
  }
}

/** Criteria with a non-empty value, in a stable order. */
export function activeCriteria(criteria: AdvancedSearchOptions['criteria']): Array<[AdvancedField, string]> {
  return ADVANCED_FIELDS
    .map((f) => [f, (criteria[f] ?? '').trim()] as [AdvancedField, string])
    .filter(([, value]) => value.length > 0);
}

export function searchAdvanced(
  articles: Article[],
  options: AdvancedSearchOptions,
): SearchResult[] {
  const criteria = activeCriteria(options.criteria);

  if (criteria.length === 0) {
    return [];
  }

  // Run each criterion as an ordinary single-field search, then keep only the
  // articles returned by every criterion (AND) and merge their scores/highlights.
  let candidates: Map<string, SearchResult> | null = null;

  for (const [field, query] of criteria) {
    const perCriterion = new Map<string, SearchResult>();
    for (const r of runSingleFieldSearch(articles, query, field, options.mode)) {
      const key = articleKey(r);
      const existing = perCriterion.get(key);
      if (!existing || r.score > existing.score) {
        perCriterion.set(key, r);
      }
    }

    if (candidates === null) {
      candidates = perCriterion;
      continue;
    }

    const merged = new Map<string, SearchResult>();
    for (const [key, prev] of candidates) {
      const next = perCriterion.get(key);
      if (!next) continue; // fails this criterion → drop
      merged.set(key, {
        ...prev,
        // AND match quality is limited by its weakest criterion
        score: Math.min(prev.score, next.score),
        matchType: next.score < prev.score ? next.matchType : prev.matchType,
        highlightedFields: { ...prev.highlightedFields, ...next.highlightedFields },
      });
    }
    candidates = merged;

    if (candidates.size === 0) break;
  }

  let results = Array.from(candidates!.values());

  if (options.manufacturers && options.manufacturers.length > 0) {
    results = results.filter((r) => options.manufacturers!.includes(r.vyrobce));
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, options.maxResults);
}

export function searchSuggestions(articles: Article[], query: string, field: SearchField = 'all'): SearchResult[] {
  if (!query.trim()) return [];

  const keys = field === 'all'
    ? ['nazev', 'typoveOznaceni', 'vyrobce', 'artikl', 'cisloDiluVyrobce']
    : field === 'typoveOznaceni'
    ? ['typoveOznaceni', 'cisloDiluVyrobce']
    : [field];

  const fuse = new Fuse(articles, {
    keys,
    threshold: 0.5,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    getFn: (obj: Article, path: string | string[]) => {
      const pathStr = Array.isArray(path) ? path[0] : path;
      const value = (obj as unknown as Record<string, unknown>)[pathStr];
      if (typeof value === 'string') return removeDiacritics(value);
      return (value ?? '') as string;
    },
  });

  return fuse.search(removeDiacritics(query)).slice(0, 3).map(r => ({
    ...r.item,
    score: Math.round((1 - (r.score ?? 0.5)) * 100),
    matchType: 'large' as const,
    highlightedFields: {},
  }));
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
