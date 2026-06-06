import { useState } from 'react';
import { HelpCircle, X, Database, Search, Bot, List, Table2, Globe, ArrowRight, Sparkles } from 'lucide-react';

export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setOpen(true)}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
          className="text-overlay1 hover:text-teal transition-colors"
          aria-label="Jak funguju?"
        >
          <HelpCircle size={15} />
        </button>
        {tooltipVisible && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-surface1 text-text rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-50">
            jak funguju?
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-surface1 rotate-45 -mt-1" />
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-crust/80 backdrop-blur-sm" />
          <div
            className="relative z-10 bg-mantle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface1 shrink-0">
              <span className="font-semibold text-text">Jak funguje Robo Filler?</span>
              <button onClick={() => setOpen(false)} className="text-overlay1 hover:text-text transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">

              {/* Databáze */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Database size={15} className="text-mauve shrink-0" />
                  <h3 className="font-semibold text-sm text-text">Databáze artiklů</h3>
                </div>
                <p className="text-sm text-subtext1 leading-relaxed">
                  Aplikace pracuje se dvěma interními databázemi — <span className="text-text font-medium">Ústí nad Orlicí</span> a <span className="text-text font-medium">Effretikon</span> — dohromady přes <span className="text-text font-medium">90 000 artiklů</span>.
                  Každá položka má typové označení, číslo artiklu, výrobce, název a číslo dílu výrobce.
                  Databáze se aktualizuje týdně a načítá se přímo v prohlížeči — vyhledávání nepotřebuje připojení k serveru.
                </p>
              </section>

              {/* Klasické vyhledávání */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Search size={15} className="text-mauve shrink-0" />
                  <h3 className="font-semibold text-sm text-text">Klasické vyhledávání</h3>
                </div>
                <p className="text-sm text-subtext1 leading-relaxed mb-3">
                  Každý dotaz prohledá databázi třemi způsoby zároveň a výsledky sloučí:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface0 rounded-xl p-3">
                    <p className="text-xs font-semibold text-text mb-1">Přesná shoda</p>
                    <p className="text-xs text-subtext1">Každé slovo musí být v záznamu přítomno. Rychlé, bez tolerance překlepů.</p>
                  </div>
                  <div className="bg-surface0 rounded-xl p-3">
                    <p className="text-xs font-semibold text-text mb-1">Přibližná shoda</p>
                    <p className="text-xs text-subtext1">Toleruje drobné překlepy a jiné pořadí slov — "poistka" najde "pojistka".</p>
                  </div>
                  <div className="bg-surface0 rounded-xl p-3">
                    <p className="text-xs font-semibold text-text mb-1">Full-text ranking</p>
                    <p className="text-xs text-subtext1">Statistický model řadí výsledky podle relevance — vzácnější slova mají větší váhu.</p>
                  </div>
                </div>
                <p className="text-xs text-subtext0 mt-2">Výsledky všech tří metod se sloučí, duplikáty odstraní a seřadí od nejpřesnějšího.</p>
              </section>

              {/* Karel Bot */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={15} className="text-mauve shrink-0" />
                  <h3 className="font-semibold text-sm text-text">Karel Bot — AI vyhledávání</h3>
                </div>
                <p className="text-sm text-subtext1 leading-relaxed mb-3">
                  Místo přesných klíčových slov stačí popsat co hledáš. AI dotaz přeloží, vyhledá a vybere nejrelevantnější výsledky:
                </p>

                <div className="flex items-stretch gap-1.5 text-xs overflow-x-auto pb-1">
                  {[
                    { label: 'Tvůj dotaz', sub: 'přirozenou češtinou' },
                    { label: 'Překlad na klíčová slova', sub: 'synonyma, zkratky, CS/DE/EN' },
                    { label: 'Vyhledání v databázi', sub: 'až 60 kandidátů' },
                    { label: 'AI výběr a komentář', sub: 'TOP 5 + popis proč' },
                    { label: 'Výsledek', sub: 'karty + text', highlight: true },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex items-center gap-1.5 shrink-0">
                      <div className={`${step.highlight ? 'bg-mauve/20' : 'bg-surface0'} rounded-xl px-2.5 py-2 text-center`}>
                        <p className="font-semibold text-text">{step.label}</p>
                        <p className="text-overlay1 mt-0.5">{step.sub}</p>
                      </div>
                      {i < arr.length - 1 && <ArrowRight size={12} className="text-overlay0 shrink-0" />}
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2 bg-surface0 rounded-xl p-3">
                    <Sparkles size={13} className="text-mauve shrink-0 mt-0.5" />
                    <p className="text-xs text-subtext1">
                      <span className="text-text font-medium">Dvoukolové upřesnění</span> — pokud první výsledky nejsou ideální, AI automaticky zkusí jiná klíčová slova a hledá znovu.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 bg-surface0 rounded-xl p-3">
                    <Globe size={13} className="text-teal shrink-0 mt-0.5" />
                    <p className="text-xs text-subtext1">
                      <span className="text-text font-medium">Webové vyhledávání</span> — zapni v nastavení chatu pro dotazy na cenu, datasheet nebo dostupnost. Prohledá internet místo interní databáze.
                    </p>
                  </div>
                </div>
              </section>

              {/* AI mód */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={15} className="text-mauve shrink-0" />
                  <h3 className="font-semibold text-sm text-text">AI mód</h3>
                </div>
                <p className="text-sm text-subtext1 leading-relaxed">
                  Záložka <span className="text-text font-medium">AI mód</span> (nahoře vedle "Jednotlivé" a "Hromadné") je rozšířená verze Karel Bota — stejné funkce, ale přes celou šířku obrazovky.
                  Vhodné pro delší konverzace. Z plovoucího chatu se sem lze přepnout tlačítkem v nastavení (<span className="text-text font-medium">Teleportovat do AI módu</span>) — konverzace se přenese celá.
                </p>
              </section>

              {/* Hromadné vyhledávání */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <List size={15} className="text-mauve shrink-0" />
                  <h3 className="font-semibold text-sm text-text">Hromadné vyhledávání</h3>
                </div>
                <p className="text-sm text-subtext1 leading-relaxed">
                  Vlož seznam výrazů (každý na řádek) a aplikace prohledá databázi pro každý zvlášť — typicky kusovník od zákazníka.
                  Výsledky jsou seřazené podle shody, lze označit zpracované položky, exportovat do CSV nebo přenést přímo do Tabulkového zpracování.
                </p>
              </section>

              {/* ZBOM */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Table2 size={15} className="text-mauve shrink-0" />
                  <h3 className="font-semibold text-sm text-text">Tabulkové zpracování (ZBOM)</h3>
                </div>
                <p className="text-sm text-subtext1 leading-relaxed">
                  Jednoduchý tabulkový editor přímo v prohlížeči pro sestavení výstupního kusovníku.
                  Zadáš číslo artiklu a aplikace doplní název a typové označení z databáze.
                  Podporuje kopírování z Excelu, přeřazení řádků, undo (Ctrl+Z) a export do TXT nebo Excel.
                  Lze mít otevřeno více kusovníků najednou jako záložky — vše se automaticky ukládá.
                </p>
              </section>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
