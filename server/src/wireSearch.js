import Fuse from 'fuse.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '../../public');

const BM25_K1 = 1.5;
const BM25_B  = 0.75;

function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/�/g, '');
}

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

function loadWires() {
  try {
    const content = readFileSync(join(DATA_DIR, 'wires.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    console.warn('[wireSearch] Could not load wires.json');
    return [];
  }
}

const allWires = loadWires();
console.log(`[wireSearch] Loaded ${allWires.length} wire articles`);

export const wireArticleCount = allWires.length;
export const wireLastUpdate = '';

// ─── BM25 ────────────────────────────────────────────────────────────────────

function tokenize(text) {
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 1);
}

function buildBM25Index(articles) {
  const N = articles.length;
  const invertedIndex = new Map();
  const docLengths = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    const a = articles[i];
    // Include barva, prurez, skupina in index for wire-specific search
    const prurezStr = a.prurez != null ? String(a.prurez) : '';
    const tokens = tokenize(
      [a.nazev, a.typoveOznaceni, a.artikl, a.vyrobce, a.cisloDiluVyrobce, a.barva, prurezStr, a.skupina].join(' ')
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
  console.log(`[wireSearch] BM25 index: ${sortedTokens.length} tokens, avgDL=${avgDL.toFixed(1)}`);
  return { invertedIndex, sortedTokens, docLengths, avgDL, N };
}

function lowerBound(arr, prefix) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  return lo;
}

const bm25Idx = buildBM25Index(allWires);

function bm25Search(query, topN, mfrFilter) {
  const { invertedIndex, sortedTokens, docLengths, avgDL, N } = bm25Idx;
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const scores    = new Map();
  const tokenHits = new Map();

  for (const qt of queryTokens) {
    const usePrefix = qt.length >= 2;
    const start = lowerBound(sortedTokens, qt);
    const end   = usePrefix ? lowerBound(sortedTokens, qt + '￿') : start + 1;
    const hitSet = new Set();

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
        hitSet.add(idx);
      }
    }
    for (const idx of hitSet) tokenHits.set(idx, (tokenHits.get(idx) ?? 0) + 1);
  }

  if (!scores.size) return [];

  const required = queryTokens.length;
  let entries = [...scores.entries()]
    .filter(([idx]) => (tokenHits.get(idx) ?? 0) >= required);

  if (mfrFilter) {
    const mfr = removeDiacritics(mfrFilter).toLowerCase();
    entries = entries.filter(([idx]) =>
      removeDiacritics(allWires[idx].vyrobce).toLowerCase().includes(mfr)
    );
  }

  entries.sort((a, b) => b[1] - a[1]);
  const maxScore = entries[0]?.[1] ?? 1;

  return entries.slice(0, topN).map(([idx, score]) => ({
    ...allWires[idx],
    _score: score / maxScore,
    _matchType: 'bm25',
    _db: 'wires',
  }));
}

// ─── Wildcard ────────────────────────────────────────────────────────────────

function wildcardSearch(corpus, query) {
  const words   = query.trim().split(/\s+/).filter(Boolean);
  const regexes = words.map(w => {
    const stripped = removeDiacritics(w);
    const charless = stripDiacriticChars(w);
    if (stripped === charless) return new RegExp(stripped, 'i');
    return new RegExp(`(?:${stripped}|${charless})`, 'i');
  });

  const prurezStr = (a) => a.prurez != null ? String(a.prurez) : '';

  return corpus
    .filter(a => {
      const haystack = removeDiacritics(
        [a.nazev, a.typoveOznaceni, a.artikl, a.vyrobce, a.cisloDiluVyrobce, a.barva, prurezStr(a), a.skupina].join(' ')
      );
      return regexes.every(re => re.test(haystack));
    })
    .map(a => ({ ...a, _score: 1.0, _matchType: 'wildcard', _db: 'wires' }));
}

// ─── Fuzzy ───────────────────────────────────────────────────────────────────

function fuzzySearch(corpus, query) {
  const fuse = new Fuse(corpus, {
    keys: ['nazev', 'typoveOznaceni', 'artikl', 'vyrobce', 'cisloDiluVyrobce', 'barva', 'skupina'],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    getFn: (obj, path) => {
      const key = Array.isArray(path) ? path[0] : path;
      const val = key === 'prurez' ? String(obj.prurez ?? '') : (obj[key] ?? '');
      return typeof val === 'string' ? removeDiacritics(val) : '';
    },
  });

  return fuse.search(removeDiacritics(query)).map(r => ({
    ...r.item,
    _score: 1 - (r.score ?? 0.5),
    _matchType: 'fuzzy',
    _db: 'wires',
  }));
}

// ─── Filter-based search (deterministic, no AI) ───────────────────────────────

const BARVA_MAP = [
  ['Černá',        b => b === 'BK' || b === 'BKWH' || b === 'WHBK'],
  ['Červená',      b => b === 'RD' || b === 'RDWH' || b === 'WHRD'],
  ['Hnědá',        b => b === 'BN' || b === 'BNWH'],
  ['Oranžová',     b => b === 'OG' || b === 'OGWH' || b === 'WHOG'],
  ['Žlutá',        b => b === 'YE'],
  ['Zelená',       b => b === 'GN' || b === 'GNWH' || b === 'WHGN'],
  ['Zeleno-žlutá', b => b === 'GNYE'],
  ['Světle modrá', b => b === 'LBU' || b === 'BUWH' || b === 'WHBU'],
  ['Tmavě modrá',  b => b === 'DBU' || b === 'DBUWH'],
  ['Šedá',         b => b === 'GY'],
  ['Fialová',      b => b === 'VT' || b === 'VTWH' || b === 'WHVT'],
  ['Bílá',         b => b === 'WH' || b.startsWith('WH')],
  ['Růžová',       b => b === 'PK'],
  ['Bordó',        b => b === 'BURD'],
];

const SKUPINA_MAP = [
  ['Standardní',    s => s === 'CE'],
  ['Bezhalogenový', s => s === 'CE_Halogen-free'],
  ['Flexibilní',    s => s === 'CE_flexibilni' || s === 'CE_vysoce_flexibilni'],
  ['RADOX',         s => s.startsWith('RADOX')],
  ['ÖLFLEX HEAT',   s => s.startsWith('ÖLFLEX HEAT')],
  ['UL',            s => s.startsWith('UL_')],
  ['NSGAFÖU',       s => s.startsWith('NSGAFÖU')],
  ['NSHXAFÖ',       s => s.startsWith('NSHXAFÖ')],
  ['PTFE',          s => s.startsWith('DESCAFLEX')],
  ['ALPHAWIRE',     s => s.startsWith('ALPHAWIRE')],
  ['Silikon',       s => s.includes('Silikon') || s.includes('SiF')],
];

/**
 * Filter wires by structured answers (from guided search).
 * Returns ALL matching wires (no topN limit) — caller should slice.
 */
export function filterWires(answers) {
  let result = [...allWires];

  for (const ans of answers) {
    if (!ans.answer) continue;
    const val = ans.answer.trim();
    if (val === 'Bez omezení' || val === 'Bez preference') continue;

    if (ans.key === 'wire_typ') {
      for (const [label, pred] of SKUPINA_MAP) {
        if (val.includes(label)) { result = result.filter(w => pred(w.skupina || '')); break; }
      }
    }

    if (ans.key === 'prurez') {
      const num = parseFloat(val);
      if (!isNaN(num)) result = result.filter(w => w.prurez === num);
    }

    if (ans.key === 'barva') {
      for (const [label, pred] of BARVA_MAP) {
        if (val.includes(label)) { result = result.filter(w => w.barva && pred(w.barva)); break; }
      }
    }

    if (ans.key === 'vyrobce') {
      const mfr = val.toLowerCase();
      result = result.filter(w => {
        const v = (w.vyrobce || '').toLowerCase();
        if (mfr.includes('lapp')) return v.includes('lapp');
        if (mfr.includes('helukabel')) return v.includes('helukabel');
        if (mfr.includes('huber') || mfr.includes('suhner') || mfr.includes('radox')) return v.includes('huber') || v.includes('suhner');
        if (mfr.includes('kablo')) return v.includes('kablo');
        if (mfr.includes('leoni')) return v.includes('leoni');
        if (mfr.includes('alphawire')) return v.includes('alphawire');
        if (mfr.includes('desca')) return v.includes('desca');
        return true;
      });
    }
  }

  return result.map(w => ({ ...w, _matchType: 'filter', _db: 'wires' }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search wire-specific database.
 * Returns articles with _score (0–1), _matchType, and _db='wires'.
 */
export function searchWires(query, topN = 5, manufacturerFilter = null) {
  let corpus = allWires;
  if (manufacturerFilter) {
    const mfr = removeDiacritics(manufacturerFilter).toLowerCase();
    const filtered = allWires.filter(a =>
      removeDiacritics(a.vyrobce).toLowerCase().includes(mfr)
    );
    if (filtered.length > 0) corpus = filtered;
  }

  const wildcard = wildcardSearch(corpus, query);
  const fuzzy    = fuzzySearch(corpus, query);
  const bm25     = bm25Search(query, topN * 2, manufacturerFilter);

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
