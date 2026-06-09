import { Mistral } from '@mistralai/mistralai';
import { searchTerm, articleCount } from './search.js';
import { searchWires } from './wireSearch.js';
import { searchCables } from './cableSearch.js';
import { ABBREVIATIONS_CONTEXT } from './abbreviations.js';
import { resolveManufacturerKey, detectDominantManufacturer } from './manufacturers.js';
import { buildKnowledgeContext } from './productKnowledge.js';

// Normalize for diacritic-insensitive matching
function normText(t) {
  return (t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const WIRE_CABLE_KEYWORDS = ['vodic', 'vodič', 'kabel', 'liy', 'olflex', 'ölflex', 'radox', 'h05v', 'h07v', 'h07z',
  'nyy', 'liycy', 'lifey', 'lifý', 'nsgafo', 'nshafo', 'lapp', 'helukabel', 'huber', 'suhner',
  'nexans', 'alphawire', 'unitronic', 'topflex', 'ceeflex', 'mm2', 'průřez', 'prurez', 'žíla', 'zila'];

function isWireCableQuery(text) {
  const n = normText(text);
  return WIRE_CABLE_KEYWORDS.some(kw => n.includes(normText(kw)));
}

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL_EXPAND       = 'mistral-small-latest';
const MODEL_SYNTH        = 'mistral-small-latest';
const MODEL_SYNTH_MEDIUM = 'mistral-medium-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly a elektrotechniku. Analyzuj zprávu uživatele v kontextu konverzace.

Typy odpovědí:
• search — vyhledávání dílu v DB (i follow-up "a pro M25?", "kovová?", "zkus IP67")
• web_search — datasheet, cena, kde koupit, specifikace výrobce
• support — jak funguje aplikace, proč nenašlo, co je ZBOM, jak exportovat atd.
• discussion — otázka nebo komentář k PRÁVĚ nalezeným výsledkům (interpretace, srovnání artiklů, proč ten a ne ten), technická diskuze o dílu/kategorii bez nového hledání; VÝHRADNĚ když konverzace obsahuje předchozí výsledky vyhledávání
• conversation — pozdrav, poděkování, nesouvisející dotaz

SEARCH — termíny:
Databáze je česká s průmyslovými zkratkami. Generuj termíny ve třech vrstvách:
  1. Česky: přesný název, synonyma, zkrácené formy
  2. Průmyslové zkratky jak se píšou v DB názvech: MS, HT, PA, PE, A2, A4, nerez, IP67, IP68…
  3. Německy a anglicky: výrazy reálně v průmyslových katalozích — DE více než EN

Kombinace: pokud dotaz obsahuje typ dílu + materiál a/nebo rozměr, vždy zahrň:
  - každou složku samostatně: typ, materiál, rozměr (v několika variantách, např. pro materiál plast: PA, PE, PVC, plast,...)
  - všechny dvojice: "typ materiál", "typ rozměr", "materiál rozměr" (několik variant pro každou dvojici)
  - plnou kombinaci: "typ materiál rozměr" (několik variant)
  - totéž pro DE/EN ekvivalenty
  Příklad "průchodka MS M20": průchodka, Blinder, MS, mosaz, brass, M20, průchodka MS, blinder MS, průchodka mosaz, průchodka M20, MS M20, mosaz M20, průchodka MS M20, Kabelverschraubung, Kabelverschraubung MS, Kabelverschraubung M20, Kabelverschraubung MS M20…

Obecný kov (kovová/kov/metal bez specifikace druhu):
  Expanduj na: nerez, MS, HT, A2, A4, Mosaz, Brass, Steel... — kombinovaně s typem i samostatně.

Číslo artiklu/kód dílu: zahrň přesně jak je napsáno.
Výrobce: extrahuj do "manufacturer", z terms vynech.
Follow-up: zachovej výrobce/materiál/rozměr z kontextu konverzace.

Specifika DB:
  "DIN lišta" (hledám lištu) → lišta, NS 35, TS 35, Tragschiene, Hutschiene
  "na DIN lištu" → řadová, Klemme
  "TOPJOB S" → řadová svorka WAGO | "inline/instalační" → Verbindungsklemme, spojovací

WEB_SEARCH: anglický dotaz; bez zmíněného výrobce přidej relevantního (Weidmüller, Phoenix, Rittal, Siemens, ABB, WAGO…).

Odpovídej POUZE jako JSON: {"type": "search", "terms": [...], "manufacturer": null, "query": ""}

${ABBREVIATIONS_CONTEXT}`;

const SYNTH_SYSTEM = `Jsi Karel Bot, průmyslový asistent pro vyhledávání artiklů v databázi Robo Filler.

Odpovídej VŽDY jako JSON: {"answer": "česky, markdown povolen", "selected": [], "refinement": null}

SELECTED — max 5 artikl čísel z kandidátů:
• Pokud dotaz specifikuje atribut (materiál, krytí, proud, rozměr), kandidáti kteří ho nesplňují do selected nepatří a nezmiňuj je.
• Priorita: přesná shoda atributu v názvu/typu → shoda rozměru → ostatní.
• Pokud v answer textu zmiňuješ konkrétní artikl nebo typ z kandidátů, musí být v selected.
• Kandidáti jsou záznamy z DB — nikdy netvrd "není v databázi" o čemkoliv z kandidátů.

REFINEMENT — {"terms": [...], "reason": "..."} pokud: výsledky nesedí a jiný výraz by pomohl, nebo znáš typový prefix výrobce pro přesnější výsledky. Max 3 termíny. Jinak null.

ANSWER — struktura pro DB výsledky:
Shrnutí co bylo nalezeno (2–3 věty). Pak vybrané artikly:

- **{artikl}** — {název} | {výrobce}
  - typ: {typové označení}
  - {parametry explicitně přítomné v názvu nebo typu: rozměr, materiál, krytí, proud, průřez… Nic neodvozuj.}

Za seznamem: 1–2 věty proč je první nejrelevantnější. Krátký analytický komentář (čtení typového označení, věcný rozdíl mezi variantami) jen pokud to přidá hodnotu — jinak vynech.
Žádné sekce "doporučení", "podpora", "webové zdroje" ani vymyšlené URL — jen pokud uživatel přímo žádá web nebo zdroje.
Chybí přesná shoda: navrhni alternativní hledání nebo doménu výrobce (weidmuller.com apod.) — nikdy "kontaktujte dodavatele".

WEB: podrobné shrnutí 5–8 vět, markdown zdroje na konci.
PODPORA: strukturovaná markdown odpověď, konkrétní a praktická.
ODMÍTNUTÍ: pouze dotazy zcela mimo téma (vaření, politika). Vše průmyslové nebo k aplikaci vždy zodpověz.
NENALEZENO: stručně co a proč, navrhni alternativní hledání. Žádná typová označení. "selected": [].
DISCUSSION/FOLLOW-UP: Odpovídej na základě konverzace a znalostní báze. "selected": [] pokud nová hledání neproběhla.
KRITICKÉ: nikdy nepiš typová označení ani artikl čísla která nejsou v kandidátech.`;

const APP_DOCS = `# Dokumentace aplikace Robo Filler

## Co aplikace dělá
Robo Filler je vyhledávač průmyslových artiklů (materiálů, komponent, dílů) ze dvou interních databází — Ústí nad Orlicí a Effretikon. Databáze obsahuje přes 90 000 položek. Aplikace slouží k rychlému vyhledání správného artiklu, sestavení kusovníku (ZBOM) pro export a obecné podpoře při práci s průmyslovými díly.

---

## Klasické vyhledávání (hlavní obrazovka)

### Jak zadat dotaz
- Vyhledávací pole je uprostřed nahoře. Napiš cokoliv — název dílu, číslo artiklu, typové označení nebo výrobce.
- Příklady fungujících dotazů: "záslepka M20", "24V DC relé", "IP68 průchodka", "5SY4116".
- Výsledky se zobrazují automaticky při psaní (debounce 300 ms). Stisknutí Enter uloží dotaz do historie.

### Historie vyhledávání
- Pod vyhledávacím polem se po prvním hledání zobrazují čipy s posledními až 15 dotazy.
- Klikni na čip pro opakování dotazu jedním klikem.
- Každý čip má tlačítko × pro odstranění z historie.
- Historie se ukládá do prohlížeče (localStorage) a přežije zavření záložky.

### Proč nic nenašlo
- Pokud klasické vyhledávání nenajde nic přesného, aplikace automaticky zobrazí sekci **"Mysleli jste...?"** s nejbližšími přibližnými shodami z databáze.
- Zkus kratší výraz. "Pojistný šroub M12 nerez DIN 933" nenajde nic — zkus jen "šroub M12 nerez".
- Aplikace hledá KAŽDÉ slovo (AND logika) — pokud jedno slovo není v databázi, výsledek je prázdný.
- Překlepy toleruje jen do určité míry — "poistka" najde "pojistka", ale "pojistka" vs "jistič" jsou jiná slova.
- Zkontroluj přepínač databáze (Ústí / Effretikon / Obě) — artikl může být jen v jedné.

### Filtr výrobců
- Po vyhledání se zobrazí seznam výrobců nalezených ve výsledcích.
- Klikni na výrobce pro zúžení. Klikni znovu pro odfiltrování. Lze vybrat více najednou.

### Karta výsledku
- Zobrazuje: typové označení, číslo artiklu, výrobce, název, číslo dílu výrobce.
- Ikona kopírování vedle artiklu — zkopíruje číslo do schránky jedním klikem.
- Tlačítko Google (šipka ven) — otevře Google vyhledávání pro daný artikl.
- Červené varování = výběhový díl (viz sekce níže).

### Přepínač databází a režimy vyhledávání
- Přepínač Ústí / Effretikon / Obě — výchozí "Obě" prohledá obě databáze.
- Režimy: **Fuzzy** (toleruje překlepy), **Wild Card** (přesné shody v textu), **Kombinovaný** (doporučeno — zkombinuje oba).
- Hledat v: všechna pole / název / typové označení / výrobce / artikl.

---

## Hromadné vyhledávání

### K čemu slouží
- Máš seznam artiklů nebo popisů a potřebuješ najít shody najednou.
- Typické použití: dostaneš kusovník od zákazníka, zkopíruješ seznam položek a aplikace je prohledá hromadně.

### Jak na to
1. Klikni na záložku "Hromadné" (nahoře vedle "Jednotlivé").
2. Vlož seznam — každý výraz na nový řádek. Lze vložit přímo z Excelu (sloupec hodnot).
3. Klikni "Hledat". Aplikace zpracuje každý řádek zvlášť a zobrazí shody se skóre.

### Práce s výsledky
- Skóre 100 % = přesná shoda textu. Nižší = fuzzy shoda.
- Zaškrtávátko u každého výrazu = označení jako "zpracováno".
- "Auto 100 %" — zaškrtne všechny výrazy s PŘESNĚ jednou 100% shodou jedním klikem.
- "Skrýt zaškrtnuté" — skryje zpracované řádky.
- Tlačítko "+" zobrazí více shod.

### Export a přenos do kusovníku
- Tlačítko "Export CSV" — stáhne výsledky jako tabulku.
- Tlačítko "Tabulkové zpracování" — přenese zaškrtnuté výsledky přímo do ZBOM kusovníku.

---

## Tabulkové zpracování (ZBOM kusovník)

### K čemu slouží
Sestavení výstupního kusovníku pro export do výrobního systému. Funguje jako jednoduchý Excel přímo v prohlížeči.

### Jak otevřít
- Tlačítko **"Tabulkové zpracování"** na hlavní obrazovce — klikni pro rozevření menu.
- Pokud máš otevřené kusovníky, kliknutím na tlačítko je rovnou otevře. Číslo v mauve kroužku vedle nápisu = počet otevřených záložek.
- V menu: **"Pokračovat v práci"** (zobrazí se když máš otevřené záložky), **"Nový kusovník"**, **"Z exportu"** (načíst TXT soubor).

### Záložky (více kusovníků najednou)
- Aplikace podporuje více kusovníků otevřených vedle sebe — každý má svoji záložku nahoře.
- Přepínání záložek: klikni na název záložky. Editor se přepne okamžitě, data zůstanou zachována.
- Přidat novou záložku: tlačítko **"+"** vpravo od záložek, nebo "Nový kusovník" v menu.
- Záložky jsou pojmenovány podle čísla vrcholu kusovníku (nebo popisu). Nové záložky se automaticky přejmenují po vyplnění záhlaví.
- Záložky přežijí zavření editoru i obnovení stránky — ukládají se do prohlížeče automaticky.

### Jak zavřít záložku
- Klikni na **×** u záložky → zobrazí se inline potvrzení **"Zavřít? ✓ ✗"**.
- Potvrzením ✓ se záložka a její data trvale odstraní. Zrušení ✗ ponechá záložku otevřenou.
- Při zavření poslední záložky se editor automaticky schová.

### Auto-save (automatické ukládání)
- Editor ukládá veškeré změny automaticky do prohlížeče (localStorage) s prodlevou 500 ms.
- Pokud zavřeš prohlížeč nebo záložku, data se obnoví při příštím otevření.
- Každý kusovník má vlastní uložený stav — záložky si neovlivňují navzájem.

### Záhlaví kusovníku
- Při vytváření nového kusovníku se zobrazí formulář záhlaví: Číslo vrcholu (povinné), Číslo závodu, Platnost od, Popis, Status, Výrobní dispečer.
- Záhlaví lze kdykoli upravit tlačítkem "← Záhlaví" v liště editoru.

### Typy řádků: L (materiál) a T (text)
- **L řádek** = materiálová položka. Má aktivní pole Artikl, Množství, Poznámka 1, Poznámka 2.
- **T řádek** = textová položka (nadpis nebo poznámka). Pole Artikl je neaktivní; text se píše do Popis.
- Přepínání: klikni na tlačítko "L" nebo "T" vlevo u řádku.

### Export
- **Export ZBOM .txt** — stáhne soubor kompatibilní s výrobním systémem. Vyžaduje vyplněné Číslo vrcholu v záhlaví.
- **Excel** — stáhne tabulku ve formátu .xlsx.

---

## Karel Bot (AI asistent) — plovoucí chat

Karel Bot je plovoucí chat dostupný z libovolné záložky aplikace.

### Jak hledat
- Piš přirozenou češtinou: "nerezová záslepka M20", "ABB pojistka 16A char. B".
- AI rozumí zkratkám: nerez = A2/A4, MS = mosaz, BK = černá, NO = spínací kontakt, atd.
- AI rozumí výrobcům — "ABB pojistka" automaticky filtruje jen ABB artikly.
- Výsledky se zobrazí jako karty pod odpovědí — max 5 nejrelevantnějších.

### Vyhledávání s průvodcem
- Při prvním dotazu na konkrétní komponent Karel Bot nabídne Vyhledávání s průvodcem.
- Průvodce krok za krokem specifikuje díl otázkami a AI najde nejlepší shody.

### AI mód (plnohodnotný AI chat)
Záložka **AI mód** je rozšířená verze Karel Bota pro pohodlnější práci.

### AI stavba kusovníku (BETA)
Experimentální funkce v záložce **AI mód** — automaticky sestaví kusovník z tabulky typových označení.`;

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
    const type = ['search', 'web_search', 'support', 'conversation', 'discussion'].includes(parsed.type)
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

async function synthesize(userMessage, articles, webResults, history, type, webSearchBlocked = false, knowledgeContext = '', model = MODEL_SYNTH) {
  let context = '';
  if (webSearchBlocked) {
    context = '\n\n[Poznámka: Uživatel žádal webové vyhledávání, ale není zapnuto. Řekni mu to a nevymýšlej odpověď.]';
  }

  if (knowledgeContext) {
    context += knowledgeContext;
  }

  if (type === 'support') {
    context = `\n\nDokumentace aplikace Robo Filler:\n${APP_DOCS}`;
  } else if (type === 'discussion') {
    // Discussion: use knowledge + conversation history, skip candidates section
    // The history already contains previous search results as text
  } else if (type === 'search') {
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
  } else if (type === 'web_search') {
    context = webResults.length > 0
      ? '\n\nVýsledky z internetu:\n' + webResults
          .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.content}`)
          .join('\n')
      : '\n\nInternetové vyhledávání nevrátilo výsledky.';
  }

  const resp = await client.chat.complete({
    model,
    ...(model === MODEL_SYNTH ? { reasoningEffort: 'high' } : {}),
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYNTH_SYSTEM },
      ...history.slice(-6),
      { role: 'user', content: `${userMessage}${context}` },
    ],
  });

  try {
    const parsed = JSON.parse(resp.choices[0].message.content);
    const refinement = (
      parsed.refinement &&
      Array.isArray(parsed.refinement.terms) &&
      parsed.refinement.terms.length > 0
    ) ? parsed.refinement : null;
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      selected: Array.isArray(parsed.selected) ? parsed.selected : null,
      refinement,
    };
  } catch {
    return { answer: resp.choices[0].message.content, selected: null, refinement: null };
  }
}

export async function handleChat(userMessage, history, sendStatus, webSearchEnabled = true, synthModel = MODEL_SYNTH, sendRaw = null) {
  sendStatus('thinking', `Přemýšlím, chvilku strpení — v databázi je momentálně ${articleCount.toLocaleString('cs-CZ')} artiklů.`);
  const expanded = await expandQuery(userMessage, history);
  let type = expanded.type;
  const { terms, manufacturer, query } = expanded;

  let articles = [];
  let webResults = [];
  const wireCableQuery = isWireCableQuery(userMessage);

  let webSearchBlocked = false;
  if (type === 'web_search' && !webSearchEnabled) {
    type = 'conversation';
    webSearchBlocked = true;
  }

  if (type === 'support') {
    sendStatus('searching', 'Hledám v dokumentaci aplikace...');
  } else if (type === 'discussion') {
    sendStatus('thinking', 'Analyzuji kontext konverzace...');
  } else if (type === 'search') {
    const preview = terms.slice(0, 3).join(', ') + (terms.length > 3 ? '...' : '');
    const mfrLabel = manufacturer ? ` [výrobce: ${manufacturer}]` : '';
    sendStatus('searching', `Hledám v databázi: ${preview}${mfrLabel}`, { terms });
    const seen = new Set();
    for (const term of terms) {
      if (wireCableQuery) {
        for (const article of searchWires(term, 12, manufacturer)) {
          if (!seen.has(article.artikl)) { seen.add(article.artikl); articles.push(article); }
        }
        for (const article of searchCables(term, 12, manufacturer)) {
          if (!seen.has(article.artikl)) { seen.add(article.artikl); articles.push(article); }
        }
      }
      for (const article of searchTerm(term, 12, manufacturer)) {
        if (!seen.has(article.artikl)) { seen.add(article.artikl); articles.push(article); }
      }
    }
  } else if (type === 'web_search') {
    if (process.env.TAVILY_API_KEY) {
      sendStatus('searching', `Hledám na internetu: ${query}`, { webQuery: true, terms: [query] });
      webResults = await webSearch(query);
    } else {
      sendStatus('searching', 'Webové vyhledávání není nakonfigurováno (chybí TAVILY_API_KEY).');
    }
  }

  sendStatus('generating', 'Formuluji odpověď...');
  let candidates = articles.slice(0, 40);

  // Resolve manufacturer key from explicit mention + dominant in results
  const primaryMfrKey = resolveManufacturerKey(manufacturer);
  const dominantVyrobce = (type === 'search' && history.length > 0) ? detectDominantManufacturer(candidates) : null;
  const secondaryMfrKey = resolveManufacturerKey(dominantVyrobce);
  const effectiveMfrKey = primaryMfrKey ?? secondaryMfrKey ?? null;

  // For discussion type, also try to extract manufacturer from conversation history
  let historyMfrKey = effectiveMfrKey;
  if (type === 'discussion' && !historyMfrKey) {
    // Look for manufacturer mentions in recent history
    const recentText = history.slice(-4).map(m => m.content ?? '').join(' ');
    historyMfrKey = resolveManufacturerKey(recentText.match(/\b(ABB|Siemens|Eaton|Schneider|WAGO|Phoenix|Weidmüller|Rittal|Omron|LAPP|Helukabel|Nexans)\b/i)?.[1] ?? null);
  }

  // Smart knowledge injection from productKnowledge.js
  // Detect category from current message; for discussion also scan recent history
  const queryForCat = type === 'discussion'
    ? [userMessage, ...history.slice(-4).map(m => m.content ?? '')].join(' ')
    : userMessage;

  const { doc: knowledgeDoc, label: knowledgeLabel, catKey } = buildKnowledgeContext(queryForCat, historyMfrKey ?? effectiveMfrKey);

  let knowledgeContext = '';
  if (knowledgeDoc && (type === 'search' || type === 'discussion')) {
    knowledgeContext = `\n\n---\n## Znalosti produktové kategorie\n${knowledgeDoc}`;
    const catDisplay = catKey ? `${PRODUCT_KNOWLEDGE_LABELS[catKey] ?? catKey}` : '';
    const mfrDisplay = (historyMfrKey ?? effectiveMfrKey) ? ` — ${historyMfrKey ?? effectiveMfrKey}` : '';
    const label = knowledgeLabel || `${catDisplay}${mfrDisplay}`;
    sendStatus('knowledge', `Inject znalostí: ${label}`, { mfr: label ? [label] : [] });
  }

  let { answer, selected, refinement } = await synthesize(userMessage, candidates, webResults, history, type, webSearchBlocked, knowledgeContext, synthModel);

  // Two-pass: if SYNTH requests refinement, do a second search and re-synthesize
  if (type === 'search' && refinement?.terms?.length > 0) {
    const refTerms = refinement.terms.slice(0, 3);
    const preview = refTerms.slice(0, 2).join(', ');
    sendStatus('searching', `Upřesňuji výsledky: ${preview}…`, { terms: refTerms, refinement: true });

    const seenArtikls = new Set(articles.map(a => a.artikl));
    for (const term of refinement.terms.slice(0, 3)) {
      if (wireCableQuery) {
        for (const article of searchWires(term, 12, manufacturer)) {
          if (!seenArtikls.has(article.artikl)) { seenArtikls.add(article.artikl); articles.push(article); }
        }
        for (const article of searchCables(term, 12, manufacturer)) {
          if (!seenArtikls.has(article.artikl)) { seenArtikls.add(article.artikl); articles.push(article); }
        }
      }
      for (const article of searchTerm(term, 12, manufacturer)) {
        if (!seenArtikls.has(article.artikl)) { seenArtikls.add(article.artikl); articles.push(article); }
      }
    }
    candidates = articles.slice(0, 60);

    sendStatus('generating', 'Formuluji výslednou odpověď…');
    const second = await synthesize(userMessage, candidates, webResults, history, type, webSearchBlocked, knowledgeContext, synthModel);
    answer   = second.answer;
    selected = second.selected;
    // refinement from second pass is intentionally ignored
  }

  let pickedArticles;
  if (type === 'search') {
    const selectedArtikls = new Set(
      (selected ?? []).filter(s => typeof s === 'string')
    );
    const autoSelect = new Set(
      [...selectedArtikls]
        .map(s => candidates.findIndex(c => c.artikl === s))
        .filter(i => i >= 0)
    );
    if (answer) {
      const answerLower = answer.toLowerCase();
      for (let i = 0; i < candidates.length && autoSelect.size < 5; i++) {
        if (autoSelect.has(i)) continue;
        const c = candidates[i];
        const fields = [c.typoveOznaceni, c.artikl, c.cisloDiluVyrobce].filter(f => f && f.length >= 4);
        if (fields.some(f => answerLower.includes(f.toLowerCase()))) {
          autoSelect.add(i);
        }
      }
    }
    const resolved = [...autoSelect].slice(0, 5);
    pickedArticles = resolved.length > 0 ? resolved.map(i => candidates[i]) : candidates.slice(0, 5);
  } else {
    pickedArticles = candidates.slice(0, 5);
  }

  return { answer, articles: pickedArticles, allCandidates: type === 'search' ? candidates : [], expandedTerms: terms, type };
}

// Human-readable labels for category keys (for status display)
const PRODUCT_KNOWLEDGE_LABELS = {
  jistic: 'Jistič', prislusenstvi_jistic: 'Příslušenství jističů',
  svorka: 'Svorka', prislusenstvi_svorka: 'Příslušenství svorek',
  stykac: 'Stykač', prislusenstvi_stykac: 'Příslušenství stykačů',
  nadproudova_spoust: 'Nadproudová spoušť', rele: 'Relé',
  prislusenstvi_rele: 'Příslušenství relé', casove_rele: 'Časové relé',
  fazove_rele: 'Fázové relé', tlacitko: 'Tlačítko',
  nouzove_tlacitko: 'Nouzové tlačítko', hlavni_vypinac: 'Hlavní vypínač',
  pruchovka: 'Průchodka', zaslepka: 'Záslepka', chranic: 'Chránič',
  prepetova_ochrana: 'Přepěťová ochrana', frekvencni_menic: 'Frekvenční měnič',
  pojistka: 'Pojistka', napajeci_zdroj: 'Napájecí zdroj',
  din_lista: 'DIN lišta', softstarter: 'Softstarter',
};
