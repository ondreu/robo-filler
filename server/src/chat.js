import { Mistral } from '@mistralai/mistralai';
import { searchTerm } from './search.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL = 'mistral-small-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly a elektrotechnické komponenty.
Tvým úkolem je rozšířit hledaný výraz uživatele o synonyma, překlady a varianty zápisů.
Odpovídej POUZE jako JSON objekt ve formátu: {"terms": ["term1", "term2", ...]}
Pravidla:
- Generuj 3–6 termínů v češtině, němčině a angličtině
- Zachovej rozměry a specifikace (M20, 16A, 230V...)
- Přidávej průmyslová synonyma a zkratky
- NIKDY nepřidávej výrobce ani čísla artiklů`;

const SYNTH_SYSTEM = `Jsi asistent pro vyhledávání průmyslových artiklů v databázi Robo Filler.
Na základě nalezených artiklů odpověz uživateli stručně a přehledně v češtině.
Pro každý relevantní výsledek uveď: artikl, název a výrobce.
Pokud jsou nalezeny duplicity, zmiň jen nejrelevantnější.
Pokud nic relevantního nebylo nalezeno, řekni to upřímně.`;

async function expandQuery(userMessage) {
  const resp = await client.chat.complete({
    model: MODEL,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXPAND_SYSTEM },
      { role: 'user', content: userMessage },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    const terms = parsed.terms;
    if (Array.isArray(terms) && terms.length > 0) return terms;
  } catch {
    // fall through
  }
  return [userMessage];
}

async function synthesize(userMessage, articles) {
  const articleList = articles
    .map((a, i) => `${i + 1}. Artikl: ${a.artikl} | Název: ${a.nazev} | Výrobce: ${a.vyrobce} | Typové označení: ${a.typoveOznaceni}`)
    .join('\n');

  const context = articles.length > 0
    ? `Nalezené artikly:\n${articleList}`
    : 'Žádné artikly nebyly nalezeny.';

  const resp = await client.chat.complete({
    model: MODEL,
    messages: [
      { role: 'system', content: SYNTH_SYSTEM },
      { role: 'user', content: `Dotaz uživatele: "${userMessage}"\n\n${context}` },
    ],
  });

  return resp.choices[0].message.content;
}

export async function handleChat(userMessage) {
  // Step 1: expand query into multiple search terms
  const terms = await expandQuery(userMessage);

  // Step 2: search for each term, collect unique articles
  const seen = new Set();
  const articles = [];

  for (const term of terms) {
    for (const article of searchTerm(term, 5)) {
      if (!seen.has(article.artikl)) {
        seen.add(article.artikl);
        articles.push(article);
      }
    }
  }

  // Step 3: synthesize answer
  const answer = await synthesize(userMessage, articles.slice(0, 15));

  return { answer, articles: articles.slice(0, 15) };
}
