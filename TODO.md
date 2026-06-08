# TODO — Robo Filler

## Přidané funkce / opravy (aktuální sprint)

- [x] Přidat vodiče, kabely a znalosti o nich — výrobci (Lapp, Helukabel, HUBER SUHNER, Nexans), produktové řady, typová označení, normy — do `manufacturers.js` + `componentGuide.js`
- [x] Řízeným vyhledáváním pro popisky svorek: doplnit WAGO 279 příslušenství (2009-114, WMB-Inline atd.) — příčina: chybějící znalosti v `componentGuide.js`
- [x] Přidat doporučení na konkrétní materiál/řadu pokud vyhledání nic nenajde — úprava `guidedSearch.js` systémového promptu
- [x] Nový konverzační mód v běžném režimu (Karel Bot) — AI radí s výběrem komponent a produktových řad; čerpá znalosti z `componentGuide.js`
- [x] Aktualizovat onboarding — doporuč běžný režim pro obecné věci, řízený pro hledání komponent, BOM jen zmínit (Beta); přidat kompletní průvodce pro nové uživatele s localStorage persistencí + reset tlačítko v footeru
- [x] Přepínač módů: "AI mód" → barevné ✨ AI ✨ s třpytkami
- [x] Otevření tabulkového zpracování z hromadného vyhledávání: opravit aby se otevřelo plnohodnotné ZBOM s kartami a persistencí
- [x] Aktualizovat interní dokumentaci (CLAUDE.md)
- [x] Aktualizovat "Jak funguju?" (HowItWorks.tsx)
- [x] Aktualizovat Changelog (Changelog.tsx)
- [x] Odebrat BETA badge u řízeného režimu → nahradit "Doporučeno"
- [x] Zmenšit plovoucí chatovací bublinu o 20%
