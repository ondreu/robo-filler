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

const SYNTH_SYSTEM = `Jsi Karel Bot, specializovaný asistent výhradně pro vyhledávání průmyslových artiklů v databázi Robo Filler a technické informace o průmyslových dílech.

ROZSAH: Odpovídáš POUZE na dotazy týkající se průmyslových dílů, artiklů, komponent, technických specifikací a vyhledávání.
ODMÍTNUTÍ: Pokud uživatel zkouší použít tě k čemukoliv jinému (obecný chat, programování, psaní textů, roleplay), zdvořile ale pevně odmítni.
FORMÁT: Odpovídej v češtině, používej markdown pro přehlednost (tučný text pro důležité hodnoty, odrážky pro výčty).
ARTIKLY: Jsou zobrazeny jako karty pod odpovědí — nevypisuj je celé. Shrň co bylo nalezeno (počet, kategorie, výrobci).
WEB: Pokud máš výsledky z internetu, shrň je přehledně a uveď zdroje jako markdown odkazy.
NENALEZENO: Pokud nic nebylo nalezeno, navrhni alternativní způsob hledání.`;

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

  if (type === 'search') {
    context = articles.length > 0
      ? `\n\nNalezené artikly (${articles.length}):\n` + articles
          .map((a, i) => `${i + 1}. ${a.artikl} | ${a.nazev} | ${a.vyrobce}`)
          .join('\n')
      : '\n\nŽádné artikly v databázi nebyly nalezeny.';
  } else if (type === 'web_search') {
    context = webResults.length > 0
      ? '\n\nVýsledky z internetu:\n' + webResults
          .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.content}`)
          .join('\n')
      : '\n\nInternetové vyhledávání nevrátilo výsledky.';
  }

  const resp = await client.chat.complete({
    model: MODEL_SYNTH,
    messages: [
      { role: 'system', content: SYNTH_SYSTEM },
      ...history.slice(-6),
      { role: 'user', content: `${userMessage}${context}` },
    ],
  });

  return resp.choices[0].message.content;
}

export async function handleChat(userMessage, history, sendStatus) {
  sendStatus('thinking', `Přemýšlím, chvilku strpení — v databázi je momentálně ${articleCount.toLocaleString('cs-CZ')} artiklů.`);
  const { type, terms, query } = await expandQuery(userMessage, history);

  let articles = [];
  let webResults = [];

  if (type === 'search') {
    const preview = terms.slice(0, 3).join(', ') + (terms.length > 3 ? '...' : '');
    sendStatus('searching', `Hledám v databázi: ${preview}`);

    const seen = new Set();
    for (const term of terms) {
      for (const article of searchTerm(term, 5)) {
        if (!seen.has(article.artikl)) {
          seen.add(article.artikl);
          articles.push(article);
        }
      }
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
  const answer = await synthesize(userMessage, articles.slice(0, 15), webResults, history, type);

  return { answer, articles: articles.slice(0, 15), expandedTerms: terms, type };
}
