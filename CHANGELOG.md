# Changelog

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
