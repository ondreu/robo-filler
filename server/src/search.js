import Fuse from 'fuse.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '../../public');

function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/�/g, '');
}

function parseCSV(content) {
  const articles = [];
  for (const line of content.trim().split('\n')) {
    const parts = line.trim().split(';');
    if (parts.length >= 5) {
      articles.push({
        typoveOznaceni: removeDiacritics(parts[0]?.trim() ?? ''),
        artikl:         removeDiacritics(parts[1]?.trim() ?? ''),
        vyrobce:        removeDiacritics(parts[2]?.trim() ?? ''),
        nazev:          removeDiacritics(parts[3]?.trim() ?? ''),
        cisloDiluVyrobce: removeDiacritics(parts[4]?.trim() ?? ''),
        vybehovyDil:    removeDiacritics(parts[5]?.trim() ?? ''),
        status:         parts[6]?.trim() ?? '',
      });
    }
  }
  return articles;
}

function loadDataset(filename) {
  try {
    const content = readFileSync(join(DATA_DIR, filename), 'utf-8');
    return parseCSV(content);
  } catch {
    console.warn(`[search] Could not load ${filename}`);
    return [];
  }
}

// Load both datasets at startup
const allArticles = [
  ...loadDataset('master-data.csv'),
  ...loadDataset('master-data-effi.csv'),
];

console.log(`[search] Loaded ${allArticles.length} articles`);

export const articleCount = allArticles.length;

function wildcardSearch(articles, query) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const regexes = words.map(w => new RegExp(removeDiacritics(w), 'i'));

  return articles.filter(a => {
    const haystack = removeDiacritics(
      [a.nazev, a.typoveOznaceni, a.artikl, a.vyrobce, a.cisloDiluVyrobce].join(' ')
    );
    return regexes.every(re => re.test(haystack));
  });
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

  return fuse.search(removeDiacritics(query)).map(r => r.item);
}

/**
 * Run combined search for a single query term, return top N unique articles.
 */
export function searchTerm(query, topN = 5) {
  const wildcard = wildcardSearch(allArticles, query);
  const fuzzy    = fuzzySearch(allArticles, query);

  const seen = new Set();
  const results = [];

  for (const a of [...wildcard, ...fuzzy]) {
    if (!seen.has(a.artikl)) {
      seen.add(a.artikl);
      results.push(a);
      if (results.length >= topN) break;
    }
  }

  return results;
}
