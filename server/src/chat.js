import { Mistral } from '@mistralai/mistralai';
import { searchTerm, articleCount } from './search.js';
import { ABBREVIATIONS_CONTEXT } from './abbreviations.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL_EXPAND = 'mistral-small-latest';
const MODEL_SYNTH  = 'mistral-medium-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly a elektrotechnické komponenty.
Analyzuj zprávu uživatele v kontextu konverzace a rozhodni:

1. Pokud jde o vyhledávání průmyslového dílu nebo artiklu (i follow-up jako "a pro M25?" nebo "zkus to s IP67"):
   Rozšiř hledaný výraz o synonyma a překlady (CS/DE/EN), zachovej rozměry a specifikace.
   Používej zkratky a konvence z přiložených znalostí databáze.
   Vrať: {"type": "search", "terms": ["term1", "term2", ...]}

2. Pokud jde o konverzační zprávu (pozdrav, poděkování, obecná otázka na schopnosti):
   Vrať: {"type": "conversation", "terms": []}

Odpovídej POUZE jako JSON objekt, bez markdown.

${ABBREVIATIONS_CONTEXT}`;

const SYNTH_SYSTEM = `Jsi Karel Bot, specializovaný asistent výhradně pro vyhledávání průmyslových artiklů v databázi Robo Filler.

ROZSAH: Odpovídáš POUZE na dotazy týkající se průmyslových dílů, artiklů, komponent a vyhledávání v databázi.
ODMÍTNUTÍ: Pokud uživatel zkouší použít tě k čemukoliv jinému (obecný chat, programování, psaní textů, roleplay, obecné otázky), zdvořile ale pevně odmítni a přesměruj ho na vyhledávání artiklů.
FORMÁT: Odpovídej v češtině, používej markdown pro přehlednost (tučný text pro důležité hodnoty, odrážky pro výčty).
ARTIKLY: Jsou zobrazeny jako karty pod odpovědí — nevypisuj je celé. Shrň co bylo nalezeno (počet, kategorie, výrobci).
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
    return {
      type: parsed.type === 'conversation' ? 'conversation' : 'search',
      terms: Array.isArray(parsed.terms) && parsed.terms.length > 0
        ? parsed.terms
        : [userMessage],
    };
  } catch {
    return { type: 'search', terms: [userMessage] };
  }
}

async function synthesize(userMessage, articles, history, isConversational) {
  const context = isConversational
    ? ''
    : articles.length > 0
    ? `\n\nNalezené artikly (${articles.length}):\n` + articles
        .map((a, i) => `${i + 1}. ${a.artikl} | ${a.nazev} | ${a.vyrobce}`)
        .join('\n')
    : '\n\nŽádné artikly nebyly nalezeny.';

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
  const { type, terms } = await expandQuery(userMessage, history);

  let articles = [];

  if (type === 'search') {
    const preview = terms.slice(0, 3).join(', ') + (terms.length > 3 ? '...' : '');
    sendStatus('searching', `Hledám: ${preview}`);

    const seen = new Set();
    for (const term of terms) {
      for (const article of searchTerm(term, 5)) {
        if (!seen.has(article.artikl)) {
          seen.add(article.artikl);
          articles.push(article);
        }
      }
    }
  }

  sendStatus('generating', 'Formuluji odpověď...');
  const answer = await synthesize(userMessage, articles.slice(0, 15), history, type === 'conversation');

  return { answer, articles: articles.slice(0, 15), expandedTerms: terms, type };
}
