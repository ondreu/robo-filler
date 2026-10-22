---
name: schoogle-article-search
description: Vyhledá SAP artikl v databázi Schoogle (dříve Robo Filler) — přístroje, svorky, kabely, vodiče a příslušenství závodů Ústí nad Orlicí a Effretikon, přes 90 000 položek. Použij VŽDY, když uživatel chce artikl / SAP číslo k typovému označení, číslu dílu výrobce nebo popisu („jaký je artikl pro 3RV2011-1CA10", „máme v SAP řadovou svorku WAGO 2,5?", „najdi v Schooglu…", „přelož kusovník na artikly"), nebo potřebuje ověřit, jestli je díl aktivní nebo výběhový — i když slovo Schoogle nepadne. Hodí se i pro dohledání artiklů k celému seznamu položek (kusovník, BOM, nabídka).
---

# Vyhledávání artiklů v databázi Schoogle

Schoogle je interní vyhledávač artiklů Schaltag (web: https://ondreu.github.io/robo-filler/).
Data jsou master CSV exporty ze SAP obou závodů. Tenhle skill je stáhne a hledá v nich
skriptem — **artikl nikdy nehádej ani nedoplňuj z paměti**, vždycky ho vyhledej.

## Jak hledat

```bash
python3 scripts/search.py "<dotaz>" [--manufacturer <výrobce>] [--field <pole>] [--db usti|effi|both] [--limit N] [--json]
```

- První spuštění stáhne data (~7 MB) z `raw.githubusercontent.com` a uloží je do cache
  na 6 hodin. `--refresh` vynutí nové stažení.
- **Dotaz piš co nejpřesnějším kódem** — typové označení (`3RV2011-1CA10`), číslo dílu
  výrobce (`3044076`) nebo artikl. Popis (`jistič C16 1p`) funguje taky, ale vrací víc
  kandidátů.
- **Výrobce dávej do `--manufacturer`**, ne do dotazu, když ho znáš jistě.
- `--field` omezí hledání na jedno pole: `typoveOznaceni`, `artikl`, `cisloDiluVyrobce`,
  `vyrobce`, `nazev`.
- Pro zpracování výsledku použij `--json` (pole `artikl`, `typoveOznaceni`, `vyrobce`,
  `nazev`, `cisloDiluVyrobce`, `zavod`, `status`, `score`, případně `neaktivni`,
  `nahrada`, `vybehovy`, `truncated`).

Pravidla vyhledávání (proč něco našlo / nenašlo):
- Musí sedět **všechna slova** dotazu, každé v kterémkoli poli.
- Velikost písmen, diakritika a oddělovače nerozhodují: `3rv2011 1ca10` = `3RV2011-1CA10`,
  `ST9` = `ST 9`, `2.5` = `2,5`.
- Slovo do 3 znaků sedí jen na začátku slova (`ut` nenajde „dutinka").
- Slovo s oddělovačem ho vyžaduje i v poli (`2,5` nenajde `M25`).
- Názvy v datech bývají česky bez diakritiky, německy nebo anglicky a zkráceně
  („Jistic", „Reihenklemme", „Stykac") — když popis nenajde nic, zkus kód nebo jiný jazyk.

## Jak číst výsledek

- `score` 100 = přesná shoda kódu. Kolem 60–80 = kandidát, kterého musíš ověřit proti
  zadání (proud, průřez, počet pólů, barva…). Nevybírej automaticky první řádek, když
  má několik kandidátů stejné skóre — vyjmenuj je, nebo se zeptej.
- `neaktivni` (status `U`) — materiál není aktivní, **nedoporučuj ho**; řekni to nahlas.
- `vybehovy` + `nahrada` — výběhový díl; doporuč artikl náhrady a obojí uveď.
- `status` má i další kódy ze SAP (`H` = aktivní, `K`, `KM`, `Z`…) — neznámý kód jen
  uveď, nevykládej si ho.
- `truncated` — výsledek je zkrácený; upřesni dotaz, nepracuj s ním jako s úplným.
- `zavod` — ve kterém závodě artikl je (`Ústí`, `Effretikon` nebo oba).

## Postup

1. Jedna položka: vyhledej, uveď **artikl, typové označení, výrobce a název**
   a upozorni na neaktivní / výběhový díl.
2. Seznam položek (kusovník): vyhledej každou zvlášť (klidně v jednom skriptu, který
   volá `search.py --json` ve smyčce, nebo importuj `search()` z `scripts/search.py`
   a data připrav jen jednou přes `prepare()`). Výsledek vrať jako tabulku: zadání →
   artikl, typové označení, výrobce, poznámka (nenalezeno / víc kandidátů / neaktivní /
   náhrada).
3. Nic nenalezeno: zkus kratší část kódu (bez přípony), bez výrobce, nebo jen číslo dílu
   výrobce — a řekni, co jsi zkoušel. Pořád nic → artikl v databázi není (může být
   potřeba ho založit), **nevymýšlej ho**.

## Když se data nestáhnou

Sandbox možná nesmí na `raw.githubusercontent.com`. Pak:
- požádej uživatele o nahrání `master-data.csv` (a případně `master-data-effi.csv`)
  a spusť `python3 scripts/search.py "<dotaz>" --csv master-data.csv --csv master-data-effi.csv`,
- nebo ať správce povolí doménu `raw.githubusercontent.com` v nastavení síťového
  přístupu pro spouštění kódu.

Jinou adresu dat lze nastavit proměnnými `SCHOOGLE_USTI_URL` a `SCHOOGLE_EFFI_URL`.

## Údržba

Stejný algoritmus používá nástroj `find_article` asistenta v DZL Konfigurátoru
(`packages/api/src/articles/articleSearch.ts`). Změna pravidel hledání patří do obou.
