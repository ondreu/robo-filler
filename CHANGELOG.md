# Changelog

## V070926 — Pokročilé vyhledávání (2026-09-07)

### Nové funkce
- **Pokročilý režim zadání** — přepínač „Jednoduché / Pokročilé" v jednotlivém vyhledávání. V pokročilém režimu je místo jednoho pole samostatný vstup pro **Typové označení**, **Výrobce**, **Název** a **Artikl**.
- **Kombinace polí (AND)** — vyplnit lze libovolnou kombinaci; prázdná pole se ignorují, vyplněná musí platit všechna zároveň (např. výrobce *Siemens* **a** typové označení *3RV2011*).
- Typové označení je i nadále **jedno pole** — hledá se v typovém označení i v čísle dílu výrobce.
- Režim vyhledávání (Fuzzy / Wild Card / Kombinovaný) i počet výsledků fungují v obou režimech; volba „Hledat v" se v pokročilém režimu skryje (každé pole má vlastní vstup).

- **Vyhledávání napříč poli** — dotaz, jehož slova leží v různých polích (`siemens 3RV2011` = výrobce + typové označení), dřív v jednoduchém poli **nenašel nic** (Wild Card) nebo dal správnému artiklu **stejné skóre jako nesouvisejícím** (Fuzzy / Kombinovaný). Nyní se takový dotaz vyhodnotí napříč všemi poli: každé slovo musí být v některém poli (AND), pořadí slov ani diakritika nehrají roli.
- **Nabídka rozdělení** — když je nejlepší shoda právě takováto (napříč poli), zobrazí se lišta s rozpadem dotazu a tlačítkem „Rozdělit do polí", které přepne na pokročilé zadání s předvyplněnými poli.

- **Krátká slova se nechytají uvnitř jiných slov** — u víceslovných dotazů musí slovo do 3 znaků ležet na hranici tokenu (začátek, za oddělovačem, nebo přechod písmeno↔číslice). Dřív `UT 2,5` našlo 73 shod, z nichž **56 (77 %) byl šum** — „ut" uvnitř *d-ut-inka*, „2,5" uvnitř *1,5-2,5mm* nebo *12,5A*. Nyní 19 shod bez šumu. U `ut 2.5` bylo šumu 28 z 32.
- **Desetinná čárka drží pohromadě** — `2,5` je jeden token, ne `2` a `5`, takže `UT 2,5` skóruje jako typové označení a ne jako dvě nezávislá čísla.
- **Rozdělení do polí drží souvislá slova** — `phoenix UT 2,5` dá `Výrobce: phoenix` + `Typové označení: UT 2,5`; dřív se rozsekalo na tři pole (`Název: UT` + `Typové označení: 2,5`).
- Jednoslovné dotazy zůstaly bez změny — `M12` i dál najde `IFRM12P1701`. Pravidlo hranice tokenu se uplatní jen tam, kde slovo funguje jako AND filtr, tedy u víceslovných dotazů.

- **Mezery a tečky v označení nehrají roli** — `icotek ST9` najde artikl `1814-2794`, jehož typové označení je `ST 9`. Dřív byl na **67. místě** (mimo zobrazených 10) ve Kombinovaném a vůbec nenalezen ve Wild Card, protože víceslovné hledání porovnávalo slova bez odstranění oddělovačů — `"st 9".includes("st9")` je `false`. Funguje obousměrně a i pro čárku vs tečku (`UT 2.5` ≈ `UT 2,5`). Oddělovače uvnitř samotného hledaného slova zůstávají **povinné**, aby se `2,5` nespletlo s `M25`.
- **Jednoznaková slova se nezahazují** — `icotek ST 9` bere v potaz i tu devítku (dřív z dotazu zbylo `icotek st`); cíl se posunul ze 4. na 2. místo. Bezpečné je to proto, že u víceslovného dotazu musí platit všechna slova (AND) a platí pravidlo hranice tokenu, takže `9` sedne na `ST 9`, ale ne na devítku uvnitř `1819`.

- **Kombinovaný režim skrýval řádky se stejným artiklem** — `combinedSearch` deduplikoval jen podle sloupce `Artikl`, ale **67 řádků v hlavní DB má artikl prázdný** a dalších 34 si nějakou hodnotu sdílí (např. ` ISO 4762` je na 5 řádcích). Všechny takové řádky se slily do jednoho výsledku a navzájem se skrývaly. Nyní se používá stejný složený klíč jako v pokročilém a cross-field hledání. Oprava jen přidává výsledky, nikdy neubírá (`ISO 4762` +5, `2,5` +7).

### Implementace
- `src/utils/searchEngine.ts` — `combinedSearch()` deduplikuje přes `articleKey()` (artikl + typové označení + výrobce + název)
- `src/utils/searchEngine.ts` — `tolerantRegex()` / `matchesAcrossSeparators()`: vzor postavený z běhů znaků mezi oddělovači — uvnitř běhu jsou oddělovače volitelné, mezi běhy povinné. Testuje se proti hodnotě **jak je zapsaná**, ne proti její kompaktní kopii: alokovat zkrácený string pro 5 polí × 80 tis. artiklů stojí víc než celé hledání, kdežto cachovaný regex jeden test. Je to i lepší semantika — v `KEL ST 9` stojí `ST9` za mezerou, což je hranice, zatímco kompaktní `kelst9` by ji skryl.
- `needsCompactRetry()` — tolerantní test se pouští jen pro slova, kde na tom může záležet (míchají písmena s číslicemi, nebo už oddělovač obsahují). `siemens` se nikdy nepíše `siem ens`, takže u čistě abecedních slov by to byla jen režie. Bez tohoto zúžení stál Kombinovaný režim 1 411 ms místo 689 ms.
- Tolerantní test běží ve Wild Card a cross-field cestě, ne ve fuzzy skórování — tam jen rozšiřoval nízkoskórující pásmo a `scoreQuery` se volá pro každého kandidáta.
- `src/utils/searchEngine.ts` — `containsWord()` / `boundaryRegex()` sdílí pravidlo hranice tokenu mezi Wild Card, Fuzzy i vyhledáváním napříč poli
- `src/utils/searchEngine.ts` — `refineAssignment()` vybírá mezi stejně skórujícími přiřazeními slov k polím to, které drží sousední slova spolu; skórování zůstává greedy (brute force nad všemi kombinacemi neporazil greedy ani u jednoho artiklu, protože skóre je `min` přes slova)
- `src/utils/searchEngine.ts` — `searchAdvanced()` spustí každé kritérium jako běžné vyhledávání v daném poli a výsledky protne; skóre je minimum ze splněných kritérií (nejslabší článek), zvýraznění se sloučí napříč poli
- `src/utils/searchEngine.ts` — `crossFieldSearch()` přiřadí každé slovo dotazu k nejlépe sedícímu poli (přesná hodnota 100 / celé slovo 95 / prefix slova 85 / podřetězec 75), skóre = nejslabší slovo, strop `CROSS_FIELD_MAX_SCORE = 86`, aby jednopolová shoda (88–98) zůstala vždy výš. Shody v rámci jednoho pole se přeskočí — ty už řeší stávající cesty. Neaktivní pro konkrétní pole („Hledat v") a pro dotazy s `*`/`?`.
- Výkon — 95 % hodnot v DB je čisté ASCII, takže se drahá normalizace diakritiky (`stripDiacriticChars`) a tokenizace dělá jen tam, kde je potřeba; režie napříč poli je ~200 ms nad 82 tis. artikly místo ~490 ms
- `src/types.ts` — `ADVANCED_FIELDS`, `ADVANCED_FIELD_LABELS`, `AdvancedQuery`, `AdvancedSearchOptions`, `SearchResult.crossField`

## V150626 — Admin: bezpečnost, produktivita, zálohy (2026-06-15)

### Nové funkce
- **Bezpečné ukládání** — před uložením souhrn („uloží se N řádků") + validace (duplicitní/prázdný klíč, nečíselné hodnoty v číselných sloupcích); `beforeunload` varování při neuložených změnách
- **Produktivita v tabulce** — řazení klikem na hlavičku (asc/desc/off), filtry jednotlivých sloupců, najít & nahradit (napříč sloupci), hromadné akce na výběru (smazat řádky / vyplnit hodnotou), zpět `Ctrl/⌘+Z`, sticky sloupec čísla řádku
- **Zálohy & rollback** — snapshoty po každém uložení s GFS retencí (vše 5 dní, týdně 3 týdny, měsíčně 1 měsíc); obnova na libovolnou verzi (před obnovou se aktuální stav zazálohuje); ruční „Zálohovat teď"
- **Audit log** — přehled admin akcí (uložení/záloha/obnova/master CSV)
- **Prohlížeč hlavní DB** — read-only hledání v master CSV přímo v adminu

### Backend
- `dataStore.js` — snapshoty (`.snapshots/`), GFS prune, audit (`.audit.jsonl`); nejsou veřejné ani v GitHub záloze
- Endpointy `/api/admin/snapshots/*`, `/api/admin/audit`, `/api/admin/master-search`

## V140626 — Admin dashboard rozšíření (2026-06-14)

Rozšíření admin prostředí o Excel-like tabulku, logy AI, upload hlavní DB a poznámky k řádkům.

### Nové funkce
- **Excel-like tabulka** — výběr více buněk (tažením/Shift), kopírování `Ctrl/⌘+C` (TSV), vkládání z Excelu `Ctrl/⌘+V` (přetečení vytvoří nové řádky), editace dvojklikem/psaním, `Del` smaže obsah
- **Logy AI chatů** — nová sekce „AI logy": Karel Bot / řízený / BOM, filtr dle typu, rozbalení detailu záznamu (`GET /api/admin/logs`)
- **Nahrání hlavní DB (master CSV)** — sekce „Hlavní DB": nahrání nové verze `master-data.csv` / `master-data-effi.csv` přímo v adminu, okamžitý reindex vyhledávání; auto-detekce kódování (UTF-8 / win-1250)
- **Poznámka k řádku** — interní pole pro admina (`_poznamka`); ve veřejném API i v GitHub záloze se odstraňuje, nikde jinde se nezobrazuje

### Backend
- `search.js` — `reloadMaster()` po nahrání CSV; `GET /api/admin/db/:name` (plná data vč. poznámek), veřejný `GET /api/db/:name` interní klíče odstraní
- `entrypoint.sh` — master CSV se nově seeduje jen když chybí (upload přes admin přežije update image)

## V130626 — Správa databází / admin (2026-06-13)

Nová záložka **🛠️ Správa DB** pro tabulkovou správu databází Vodiče, Kabely a Sypký materiál.

### Nové funkce

**Admin správa databází**
- Nová záložka 🛠️ Správa DB (viditelná jen když je nastaven `VITE_BACKEND_URL`), chráněná heslem přes backend (`ADMIN_PASSWORD`)
- Tabulkový editor: editace buněk, přidávání/mazání/duplikace řádků, fulltextové hledání a stránkování
- Správa sloupců: přidání nového sloupce, smazání sloupce, nastavení popisku, typu (text / číslo / ano-ne) a příznaku „filtrovatelný"
- Import CSV (nahradit / přidat), export CSV i JSON pro další práci v jiných programech
- Backend je nově zdroj pravdy — databáze se ukládají do perzistentního `DATA_DIR` a po editaci se obnoví vyhledávací indexy Karel Bota

**Dynamické filtry**
- Sloupec označený v adminu jako „filtrovatelný" se automaticky zobrazí jako filtr ve vyhledávání (Vodiče & Kabely, Sypký materiál) — např. nový sloupec „Nákupčí"
- Vyhledávací UI načítá živá data z backendu (`/api/db/:name`) s fallbackem na statické JSON

### Backend
- `dataStore.js` — sdílené čtení/zápis databází + schémat, reload registry indexů
- Endpointy `GET /api/db`, `GET /api/db/:name`, `GET /api/db/:name/schema`, `POST /api/admin/login`, `PUT /api/admin/db/:name`
- Docker: perzistentní volume `./data:/app/data` + seed výchozích dat při prvním startu (`entrypoint.sh`)

## V120626 — Sypký materiál (2026-06-12)

Nová karta **📦 Sypký materiál** vedle Vodičů & Kabelů — databáze kanban materiálu s filtrováním a vyhledáváním.

### Nové funkce

**Sypký materiál (Kanban DB)**
- Tlačítko „Vodiče & Kabely" rozšířeno na přepínač „Vodiče & Kabely / Sypký materiál"
- Databáze 517 artiklů kanban materiálu (`public/kanban.json`) — dutinky, kabelová oka, fastony, smršťovací bužírky, stahovací pásky, konektory, značení a další
- Filtrování po kategoriích — po výběru kategorie se zobrazí podskupiny (např. Dutinky → Izolované / Neizolované / Dvojdutinky / V pásu / Stínící)
- Filtry Provedení (bez lepidla / s lepidlem / bílé / černé…), Barva dle DIN (dle DIN / mimo DIN) a Kanban (v kanbanu / mimo kanban)
- Vyhledávání dle SAP artiklu, Elkov čísla, objednacího čísla, typu nebo popisu
- Karta artiklu: SAP artikl s kopírováním, pozice v kanbanu, podskupina, odznaky Kanban / DIN / poznámka
- Detail artiklu: Elkov číslo, nový artikl, výrobce, obj. číslo, značení (ruční / tiskárna Phoenix) a poznámky (výběhy, náhrady)

## v2.1.0 — AI stavba kusovníku BETA (2026-06-07)

Experimentální funkce pro automatické sestavení kusovníku z typových označení pomocí AI.

### Nové funkce

**AI stavba kusovníku (BETA)**
- Nový sub-mód v záložce AI mód, přepíná se tlačítkem „AI stavba kusovníku"
- 6-sloupcová vstupní tabulka: Popis, Výrobce, Typové označení *(povinné)*, Alt. typové označení, Počet, Označení přístroje
- Excel-like výběr buněk (klik/shift+klik = rozsah, mauve highlight), Tab/Enter/Arrow navigace
- Vkládání z Excelu zachovává prázdné buňky uvnitř rozsahu
- 2-kolové vyhledávání per řádek (hlavní + alt. označení) + AI párování přes Mistral Small
- Paralelní zpracování — max 10 řádků zároveň (worker pool), ~10× rychlejší než sekvenční
- Znalosti výrobců: pro WAGO, Siemens, ABB, Schneider aj. AI odvodí popis z typového označení (max 40 znaků, jen kde si je jistá)
- Upřesňující dotazy *po* vyhledávání — zobrazí se pouze pokud ≥3 položky nebyly nalezeny a dotaz by mohl pomoci; re-run jen nenalezených řádků
- Výsledky: tabulka Kusovník (ZBOM L/T formát) + tabulka K-Založení (12 sloupců, CSV export)
- „Otevřít kusovník v editoru" — přenese výsledek přímo do ZBOM editoru jako novou záložku
- Historie posledních 5 sestavení v localStorage — okamžité načtení bez opakování AI volání
- Tlačítko Vyčistit, pole „Pokyny pro AI" (obecný prompt, ne jen preference prefixů)
- Varování při přepnutí na BOM mód (náročná operace)
- BETA badge u přepínače sub-módu

### Karel Bot — opravy a vylepšení
- Oprava diakritiky v kartičkách výsledků (CSV → UTF-8)
- BM25 full-text index vedle Fuse.js (AND sémantika, lepší přesnost)
- Dvoukolová validace — AI upřesní dotaz pokud první výsledky nejsou dostatečné
- Kartičky se přidají automaticky pokud AI je zmíní v textu odpovědi
- Web vyhledávání preferuje stránky výrobců
- Wildcard varianty bez diakritiky

### Infrastruktura
- CSV data součástí Docker image — aktualizace DB přes Watchtower automaticky

---

## v2.0.0 — Karel Bot AI (2026-06-06)

Velké vydání přidává integrovaného AI asistenta **Karel Bot** pro vyhledávání průmyslových artiklů přirozenou češtinou.

### Nové funkce

**Karel Bot — AI chat asistent**
- Plovoucí chat tlačítko s glow efektem v pravém dolním rohu
- SSE streaming s průběhovými stavy: *Přemýšlím → Hledám → Formuluji*
- Markdown odpovědi (tučný text, odrážky, tabulky, odkazy)
- Resizable chat okno — táhni levý horní roh pro změnu velikosti
- Ozubené kolečko otevírá nastavení s přepínačem webového vyhledávání (výchozí: vypnuto)

**Dvoustupňové AI vyhledávání**
- Query expansion: `mistral-small-latest` rozšiřuje dotaz o synonyma a překlady (CS/DE/EN)
- Synthesis + ranking: `mistral-medium-latest` vybírá TOP 5 nejrelevantnějších karet z 40 kandidátů
- Slovník průmyslových zkratek: materiály (A2/A4/INOX/nerez, MS/mosaz), barvy (BK/RD/BU…), plasty, IP krytí, elektro (NO/NC/CO, 1P/3P/4P…)

**Výsledky — karty artiklů**
- Tlačítko pro kopírování čísla artiklu
- Tlačítko pro Google vyhledávání typového označení
- LLM ranker vybírá relevantní karty ze širšího fondu výsledků

**Webové vyhledávání (Tavily)**
- Volitelné webové vyhledávání přes Tavily API
- Detailní odpovědi (5–8 vět) se zdroji jako markdown odkazy
- Upozornění když web search není zapnutý (místo halucinace)

**Backend & infrastruktura**
- Node.js/Express backend s SSE streamingem na UGREEN NAS
- HTTPS přes Cloudflare Tunnel bez port forwardingu
- Auto-deploy: GitHub Actions → GHCR Docker image → Watchtower (aktualizace do 5 minut)

**Tuning vyhledávání**
- Fuse.js fuzzy threshold snížen na 0.3 (méně šumu)
- 12 výsledků per search term, celkem 40 kandidátů pro LLM ranker

---

## v1.0.0 — Základní vyhledávání artiklů

- Tabulkové zobrazení 90 000+ průmyslových artiklů z CSV
- Fulltext vyhledávání přes Fuse.js
- GitHub Pages hosting
