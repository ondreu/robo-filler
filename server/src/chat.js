import { Mistral } from '@mistralai/mistralai';
import { searchTerm, articleCount } from './search.js';
import { ABBREVIATIONS_CONTEXT } from './abbreviations.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL_EXPAND = 'mistral-small-latest';
const MODEL_SYNTH  = 'mistral-medium-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly, elektrotechnické komponenty a aplikaci Robo Filler.
Analyzuj zprávu uživatele v kontextu konverzace a rozhodni:

1. Pokud jde o vyhledávání průmyslového dílu nebo artiklu v databázi (i follow-up jako "a pro M25?" nebo "zkus to s IP67"):
   Rozšiř hledaný výraz o synonyma a překlady (CS/DE/EN), zachovej rozměry a specifikace.
   Používej zkratky a konvence z přiložených znalostí databáze.
   Pokud je v dotazu zmíněn výrobce (např. ABB, Siemens, Schneider, Phoenix Contact, Wago, Eaton, Legrand, OBO, Roxtec, Rittal, Moeller, Hager, Gewiss, Hensel aj.), extrahuj ho do pole "manufacturer" — přesně jak je napsán. Jinak "manufacturer": null.
   Z termínů pro vyhledávání vynech jméno výrobce — hledej jen podle typu/názvu dílu.
   Vrať: {"type": "search", "terms": ["term1", "term2", ...], "manufacturer": "ABB", "query": ""}

2. Pokud uživatel žádá informace z internetu (datasheet, cena, specifikace výrobce, kde koupit, technická dokumentace):
   Vrať: {"type": "web_search", "terms": [], "query": "přesný anglický vyhledávací dotaz"}

3. Pokud jde o otázku na ovládání nebo funkce aplikace Robo Filler (jak hledat, jak funguje kusovník, co je hromadné vyhledávání, jak exportovat, limitace, tipy na použití apod.):
   Vrať: {"type": "support", "terms": [], "query": ""}

4. Pokud jde o konverzační zprávu (pozdrav, poděkování, obecná otázka na schopnosti):
   Vrať: {"type": "conversation", "terms": [], "query": ""}

Odpovídej POUZE jako JSON objekt, bez markdown.

${ABBREVIATIONS_CONTEXT}`;

const SYNTH_SYSTEM = `Jsi Karel Bot, asistent pro vyhledávání průmyslových artiklů v databázi Robo Filler a podpora pro práci s aplikací.

FORMÁT: Odpovídej VŽDY jako JSON objekt: {"answer": "česky, markdown povolen", "selected": []}
SELECTED: Z kandidátů artiklů vyber do "selected" indexy max 5 nejrelevantnějších. Pokud žádný nesedí nebo žádní nejsou, vrať "selected": [].

DB VÝSLEDKY (2-4 věty):
- Popiš co jsi našel — počet, kategorie, výrobce.
- Zhodnoť relevanci: který výsledek vypadá nejpřesněji a proč (shoda rozměrů, výrobce, funkce).
- Pokud shody nejsou přesné, řekni to otevřeně: "Nenašel jsem přesnou shodu, nejblíže je..."
- Navrhni upřesnění pokud výsledky jsou slabé.

WEB: Shrň podrobně (5-8 vět), zdroje jako markdown odkazy na konci.
WEB_NEDOSTUPNÉ: Pokud uvidíš poznámku že web search není zapnut, jasně to řekni, nevymýšlej.
PODPORA: Pokud dostaneš dokumentaci aplikace, odpověz na základě ní konkrétně a prakticky (2-5 vět).
ODMÍTNUTÍ: Dotazy nesouvisející s průmyslovými díly ani aplikací Robo Filler zdvořile odmítni.
NENALEZENO: Navrhni jedno konkrétní alternativní hledání, "selected": [].`;

const APP_DOCS = `# Dokumentace aplikace Robo Filler

## Klasické vyhledávání
- Zadej libovolný výraz do vyhledávacího pole (název, artikl, typové označení, výrobce).
- Kombinovaný engine: Wildcard (každé slovo musí být přítomno, AND logika) + Fuzzy (Fuse.js, toleruje překlepy, threshold 0.3).
- Filtr výrobců: klikni na výrobce v levém panelu pro zúžení výsledků.
- Přepínač databází: Ústí / Effretikon / Obě — vpravo nahoře.
- Tip: kratší výrazy fungují lépe než celé věty.

## Hromadné vyhledávání
- Záložka "Hromadné vyhledávání" — zadej seznam výrazů, každý na nový řádek.
- Aplikace prohledá databázi pro každý výraz zvlášť, duplicity se zpracují jednou.
- Tlačítko "Auto 100 %" zaškrtne výrazy s přesně jednou 100% shodou.
- Tlačítko "Skrýt zaškrtnuté" skryje zpracované řádky.
- Výsledky lze exportovat do CSV nebo přenést do Tabulkového zpracování.
- Lze nastavit počet zobrazených shod na výraz: 3 / 6 / 9.

## Tabulkové zpracování (ZBOM kusovník)
- Otevři přes tlačítko "Tabulkové zpracování" nebo z Hromadného vyhledávání.
- Excel-like editace: klikni na buňku pro editaci, Tab/Enter pro pohyb.
- Multi-cell výběr: klikni a táhni nebo Shift+klik.
- Kopírování/vkládání: Ctrl+C / Ctrl+V (kompatibilní s Excelem).
- Drag & drop řádků: táhni za ikonku vlevo pro přeřazení.
- Undo: Ctrl+Z, až 50 kroků zpět.
- Zadej artikl → aplikace automaticky doplní popis a typové označení z databáze.
- Přepínač desetinného oddělovače (tečka / čárka) pro export.
- Import z existujícího TXT exportu: tlačítko "Import".
- Výběhový díl (status U): aplikace zobrazí varování a automaticky doplní poznámku 2.

## Karel Bot (AI asistent)
- Plovoucí tlačítko v pravém dolním rohu.
- Hledej přirozenou češtinou: "nerezová záslepka M20", "ABB pojistka 16A", "průchodka IP68".
- AI rozumí výrobcům — "ABB pojistka" filtruje výsledky jen na ABB.
- Ozubené kolečko: zapne/vypne webové vyhledávání (Tavily) — výchozí: vypnuto.
- Webové vyhledávání je vhodné pro: datasheet, cena, kde koupit, technická dokumentace.
- Chat okno lze přetáhnout za levý horní roh pro změnu velikosti.
- Limitace: AI vybírá max 5 karet z 40 kandidátů — ne vždy najde vše co v DB je.

## Výběhové díly a neaktivní materiály
- Artikl se statusem "U" = výběhový díl, zobrazí se varování na kartě výsledku.
- Při použití v ZBOM se automaticky doplní poznámka 2: "Neaktivní materiál".

## Export
- Klasické vyhledávání: tlačítko "Export CSV" v záhlaví výsledků.
- Hromadné vyhledávání: export zaškrtnutých výsledků do CSV.
- ZBOM: export do TXT (formát kompatibilní s importem).`;

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
    const type = ['search', 'web_search', 'support', 'conversation'].includes(parsed.type)
      ? parsed.type
      : 'search';
    return {
      type,
      terms: Array.isArray(parsed.terms) && parsed.terms.length > 0 ? parsed.terms : [userMessage],
      manufacturer: typeof parsed.manufacturer === 'string' && parsed.manufacturer.trim() ? parsed.manufacturer.trim() : null,
      query: parsed.query ?? userMessage,
    };
  } catch {
    return { type: 'search', terms: [userMessage], manufacturer: null, query: userMessage };
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

async function synthesize(userMessage, articles, webResults, history, type, webSearchBlocked = false) {
  let context = '';
  if (webSearchBlocked) {
    context = '\n\n[Poznámka: Uživatel žádal webové vyhledávání, ale není zapnuto. Řekni mu to a nevymýšlej odpověď.]';
  }

  if (type === 'support') {
    context = `\n\nDokumentace aplikace Robo Filler:\n${APP_DOCS}`;
  } else if (type === 'search') {
    context = articles.length > 0
      ? `\n\nKandidáti (${articles.length}) — vyber indexy max 5 nejrelevantnějších:\n` + articles
          .map((a, i) => `[${i}] ${a.artikl} | ${a.nazev} | ${a.vyrobce}`)
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
  const { terms, manufacturer, query } = expanded;

  let articles = [];
  let webResults = [];

  let webSearchBlocked = false;
  if (type === 'web_search' && !webSearchEnabled) {
    type = 'conversation';
    webSearchBlocked = true;
  }

  if (type === 'support') {
    sendStatus('searching', 'Hledám v dokumentaci aplikace...');
  } else if (type === 'search') {
    const preview = terms.slice(0, 3).join(', ') + (terms.length > 3 ? '...' : '');
    const mfrLabel = manufacturer ? ` [výrobce: ${manufacturer}]` : '';
    sendStatus('searching', `Hledám v databázi: ${preview}${mfrLabel}`);

    const seen = new Set();
    for (const term of terms) {
      for (const article of searchTerm(term, 12, manufacturer)) {
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
      sendStatus('searching', 'Webové vyhledávání není nakonfigurováno (chybí TAVILY_API_KEY).');
    }
  }

  sendStatus('generating', 'Formuluji odpověď...');
  const candidates = articles.slice(0, 40);
  const { answer, selected } = await synthesize(userMessage, candidates, webResults, history, type, webSearchBlocked);

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
