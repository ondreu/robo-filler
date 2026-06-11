import { useState, useEffect } from 'react';
import { X, Tag } from 'lucide-react';

interface ChangelogEntry {
  version: string;   // VDDMMYY
  date: string;      // human-readable
  changes: string[];
  major?: boolean;
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: 'V150626',
    date: '15. 6. 2026',
    major: true,
    changes: [
      'Admin: bezpečné ukládání — souhrn změn + kontrola chyb (duplicity, prázdné/nečíselné hodnoty) před uložením, varování při odchodu s neuloženými změnami',
      'Admin: řazení kliknutím na hlavičku, filtry jednotlivých sloupců, najít & nahradit, hromadné akce na výběru (smazat řádky / vyplnit hodnotou), zpět (Ctrl+Z)',
      'Admin: zálohy a obnova — snapshoty s odstupňovanou retencí (5 dní / 3 týdny / 1 měsíc) a rollback na libovolnou verzi; audit log admin akcí',
      'Admin: nahrání hlavní DB doplněno o náhled (read-only prohlížeč hlavní databáze) a sticky sloupec čísla řádku',
    ],
  },
  {
    version: 'V140626',
    date: '14. 6. 2026',
    major: true,
    changes: [
      'Admin: Excel-like tabulka — výběr více buněk myší, kopírování (Ctrl/⌘+C) a vkládání z Excelu (Ctrl/⌘+V), editace dvojklikem nebo psaním, mazání obsahu klávesou Del',
      'Admin: prohlížeč logů AI chatů (Karel Bot / řízený / BOM) s filtrem a rozbalením detailu',
      'Admin: nahrání nové verze hlavní databáze (master CSV) přímo v dashboardu — okamžitě se přeindexuje vyhledávání',
      'Admin: pole „Poznámka" u každého řádku — jen pro admina, nikde jinde (ani ve veřejném API či záloze) viditelné',
    ],
  },
  {
    version: 'V130626',
    date: '13. 6. 2026',
    major: true,
    changes: [
      'Správa databází (admin) — nová záložka 🛠️ Správa DB pro úpravu databází Vodiče, Kabely a Sypký materiál jako tabulky (chráněno heslem přes backend)',
      'Admin: přidávání/mazání řádků i sloupců, editace buněk, duplikace řádků, fulltextové hledání a stránkování',
      'Admin: u každého sloupce lze nastavit popisek, typ (text / číslo / ano-ne) a příznak „filtrovatelný"',
      'Dynamické filtry — sloupec označený jako filtrovatelný se automaticky objeví jako filtr ve vyhledávání (např. přidám sloupec „Nákupčí" → vyskočí filtr)',
      'Admin: import a export CSV, export JSON pro práci v jiných programech',
      'Databáze se nově načítají živě z backendu (zdroj pravdy) — úpravy se projeví okamžitě; při nedostupnosti backendu fallback na statická data',
    ],
  },
  {
    version: 'V120626',
    date: '12. 6. 2026',
    major: true,
    changes: [
      'Sypký materiál — nová karta vedle Vodičů & Kabelů: databáze 517 artiklů kanban materiálu (dutinky, kabelová oka, fastony, smršťovací bužírky, stahovací pásky…)',
      'Sypký materiál: filtrování po kategoriích — po výběru kategorie se zobrazí podskupiny (např. Dutinky → Izolované / Neizolované / Dvojdutinky / V pásu / Stínící)',
      'Sypký materiál: filtry Provedení (bez lepidla / s lepidlem…), Barva dle DIN a V kanbanu / Mimo kanban',
      'Sypký materiál: vyhledávání dle SAP artiklu, Elkov čísla, objednacího čísla, typu nebo popisu',
      'Sypký materiál: karta artiklu zobrazuje pozici v kanbanu, skupinu a odznak Kanban; detail navíc Elkov číslo, nový artikl a poznámky (výběhy, náhrady)',
    ],
  },
  {
    version: 'V110626',
    date: '11. 6. 2026',
    major: true,
    changes: [
      'Vyhledávač vodičů — filtrování místo AI hledání: kategorie Vodič / Kabel nyní přímo filtruje databázi',
      'Jednožilové vodiče: filtry Typ / norma (H07V-K, RADOX, ÖLFLEX HEAT, UL...) + Průřez (mm²) + Barva + Výrobce — vrátí všechny nevyloučené výsledky',
      'Vícežilové kabely: filtry Počet žil + Průřez + Stínění + Materiál pláště + E-chain + Výrobce (databáze kabelů bude doplněna)',
      'Větvené otázky: první otázka rozhodne větev (vodič vs. kabel), zobrazí se jen relevantní dotazy bez zbytečných AI volání',
      'Výsledky: zobrazuje všechny odpovídající vodiče/kabely včetně tlačítka "Zobrazit všechny"',
    ],
  },
  {
    version: 'V100626',
    date: '10. 6. 2026',
    major: true,
    changes: [
      'Databáze vodičů — nová specializovaná databáze 639 artiklů vodičů (LAPP, Helukabel, HUBER+SUHNER, KABLO VRCHLABÍ, ALPHAWIRE a další) vedle hlavní databáze',
      'Databáze vodičů: prohledávána automaticky při hledání vodičů v Karel Botu i řízeném režimu; kategorie Vodič / Kabel má v řízeném módu přednost',
      'Databáze vodičů: výsledky označeny odznakem "Vodič DB" na kartě; karta navíc zobrazuje průřez (mm²) a barvu',
      'Databáze vodičů: sortiment — H07V-K, H05V-K, H07Z-K (HF), LiY, LiYCY, LiYv, LifY, RADOX 125/155/3GKW/4GKW, ÖLFLEX HEAT 125/180/260, UL-Style, NSGAFÖU, NSHXAFÖ, DESCAFLEX PTFE-200 a další',
      'Zápatí: počet artiklů nyní zobrazuje hlavní DB a Vodič DB zvlášť (např. "90 000 artiklů + 639 vodičů")',
    ],
  },
  {
    version: 'V090626',
    date: '9. 6. 2026',
    major: true,
    changes: [
      'Znalosti vodičů a kabelů — nová kategorie v řízeném vyhledávání: Vodič / Kabel (LAPP ÖLFLEX, Helukabel TOPFLEX, Nexans NYY-J, HUBER+SUHNER RADOX)',
      'LAPP, Helukabel, HUBER+SUHNER, Nexans — přidány do databáze výrobců (znalosti produktových řad, typová označení, normy IEC 60227/60245, EN 50525)',
      'Oprava příslušenství svorek: WAGO 279 série — přidány správná typová označení nosičů popisků (2009-114, WMB-Inline) do znalostní báze',
      'Doporučení při nenalezení materiálu — řízenývyhledávač nyní navrhuje konkrétní typové označení nebo produktovou řadu ze znalostní báze pokud nic nenajde v DB',
      'Poradce komponent v Karel Botu — nový přepínač v nastavení; při aktivaci AI čerpá znalosti z průvodce kategoriemi a radí s výběrem komponent a produktových řad',
      'Kompletní onboarding pro nové uživatele — průvodce při prvním spuštění provede hlavními funkcemi aplikace (Jednotlivé, Hromadné, AI mód, ZBOM); reset přes tlačítko "průvodce" v zápatí',
      'Tabulkové zpracování z hromadného vyhledávání nyní otevře plnohodnotné ZBOM s kartami a persistencí (stejně jako ZBOM z hlavního menu)',
      'Přepínač módů: "AI mód" přejmenován na ✨ AI ✨ s barevnými třpytkami',
      'Řízený režim: odstraněn BETA badge, nahrazen "Doporučeno"',
      'Plovoucí Karel Bot bublina zmenšena o 20 %',
      'Onboarding: aktualizovány popisy módů — Běžný = obecné dotazy, Řízený = doporučený pro hledání komponent',
    ],
  },
  {
    version: 'V080626',
    date: '8. 6. 2026',
    major: true,
    changes: [
      'Řízený režim (BETA) — nový sub-mód v AI módu pro krok-za-krokem hledání komponent',
      'Řízený režim: průvodce postupnými otázkami (výrobce, proud, póly, charakteristika…) pro 17 kategorií komponent',
      'Řízený režim: kategorie — Jistič, Stykač, Pojistka, Napájecí zdroj, Svorky, Frekvenční měnič, Soft Starter, Transformátor, Relé, DIN lišta, Rittal, Hlavní vypínač, Tlačítko, Průchodka, Záslepka, Proudový chránič, Přepěťová ochrana',
      'Řízený režim: AI vygeneruje 20–35 vyhledávacích termínů (česky + německy + anglicky + typová označení výrobců)',
      'Řízený režim: znalostní databáze každé kategorie (výrobci, produktové řady, tipová označení, vyhledávací strategie)',
      'Řízený režim: volba odpovědí jako chip-boxy nebo volný text, výsledky jako AI odpověď + kartičky artiklů',
      'Řízený režim: historie posledních 20 dotazů v postranním panelu',
    ],
  },
  {
    version: 'V070626',
    date: '7. 6. 2026',
    major: true,
    changes: [
      'AI stavba kusovníku (BETA) — nový sub-mód v AI módu pro automatické sestavení kusovníku z typových označení',
      'AI stavba kusovníku: 6-sloupcová vstupní tabulka s Excel-like výběrem buněk, Tab/Enter navigací a vkládáním z Excelu',
      'AI stavba kusovníku: 2-kolové vyhledávání per řádek + AI párování (Mistral Small) — zpracování paralelně, max 10 řádků zároveň',
      'AI stavba kusovníku: znalosti výrobců — pro WAGO, Siemens, ABB, Schneider aj. AI odvodí popis artiklu z typového označení',
      'AI stavba kusovníku: výsledky ve dvou tabulkách — Kusovník (ZBOM formát) a K-Založení (CSV export)',
      'AI stavba kusovníku: upřesňující dotazy po vyhledávání — AI se zeptá jen pokud může zlepšit nenalezené položky',
      'AI stavba kusovníku: historie posledních 5 sestavení v localStorage — opakované vyhledávání nevyžaduje nové AI volání',
      'AI stavba kusovníku: tlačítko Vyčistit, přejmenované pole "Pokyny pro AI" (obecný prompt)',
      'Karel Bot: oprava diakritiky v kartičkách výsledků (CSV data převedena na UTF-8, „DIN lišta" místo „DIN li?ta")',
      'Karel Bot: přesnější vyhledávání díky BM25 full-text indexu (AND sémantika) vedle Fuse.js',
      'Karel Bot: dvoukolová validace — AI upřesní dotaz pokud první výsledky nejsou dostatečné',
      'Karel Bot: kartičky se automaticky přidají pokud AI je zmíní jmenovitě v textu odpovědi',
      'Karel Bot: web vyhledávání preferuje známé výrobce (Weidmüller, Phoenix Contact, Rittal, …)',
      'Karel Bot: wildcard search zkouší „lišta", „lista" i „lita" (varianty bez diakritiky)',
      'Karel Bot: jemný mauve glow kolem okna AI módu',
      'Data CSV jsou součástí Docker image — aktualizace databáze se přenese automaticky přes Watchtower bez zásahu na NAS',
    ],
  },
  {
    version: 'V060626',
    date: '6. 6. 2026',
    major: true,
    changes: [
      'Karel Bot — AI asistent vyhledávání artiklů (plovoucí chat v pravém rohu)',
      'Přirozená čeština: dotazy jako "nerezová záslepka M20" nebo "ABB pojistka 16A"',
      'Dvoustupňové AI: query expansion (Mistral Small) + synthesis s rankingem (Mistral Medium)',
      'LLM ranker vybírá TOP 5 nejrelevantnějších karet z až 40 kandidátů',
      'Slovník průmyslových zkratek: materiály, barvy, plasty, IP krytí, elektro komponenty',
      'Volitelné webové vyhledávání přes Tavily (ozubené kolečko v chatu)',
      'Resizable chat okno, markdown odpovědi, SSE streaming se stavovými pílulkami',
      'Auto-deploy backendu: GitHub Actions → Docker image → Watchtower na NAS',
    ],
  },
  {
    version: 'V050626',
    date: '5. 6. 2026',
    changes: [
      'Oprava: vyhledávání s výrazem obsahujícím závorky „(" nebo „)" již správně funguje (závorky se neinterpretovaly jako regex skupiny)',
    ],
  },
  {
    version: 'V280526',
    date: '28. 5. 2026',
    changes: [
      'Tabulkové zpracování: přidáno tlačítko "Zpět" (undo) s historií až 50 kroků, klávesová zkratka Ctrl+Z',
      'Tabulkové zpracování: buňky dotčené editací, vložením nebo doplněním se krátce rozsvítí (halo efekt)',
    ],
  },
  {
    version: 'V270526',
    date: '27. 5. 2026',
    changes: [
      'Přidána podpora neaktivního materiálu (status "U") — karta výsledku zobrazí varování "Materiál není aktivní!"',
      'Při použití neaktivního materiálu v Tabulkovém zpracování se automaticky doplní poznámka 2: "Neaktivní materiál"',
      'Odstraněno tlačítko "Doplnit excel" (funkce byla zastaralá)',
    ],
  },
  {
    version: 'V250526',
    date: '25. 5. 2026',
    changes: [
      'Přidáno pole Výběhový díl — na kartě výsledku zobrazí varování a náhradní artikl',
      'Přejmenováno tlačítko "Export ZBOM" na "Tabulkové zpracování", tabulka se otevře přímo',
    ],
  },
  {
    version: 'V200526',
    date: '20. 5. 2026',
    changes: [
      'Hromadné vyhledávání: tlačítko "Auto 100 %" automaticky zaškrtne výrazy s přesně jednou 100% shodou',
      'Hromadné vyhledávání: tlačítko "Skrýt zaškrtnuté" pro přehlednější práci s dlouhými seznamy',
      'Optimalizace: duplicitní dotazy se vyhledají jen jednou (výrazné zrychlení u opakujících se výrazů)',
    ],
  },
  {
    version: 'V190526',
    date: '19. 5. 2026',
    changes: [
      'Tabulkové zpracování (ZBOM kusovník): Excel-like editace s multi-cell výběrem, kopírováním a vkládáním',
      'ZBOM: přepínač desetinného oddělovače (tečka / čárka) pro export',
      'ZBOM: import z existujícího TXT exportu',
      'ZBOM: automatické doplnění popisu a typového označení z databáze při zadání artiklu',
      'Tlačítko "Otevřít ZBOM" rozbaleno na dropdown — nový kusovník nebo import z exportu',
      'Drag & drop pro přeřazení řádků v kusovníku',
    ],
  },
  {
    version: 'V180526',
    date: '18. 5. 2026',
    changes: [
      'Zobrazení data poslední aktualizace databáze vedle počtu záznamů',
    ],
  },
  {
    version: 'V140526',
    date: '14. 5. 2026',
    changes: [
      'Ikona kopírování artiklu přímo na kartě v hromadném vyhledávání',
    ],
  },
  {
    version: 'V120526',
    date: '12. 5. 2026',
    changes: [
      'Přidáno hromadné vyhledávání (nová záložka) s exportem výsledků do CSV',
      'Hromadné vyhledávání: počet zobrazených shod na výraz (3 / 6 / 9)',
      'Hromadné vyhledávání: tlačítko "+" pro odkrytí dalších výsledků bez nového hledání',
      'Vylepšení vyhledávače: multi-word vyhledávání (AND logika), kombinovaný režim (fuzzy + wildcard)',
      'Podpora obou databází zároveň (Ústí + Effretikon)',
    ],
  },
  {
    version: 'V051225',
    date: '5. 12. 2025',
    changes: [
      'Spuštění aplikace Article Search App / Robo Filler',
      'Vyhledávání v databázi materiálů (fuzzy, wildcard)',
      'Zvýrazňování shod, filtr výrobců, kopírování artiklu',
      'Export výsledků do CSV',
    ],
  },
];

const LATEST = ENTRIES[0].version;
const LS_KEY = 'changelog_seen';

export function Changelog() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    setSeen(localStorage.getItem(LS_KEY) === LATEST);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setSeen(true);
    localStorage.setItem(LS_KEY, LATEST);
  };

  return (
    <>
      <div className="relative inline-flex">
        {!seen && (
          <span className="absolute -inset-0.5 rounded-xl bg-teal/10 blur-sm animate-pulse pointer-events-none" />
        )}
        <button
          onClick={handleOpen}
          className="relative inline-flex items-center gap-1.5 text-overlay0 hover:text-subtext0 transition-colors text-sm"
          title="Zobrazit historii změn"
        >
          <span>changelog</span>
          <span className="font-mono text-xs px-1.5 py-0.5 bg-surface1 rounded-lg">{LATEST}</span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-crust/80 backdrop-blur-sm" />
          <div
            className="relative z-10 bg-mantle rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface1">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-mauve" />
                <span className="font-semibold text-text">Historie změn</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-overlay1 hover:text-text transition-colors"
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>

            {/* Entries */}
            <div className="overflow-y-auto px-6 py-4 space-y-5">
              {ENTRIES.map((entry, i) => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono text-xs px-2 py-0.5 bg-mauve/20 text-mauve rounded-lg font-bold">
                      {entry.version}
                    </span>
                    <span className="text-subtext0 text-xs">{entry.date}</span>
                    {i === 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-green/20 text-green rounded-lg">nejnovější</span>
                    )}
                    {entry.major && (
                      <span className="text-xs px-1.5 py-0.5 bg-mauve text-crust rounded-lg font-semibold">★ major release</span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {entry.changes.map((change, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-subtext1">
                        <span className="text-mauve mt-1 flex-shrink-0">–</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
