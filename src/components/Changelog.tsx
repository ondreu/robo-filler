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
          <>
            <span className="absolute -inset-1 rounded-xl bg-teal/50 blur-lg animate-pulse pointer-events-none" />
            <span className="absolute -inset-2 rounded-xl bg-teal/20 blur-xl animate-pulse pointer-events-none" />
          </>
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
