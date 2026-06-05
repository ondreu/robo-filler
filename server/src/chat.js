import { Mistral } from '@mistralai/mistralai';
import { searchTerm } from './search.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL = 'mistral-small-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly a elektrotechnické komponenty.
Analyzuj zprávu uživatele v kontextu konverzace a rozhodni:

1. Pokud jde o vyhledávání průmyslového dílu nebo artiklu (i follow-up jako "a pro M25?" nebo "zkus to s IP67"):
   Rozšiř hledaný výraz o synonyma a překlady (CS/DE/EN), zachovej rozměry a specifikace.
   Vrať: {"type": "search", "terms": ["term1", "term2", ...]}

2. Pokud jde o konverzační zprávu (pozdrav, poděkování, obecná otázka na schopnosti):
   Vrať: {"type": "conversation", "terms": []}

Odpovídej POUZE jako JSON objekt, bez markdown.`;

const SYNTH_SYSTEM = `Jsi AI asistent Karel Bot pro vyhledávání průmyslových artiklů v databázi Robo Filler.
Odpovídej přirozeně a přátelsky v češtině. NIKDY nepoužívej markdown formátování (žádné **, *, #).
Artikly jsou zobrazeny jako karty pod tvojí odpovědí — nepotřebuješ je vypisovat.
Jen stručně shrň kolik relevantních artiklů bylo nalezeno a co jsou zač (1-2 věty).
Pokud nic nebylo nalezeno, navrhni alternativní způsob hledání.
Pro konverzační zprávy odpovídej přirozeně bez zmínky o artiklech.`;

async function expandQuery(userMessage, history) {
  const resp = await client.chat.complete({
    model: MODEL,
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
    model: MODEL,
    messages: [
      { role: 'system', content: SYNTH_SYSTEM },
      ...history.slice(-6),
      { role: 'user', content: `${userMessage}${context}` },
    ],
  });

  return resp.choices[0].message.content;
}

export async function handleChat(userMessage, history, sendStatus) {
  sendStatus('thinking', 'Přemýšlím...');
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
