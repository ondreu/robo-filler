import Fuse from 'fuse.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '../../public');

const BM25_K1 = 1.5;
const BM25_B  = 0.75;

function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/�/g, '');
}

// Returns string with diacritic-bearing characters removed entirely (e.g. "lišta" → "lita")
function stripDiacriticChars(str) {
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


function parseCSV(content) {
  const articles = [];
  for (const line of content.trim().split('\n')) {
    const parts = line.trim().split(';');
    if (parts.length >= 5) {
      articles.push({
        typoveOznaceni:   parts[0]?.trim() ?? '',
        artikl:           parts[1]?.trim() ?? '',
        vyrobce:          parts[2]?.trim() ?? '',
        nazev:            parts[3]?.trim() ?? '',
        cisloDiluVyrobce: parts[4]?.trim() ?? '',
        vybehovyDil:      parts[5]?.trim() ?? '',
        status:           parts[6]?.trim() ?? '',
      });
    }
  }
  return articles;
}

function decodeSmart(buf) {
  // Master CSV historicky bývá windows-1250; admin upload může být UTF-8.
  // Zkus UTF-8 — když obsahuje náhradní znak (nevalidní UTF-8), dekóduj jako win-1250.
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (utf8.includes('�')) {
    return new TextDecoder('windows-1250').decode(buf);
  }
  return utf8;
}

function loadDataset(filename) {
  try {
    const buf = readFileSync(join(DATA_DIR, filename));
    return parseCSV(decodeSmart(buf));
  } catch {
    console.warn(`[search] Could not load ${filename}`);
    return [];
  }
}

const MASTER_FILES = ['master-data.csv', 'master-data-effi.csv'];

function loadAllArticles() {
  return MASTER_FILES.flatMap(loadDataset);
}

let allArticles = loadAllArticles();

console.log(`[search] Loaded ${allArticles.length} articles`);

export const articleCount = allArticles.length;
export function getArticleCount() { return allArticles.length; }

// ─── BM25 ────────────────────────────────────────────────────────────────────

function tokenizeBM25(text) {
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

function buildBM25Index(articles) {
  const N = articles.length;
  // inverted index: token → [{idx, tf}]
  const invertedIndex = new Map();
  const docLengths = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    const a = articles[i];
    const tokens = tokenizeBM25(
      [a.nazev, a.typoveOznaceni, a.artikl, a.vyrobce, a.cisloDiluVyrobce].join(' ')
    );
    docLengths[i] = tokens.length;

    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;

    for (const [t, freq] of Object.entries(tf)) {
      if (!invertedIndex.has(t)) invertedIndex.set(t, []);
      invertedIndex.get(t).push({ idx: i, tf: freq });
    }
  }

  const avgDL = docLengths.reduce((s, v) => s + v, 0) / N;
  const sortedTokens = [...invertedIndex.keys()].sort();

  console.log(`[search] BM25 index: ${sortedTokens.length} unique tokens, avgDL=${avgDL.toFixed(1)}`);
  return { invertedIndex, sortedTokens, docLengths, avgDL, N };
}

// Binary search for first index in sorted array where arr[i] >= prefix
function lowerBound(arr, prefix) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  return lo;
}

let bm25Index = buildBM25Index(allArticles);

// Obnoví hlavní DB i index po nahrání nového master CSV přes admin.
export function reloadMaster() {
  allArticles = loadAllArticles();
  bm25Index = buildBM25Index(allArticles);
  console.log(`[search] Reloaded ${allArticles.length} articles`);
  return allArticles.length;
}

function bm25Search(query, topN, manufacturerFilter) {
  const { invertedIndex, sortedTokens, docLengths, avgDL, N } = bm25Index;
  const queryTokens = tokenizeBM25(query);
  if (!queryTokens.length) return [];

  const scores     = new Map(); // articleIdx → accumulated BM25 score
  const tokenHits  = new Map(); // articleIdx → count of distinct query tokens matched

  for (const qt of queryTokens) {
    const usePrefix = qt.length >= 3;
    const start = lowerBound(sortedTokens, qt);
    const end   = usePrefix ? lowerBound(sortedTokens, qt + '￿') : start + 1;

    const hitThisToken = new Set();

    for (let ti = start; ti < end; ti++) {
      const t = sortedTokens[ti];
      if (!usePrefix && t !== qt) continue;

      const postings = invertedIndex.get(t);
      if (!postings) continue;

      const df  = postings.length;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const { idx, tf } of postings) {
        const dl    = docLengths[idx];
        const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * dl / avgDL);
        scores.set(idx, (scores.get(idx) ?? 0) + idf * (tf * (BM25_K1 + 1)) / denom);
        hitThisToken.add(idx);
      }
    }

    for (const idx of hitThisToken) {
      tokenHits.set(idx, (tokenHits.get(idx) ?? 0) + 1);
    }
  }

  if (!scores.size) return [];

  // AND semantics: document must match ALL query tokens
  const required = queryTokens.length;
  let entries = [...scores.entries()]
    .filter(([idx]) => (tokenHits.get(idx) ?? 0) >= required);

  if (manufacturerFilter) {
    const mfr = removeDiacritics(manufacturerFilter).toLowerCase();
    entries = entries.filter(([idx]) =>
      removeDiacritics(allArticles[idx].vyrobce).toLowerCase().includes(mfr)
    );
  }

  entries.sort((a, b) => b[1] - a[1]);
  const maxScore = entries[0]?.[1] ?? 1;

  return entries.slice(0, topN).map(([idx, score]) => ({
    ...allArticles[idx],
    _score: score / maxScore,
    _matchType: 'bm25',
  }));
}

// ─── Fuse.js + wildcard ───────────────────────────────────────────────────────

function wildcardSearch(articles, query) {
  const words   = query.trim().split(/\s+/).filter(Boolean);
  const regexes = words.map(w => {
    const stripped = removeDiacritics(w);     // "lišta" → "lista"
    const charless = stripDiacriticChars(w);  // "lišta" → "lita"
    if (stripped === charless) return new RegExp(stripped, 'i');
    return new RegExp(`(?:${stripped}|${charless})`, 'i');
  });

  return articles
    .filter(a => {
      const haystack = removeDiacritics(
        [a.nazev, a.typoveOznaceni, a.artikl, a.vyrobce, a.cisloDiluVyrobce].join(' ')
      );
      return regexes.every(re => re.test(haystack));
    })
    .map(a => ({ ...a, _score: 1.0, _matchType: 'wildcard' }));
}

function fuzzySearch(articles, query) {
  const fuse = new Fuse(articles, {
    keys: ['nazev', 'typoveOznaceni', 'artikl', 'vyrobce', 'cisloDiluVyrobce'],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    getFn: (obj, path) => {
      const val = obj[Array.isArray(path) ? path[0] : path];
      return typeof val === 'string' ? removeDiacritics(val) : '';
    },
  });

  return fuse.search(removeDiacritics(query)).map(r => ({
    ...r.item,
    _score: 1 - (r.score ?? 0.5),
    _matchType: 'fuzzy',
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run combined wildcard + fuzzy + BM25 search for a single query term.
 * Returns articles with _score (0–1) and _matchType fields, sorted by score desc.
 */
export function searchTerm(query, topN = 5, manufacturerFilter = null) {
  let corpus = allArticles;
  if (manufacturerFilter) {
    const mfr = removeDiacritics(manufacturerFilter).toLowerCase();
    const filtered = allArticles.filter(a =>
      removeDiacritics(a.vyrobce).toLowerCase().includes(mfr)
    );
    if (filtered.length > 0) corpus = filtered;
  }

  const wildcard = wildcardSearch(corpus, query);
  const fuzzy    = fuzzySearch(corpus, query);
  const bm25     = bm25Search(query, topN * 2, manufacturerFilter);

  // Priority order: wildcard > fuzzy > bm25; first-seen wins (wildcard always takes precedence)
  const seen    = new Set();
  const results = [];

  for (const a of [...wildcard, ...fuzzy, ...bm25]) {
    if (!seen.has(a.artikl)) {
      seen.add(a.artikl);
      results.push(a);
      if (results.length >= topN) break;
    }
  }

  return results;
}
