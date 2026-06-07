import { Mistral } from '@mistralai/mistralai';
import { searchTerm } from './search.js';

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

async function pickBestMatch(typoveOznaceni, popis, vyrobce, candidates, preferences) {
  if (candidates.length === 0) return null;

  const candidateList = candidates.map(c =>
    `artikl:${c.artikl} | typ:${c.typoveOznaceni || '-'} | díl:${c.cisloDiluVyrobce || '-'} | výrobce:${c.vyrobce} | název:${c.nazev}`
  ).join('\n');

  const queryParts = [
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

export async function handleBomBuild(rows, preferences, sendProgress, answers = []) {
  // Merge answers into preferences context so pickBestMatch benefits from them
  let enrichedPrefs = preferences || '';
  if (answers.length > 0) {
    const answerLines = answers.map(a => `${a.question}: ${a.answer}`).join('\n');
    enrichedPrefs = [enrichedPrefs, `\n[Upřesnění od uživatele]\n${answerLines}`].filter(Boolean).join('\n');
  }
  const bomRows = [];
  const toCreate = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
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
      continue;
    }

    sendProgress(i, rows.length, mainQuery || altQuery, 'searching');

    let found = null;

    // Round 1: search by main type designation
    if (mainQuery) {
      const results1 = searchTerm(mainQuery, 5, vyrobce.trim() || null);
      found = await pickBestMatch(mainQuery, popis, vyrobce, results1, enrichedPrefs);
    }

    // Round 2: search by alternative type designation (or retry without manufacturer filter)
    if (!found) {
      const round2Query = altQuery || mainQuery;
      const round2Mfr = altQuery ? (vyrobce.trim() || null) : null;
      const results2 = searchTerm(round2Query, 5, round2Mfr);
      found = await pickBestMatch(round2Query, popis, vyrobce, results2, enrichedPrefs);
    }

    if (found) {
      sendProgress(i, rows.length, mainQuery || altQuery, 'found');
      bomRows.push({
        type: 'L',
        artikl: found.artikl,
        popis: found.nazev,
        typoveOznaceni: found.typoveOznaceni,
        mnozstvi: Number(pocet) || 1,
        poznamka1: '',
        poznamka2: oznaceniPristroje,
      });
    } else {
      sendProgress(i, rows.length, mainQuery || altQuery, 'not_found');

      const unit = await estimateUnit(popis, mainQuery || altQuery);

      // T row in BOM: type designation in note1, instrument tag in note2
      bomRows.push({
        type: 'T',
        artikl: '',
        popis: '',
        typoveOznaceni: '',
        mnozstvi: Number(pocet) || 1,
        poznamka1: mainQuery || altQuery,
        poznamka2: oznaceniPristroje,
      });

      toCreate.push({
        nazev: popis,
        vyrobce,
        typoveOznaceni: mainQuery || altQuery,
        unit,
        oznaceniPristroje,
      });
    }
  }

  return { bomRows, toCreate };
}
