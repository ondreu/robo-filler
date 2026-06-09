import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '../../public');

function loadCables() {
  try {
    const content = readFileSync(join(DATA_DIR, 'cables.json'), 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const allCables = loadCables();
if (allCables.length === 0) {
  console.error(`[cableSearch] CHYBA: cables.json nenalezen! Očekávaná cesta: ${join(DATA_DIR, 'cables.json')}`);
} else {
  console.log(`[cableSearch] Loaded ${allCables.length} cable articles`);
}

export const cableArticleCount = allCables.length;

function norm(val) {
  return (val ?? '').toString().toLowerCase().trim();
}

function parseMultiVal(val) {
  return val.split('|||').map(s => s.trim()).filter(s => s && s !== 'Bez omezení' && s !== 'Bez preference');
}

// cables.json uses normalized 'ANO'/'NE'/null
function isYes(val) { return val === 'ANO'; }
function isNo(val)  { return val === 'NE'; }

/**
 * Filter cables by structured answers (from guided search).
 * dropKeys: array of answer keys to skip (progressive relaxation).
 * Returns ALL matching cables (no topN limit) — caller should slice.
 */
export function filterCables(answers, dropKeys = []) {
  if (allCables.length === 0) return [];

  let result = [...allCables];

  for (const ans of answers) {
    if (!ans.answer) continue;
    if (dropKeys.includes(ans.key)) continue;
    const val = ans.answer.trim();
    if (val === 'Bez omezení' || val === 'Bez preference') continue;

    if (ans.key === 'pocetZil') {
      const vals = parseMultiVal(val);
      if (vals.length > 0) {
        result = result.filter(c => vals.some(v => {
          if (v === 'více než 30') { const n = parseInt(c.pocetZil); return !isNaN(n) && n > 30; }
          const num = parseInt(v);
          return !isNaN(num) && parseInt(c.pocetZil) === num;
        }));
      } else if (val === 'více než 30') {
        result = result.filter(c => { const n = parseInt(c.pocetZil); return !isNaN(n) && n > 30; });
      } else {
        const num = parseInt(val);
        if (!isNaN(num)) result = result.filter(c => parseInt(c.pocetZil) === num);
      }
    }

    if (ans.key === 'kabel_prurez') {
      const nums = parseMultiVal(val).map(v => parseFloat(v)).filter(n => !isNaN(n));
      if (nums.length === 0) {
        const single = parseFloat(val);
        if (!isNaN(single)) result = result.filter(c => { const p = parseFloat(c.prurez); return !isNaN(p) && Math.abs(p - single) < 0.001; });
      } else {
        result = result.filter(c => { const p = parseFloat(c.prurez); return !isNaN(p) && nums.some(num => Math.abs(p - num) < 0.001); });
      }
    }

    if (ans.key === 'stineni') {
      const vals = parseMultiVal(val);
      const checkVal = vals.length > 0 ? vals : [val];
      const wantShielded = checkVal.some(v => v.includes('Stíněný'));
      const wantUnshielded = checkVal.some(v => v.includes('Bez stínění'));
      if (wantShielded && wantUnshielded) {
        // both — no filter
      } else if (wantShielded) {
        result = result.filter(c => isYes(c.stineni));
      } else if (wantUnshielded) {
        result = result.filter(c => isNo(c.stineni) || c.stineni === null);
      }
    }

    if (ans.key === 'materialPlaste') {
      const vals = parseMultiVal(val);
      const checkVals = vals.length > 0 ? vals : [val];
      const matTests = checkVals.map(v => {
        if (v.includes('PUR')) return mp => norm(mp).includes('pur');
        if (v.includes('Bezhalogenový') || v.includes('FRNC') || v.includes('LSZH')) return mp => ['halogen free', 'bezhalogen', 'polyolefin'].some(k => norm(mp).includes(k));
        if (v.includes('Gumový') || v.includes('EPR') || v.includes('EPDM')) return mp => { const m = norm(mp); return m.includes('pry') || m.includes('gum') || m.includes('epr') || m.includes('epdm') || m.includes('silikon'); };
        if (v.includes('PVC')) return mp => mp === null || norm(mp).includes('pvc');
        return null;
      }).filter(Boolean);
      if (matTests.length > 0) {
        result = result.filter(c => matTests.some(test => test(c.materialPlaste)));
      }
    }

    if (ans.key === 'retiez') {
      const vals = parseMultiVal(val);
      const checkVals = vals.length > 0 ? vals : [val];
      const wantChain = checkVals.some(v => v.includes('Ano') || v.includes('e-chain') || v.includes('ohebný'));
      const wantFixed = checkVals.some(v => v.includes('Ne') || v.includes('pevné'));
      if (wantChain && wantFixed) {
        // both — no filter
      } else if (wantChain) {
        result = result.filter(c => isYes(c.retiez));
      } else if (wantFixed) {
        result = result.filter(c => isNo(c.retiez) || c.retiez === null);
      }
    }

    if (ans.key === 'kabel_vyrobce') {
      const mfrs = parseMultiVal(val).map(v => v.toLowerCase());
      if (mfrs.length === 0) mfrs.push(val.toLowerCase());
      result = result.filter(c => {
        const v = norm(c.vyrobce);
        return mfrs.some(mfr => {
          if (mfr.includes('lapp')) return v.includes('lapp');
          if (mfr.includes('helukabel')) return v.includes('helukabel');
          if (mfr.includes('nexans')) return v.includes('nexans');
          if (mfr.includes('huber') || mfr.includes('suhner')) return v.includes('huber') || v.includes('suhner');
          return true;
        });
      });
    }
  }

  return result.map(c => ({ ...c, _matchType: 'filter', _db: 'cables' }));
}

// ─── Text search (BM25 + wildcard) ────────────────────────────────────────────

function removeDiacritics(str) {
  return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(text) {
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 1);
}

const BM25_K1 = 1.5;
const BM25_B  = 0.75;

function buildCableBM25Index() {
  const N = allCables.length;
  const invertedIndex = new Map();
  const docLengths = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    const c = allCables[i];
    const tokens = tokenize([
      c.nazev, c.artikl, c.vyrobce,
      c.materialPlaste,
      c.barva,
      c.prurez != null ? String(c.prurez) : '',
      c.pocetZil != null ? String(c.pocetZil) : '',
    ].join(' '));
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
  console.log(`[cableSearch] BM25 index: ${sortedTokens.length} tokens, avgDL=${avgDL.toFixed(1)}`);
  return { invertedIndex, sortedTokens, docLengths, avgDL, N };
}

const cableBM25 = allCables.length > 0 ? buildCableBM25Index() : null;

function bm25SearchCables(query, topN, mfrFilter) {
  if (!cableBM25) return [];
  const { invertedIndex, sortedTokens, docLengths, avgDL, N } = cableBM25;
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const scores    = new Map();
  const tokenHits = new Map();

  for (const qt of queryTokens) {
    const usePrefix = qt.length >= 2;
    let lo = 0, hi = sortedTokens.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sortedTokens[mid] < qt) lo = mid + 1; else hi = mid; }
    const start = lo;
    lo = start; hi = sortedTokens.length;
    const fence = usePrefix ? qt + '￿' : null;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (fence && sortedTokens[mid] < fence) lo = mid + 1; else hi = mid; }
    const end = usePrefix ? lo : start + 1;

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
      removeDiacritics(allCables[idx].vyrobce ?? '').toLowerCase().includes(mfr)
    );
  }

  entries.sort((a, b) => b[1] - a[1]);
  const maxScore = entries[0]?.[1] ?? 1;
  return entries.slice(0, topN).map(([idx, score]) => ({
    ...allCables[idx],
    _score: score / maxScore,
    _matchType: 'bm25',
    _db: 'cables',
  }));
}

function wildcardSearchCables(corpus, query) {
  const words   = query.trim().split(/\s+/).filter(Boolean);
  const regexes = words.map(w => new RegExp(removeDiacritics(w), 'i'));
  return corpus
    .filter(c => {
      const haystack = removeDiacritics([
        c.nazev, c.artikl, c.vyrobce, c.materialPlaste, c.barva,
        c.prurez != null ? String(c.prurez) : '',
        c.pocetZil != null ? String(c.pocetZil) : '',
      ].join(' '));
      return regexes.every(re => re.test(haystack));
    })
    .map(c => ({ ...c, _score: 1.0, _matchType: 'wildcard', _db: 'cables' }));
}

/**
 * Search cables by free text query (BM25 + wildcard).
 * Returns articles with _score (0–1), _matchType, _db='cables'.
 */
export function searchCables(query, topN = 5, manufacturerFilter = null) {
  let corpus = allCables;
  if (manufacturerFilter) {
    const mfr = removeDiacritics(manufacturerFilter).toLowerCase();
    const filtered = allCables.filter(c =>
      removeDiacritics(c.vyrobce ?? '').toLowerCase().includes(mfr)
    );
    if (filtered.length > 0) corpus = filtered;
  }

  const wildcard = wildcardSearchCables(corpus, query);
  const bm25     = bm25SearchCables(query, topN * 2, manufacturerFilter);

  const seen    = new Set();
  const results = [];
  for (const c of [...wildcard, ...bm25]) {
    if (!seen.has(c.artikl)) {
      seen.add(c.artikl);
      results.push(c);
      if (results.length >= topN) break;
    }
  }
  return results;
}
