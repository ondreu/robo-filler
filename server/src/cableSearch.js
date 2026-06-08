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
