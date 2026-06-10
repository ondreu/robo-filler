# Robo Filler — Průvodce pro AI

Nástroj pro vyhledávání průmyslových artiklů a sestavení kusovníků. Interní aplikace Schaltag.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS (Catppuccin theme)
- **Backend**: Node.js + Express, Server-Sent Events (SSE) pro streaming
- **AI**: Mistral AI (`@mistralai/mistralai` SDK) — `mistral-small-latest` pro matching/derive, `mistral-medium-latest` pro Karel Bot synthesis
- **Vyhledávání**: BM25 + Wildcard + Fuzzy (vlastní `server/src/search.js`)
- **Styling konvence**: Catppuccin — `bg-base`, `bg-mantle`, `bg-surface0/1/2`, `text-mauve`, `text-teal`, `text-text`, `text-subtext1`, `text-overlay0/1`

## Klíčové soubory

### Frontend (`src/`)
| Soubor | Popis |
|--------|-------|
| `src/App.tsx` | Root komponenta — módy (single/bulk/ai), ZBOM záložky, sub-mode toggle |
| `src/components/AiBomBuilder.tsx` | AI stavba kusovníku (BETA) — celá UI logika |
| `src/components/AiChat.tsx` | Karel Bot chat UI — `componentAdvisor` toggle pro poradce komponent |
| `src/components/AiOnboarding.tsx` | AI mód onboarding (5 kroků), LS key `ai-onboarding-v1` |
| `src/components/AppOnboarding.tsx` | Celoapplikační onboarding (5 kroků), LS key `app-onboarding-v1` |
| `src/components/BulkSearch.tsx` | Hromadné vyhledávání — `onOpenInZbom` callback pro otevření v ZBOM záložce |
| `src/components/ZbomEditor.tsx` | ZBOM tabulkový editor |
| `src/components/HowItWorks.tsx` | Modal „Jak funguju?" |
| `src/components/Changelog.tsx` | Modal se záznamy změn — verze `VDDMMYY` |
| `src/utils/bomExport.ts` | `ImportResult` typ + helpers pro ZBOM import |
| `src/types.ts` | `BomRow`, `BomHeader` typy |

### Backend (`server/src/`)
| Soubor | Popis |
|--------|-------|
| `server/src/index.js` | Express server — endpointy |
| `server/src/bomBuilder.js` | AI BOM builder logika |
| `server/src/chat.js` | Karel Bot logika |
| `server/src/search.js` | BM25 + wildcard + fuzzy vyhledávač |
| `server/src/manufacturers.js` | `MANUFACTURER_DOCS`, `resolveManufacturerKey`, `resolveManufacturersByCategory` — zahrnuje LAPP, Helukabel, HUBER+SUHNER, Nexans |
| `server/src/abbreviations.js` | Průmyslové zkratky pro Karel Bot |
| `server/src/guidedSearch.js` | Řízený vyhledávač — fáze initial/questioning, generace termínů, synthesize s doporučeními |
| `server/src/wireSearch.js` | Vyhledávač pro Vodič DB (wires.json) — BM25 + wildcard + fuzzy, exportuje `searchWires` |

## API endpointy

| Endpoint | Typ | Popis |
|----------|-----|-------|
| `POST /api/chat` | SSE | Karel Bot chat |
| `POST /api/bom-build` | SSE | AI stavba kusovníku — progress events per řádek |
| `POST /api/bom-post-check` | JSON | Post-search clarification check (≥3 nenalezených) |
| `POST /api/bom-check` | JSON | Pre-search clarification (starý endpoint, stále funkční) |

### SSE event typy (`/api/bom-build`)
```
progress: { rowIndex, total, typoveOznaceni, status, mfrName? }
  status: 'waiting' | 'searching' | 'found' | 'not_found' | 'skipped' | 'knowledge'
result:   { bomRows, toCreate, produktovaHierarchie, artiklVrcholu }
error:    { error }
```

## AI BOM Builder — architektura

### Fáze UI state machine
```
input → processing → post_check → clarifying → results
                  ↘ (bez otázek) ↗
```

### Backend flow (`bomBuilder.js`)
1. `handleBomBuild(rows, preferences, sendProgress, answers)` — worker pool (max 10 paralelně)
2. Per řádek: `resolveManufacturerKey` → `searchTerm` (round 1) → `pickBestMatch` → (round 2 if not found) → `deriveDescription` (if popis prázdný + mfrDoc)
3. `postCheckClarification(notFoundRows, preferences)` — AI se ptá jen pokud ≥3 nenalezených
4. `deriveDescription(typoveOznaceni, mfrDoc)` — max 40 znaků, vrátí `""` pokud AI není jistá

### Typy výsledků
- **L řádky** (BomResultRow `type:'L'`): nalezené artikly, `aiFilledPopis` = true pokud AI doplnila popis
- **T řádky** (BomResultRow `type:'T'`): nenalezené — jdou do K-Založení tabulky (ToCreateRow)

### Formát kusovníku (ZBOM)
L/T řádky odpovídají SAP ZBOM formátu — L = materiál, T = text/placeholder.
`buildImportResult()` převede `BomResultRow[]` → `ImportResult` pro ZBOM editor.

## Changelog konvence

Verze v `Changelog.tsx`: formát `VDDMMYY` (např. `V070626` = 7. 6. 2026).
Po vydání nové verze aktualizuj:
1. `src/components/Changelog.tsx` — přidej nový záznam na začátek `ENTRIES`
2. `src/components/HowItWorks.tsx` — pokud přibyla nová funkce, přidej sekci
3. `CHANGELOG.md` — markdown verze pro GitHub

## Důležité konvence

- **Neměň stávající AI mód (Karel Bot)** — `AiChat.tsx` a `chat.js` jsou oddělené od BOM builderu
- **`manufacturers.js` je sdílený** — `resolveManufacturerKey` a `MANUFACTURER_DOCS` používají Karel Bot i BOM builder
- **SSE progress** — knowledge eventy (`status:'knowledge'`) se vkládají jako extra položky do `progressItems`, ne jako update existujícího řádku
- **Historie BOM** — `localStorage` key `robo-filler-bom-history`, max 5 záznamů, cache key = JSON rows + preferences
- **BOM builder BETA** — označen BETA badge; varování se zobrazí při každém přepnutí na tento mód
- **Řízený mód** — byl BETA, nyní má badge „Doporučeno" (bg-green/20 text-green)
- **Paralelismus** — worker pool max 10 (konstanta `CONCURRENCY` v `handleBomBuild`), každý řádek má 2-4 sekvenční AI volání uvnitř
- **Poradce komponent** — toggle v nastavení Karel Bota; posílá `componentAdvisor: true` na backend, který injektuje znalosti z `componentGuide.js` do kontextu
- **ZBOM z hromadného vyhledávání** — `BulkSearch` volá `onOpenInZbom(bulkResults, selections)` callback; `App.tsx` vytvoří novou ZBOM záložku s daty → plnohodnotný editor s persistencí
- **Onboarding** — `app-onboarding-v1` (AppOnboarding, 5 kroků při prvním spuštění), `ai-onboarding-v1` (AiOnboarding, 5 kroků při prvním vstupu do AI módu); reset tlačítkem „průvodce" v zápatí
- **ZbomTab typ** — `{ id, name, importData?: ImportResult, bulkResults?: BulkQueryResult[], bulkSelections?: Record<number, SearchResult | null> }`
- **Mode switcher** — „AI mód" přejmenován na `✨ AI ✨` s pink sparkles
- **Vodiče/Kabely** — nová kategorie `vodic_kabel` v `componentGuide.js`; výrobci LAPP, Helukabel, HUBER+SUHNER, Nexans s plnými `MANUFACTURER_DOCS`
- **Vodič DB** — `public/wires.json` (639 artiklů), načítána frontend i backend; frontend mergeuje do `articles` state (wire artikly nesmí přepsat hlavní DB); backend `wireSearch.js` pro Karel Bot a řízený mód; wire karty mají badge "Vodič DB" + prurez/barva; `Article` type má volitelná pole `prurez`, `barva`, `skupina`
- **Řízený mód doporučení** — když DB nenajde nic, AI doporučí konkrétní typové označení z knowledge báze kategorie
- **Sypký materiál (Kanban DB)** — `public/kanban.json` (517 artiklů z interní Kanban_DB.xlsx); karta `KanbanSearch.tsx`, `AppMode: 'kanban'`, přepínač vedle „Vodiče & Kabely"; barva peach; kategorie → podskupiny (`KATEGORIE` matchery nad sloupcem Skupina, fallback Ostatní musí být poslední), filtry Provedení / Barva dle DIN / Kanban; data se NEmergují do hlavní DB (`articles`); typ `KanbanArticle` + `loadKanban()` v `csvParser.ts`

## Plánovaný refaktoring: Unifikovaná knowledge báze

### Problém
`manufacturers.js` injectuje celé docs výrobce (např. vše o WAGO), i když dotaz je specifický ("WAGO svorka"). Zbytečný šum v kontextu AI.

### Řešení
Sloučit `manufacturers.js` a `componentGuide.js` do jednoho souboru `productKnowledge.js` s hierarchickou strukturou:

```
kategorie → výrobce → produktové řady → detaily/příklady typových označení
```

```js
const KNOWLEDGE = {
  svorky: {
    label: 'Svorky',
    aliases: ['svorka', 'svorky', ...],
    questions: [...],           // pro řízený mód
    manufacturers: {
      wago: {
        label: 'WAGO',
        doc: `### CAGE CLAMP\n...\n### TOPJOB S\n...`
      },
      weidmuller: { ... }
    }
  },
  jistice: { ... }
}
```

### Injection logika po refaktoringu
- Kategorie + výrobce detekováni → `KNOWLEDGE[cat].manufacturers[mfr].doc` (přesný průsečík)
- Jen kategorie → všechny `manufacturers[*].doc` dané kategorie
- Jen výrobce → agregace přes všechny kategorie daného výrobce

### Dopad na soubory
- `chat.js` — upravit injection logiku
- `guidedSearch.js` — upravit injection logiku
- `bomBuilder.js` — používá `MANUFACTURER_DOCS` bez znalosti kategorie → přidat fallback (agregace přes kategorie)
- `manufacturers.js` + `componentGuide.js` → smazat, nahradit `productKnowledge.js`

### Poznámky
- Výrobce může být ve více kategoriích (WAGO: svorky, I/O moduly, napájení) — správně, je to záměr
- Migrace obsahu (~3 200 řádků) je ruční práce, dělat postupně po kategoriích
