import { Mistral } from '@mistralai/mistralai';
import { searchTerm } from './search.js';
import { searchWires, filterWires, wireArticleCount } from './wireSearch.js';
import { filterCables, cableArticleCount } from './cableSearch.js';
import { MANUFACTURER_DOCS } from './manufacturers.js';
import { COMPONENT_CATEGORIES, detectCategory, getCategoryByKey, listCategoryLabels } from './componentGuide.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL = 'mistral-small-latest';

// label → category map for AI detection fallback
const CATEGORIES_BY_LABEL = {};
for (const cat of COMPONENT_CATEGORIES) {
  CATEGORIES_BY_LABEL[cat.label.toLowerCase()] = cat;
}

// ---------------------------------------------------------------------------
// Category detection via AI (fallback when keyword match fails)
// ---------------------------------------------------------------------------
async function detectCategoryAI(message) {
  const labels = listCategoryLabels();
  const resp = await client.chat.complete({
    model: MODEL,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Jsi expert na průmyslovou elektroniku. Ze zprávy uživatele urči, jakou kategorii průmyslového dílu hledá.
Dostupné kategorie: ${labels.join(', ')}.
Vrať POUZE JSON: {"category": "přesný název kategorie z dostupných nebo null pokud nejde určit"}
Příklady: "jistič 16A" → "Jistič", "kontaktor 9A" → "Stykač", "průchodka M20" → "Průchodka", "24V PSU" → "Napájecí zdroj"`,
      },
      { role: 'user', content: message },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    const label = parsed.category;
    if (!label || label === 'null') return null;
    return CATEGORIES_BY_LABEL[label.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generate search terms from collected answers + category knowledge
// ---------------------------------------------------------------------------
async function generateSearchTerms(category, answers) {
  const answerText = answers
    .map(a => `- ${a.question}: ${a.answer}`)
    .join('\n');

  const systemPrompt = `Jsi expert na průmyslovou elektrotechniku a vyhledávání v databázi průmyslových artiklů.

Databáze je česká, obsahuje průmyslové díly. Hledáš vždy v polích: název, typové označení, výrobce.

Znalosti o kategorii "${category.label}":
${category.knowledge}

ÚKOL: Z parametrů poskytnutých uživatelem vygeneruj 20–35 různorodých vyhledávacích termínů.

PRIORITA TERMÍNŮ — NEJDŮLEŽITĚJŠÍ:
1. PRIMÁRNĚ: Konkrétní typová označení výrobce (catalog numbers) dle vzorů v knowledge bázi.
   Příklady správného formátu: S203-C16, 3RT2016-1BB41, LC1D09BD, PKZM0-10, RM85-2011-35-1024
   - Pokud znáš výrobce: vygeneruj 8–15 konkrétních typových označení z jeho řad pro zadané parametry
   - Pokud výrobce neznáš: generuj typová označení od VŠECH hlavních výrobců kategorie
   - Zahrň typová označení pro sousední hodnoty parametrů (±1 krok proud, ±1 výkonový stupeň)
2. SEKUNDÁRNĚ: Obecné textové termíny jako záloha:
   - Česky: název dílu + klíčové parametry
   - Německy: výrazy z německých katalogů
   - Anglicky: technické zkratky
   - Zkrácené formy, zkratky, samotné klíčové hodnoty

Kombinuj parametry různě — každý termín má zachytit jiný možný způsob zápisu v DB.
Pokud je výrobce "bez preference", nevynechej žádného hlavního výrobce z termínů.
Pokud výrobce není zadán nebo je "bez preference", nastav manufacturer na null.

Odpovídej POUZE jako JSON: {"terms": ["term1", "term2", ...], "manufacturer": "přesný název výrobce nebo null"}`;

  const userPrompt = `Kategorie: ${category.label}
Parametry od uživatele:
${answerText}

Vygeneruj 20–35 vyhledávacích termínů. Začni konkrétními typovými označeními výrobce (catalog numbers), pak přidej obecné fallback termíny.`;

  const resp = await client.chat.complete({
    model: MODEL,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms.filter(t => typeof t === 'string' && t.trim())
      : [];
    const manufacturer = (typeof parsed.manufacturer === 'string' && parsed.manufacturer.trim().toLowerCase() !== 'null')
      ? parsed.manufacturer.trim()
      : null;
    return { terms, manufacturer };
  } catch {
    return { terms: [], manufacturer: null };
  }
}

// ---------------------------------------------------------------------------
// Synthesize results
// ---------------------------------------------------------------------------
async function synthesize(category, answers, articles, mfrKeys) {
  const answerSummary = answers.map(a => `${a.question}: ${a.answer}`).join('; ');

  const mfrDocs = mfrKeys.map(k => MANUFACTURER_DOCS[k]).filter(Boolean);
  let context = '';
  if (mfrDocs.length > 0) {
    context += '\n\n' + mfrDocs.join('\n\n---\n\n');
  }
  context += articles.length > 0
    ? `\n\nKandidáti (${articles.length}) — vyber artikl čísla max 5 nejrelevantnějších do "selected":\n` + articles
        .map(a => {
          const parts = [a.artikl, a.nazev, a.vyrobce];
          if (a.typoveOznaceni) parts.push(`typ:${a.typoveOznaceni}`);
          if (a.cisloDiluVyrobce) parts.push(`díl:${a.cisloDiluVyrobce}`);
          return parts.join(' | ');
        })
        .join('\n')
    : '\n\nŽádné artikly v databázi nebyly nalezeny.';

  const resp = await client.chat.complete({
    model: MODEL,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Jsi průmyslový expert na vyhledávání artiklů. Odpovídej VŽDY jako JSON: {"answer": "česky, markdown povolen", "selected": []}

SELECTED — max 5 artikl čísel z kandidátů:
• Vyber artikly které nejlépe odpovídají zadaným parametrům.
• Priorita: přesná shoda typového označení → parametry v názvu → ostatní.
• Pokud v answer textu zmiňuješ konkrétní artikl, musí být v selected.
• Nikdy neuvádej artikly mimo kandidáty.

ANSWER — struktura:
Shrnutí co bylo nalezeno (2–3 věty). Pak vybrané artikly:
- **{artikl}** — {název} | {výrobce}
  - typ: {typové označení}
  - {relevantní parametry}
Závěr: proč je první nejrelevantnější.

POKUD NIC NENALEZENO nebo žádný kandidát nesplňuje parametry:
• Stručně vysvětli proč.
• Uveď konkrétní doporučení: "Doporučuji typové označení: **{přesné typové označení}** od {výrobce} — {krátký popis proč}."
• Případně uveď alternativní produktovou řadu: "Produktová řada {řada} od {výrobce} je pro tyto parametry standardní volba."
• Doporučení vycházej VÝHRADNĚ z knowledge báze kategorie — nikdy nevymýšlej typová označení.
KRITICKÉ: nikdy nepiš typová označení ani artikl čísla která nejsou v kandidátech, POKUD NEJSOU z knowledge báze kategorie.`,
      },
      {
        role: 'user',
        content: `Kategorie: ${category.label}\nHledané parametry: ${answerSummary}${context}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      selected: Array.isArray(parsed.selected) ? parsed.selected : [],
    };
  } catch {
    return { answer: resp.choices[0].message.content, selected: [] };
  }
}

// ---------------------------------------------------------------------------
// Conditional question helpers
// ---------------------------------------------------------------------------

function questionApplies(q, answers) {
  if (!q.onlyIf) return true;
  const prev = answers.find(a => a.key === q.onlyIf.key);
  if (!prev) return true; // condition not yet established — include
  const condVal = q.onlyIf.value;
  return Array.isArray(condVal)
    ? condVal.some(v => prev.answer.includes(v))
    : prev.answer.includes(condVal);
}

function getNextApplicableIdx(questions, fromIdx, answers) {
  let i = fromIdx;
  while (i < questions.length && !questionApplies(questions[i], answers)) i++;
  return i;
}

function countApplicableQuestions(questions, answers) {
  return questions.filter(q => questionApplies(q, answers)).length;
}

function virtualQuestionIdx(questions, arrayIdx, answers) {
  let virtual = 0;
  for (let i = 0; i <= arrayIdx; i++) {
    if (questionApplies(questions[i], answers)) virtual++;
  }
  return virtual - 1; // 0-based
}

// ---------------------------------------------------------------------------
// Filter-based wire/cable search (no AI cost, deterministic)
// ---------------------------------------------------------------------------

// Bonus filters dropped first when 0 results (least → most important)
const WIRE_BONUS_ORDER  = ['vyrobce', 'wire_typ'];
const CABLE_BONUS_ORDER = ['retiez', 'materialPlaste', 'stineni', 'kabel_vyrobce'];

const FILTER_KEY_LABELS = {
  vyrobce:       'výrobce vodiče',
  wire_typ:      'typ/norma vodiče',
  retiez:        'použití v e-chain',
  materialPlaste:'materiál pláště',
  stineni:       'stínění',
  kabel_vyrobce: 'výrobce kabelu',
};

function buildFilterAnswer(allAnswers, count, type, droppedKeys = []) {
  const params = allAnswers
    .filter(a => a.answer && a.answer !== 'Bez omezení' && a.answer !== 'Bez preference' && a.key !== 'subtype' && !droppedKeys.includes(a.key))
    .map(a => `**${a.answer}**`)
    .join(', ');

  if (count === 0) {
    return `Žádný ${type} v databázi neodpovídá zadaným parametrům.\n\n`
      + `Zkus méně přísné filtrování — vynech některý z parametrů nebo zvol "Bez omezení".`;
  }

  const noun = type === 'vodič'
    ? (count === 1 ? 'vodič' : count < 5 ? 'vodiče' : 'vodičů')
    : (count === 1 ? 'kabel' : count < 5 ? 'kabely' : 'kabelů');
  let answer = `Nalezeno **${count} ${noun}**${params ? ' pro ' + params : ''}. `
    + `Zobrazuji prvních ${Math.min(10, count)} — klikni "Zobrazit všechny" pro celý seznam.`;

  if (droppedKeys.length > 0) {
    const labels = droppedKeys.map(k => FILTER_KEY_LABELS[k] ?? k).join(', ');
    answer += `\n\n⚠️ **Upozornění:** Pro zadanou kombinaci nebyla nalezena přesná shoda. `
      + `Filtr${droppedKeys.length > 1 ? 'y' : ''} **${labels}** ${droppedKeys.length > 1 ? 'byly vynechány' : 'byl vynechán'} — databáze neobsahuje dostatek dat. `
      + `Ověř si shodu ručně podle parametrů v názvu.`;
  }

  return answer;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function handleGuidedChat(message, phase, categoryKey, answers, sendEvent) {

  // --------------------------------------------------------------------------
  // PHASE: initial — detect component category, return first question
  // --------------------------------------------------------------------------
  if (phase === 'initial') {
    // Direct chip selection — skip detection entirely
    if (categoryKey) {
      const directCat = getCategoryByKey(categoryKey);
      if (directCat) {
        const questions = directCat.questions;
        // For categories with conditional branches, use unconditional count as initial total
        // (will update dynamically after first answer selects a branch)
        const initTotal = questions.some(q => q.onlyIf)
          ? questions.filter(q => !q.onlyIf).length
          : questions.length;
        sendEvent('category', {
          category: directCat.key,
          categoryLabel: directCat.label,
          question: questions[0].text,
          options: questions[0].options ?? null,
          hint: questions[0].hint ?? null,
          questionIndex: 0,
          questionTotal: initTotal,
        });
        return;
      }
    }

    sendEvent('status', { label: 'Rozpoznávám komponentu…' });

    // Keyword-based detection first (fast, no AI cost)
    let category = detectCategory(message);

    // Fall back to AI detection
    if (!category) {
      category = await detectCategoryAI(message);
    }

    if (!category) {
      sendEvent('question', {
        isAskCategory: true,
        question: 'Jakou komponentu hledáš? Napiš název dílu (např. jistič, stykač, průchodka, svorka…)',
        options: listCategoryLabels(),
        questionIndex: 0,
        questionTotal: 1,
      });
      return;
    }

    const questions = category.questions;
    const initTotal2 = questions.some(q => q.onlyIf)
      ? questions.filter(q => !q.onlyIf).length
      : questions.length;
    sendEvent('category', {
      category: category.key,
      categoryLabel: category.label,
      question: questions[0].text,
      options: questions[0].options ?? null,
      hint: questions[0].hint ?? null,
      questionIndex: 0,
      questionTotal: initTotal2,
    });
    return;
  }

  // --------------------------------------------------------------------------
  // PHASE: questioning — ask next question or start search
  // --------------------------------------------------------------------------
  if (phase === 'questioning') {
    const category = getCategoryByKey(categoryKey);
    if (!category) {
      sendEvent('error', { error: 'Neznámá kategorie.' });
      return;
    }

    const questions = category.questions;

    // Find the current question.
    // We can't use answers.length as array index because skipped conditional
    // branches (e.g. wire questions when in cable branch) create gaps.
    // Instead, start from the last answered question's array position + 1.
    const lastAnsweredKey = answers.length > 0 ? answers[answers.length - 1].key : null;
    const lastAnsweredArrayIdx = lastAnsweredKey
      ? questions.findIndex(q => q.key === lastAnsweredKey)
      : -1;
    const currentQIdx = getNextApplicableIdx(questions, lastAnsweredArrayIdx + 1, answers);
    const currentQ = questions[currentQIdx];
    if (!currentQ) {
      sendEvent('error', { error: 'Neočekávaný stav otázek.' });
      return;
    }

    const allAnswers = [
      ...answers,
      { key: currentQ.key, question: currentQ.text, answer: message },
    ];

    // vodic_kabel: after subtype is answered, send ALL remaining params as one form
    // instead of asking questions one-by-one (avoids 5+ sequential turns)
    if (category.key === 'vodic_kabel' && currentQ.key === 'subtype') {
      const formQuestions = questions
        .filter((q, idx) => idx > currentQIdx && questionApplies(q, allAnswers))
        .map(q => ({ key: q.key, text: q.text, options: q.options ?? null }));
      sendEvent('parameter_form', { formQuestions, answers: allAnswers });
      return;
    }

    // Find next applicable question
    const nextQIdx = getNextApplicableIdx(questions, currentQIdx + 1, allAnswers);
    const effectiveTotal = countApplicableQuestions(questions, allAnswers);

    if (nextQIdx < questions.length) {
      const nextQ = questions[nextQIdx];
      const vIdx = virtualQuestionIdx(questions, nextQIdx, allAnswers);
      sendEvent('question', {
        question: nextQ.text,
        options: nextQ.options ?? null,
        hint: nextQ.hint ?? null,
        questionIndex: vIdx,
        questionTotal: effectiveTotal,
        answers: allAnswers,
      });
      return;
    }

    // --------------------------------------------------------------------------
    // All questions answered
    // --------------------------------------------------------------------------

    // ── Filter-based path for wires/cables (no AI cost) ────────────────────
    if (category.key === 'vodic_kabel') {
      const subtypeAnswer = allAnswers.find(a => a.key === 'subtype')?.answer ?? '';
      const isWire = subtypeAnswer.includes('Jednožilový');
      const type = isWire ? 'vodič' : 'kabel';

      // Check data availability
      if (isWire && wireArticleCount === 0) {
        sendEvent('result', {
          answer: '⚠️ **Databáze vodičů není dostupná na serveru.**\n\nZkontroluj, zda soubor `public/wires.json` existuje v projektu a server byl spuštěn z adresáře projektu.',
          articles: [], allCandidates: [], expandedTerms: [], answers: allAnswers,
        });
        return;
      }
      if (!isWire && cableArticleCount === 0) {
        sendEvent('result', {
          answer: '⚠️ **Databáze kabelů není dostupná na serveru.**\n\nZkontroluj, zda soubor `public/cables.json` existuje v projektu a server byl spuštěn z adresáře projektu.',
          articles: [], allCandidates: [], expandedTerms: [], answers: allAnswers,
        });
        return;
      }

      sendEvent('status', { label: `Filtruji databázi ${isWire ? 'vodičů' : 'kabelů'}…` });

      // Progressive relaxation: if 0 results, drop bonus filters one by one
      let filtered = isWire ? filterWires(allAnswers) : filterCables(allAnswers);
      const droppedKeys = [];

      if (filtered.length === 0) {
        const bonusOrder = isWire ? WIRE_BONUS_ORDER : CABLE_BONUS_ORDER;
        for (const key of bonusOrder) {
          // Only drop if the user actually set a non-trivial value for this key
          const ans = allAnswers.find(a => a.key === key);
          const isActive = ans && ans.answer !== 'Bez omezení' && ans.answer !== 'Bez preference';
          if (!isActive) continue;
          droppedKeys.push(key);
          filtered = isWire ? filterWires(allAnswers, droppedKeys) : filterCables(allAnswers, droppedKeys);
          if (filtered.length > 0) break;
        }
      }

      const answer = buildFilterAnswer(allAnswers, filtered.length, type, droppedKeys);
      sendEvent('result', {
        answer,
        articles: filtered.slice(0, 10),
        allCandidates: filtered.slice(0, 200),
        expandedTerms: [],
        answers: allAnswers,
      });
      return;
    }

    // ── AI-based path for all other categories ──────────────────────────────
    sendEvent('status', { label: 'Generuji vyhledávací termíny…' });

    const { terms, manufacturer } = await generateSearchTerms(category, allAnswers);

    if (terms.length === 0) {
      sendEvent('error', { error: 'Nepodařilo se vygenerovat vyhledávací termíny.' });
      return;
    }

    sendEvent('searching', { terms, total: terms.length });

    const seen = new Set();
    const articles = [];

    for (const term of terms) {
      for (const article of searchTerm(term, 12, manufacturer)) {
        if (!seen.has(article.artikl)) {
          seen.add(article.artikl);
          articles.push(article);
        }
      }
    }

    sendEvent('status', { label: `Nalezeno ${articles.length} kandidátů, formuluji odpověď…` });

    const mfrKeys = category.mfrKeys ?? [];
    const { answer, selected } = await synthesize(category, allAnswers, articles.slice(0, 60), mfrKeys);

    const selectedSet = new Set((selected ?? []).filter(s => typeof s === 'string'));
    const autoSelect = new Set(
      [...selectedSet]
        .map(s => articles.findIndex(c => c.artikl === s))
        .filter(i => i >= 0)
    );
    if (answer) {
      const answerLower = answer.toLowerCase();
      for (let i = 0; i < articles.length && autoSelect.size < 5; i++) {
        if (autoSelect.has(i)) continue;
        const c = articles[i];
        const fields = [c.typoveOznaceni, c.artikl, c.cisloDiluVyrobce].filter(f => f && f.length >= 4);
        if (fields.some(f => answerLower.includes(f.toLowerCase()))) {
          autoSelect.add(i);
        }
      }
    }
    const pickedIndices = [...autoSelect].slice(0, 5);
    const pickedArticles = pickedIndices.length > 0
      ? pickedIndices.map(i => articles[i])
      : articles.slice(0, 5);

    sendEvent('result', {
      answer,
      articles: pickedArticles,
      allCandidates: articles.slice(0, 60),
      expandedTerms: terms,
      answers: allAnswers,
    });
    return;
  }

  sendEvent('error', { error: 'Neznámá fáze.' });
}
