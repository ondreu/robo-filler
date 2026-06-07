import { Mistral } from '@mistralai/mistralai';
import { searchTerm, articleCount } from './search.js';
import { ABBREVIATIONS_CONTEXT } from './abbreviations.js';
import { resolveManufacturerKey, detectDominantManufacturer, MANUFACTURER_DOCS, resolveManufacturersByCategory } from './manufacturers.js';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const MODEL_EXPAND       = 'mistral-small-latest';
const MODEL_SYNTH        = 'mistral-small-latest';
const MODEL_SYNTH_MEDIUM = 'mistral-medium-latest';

const EXPAND_SYSTEM = `Jsi expert na průmyslové díly, elektrotechnické komponenty a aplikaci Robo Filler.
Analyzuj zprávu uživatele v kontextu konverzace a rozhodni:

1. Pokud jde o vyhledávání průmyslového dílu nebo artiklu v databázi (i follow-up jako "a pro M25?" nebo "zkus to s IP67" nebo "chci na DIN lištu"):
   Rozšiř hledaný výraz o synonyma a překlady (CS/DE/EN), zachovej rozměry a specifikace.
   Používej zkratky a konvence z přiložených znalostí databáze.
   Pokud dotaz obsahuje číslo artiklu nebo kód dílu (formáty jako 2204-1401, 5SY4116, XB4BA31, M20x1.5 apod.), VŽDY ho zahrň do terms přesně jak je — nesmíš ho vynechat ani nahradit popisem.
   VÝROBCE: Pokud je výrobce zmíněn v aktuálním dotazu, extrahuj ho do "manufacturer". Pokud aktuální dotaz je follow-up (navazuje na předchozí konverzaci) a v historii byl konkrétní výrobce zmíněn, zachovej ho — uživatel stále hledá u stejného výrobce. Jinak "manufacturer": null.
   Z termínů pro vyhledávání vynech jméno výrobce — hledej jen podle typu/názvu dílu.
   PŘEKLADY PRO DATABÁZI:
   - "DIN lišta" jako KOMPONENT (hledám lištu samotnou) = "lišta", "lista", "NS 35", "TS 35", "UB 7,5", "Tragschiene", "Hutschiene". Přidej materiál pokud zmíněn: nerez/A2/A4 = "nerez", "Edelstahl", "stainless".
   - "na DIN lištu" / "pro DIN lištu" / "rail mount" (hledám zařízení montované na lištu) = "řadová" nebo "Durchgang" nebo "Klemme".
   - "TOPJOB S" = řadová svorka WAGO. "inline" / "instalační" = "Verbindungsklemme" nebo "spojovací".
   KOMBINOVANÉ VÝRAZY: Pokud dotaz obsahuje materiál + typ dílu, VŽDY přidej kombinované výrazy "materiál typ" — samotný materiál bez kontextu dílu vrací příliš obecné výsledky. Příklad: dotaz "nerezová záslepka M20" → terms musí obsahovat "nerez záslepka", "nerez plug", ne jen "nerez" a "záslepka" zvlášť.
   OBECNÝ MATERIÁL "kov/kovová/metal": Pokud je materiál nespecifikovaný ("kovová", "kov", "metal", "metallic") bez konkrétního druhu, expanduj na všechny běžné kovy kombinované s typem dílu: nerez, Edelstahl, stainless, MS, mosaz, Messing, brass, ocel, Stahl, steel, hliník, Aluminium, aluminium. Každý jako kombinaci s typem dílu ("nerez záslepka", "mosaz záslepka", "MS záslepka" atd.).
   Vrať: {"type": "search", "terms": ["term1", "term2", ...], "manufacturer": "WAGO", "query": ""}

2. Pokud uživatel žádá informace z internetu (datasheet, cena, specifikace výrobce, kde koupit, technická dokumentace):
   Formuluj dotaz v angličtině. Pokud jde o průmyslovou komponentu bez zmíněného výrobce, přidej do dotazu jméno relevantního známého výrobce (Weidmüller, Phoenix Contact, Rittal, Siemens, ABB, WAGO, Eaton, Omron, Allen-Bradley) dle kontextu — vyhni se generickým dotazům, které vrátí neznámé distributory.
   Vrať: {"type": "web_search", "terms": [], "query": "přesný anglický vyhledávací dotaz"}

3. Pokud jde o otázku na ovládání, fungování nebo problémy s aplikací Robo Filler — včetně: jak hledat, proč nenašlo, proč jsou špatné výsledky, jak funguje kusovník/ZBOM, co je hromadné vyhledávání, jak exportovat, jak přidat řádek, co znamená výběhový díl, jak použít Karel Bot, proč se nezobrazují výsledky, tipy a triky, limitace, číslo articlu nefunguje, apod.:
   Vrať: {"type": "support", "terms": [], "query": ""}
   Pokud si nejsi jistý zda jde o support nebo conversation, zvolte support.

4. Pokud jde o čistě konverzační zprávu bez vztahu k aplikaci (pozdrav, poděkování, obecná otázka na schopnosti AI):
   Vrať: {"type": "conversation", "terms": [], "query": ""}

Odpovídej POUZE jako JSON objekt, bez markdown.

${ABBREVIATIONS_CONTEXT}`;

const SYNTH_SYSTEM = `Jsi Karel Bot, asistent pro vyhledávání průmyslových artiklů v databázi Robo Filler a podpora pro práci s aplikací.

FORMÁT: Odpovídej VŽDY jako JSON objekt: {"answer": "česky, markdown povolen", "selected": [], "refinement": null}
SELECTED: Z kandidátů artiklů vyber do "selected" artikl čísla (pole "artikl") max 5 nejrelevantnějších — např. "selected": ["1813-5819", "1814-1685"]. PRIORITA ATRIBUTŮ: Pokud dotaz obsahuje konkrétní atribut (materiál: nerez, mosaz, plast; krytí: IP67; proud: 16A; rozměr: M20…) a kandidát tento atribut přímo obsahuje v názvu nebo popisu, VŽDY ho zař na první místo — bez ohledu na % skóre. Kandidát s nerez v názvu při dotazu "nerezová DIN lišta" je vždy relevantnější než ocelový s vyšším skóre. Pokud dotaz obsahuje konkrétní číslo artiklu nebo kód dílu, prioritně vyber kandidáta kde pole artikl, typ nebo díl přesně odpovídá. DŮLEŽITÉ: Kandidáti jsou záznamy přímo z databáze — nikdy neříkej "není v databázi" o čemkoliv z kandidátů. Pokud v textu "answer" zmiňuješ konkrétní typové označení, číslo artiklu nebo dílu z kandidátů, MUSÍŠ jeho artikl číslo přidat do "selected". Pokud žádný nesedí nebo žádní nejsou, vrať "selected": [].
REFINEMENT: Vrať "refinement": {"terms": ["term1", "term2"], "reason": "důvod"} pokud platí alespoň jedno: (a) kandidáti nesedí na dotaz a jiné hledání by pomohlo, (b) znáš typové označení nebo prefix výrobce který by vrátil přesnější výsledky než klíčová slova — zahrň ho jako term (wildcard ho najde i jako prefix). Maximálně 3 termíny, konkrétní. Pokud jsou výsledky dobré a typový kód neznáš, vrať "refinement": null.

DB VÝSLEDKY — doporučená struktura odpovědi:

Začni jednou větou shrnující co bylo nalezeno.

Pak vybrané artikly jako odrážky. Kandidáti mají formát "artikl | název | výrobce | typ:…" — odkazuj na ně číslem artiklu nebo názvem:
- **{artikl}** — {název} | {výrobce}
  - typ: {typové označení}
  - {parametry vyčtené z typového označení — průřez, proud, počet pólů, barva, charakteristika, krytí… Preferuj typové označení jako primární zdroj informací, ne název.}

- **{artikl}** — {název} | {výrobce}
  - …

Za seznamem stručně zdůvodni proč je první výsledek nejrelevantnější. Pokud se ostatní výsledky od prvního výrazně liší nebo doplňují, krátce to poznamenej. Jinak zbytečně nekomentuj.

Mimo tuto strukturu máš volnost přidat vlastní analytický komentář tam kde to dává smysl — čtení typového označení, srovnání řad, technologické rozdíly. Uživatel to ocení.

Nikdy nešpekuluj o vhodnosti produktu pro aplikaci — uživatel zná svoje požadavky.
Pokud chybí přesná shoda: doporuč alternativní hledání nebo weby výrobců (weidmuller.com, phoenixcontact.com, wago.com, rittal.com, abb.com) — NIKDY "kontaktujte dodavatele".

WEB: Shrň podrobně (5-8 vět), zdroje jako markdown odkazy na konci. Pokud jde o průmyslové komponenty, preferuj doporučení od známých výrobců (Weidmüller, Phoenix Contact, Rittal, Siemens, ABB, WAGO, Eaton, Omron, Allen-Bradley, Schneider) — neznámé distributory nebo obskurní dodavatele zmiňuj jen pokud není lepší alternativa.
WEB_NEDOSTUPNÉ: Pokud uvidíš poznámku že web search není zapnut, jasně to řekni, nevymýšlej.
PODPORA: Pokud dostaneš dokumentaci aplikace, odpověz strukturovaně s markdown formátováním — používej **tučný text** pro důležité pojmy, odrážky pro kroky nebo seznamy, krátké nadpisy pokud odpověď pokrývá více témat. Buď konkrétní a praktický.
ODMÍTNUTÍ: Odmítni POUZE dotazy zcela mimo téma (vaření, politika, obecné AI otázky). Vše co se byť vzdáleně týká vyhledávání artiklů, fungování aplikace, výsledků nebo průmyslových komponent vždy zodpověz — raději zodpověz zbytečně než odmítni legitimní dotaz.
HALUCINACE (KRITICKÉ): Nikdy nepiš konkrétní typová označení, čísla artiklů ani specifické produkty, které nejsou v seznamu kandidátů — ani kdyby sis byl jistý jejich existencí z jiných zdrojů. Pouze kandidáti z databáze jsou ověřené záznamy. Uvádění neověřených označení je halucinace.
ATRIBUTY BEZ VYMÝŠLENÍ: Pokud dotaz specifikuje atribut (materiál, krytí, proud…) a kandidát ho nesplňuje, uveď to přímo — nikdy nevymýšlej zdůvodnění proč by mohl vyhovovat. PA je plast, ne kov. "Konstruováno pro kovové aplikace" nebo podobné fráze jsou halucinace. Buď stručný: "materiál PA (plast) — nesplňuje požadavek na kov".
NENALEZENO: Pokud jsou kandidáti prázdní, stručně řekni co a proč nebylo nalezeno, navrhni konkrétní alternativní hledání jiným termínem. Neuváděj žádná typová označení ani čísla. "selected": [].`;

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
- Pokud máš otevřené kusovníky, kliknutí na tlačítko je rovnou otevře. Číslo v mauve kroužku vedle nápisu = počet otevřených záložek.
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

### Jak skrýt/zobrazit editor
- Tlačítko **X** v pravém rohu editoru (ne na záložce!) pouze schová editor — záložky zůstanou zachovány.
- Pro opětovné otevření klikni na "Tabulkové zpracování" v hlavním menu — editor se otevře s přesně tím, co jsi měl naposledy otevřené.

### Auto-save (automatické ukládání)
- Editor ukládá veškeré změny automaticky do prohlížeče (localStorage) s prodlevou 500 ms.
- Pokud zavřeš prohlížeč nebo záložku, data se obnoví při příštím otevření.
- Každý kusovník má vlastní uložený stav — záložky si neovlivňují navzájem.

### Záhlaví kusovníku
- Při vytváření nového kusovníku se zobrazí formulář záhlaví: Číslo vrcholu (povinné), Číslo závodu, Platnost od, Popis, Status, Výrobní dispečer.
- Záhlaví lze kdykoli upravit tlačítkem "← Záhlaví" v liště editoru.
- Číslo vrcholu a popis se automaticky použijí jako název záložky.

### Editace buněk
- Klikni na buňku → editace. Napiš hodnotu, potvrď Enter (přesune dolů) nebo Tab (přesune vpravo).
- Dvojklik = editace existující hodnoty (nezmaže obsah, kurzor na konec).
- F2 = vstup do editace vybrané buňky.
- Escape = zrušit editaci bez uložení.

### Automatické doplnění z databáze
- Do sloupce **"Artikl"** napiš číslo artiklu a stiskni Enter nebo Tab.
- Aplikace automaticky doplní "Popis" a "Typové označení" z databáze — buňky krátce zezelenou.
- Funguje i při vkládání (Ctrl+V) — doplnění proběhne pro všechny vložené artikly najednou.
- Pokud artikl nenajde, buňky zůstanou prázdné — ověř číslo artiklu v klasickém vyhledávání.

### Výběr a kopírování více buněk
- Klikni a táhni myší pro výběr rozsahu buněk.
- Shift+klik = výběr rozsahu od aktuální buňky.
- Ctrl+A = vyber vše.
- Ctrl+C zkopíruje vybrané buňky (kompatibilní s Excelem).
- Ctrl+V vloží z Excelu nebo z jiné části tabulky. Chybějící řádky se přidají automaticky.
- Delete nebo Backspace = smaže obsah vybraných buněk.

### Přeřazení řádků
- Vlevo u každého řádku je ikona pro drag & drop (šest teček).
- Chyť ji myší a přetáhni řádek na nové místo v tabulce.

### Undo (vrácení změn)
- Ctrl+Z nebo tlačítko "Zpět" v liště vrátí poslední akci. Funguje až 50 kroků zpět.
- Vrací: editace buněk, vkládání, přeřazení řádků, mazání.

### Typy řádků: L (materiál) a T (text)
- **L řádek** = materiálová položka. Má aktivní pole Artikl, Množství, Poznámka 1, Poznámka 2.
- **T řádek** = textová položka (nadpis nebo poznámka). Pole Artikl je neaktivní; text se píše do Popis.
- Přepínání: klikni na tlačítko "L" nebo "T" vlevo u řádku.

### Desetinný oddělovač a export
- Přepínač "1.5" / "1,5" v liště — nastav podle cílového systému (česky obvykle čárka).
- **Export ZBOM .txt** — stáhne soubor kompatibilní s výrobním systémem. Vyžaduje vyplněné Číslo vrcholu v záhlaví.
- **Excel** — stáhne tabulku ve formátu .xlsx.
- Stejný TXT soubor lze znovu načíst přes "Z exportu" → zachová se záhlaví i všechny řádky.

### Výběhové díly v kusovníku
- Artikl se statusem "U" = výběhový díl. V kusovníku se automaticky doplní "Neaktivní materiál" do Poznámky 2.

---

## Karel Bot (AI asistent) — plovoucí chat

Karel Bot je plovoucí chat dostupný z libovolné záložky aplikace.

### Jak otevřít
- Fialové tlačítko s bublinkou v pravém dolním rohu — klikni pro otevření.
- Okno lze přesunout přetažením za záhlaví a změnit velikost tažením za levý horní roh (min. 300×300 px).

### Jak hledat
- Piš přirozenou češtinou: "nerezová záslepka M20", "ABB pojistka 16A char. B".
- AI rozumí zkratkám: nerez = A2/A4, MS = mosaz, BK = černá, NO = spínací kontakt, atd.
- AI rozumí výrobcům — "ABB pojistka" automaticky filtruje jen ABB artikly.
- Výsledky se zobrazí jako karty pod odpovědí — max 5 nejrelevantnějších.

### Pomoc s aplikací
- Zeptej se na cokoliv k aplikaci: "jak přidám řádek do kusovníku?", "co je hromadné vyhledávání?", "jak exportovat ZBOM?".

### Teleport do AI módu
- Tlačítko **ozubené kolečko** → **"Teleportovat do AI módu"** přenese celou konverzaci do záložky AI mód (viz níže).
- Použij pro delší konverzace nebo když chceš větší pracovní plochu.

### Nový chat
- Tlačítko tužky (✏) v záhlaví smaže konverzaci a začne novou.

### Nastavení (ozubené kolečko)
- **Webové vyhledávání** — zapni pro dotazy "kde koupit", "datasheet", "cena". Výchozí: vypnuto.
- **Model** — přepínač Mistral Small 4 (výchozí, rychlý) / Mistral Medium 3.5 (přesnější, ~10× dražší). Volba vyprší po 24 h a resetuje se na Small.
- **↩ Obnovit poslední chat** — obnoví předchozí konverzaci po obnovení stránky.

---

## AI mód (plnohodnotný AI chat)

Záložka **AI mód** (třetí záložka nahoře vedle "Jednotlivé" a "Hromadné") je rozšířená verze Karel Bota pro pohodlnější práci.

### Rozdíl oproti plovoucímu chatu
- Zabírá celou šířku obrazovky — vhodné pro delší konverzace.
- Zprávy jsou plně rozložené, kandidátské artikly jsou přehledněji zobrazeny.
- Má stejné funkce jako plovoucí chat (vyhledávání, pomoc s aplikací, webové vyhledávání, výběr modelu).

### Zobrazení kandidátů
- Pod každou odpovědí je tlačítko **"Zobrazit výsledky (N)"** — klikni pro rozbalení všech nalezených kandidátů.
- Zobrazí se kompaktní karty artiklů se jménem, výrobcem, typovým označením a možností kopírování.

### Export z AI módu (ozubené kolečko)
- **Konverzace (.md)** — stáhne celou konverzaci jako Markdown soubor.
- **Nalezené artikly (.csv)** — stáhne všechny kandidátské artikly z posledního hledání jako CSV.

### Jak sem přejít
- Klikni na záložku **"AI mód"** nahoře — nebo použij Teleport z plovoucího chatu.
- Konverzace z teleportu se okamžitě zobrazí v AI módu.

### Konverzační kontext
- AI si pamatuje posledních 6 zpráv (3 výměny otázka–odpověď). Starší kontext se ztratí.

### Limitace
- AI vybírá max 5 karet z až 60 kandidátů — pro přesné hledání číslem artiklu použij klasické vyhledávání.
- AI může občas chybně pochopit dotaz — přeformuluj nebo upřesni.

---

## Výběhové díly a neaktivní materiály
- Artikl se statusem "U" = výběhový díl = materiál se přestává vyrábět nebo je nahrazen.
- Na kartě výsledku se zobrazí červené varování "Materiál není aktivní!".
- V kusovníku ZBOM se automaticky doplní "Neaktivní materiál" do sloupce Poznámka 2.
- Pokud vidíš toto varování, ověř náhradní artikl u výrobce nebo v katalogu.

---

## Časté chyby a řešení

### "Nic se nenašlo"
1. Podívej se na sekci "Mysleli jste...?" — aplikace automaticky zobrazí nejbližší přibližné shody.
2. Zkrať dotaz — hledej jen 1-2 klíčová slova.
3. Zkus anglický nebo německý ekvivalent (M20 Verschlussstopfen místo M20 záslepka).
4. Přepni databázi na "Obě".
5. Zkus Karel Bot — umí synonyma a překlady automaticky.

### "Výsledky jsou úplně jiné než čekám"
- Některé slovo v dotazu matí vyhledávač — odeber slova jedno po druhém.
- Použij filtr výrobce pro zúžení výsledků.
- Zkus režim "Wild Card" místo "Kombinovaného".

### "Artikl se nenašel v kusovníku (ZBOM)"
- Ověř správné číslo artiklu — bez mezer, bez extra pomlček.
- Zkontroluj přepínač databáze — artikl může být jen v Ústí nebo jen v Effretikonu.

### "Záložka v kusovníku zmizela po obnovení stránky"
- To by se nemělo stát — záložky se automaticky ukládají. Zkontroluj, zda prohlížeč nemá zakázaný localStorage (soukromý režim může mít omezení).

### "Export nefunguje"
- Prohlížeč musí povolovat stahování. Zkontroluj nastavení prohlížeče nebo blokátor stahování.
- Export ZBOM .txt vyžaduje vyplněné Číslo vrcholu — pokud chybí, aplikace nejprve otevře formulář záhlaví.

---

## AI stavba kusovníku (BETA)

Experimentální funkce dostupná v záložce **AI mód** přes přepínač **"AI stavba kusovníku"** (vedle "Běžný").

### K čemu slouží
Automaticky sestaví kusovník z tabulky typových označení — každou položku vyhledá v databázi a vrátí výsledný kusovník připravený pro ZBOM editor nebo export.

### Jak na to
1. Přejdi do záložky **AI mód** → klikni na **"AI stavba kusovníku"**.
2. Potvrď varování (operace je placená).
3. Vyplň tabulku — povinný sloupec je **Typové označení**. Ostatní (Popis, Výrobce, Počet, Označení přístroje) jsou volitelné.
4. Volitelně zadej **Pokyny pro AI** (např. preferovat artikly bez zákaznického prefixu).
5. Klikni **Spustit** — AI prohledá databázi pro každý řádek paralelně.

### Výsledky
- Záložka **Kusovník**: nalezené artikly jako L-řádky (materiál), nenalezené jako T-řádky (placeholder). Lze otevřít přímo v ZBOM editoru.
- Záložka **K-Založení**: nenalezené položky připravené pro zakládání nových artiklů, export do CSV.
- Sloupec Popis s ikonou **AI** = popis byl doplněn nebo odvozen automaticky.

### Funkce
- **Znalosti výrobců**: pro WAGO, Siemens, ABB, Schneider, Phoenix Contact aj. AI odvodí popis z typového označení pokud je prázdný.
- **Upřesňující dotazy**: po vyhledávání se AI může zeptat na doplňující informace pro nenalezené položky — odpovědi spustí přehledávání jen těch řádků.
- **Historie**: posledních 5 sestavení se ukládá — kliknutím na "Nedávné" se okamžitě načte výsledek bez opakování vyhledávání.
- **Vyčistit**: tlačítko vpravo dole v tabulce smaže obsah a vrátí 3 prázdné řádky.
- **Excel-like tabulka**: výběr buněk klikem nebo shift+klikem, navigace Tab/Enter/šipky, vkládání z Excelu zachovává prázdné buňky.

### Limity a poznámky
- Funkce je označena jako **BETA** — může se chovat neočekávaně.
- Každé vyhledávání je placené — využívejte historii pro opakované dotazy.
- AI párování nemusí být vždy správné — výsledky zkontrolujte před použitím.`;

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

async function synthesize(userMessage, articles, webResults, history, type, webSearchBlocked = false, mfrKeys = [], model = MODEL_SYNTH) {
  let context = '';
  if (webSearchBlocked) {
    context = '\n\n[Poznámka: Uživatel žádal webové vyhledávání, ale není zapnuto. Řekni mu to a nevymýšlej odpověď.]';
  }

  if (type === 'support') {
    context = `\n\nDokumentace aplikace Robo Filler:\n${APP_DOCS}`;
  } else if (type === 'search') {
    const mfrDocs = mfrKeys.map(k => MANUFACTURER_DOCS[k]).filter(Boolean);
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

export async function handleChat(userMessage, history, sendStatus, webSearchEnabled = false, synthModel = MODEL_SYNTH) {
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
    sendStatus('searching', `Hledám v databázi: ${preview}${mfrLabel}`, { terms });

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
      sendStatus('searching', `Hledám na internetu: ${query}`, { webQuery: true, terms: [query] });
      webResults = await webSearch(query);
    } else {
      sendStatus('searching', 'Webové vyhledávání není nakonfigurováno (chybí TAVILY_API_KEY).');
    }
  }

  sendStatus('generating', 'Formuluji odpověď...');
  let candidates = articles.slice(0, 40);

  // Resolve manufacturer docs: explicit mention, category keywords, dominant articles (follow-up)
  const primaryMfrKey = resolveManufacturerKey(manufacturer);
  const dominantVyrobce = (type === 'search' && history.length > 0) ? detectDominantManufacturer(candidates) : null;
  const secondaryMfrKey = resolveManufacturerKey(dominantVyrobce);
  const categoryMfrKeys = (type === 'search' && !primaryMfrKey) ? resolveManufacturersByCategory(userMessage) : [];
  const mfrKeys = [...new Set([primaryMfrKey, secondaryMfrKey, ...categoryMfrKeys].filter(Boolean))];

  if (mfrKeys.length > 0) {
    const MFR_DISPLAY = {
      wago: 'WAGO', abb: 'ABB', siemens: 'Siemens', phoenix: 'Phoenix Contact',
      weidmuller: 'Weidmüller', allen_bradley: 'Allen-Bradley', rittal: 'Rittal',
      eaton: 'Eaton', omron: 'Omron', schneider: 'Schneider Electric',
    };
    const names = mfrKeys.map(k => MFR_DISPLAY[k] ?? k);
    sendStatus('knowledge', `Načítám znalosti výrobce: ${names.join(', ')}`, { mfr: names });
  }

  let { answer, selected, refinement } = await synthesize(userMessage, candidates, webResults, history, type, webSearchBlocked, mfrKeys, synthModel);

  // Two-pass: if SYNTH requests refinement, do a second search and re-synthesize
  if (type === 'search' && refinement?.terms?.length > 0) {
    const refTerms = refinement.terms.slice(0, 3);
    const preview = refTerms.slice(0, 2).join(', ');
    sendStatus('searching', `Upřesňuji výsledky: ${preview}…`, { terms: refTerms, refinement: true });

    const seenArtikls = new Set(articles.map(a => a.artikl));
    for (const term of refinement.terms.slice(0, 3)) {
      for (const article of searchTerm(term, 12, manufacturer)) {
        if (!seenArtikls.has(article.artikl)) {
          seenArtikls.add(article.artikl);
          articles.push(article);
        }
      }
    }
    candidates = articles.slice(0, 60);

    sendStatus('generating', 'Formuluji výslednou odpověď…');
    const second = await synthesize(userMessage, candidates, webResults, history, type, webSearchBlocked, mfrKeys, synthModel);
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
    // Auto-include candidates whose typoveOznaceni/artikl/cisloDiluVyrobce appear in the answer text
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
