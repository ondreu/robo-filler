import { Mistral } from '@mistralai/mistralai';
import { searchTerm, articleCount } from './search.js';
import { ABBREVIATIONS_CONTEXT } from './abbreviations.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL_EXPAND = 'mistral-small-latest';
const MODEL_SYNTH  = 'mistral-medium-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly a elektrotechnické komponenty.
Analyzuj zprávu uživatele v kontextu konverzace a rozhodni:

1. Pokud jde o vyhledávání průmyslového dílu nebo artiklu v databázi (i follow-up jako "a pro M25?" nebo "zkus to s IP67"):
   Rozšiř hledaný výraz o synonyma a překlady (CS/DE/EN), zachovej rozměry a specifikace.
   Používej zkratky a konvence z přiložených znalostí databáze.
   Vrať: {"type": "search", "terms": ["term1", "term2", ...], "query": ""}

2. Pokud uživatel žádá informace z internetu (datasheet, cena, specifikace výrobce, kde koupit, technická dokumentace):
   Vrať: {"type": "web_search", "terms": [], "query": "přesný anglický vyhledávací dotaz"}

3. Pokud jde o konverzační zprávu (pozdrav, poděkování, obecná otázka na schopnosti):
   Vrať: {"type": "conversation", "terms": [], "query": ""}

Odpovídej POUZE jako JSON objekt, bez markdown.

${ABBREVIATIONS_CONTEXT}`;

const SYNTH_SYSTEM = `Jsi Karel Bot, specializovaný asistent pro vyhledávání průmyslových artiklů v databázi Robo Filler.

ROZSAH: Odpovídáš POUZE na dotazy o průmyslových dílech, artiklech a technických specifikacích. Vše ostatní zdvořile odmítni.
DÉLKA: Buď maximálně stručný — 1 až 2 věty. Žádné zbytečné úvody ani závěry.
FORMÁT: Odpovídej VŽDY jako JSON objekt: {"answer": "česky, markdown povolen", "selected": []}
SELECTED: Pokud dostaneš seznam kandidátů artiklů, vyber do "selected" indexy (čísla) max 5 nejrelevantnějších pro dotaz. Ostatní zahoď. Pokud žádný kandidát nesedí nebo seznam není k dispozici, vrať "selected": [].
WEB: Pokud máš výsledky z internetu, shrň je v 1 větě a uveď zdroje jako markdown odkazy.
KOMBINACE: Pokud máš oboje (DB i web), nejprve shrň DB výsledky, pak doplň webový kontext.
NENALEZENO: Navrhni jedno konkrétní alternativní hledání, "selected": [].`;

async function expandQuery(userMessage, history) {
  const resp = await client.chat.complete({
    model: MODEL_EXPAND,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXPAND_SYSTEM },
      ...history.slice(-4),
      { role: 'user', content: userMessage },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    const type = ['search', 'web_search', 'conversation'].includes(parsed.type)
      ? parsed.type
      : 'search';
    return {
      type,
      terms: Array.isArray(parsed.terms) && parsed.terms.length > 0 ? parsed.terms : [userMessage],
      query: parsed.query ?? userMessage,
    };
  } catch {
    return { type: 'search', terms: [userMessage], query: userMessage };
  }
}

async function webSearch(query) {
  if (!process.env.TAVILY_API_KEY) return [];

  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function synthesize(userMessage, articles, webResults, history, type) {
  let context = '';

  if (articles.length > 0) {
    context += `\n\nKandidáti z databáze (${articles.length}) — vyber indexy max 5 nejrelevantnějších:\n` + articles
      .map((a, i) => `[${i}] ${a.artikl} | ${a.nazev} | ${a.vyrobce}`)
      .join('\n');
  } else if (type === 'search') {
    context += '\n\nŽádné artikly v databázi nebyly nalezeny.';
  }

  if (webResults.length > 0) {
    context += '\n\nVýsledky z internetu:\n' + webResults
      .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.content}`)
      .join('\n');
  }

  const resp = await client.chat.complete({
    model: MODEL_SYNTH,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYNTH_SYSTEM },
      ...history.slice(-6),
      { role: 'user', content: `${userMessage}${context}` },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      selected: Array.isArray(parsed.selected) ? parsed.selected : null,
    };
  } catch {
    return { answer: resp.choices[0].message.content, selected: null };
  }
}

export async function handleChat(userMessage, history, sendStatus, webSearchEnabled = false) {
  sendStatus('thinking', `Přemýšlím, chvilku strpení — v databázi je momentálně ${articleCount.toLocaleString('cs-CZ')} artiklů.`);
  const expanded = await expandQuery(userMessage, history);
  let type = expanded.type;
  const { terms, query } = expanded;

  let articles = [];
  let webResults = [];

  if (type === 'search' || (type === 'web_search' && !webSearchEnabled)) {
    const effectiveType = 'search';
    type = effectiveType;
    const preview = terms.slice(0, 3).join(', ') + (terms.length > 3 ? '...' : '');
    const statusMsg = webSearchEnabled
      ? `Hledám v databázi a na internetu: ${preview}`
      : `Hledám v databázi: ${preview}`;
    sendStatus('searching', statusMsg);

    const seen = new Set();
    for (const term of terms) {
      for (const article of searchTerm(term, 12)) {
        if (!seen.has(article.artikl)) {
          seen.add(article.artikl);
          articles.push(article);
        }
      }
    }

    if (webSearchEnabled && process.env.TAVILY_API_KEY) {
      webResults = await webSearch(userMessage);
    }
  } else if (type === 'web_search') {
    if (process.env.TAVILY_API_KEY) {
      sendStatus('searching', `Hledám na internetu: ${query}`);
      webResults = await webSearch(query);
    } else {
      sendStatus('searching', 'Internetové vyhledávání není nakonfigurováno...');
    }
  }

  sendStatus('generating', 'Formuluji odpověď...');
  const candidates = articles.slice(0, 40);
  const { answer, selected } = await synthesize(userMessage, candidates, webResults, history, type);

  let pickedArticles;
  if (type === 'search' && selected && selected.length > 0) {
    pickedArticles = selected
      .filter(i => typeof i === 'number' && i >= 0 && i < candidates.length)
      .slice(0, 5)
      .map(i => candidates[i]);
  } else {
    pickedArticles = candidates.slice(0, 5);
  }

  return { answer, articles: pickedArticles, expandedTerms: terms, type };
}
