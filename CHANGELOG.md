# Changelog

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
