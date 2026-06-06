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
   Pokud dotaz obsahuje číslo artiklu nebo kód dílu (formáty jako 2204-1401, 5SY4116, XB4BA31, M20x1.5 apod.), VŽDY ho zahrň do terms přesně jak je — nesmíš ho vynechat ani nahradit popisem.
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
SELECTED: Z kandidátů artiklů vyber do "selected" indexy max 5 nejrelevantnějších. Pokud dotaz obsahuje konkrétní číslo artiklu nebo kód dílu, prioritně vyber kandidáta kde pole artikl, typ nebo díl přesně odpovídá — to je vždy nejrelevantnější. Pokud žádný nesedí nebo žádní nejsou, vrať "selected": [].

DB VÝSLEDKY (2-4 věty):
- Popiš co jsi našel — počet, kategorie, výrobce.
- Zhodnoť relevanci: který výsledek vypadá nejpřesněji a proč (shoda rozměrů, výrobce, funkce).
- Pokud shody nejsou přesné, řekni to otevřeně: "Nenašel jsem přesnou shodu, nejblíže je..."
- Navrhni upřesnění pokud výsledky jsou slabé.

WEB: Shrň podrobně (5-8 vět), zdroje jako markdown odkazy na konci.
WEB_NEDOSTUPNÉ: Pokud uvidíš poznámku že web search není zapnut, jasně to řekni, nevymýšlej.
PODPORA: Pokud dostaneš dokumentaci aplikace, odpověz strukturovaně s markdown formátováním — používej **tučný text** pro důležité pojmy, odrážky pro kroky nebo seznamy, krátké nadpisy pokud odpověď pokrývá více témat. Buď konkrétní a praktický.
ODMÍTNUTÍ: Dotazy nesouvisející s průmyslovými díly ani aplikací Robo Filler zdvořile odmítni.
NENALEZENO: Navrhni jedno konkrétní alternativní hledání, "selected": [].`;

const APP_DOCS = `# Dokumentace aplikace Robo Filler

## Co aplikace dělá
Robo Filler je vyhledávač průmyslových artiklů (materiálů, komponent, dílů) ze dvou interních databází — Ústí nad Labem a Effretikon. Databáze obsahuje přes 90 000 položek. Aplikace slouží k rychlému vyhledání správného artiklu a sestavení kusovníku (ZBOM) pro export.

---

## Klasické vyhledávání (hlavní obrazovka)

### Jak zadat dotaz
- Vyhledávací pole je uprostřed nahoře. Napiš cokoliv — název dílu, číslo artiklu, typové označení nebo výrobce.
- Příklady fungujících dotazů: "záslepka M20", "24V DC relé", "IP68 průchodka", "5SY4116".
- Stiskni Enter nebo klikni na lupu. Výsledky se zobrazí okamžitě.

### Proč nic nenašlo
- Zkus kratší výraz. "Pojistný šroub M12 nerez DIN 933" nenajde nic — zkus jen "šroub M12 nerez" nebo "M12 A2".
- Aplikace hledá KAŽDÉ slovo (AND logika) — pokud jedno slovo není v databázi, výsledek je prázdný.
- Překlepy toleruje jen do určité míry. "poistka" najde "pojistka", ale "pojistka" vs "jistič" jsou jiná slova — zkus obě.
- Zkontroluj přepínač databáze (Ústí / Effretikon / Obě) — artikl může být jen v jedné.

### Filtr výrobců (levý panel)
- Po vyhledání se vlevo zobrazí seznam výrobců a počty výsledků.
- Klikni na výrobce pro zúžení na jeho artikly. Klikni znovu pro odfiltrování.
- Lze vybrat více výrobců najednou.

### Karta výsledku
- Zobrazuje: typové označení, číslo artiklu, výrobce, název, číslo dílu výrobce.
- Ikona kopírování vedle artiklu — zkopíruje číslo do schránky jedním klikem.
- Tlačítko Google (šipka ven) — otevře Google vyhledávání pro daný artikl.
- Červené varování = výběhový díl (viz níže).

### Přepínač databází
- Vpravo nahoře: "Ústí" / "Effretikon" / "Obě".
- Výchozí je "Obě" — prohledá obě databáze najednou. Pokud hledáš pro konkrétní závod, přepni.

---

## Hromadné vyhledávání

### K čemu slouží
- Máš seznam artiklů nebo popisů a potřebuješ najít shody najednou — místo hledání jednoho po druhém.
- Typické použití: dostaneš kusovník od zákazníka, zkopíruješ seznam položek a aplikace je prohledá hromadně.

### Jak na to
1. Klikni na záložku "Hromadné vyhledávání" (nahoře vedle "Vyhledávání").
2. Do textového pole vlož seznam — každý výraz na nový řádek. Lze vložit přímo z Excelu (sloupec hodnot).
3. Klikni "Hledat". Aplikace zpracuje každý řádek zvlášť.
4. U každého výrazu se zobrazí nalezené shody s procentuálním skóre shody.

### Práce s výsledky
- Skóre 100 % = přesná shoda textu. Nižší = fuzzy shoda (podobný text).
- Zaškrtávátko u každého výrazu = označení jako "zpracováno".
- "Auto 100 %" — jedním klikem zaškrtne všechny výrazy, které mají PŘESNĚ jednu 100% shodu. Šetří čas při velkých seznamech.
- "Skrýt zaškrtnuté" — skryje zpracované řádky, zobrazí jen nevyřešené.
- Tlačítko "+" u výrazu — zobrazí více shod bez nového hledání (pokud jich bylo víc než zobrazený limit).
- Počet zobrazených shod: přepínač 3 / 6 / 9 shod na výraz.

### Export a přenos do kusovníku
- Tlačítko "Export CSV" — stáhne výsledky jako tabulku.
- Tlačítko "Tabulkové zpracování" — přenese zaškrtnuté výsledky přímo do ZBOM kusovníku.

---

## Tabulkové zpracování (ZBOM kusovník)

### K čemu slouží
- Sestavení výstupního kusovníku pro export do výrobního systému.
- Funguje jako jednoduchý Excel přímo v prohlížeči.

### Jak otevřít
- Tlačítko "Tabulkové zpracování" na hlavní obrazovce (rozbalovací menu).
- Nebo z Hromadného vyhledávání po výběru výsledků.
- "Nový kusovník" = prázdná tabulka. "Import z exportu" = načti existující TXT soubor.

### Editace buněk
- Klikni na buňku → aktivuje se editace. Napiš hodnotu, potvrď Enter nebo Tab.
- Tab přesune na další buňku vpravo, Enter dolů.
- Dvojklik = editace existující hodnoty (nezmaže obsah).

### Automatické doplnění z databáze
- Do sloupce "Artikl" napiš číslo artiklu a stiskni Enter nebo Tab.
- Aplikace automaticky doplní "Popis" a "Typové označení" z databáze.
- Pokud artikl nenajde, buňky zůstanou prázdné — zkontroluj číslo artiklu.

### Výběr a kopírování více buněk
- Klikni a táhni myší pro výběr více buněk.
- Shift+klik = výběr rozsahu.
- Ctrl+C zkopíruje vybrané buňky (kompatibilní s Excelem).
- Ctrl+V vloží z Excelu nebo z jiné části tabulky.

### Přeřazení řádků
- Vlevo u každého řádku je ikona pro drag & drop.
- Chop ji myší a přetáhni řádek na nové místo.

### Undo (vrácení změn)
- Ctrl+Z vrátí poslední akci. Funguje až 50 kroků zpět.
- Vrací: editace buněk, vložení, přeřazení řádků, mazání.

### Desetinný oddělovač
- Přepínač "." nebo "," pro export. Nastav podle toho, co očekává cílový systém.
- Česky obvykle čárka, mezinárodně tečka.

### Export
- Tlačítko "Export" stáhne TXT soubor ve formátu kompatibilním s importem.
- Stejný soubor lze znovu načíst přes "Import z exportu".

### Výběhové díly v kusovníku
- Pokud zadáš artikl se statusem "U" (výběhový díl), aplikace zobrazí varování.
- Automaticky se doplní "Neaktivní materiál" do poznámky 2.

---

## Karel Bot (AI asistent vyhledávání)

### Jak otevřít
- Fialové tlačítko s bublinkou v pravém dolním rohu obrazovky. Funguje na všech záložkách.
- Klikni pro otevření chatu. Klikni znovu (nebo na X) pro zavření.

### Jak hledat
- Piš přirozenou češtinou jako kolegovi: "hledám nerezovou záslepku M20", "potřebuju ABB pojistku 16A charakteristika B".
- AI rozumí zkratkám: nerez = A2/A4, MS = mosaz, BK = černá, NO = spínací kontakt atd.
- AI rozumí výrobcům — "ABB pojistka" automaticky filtruje jen ABB artikly.
- Výsledky se zobrazí jako karty pod odpovědí.

### Kdy použít Karel Bot místo klasického vyhledávání
- Nevíš přesný název dílu — popíšeš co potřebuješ a AI vyhledá synonyma.
- Kombinovaný dotaz s více parametry: výrobce + typ + rozměr.
- Chceš komentář k výsledkům — AI řekne který výsledek vypadá nejrelevantnější.

### Webové vyhledávání
- Klikni na ozubené kolečko vedle pole pro zprávu → zobrazí se přepínač "Webové vyhledávání".
- Výchozí: vypnuto. Zapni pro dotazy jako "kde koupit", "datasheet", "technická dokumentace".
- Webové vyhledávání nejde použít pro hledání v interní databázi — je to čistě pro informace z internetu.

### Změna velikosti okna
- Chyť levý horní roh chat okna a přetáhni pro změnu velikosti. Minimum 300×300 px, maximum cca 900×850 px.

### Limitace Karel Bota
- AI vybírá max 5 karet z 40 kandidátů — pro přesné hledání konkrétního artiklu použij raději klasické vyhledávání.
- AI může občas chybně pochopit dotaz nebo vybrat méně relevantní výsledky — ověř si karty.
- AI neví co je v databázi — pokud něco nenajde, zkus jiná synonyma nebo klasické vyhledávání.
- Historie chatu se resetuje při zavření okna nebo obnovení stránky.

---

## Výběhové díly a neaktivní materiály
- Artikl se statusem "U" = výběhový díl = materiál se přestává vyrábět nebo je nahrazen.
- Na kartě výsledku se zobrazí červené varování "Materiál není aktivní!".
- V kusovníku ZBOM se automaticky doplní poznámka "Neaktivní materiál" do sloupce Poznámka 2.
- Pokud vidíš toto varování, doporučujeme ověřit náhradní artikl u výrobce nebo v katalogu.

---

## Časté chyby a řešení

### "Nic se nenašlo"
1. Zkrať dotaz — hledej jen 1-2 klíčová slova.
2. Zkus anglický nebo německý ekvivalent (M20 Verschlussstopfen místo M20 záslepka).
3. Přepni databázi na "Obě".
4. Zkus Karel Bot — umí synonyma a překlady automaticky.

### "Výsledky jsou úplně jiné než čekám"
- Některé slovo v dotazu matí vyhledávač — odeber slova jedno po druhém a hledej znovu.
- Použij filtr výrobce vlevo pro zúžení.

### "Artikl se nenašel v kusovníku"
- Ověř že máš správné číslo artiklu (bez mezer, bez pomlček navíc).
- Zkontroluj přepínač databáze — artikl může být jen v Ústí nebo jen v Effretikonu.

### "Export nefunguje"
- Prohlížeč musí povolovat stahování. Zkontroluj nastavení prohlížeče nebo blokátor stahování.`;

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
          .map((a, i) => {
            const parts = [a.artikl, a.nazev, a.vyrobce];
            if (a.typoveOznaceni) parts.push(`typ:${a.typoveOznaceni}`);
            if (a.cisloDiluVyrobce) parts.push(`díl:${a.cisloDiluVyrobce}`);
            return `[${i}] ${parts.join(' | ')}`;
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
