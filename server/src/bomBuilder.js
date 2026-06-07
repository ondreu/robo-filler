import { Mistral } from '@mistralai/mistralai';
import { searchTerm } from './search.js';
import { resolveManufacturerKey, MANUFACTURER_DOCS } from './manufacturers.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL = 'mistral-small-latest';

const MATCH_SYSTEM = `Jsi expert na průmyslové komponenty. Dostaneš typové označení hledaného artiklu a seznam kandidátů z databáze.
Vyber nejlepší shodu nebo vrať null pokud žádný kandidát neodpovídá.

PREFERENCE ZÁKAZNÍKA: Pokud jsou zadány zákaznické preference (prefix/sufix), PREFERUJ artikly s tímto prefixem/sufixem před standardními artikly. Např. pokud preference je "STA", hledej "STA_5SY4116-1" nebo "5SY4116-1_STA" přednostně před "5SY4116-1".

KRITÉRIA SHODY:
- Typové označení kandidáta odpovídá hledanému (s nebo bez zákaznického prefixu/sufixu, nebo jako substring)
- Výrobce odpovídá (pokud zadán)
- Pokud žádný kandidát nesplňuje shodu v typovém označení nebo číslu dílu výrobce, vrať null

Odpovídej POUZE jako JSON: {"artikl": "číslo_artiklu"} nebo {"artikl": null}`;

const CHECK_SYSTEM = `Jsi expert na průmyslové komponenty a sestavení kusovníků. Dostaneš seznam položek kusovníku pro vyhledávání v databázi artiklů.

TVŮJ ÚKOL: Rozhodn, zda potřebuješ upřesnění od uživatele PŘED vyhledáváním. Pravidlo je "málo, ale správně" — zeptej se POUZE pokud:
1. Odpověď by VÝRAZNĚ ovlivnila výběr artiklů pro více řádků najednou (ne jen okrajově)
2. Informaci nelze odvodit z typového označení, popisu ani zadaných preferencí
3. Otázka je konkrétní a actionable — uživatel by nevěděl "proč se ptáš"

NEPTEJ SE na: výrobce pokud je jasný z typového označení, konkrétní parametry pokud jsou v typovém označení, obecné preference pokud jsou zadané, výchozí volby pokud jedna možnost je zjevně správná.

TYPICKÉ SITUACE KDY SE ZEPTAT:
- Zadány prefixy zákazníků v preferencích ale není jasné pro které výrobce — upřesni
- Hledané položky by mohly být zákaznické/projektové materiály a to není v preferencích uvedeno
- Více položek stejného druhu s rozdílnými parametry které se nedají odvodit (např. "jistič" bez proudu)
- Preferovaný výrobce pro skupinu položek není jasný

Maximálně 3 otázky. Otázky musí být stručné a konkrétní. Pokud je vše dostatečně jasné, vrať needsClarification: false.

Vrať JSON:
{
  "needsClarification": true,
  "questions": [
    {
      "id": "q1",
      "question": "Stručná otázka?",
      "type": "choice",
      "choices": ["Možnost A", "Možnost B", "Jiné / neurčeno"]
    }
  ]
}
Nebo: {"needsClarification": false, "questions": []}`;

const UNIT_SYSTEM = `Odhadni základní měrnou jednotku pro průmyslový artikl.
Pravidla:
- Kabely, vodiče, lany, hadice, trubky, lišty DIN, těsnění v roli → "m"
- Barvy, laky, oleje, lepidla v objemu → "l" nebo "kg"
- Všechno ostatní (komponenty, přístroje, svorky, šrouby, atd.) → "ks"

Odpovídej POUZE jako JSON: {"unit": "ks"}`;

const POST_CHECK_SYSTEM = `Jsi expert na průmyslové komponenty. Prošel/a jsi kusovník a některé položky nebyly nalezeny v databázi.
Rozhodni, zda by upřesnění od uživatele mohlo pomoci tyto položky najít.

ZEPTEJ SE POUZE pokud:
1. Je více nenalezených položek a konkrétní odpověď by VÝRAZNĚ zvýšila šanci na nalezení
2. Otázka je actionable — výsledek odpovědi přímo ovlivní vyhledávání
3. Nelze odvodit z dostupných informací

Příklady kdy se ZEPTAT:
- Jsou nenalezené položky zákaznické (s prefixem/sufixem) nebo standardní?
- Je preferovaný konkrétní výrobce pro nenalezené skupiny?

Příklady kdy SE NEZEPTAT:
- Jen 1-2 nenalezené položky (pravděpodobně opravdu neexistují v databázi)
- Typová označení jsou jasně specifická
- Všechno je dostatečně popsané

Max 2 otázky. Vrať JSON ve stejném formátu jako checkClarification.`;

export async function postCheckClarification(notFoundRows, preferences) {
  if (notFoundRows.length < 3) return { needsClarification: false, questions: [] };

  const summary = notFoundRows.slice(0, 15).map((r, i) =>
    `${i + 1}. typ:"${r.typoveOznaceni || ''}" popis:"${r.popis || ''}" výrobce:"${r.vyrobce || ''}"`
  ).join('\n');

  const userContent = [
    preferences ? `Zadané preference: ${preferences}` : '',
    `Nenalezené položky (${notFoundRows.length} celkem):\n${summary}`,
    notFoundRows.length > 15 ? `... a ${notFoundRows.length - 15} dalších` : '',
  ].filter(Boolean).join('\n');

  try {
    const resp = await client.chat.complete({
      model: MODEL,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: POST_CHECK_SYSTEM },
        { role: 'user', content: userContent },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    return {
      needsClarification: !!parsed.needsClarification,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch {
    return { needsClarification: false, questions: [] };
  }
}

export async function checkClarification(rows, preferences) {
  const activeRows = rows.filter(r => (r.typoveOznaceni || '').trim() || (r.altTypoveOznaceni || '').trim());
  if (activeRows.length === 0) return { needsClarification: false, questions: [] };

  const rowSummary = activeRows.slice(0, 20).map((r, i) =>
    `${i + 1}. typ:"${r.typoveOznaceni || ''}" popis:"${r.popis || ''}" výrobce:"${r.vyrobce || ''}"`
  ).join('\n');

  const userContent = [
    preferences ? `Zadané preference: ${preferences}` : 'Preference: žádné',
    `\nPoložky kusovníku (${activeRows.length} celkem):\n${rowSummary}`,
    activeRows.length > 20 ? `... a ${activeRows.length - 20} dalších` : '',
  ].filter(Boolean).join('\n');

  try {
    const resp = await client.chat.complete({
      model: MODEL,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: CHECK_SYSTEM },
        { role: 'user', content: userContent },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    return {
      needsClarification: !!parsed.needsClarification,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch {
    return { needsClarification: false, questions: [] };
  }
}

const DERIVE_SYSTEM = `Jsi expert na průmyslové komponenty. Na základě typového označení a přiloženého znalostního přehledu výrobce odvoz stručný, lidsky čitelný popis artiklu.

PRAVIDLA:
- Max 40 znaků, česky
- Uveď POUZE parametry, které přímo vyčteš z typového označení dle struktury produktové řady (proud, počet pólů, charakteristika, průřez, barva, počet vodičů apod.)
- Nepoužívej obecné fráze — jen konkrétní odvozené parametry
- KRITICKÉ: Pokud si nejsi zcela jistý dekódováním typového označení, nebo typové označení neodpovídá žádnému vzoru ve znalostním přehledu, vrať {"popis": ""}. Raději vrať prázdný popis než hádat nebo vymýšlet parametry.

Příklady kdy vrátit popis:
- "2002-1201" (WAGO TOPJOB S) → "TOPJOB S, 2.5mm², 2-vodičová, šedá"
- "2002-1204" (WAGO TOPJOB S) → "TOPJOB S, 2.5mm², 2-vodičová, modrá"
- "5SY4116-7" (Siemens SENTRON) → "MCB SENTRON 5SY4, 10kA, 1P, 16A, char. C"
- "5SY6206-7" (Siemens SENTRON) → "MCB SENTRON 5SY6, 6kA, 2P, 6A, char. C"
- "S201-B16" (ABB) → "MCB S201, 6kA, 1P, 16A, char. B"
- "S203M-C25" (ABB) → "MCB S203M, 10kA, 3P, 25A, char. C"

Příklady kdy vrátit {"popis": ""}:
- Typové označení je neznámé nebo nestandardní
- Parametry nelze spolehlivě odvodit ze struktury označení
- Výrobce v přehledu toto označení nepokrývá

Vrať JSON: {"popis": "stručný odvozený popis"} nebo {"popis": ""}`;

async function deriveDescription(typoveOznaceni, mfrDoc) {
  if (!typoveOznaceni || !mfrDoc) return '';
  try {
    const resp = await client.chat.complete({
      model: MODEL,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: DERIVE_SYSTEM },
        { role: 'user', content: `Znalostní přehled výrobce:\n${mfrDoc}\n\nTypové označení: "${typoveOznaceni}"` },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    return typeof parsed.popis === 'string' ? parsed.popis.trim() : '';
  } catch {
    return '';
  }
}

async function pickBestMatch(typoveOznaceni, popis, vyrobce, candidates, preferences, mfrDoc = '') {
  if (candidates.length === 0) return null;

  const candidateList = candidates.map(c =>
    `artikl:${c.artikl} | typ:${c.typoveOznaceni || '-'} | díl:${c.cisloDiluVyrobce || '-'} | výrobce:${c.vyrobce} | název:${c.nazev}`
  ).join('\n');

  const queryParts = [
    mfrDoc ? `Znalostní přehled výrobce:\n${mfrDoc}` : null,
    `Hledané typové označení: "${typoveOznaceni}"`,
    popis ? `Popis: "${popis}"` : null,
    vyrobce ? `Výrobce: "${vyrobce}"` : null,
    preferences ? `Zákaznické preference (prefix/sufix): ${preferences}` : null,
    `\nKandidáti:\n${candidateList}`,
  ].filter(Boolean).join('\n');

  try {
    const resp = await client.chat.complete({
      model: MODEL,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: MATCH_SYSTEM },
        { role: 'user', content: queryParts },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    if (!parsed.artikl) return null;
    return candidates.find(c => c.artikl === parsed.artikl) ?? null;
  } catch {
    return null;
  }
}

async function estimateUnit(nazev, typoveOznaceni) {
  try {
    const resp = await client.chat.complete({
      model: MODEL,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: UNIT_SYSTEM },
        { role: 'user', content: `Název: "${nazev}", Typové označení: "${typoveOznaceni}"` },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    return typeof parsed.unit === 'string' && parsed.unit ? parsed.unit : 'ks';
  } catch {
    return 'ks';
  }
}

const MFR_DISPLAY = {
  wago: 'WAGO', abb: 'ABB', siemens: 'Siemens', phoenix: 'Phoenix Contact',
  weidmuller: 'Weidmüller', allen_bradley: 'Allen-Bradley', rittal: 'Rittal',
  eaton: 'Eaton', omron: 'Omron', schneider: 'Schneider Electric',
};

export async function handleBomBuild(rows, preferences, sendProgress, answers = []) {
  let enrichedPrefs = preferences || '';
  if (answers.length > 0) {
    const answerLines = answers.map(a => `${a.question}: ${a.answer}`).join('\n');
    enrichedPrefs = [enrichedPrefs, `\n[Upřesnění od uživatele]\n${answerLines}`].filter(Boolean).join('\n');
  }

  // Pre-announce manufacturer knowledge synchronously to avoid duplicate announcements
  // when rows for the same manufacturer run in parallel
  const announcedMfr = new Set();
  rows.forEach((row, i) => {
    const mainQuery = (row.typoveOznaceni || '').trim();
    const altQuery = (row.altTypoveOznaceni || '').trim();
    if (!mainQuery && !altQuery) return;
    const mfrKey = resolveManufacturerKey(row.vyrobce || '') || resolveManufacturerKey(mainQuery) || resolveManufacturerKey(altQuery);
    const mfrDoc = mfrKey ? (MANUFACTURER_DOCS[mfrKey] ?? '') : '';
    if (mfrKey && mfrDoc && !announcedMfr.has(mfrKey)) {
      announcedMfr.add(mfrKey);
      sendProgress(i, rows.length, mainQuery || altQuery, 'knowledge', MFR_DISPLAY[mfrKey] ?? mfrKey);
    }
  });

  // Process rows with bounded concurrency — max 10 rows at a time
  const CONCURRENCY = 10;
  const results = new Array(rows.length).fill(null);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < rows.length) {
      const i = nextIdx++;
      results[i] = await processRow(rows[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  async function processRow(row, i) {
    const {
      typoveOznaceni = '',
      altTypoveOznaceni = '',
      popis = '',
      vyrobce = '',
      pocet = 1,
      oznaceniPristroje = '',
    } = row;

    const mainQuery = typoveOznaceni.trim();
    const altQuery = altTypoveOznaceni.trim();

    if (!mainQuery && !altQuery) {
      sendProgress(i, rows.length, '', 'skipped');
      return null;
    }

    const mfrKey = resolveManufacturerKey(vyrobce) || resolveManufacturerKey(mainQuery) || resolveManufacturerKey(altQuery);
    const mfrDoc = mfrKey ? (MANUFACTURER_DOCS[mfrKey] ?? '') : '';

    sendProgress(i, rows.length, mainQuery || altQuery, 'searching');

    let found = null;

    if (mainQuery) {
      const results1 = searchTerm(mainQuery, 5, vyrobce.trim() || null);
      found = await pickBestMatch(mainQuery, popis, vyrobce, results1, enrichedPrefs, mfrDoc);
    }

    if (!found) {
      const round2Query = altQuery || mainQuery;
      const round2Mfr = altQuery ? (vyrobce.trim() || null) : null;
      const results2 = searchTerm(round2Query, 5, round2Mfr);
      found = await pickBestMatch(round2Query, popis, vyrobce, results2, enrichedPrefs, mfrDoc);
    }

    let derivedPopis = '';
    if (!popis.trim() && mfrDoc) {
      derivedPopis = await deriveDescription(mainQuery || altQuery, mfrDoc);
    }

    if (found) {
      sendProgress(i, rows.length, mainQuery || altQuery, 'found');
      return {
        bomRow: {
          type: 'L',
          artikl: found.artikl,
          popis: derivedPopis || found.nazev,
          typoveOznaceni: found.typoveOznaceni,
          mnozstvi: Number(pocet) || 1,
          poznamka1: '',
          poznamka2: oznaceniPristroje,
          aiFilledPopis: !popis.trim() && !!(derivedPopis || found.nazev),
        },
        toCreateEntry: null,
      };
    } else {
      sendProgress(i, rows.length, mainQuery || altQuery, 'not_found');
      const unit = await estimateUnit(popis, mainQuery || altQuery);
      return {
        bomRow: {
          type: 'T',
          artikl: '',
          popis: '',
          typoveOznaceni: '',
          mnozstvi: Number(pocet) || 1,
          poznamka1: mainQuery || altQuery,
          poznamka2: oznaceniPristroje,
        },
        toCreateEntry: {
          nazev: derivedPopis || popis,
          vyrobce,
          typoveOznaceni: mainQuery || altQuery,
          unit,
          oznaceniPristroje,
          aiFilledPopis: !popis.trim() && !!derivedPopis,
        },
      };
    }
  }

  // Assemble results in original row order
  const bomRows = [];
  const toCreate = [];
  for (const r of results) {
    if (!r) continue;
    bomRows.push(r.bomRow);
    if (r.toCreateEntry) toCreate.push(r.toCreateEntry);
  }

  return { bomRows, toCreate };
}
