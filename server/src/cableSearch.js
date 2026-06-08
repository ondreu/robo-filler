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
console.log(`[cableSearch] Loaded ${allCables.length} cable articles`);

export const cableArticleCount = allCables.length;

function norm(val) {
  return (val ?? '').toString().toLowerCase().trim();
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
      if (val === 'více než 30') {
        result = result.filter(c => {
          const n = parseInt(c.pocetZil);
          return !isNaN(n) && n > 30;
        });
      } else {
        const num = parseInt(val);
        if (!isNaN(num)) {
          result = result.filter(c => {
            const n = parseInt(c.pocetZil);
            return n === num;
          });
        }
      }
    }

    if (ans.key === 'kabel_prurez') {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        result = result.filter(c => {
          const p = parseFloat(c.prurez);
          return !isNaN(p) && Math.abs(p - num) < 0.001;
        });
      }
    }

    if (ans.key === 'stineni') {
      if (val.includes('Stíněný')) {
        result = result.filter(c => isYes(c.stineni));
      } else if (val.includes('Bez stínění')) {
        result = result.filter(c => isNo(c.stineni) || c.stineni === null);
      }
    }

    if (ans.key === 'materialPlaste') {
      if (val.includes('PUR')) {
        result = result.filter(c => norm(c.materialPlaste).includes('pur'));
      } else if (val.includes('Bezhalogenový') || val.includes('FRNC') || val.includes('LSZH')) {
        result = result.filter(c => ['halogen free', 'bezhalogen', 'polyolefin'].some(k => norm(c.materialPlaste).includes(k)));
      } else if (val.includes('Gumový') || val.includes('EPR') || val.includes('EPDM')) {
        result = result.filter(c => {
          const mp = norm(c.materialPlaste);
          return mp.includes('pry') || mp.includes('gum') || mp.includes('epr') || mp.includes('epdm') || mp.includes('silikon');
        });
      } else if (val.includes('PVC')) {
        // null materialPlaste = standard cable (typically PVC) — include it
        result = result.filter(c => c.materialPlaste === null || norm(c.materialPlaste).includes('pvc'));
      }
    }

    if (ans.key === 'retiez') {
      if (val.includes('Ano') || val.includes('e-chain') || val.includes('ohebný')) {
        result = result.filter(c => isYes(c.retiez));
      } else if (val.includes('Ne') || val.includes('pevné')) {
        // null retiez = standard fixed installation (not e-chain)
        result = result.filter(c => isNo(c.retiez) || c.retiez === null);
      }
    }

    if (ans.key === 'kabel_vyrobce') {
      const mfr = val.toLowerCase();
      result = result.filter(c => {
        const v = norm(c.vyrobce);
        if (mfr.includes('lapp')) return v.includes('lapp');
        if (mfr.includes('helukabel')) return v.includes('helukabel');
        if (mfr.includes('nexans')) return v.includes('nexans');
        if (mfr.includes('huber') || mfr.includes('suhner')) return v.includes('huber') || v.includes('suhner');
        return true;
      });
    }
  }

  return result.map(c => ({ ...c, _matchType: 'filter', _db: 'cables' }));
}
