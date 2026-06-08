// ---------------------------------------------------------------------------
// Průvodce komponentami — páteř řízeného vyhledávání
// Pro každou kategorii: otázky, znalosti výrobců, strategie vyhledávání.
// DŮLEŽITÉ: knowledge pole slouží jako kontext pro AI — popis typových označení,
// produktových řad a formátů katalogových čísel výrobců.
// ---------------------------------------------------------------------------

function normalize(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------
// CATEGORY DEFINITIONS
// ---------------------------------------------------------------------------
export const COMPONENT_CATEGORIES = [
  // -------------------------------------------------------------------------
  // 1. Jistič
  // -------------------------------------------------------------------------
  {
    key: 'jistic',
    label: 'Jistič',
    aliases: ['jistič', 'jistic', 'jistice', 'mcb', 'mpcb', 'motorový jistič', 'motorovy jistic', 'leitungsschutzschalter', 'ls-schalter', 'circuit breaker', 'miniature circuit breaker'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                    options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'subtype', text: 'Jaký typ jističe hledáš?',                       options: ['Standardní MCB (jistič el. instalace)', 'Motorový jistič MPCB (pro motor)', 'Nevím / obojí může být'] },
      { key: 'proud',   text: 'Jaká je požadovaná jmenovitá hodnota proudu? (napiš číslo, např. 16)' },
      { key: 'poly',    text: 'Kolik pólový?',                                  options: ['1P', '2P', '3P', '4P', '3P+N'] },
      { key: 'char',    text: 'Jaká charakteristika (spouštěcí křivka)?',       options: ['B  —  3–5×In  (citlivá el., kabel)', 'C  —  5–10×In  (obecné, motory)', 'D  —  10–20×In  (velké motory, transformátory)', 'Nevím'] },
      { key: 'icu',     text: 'Požadovaná zkratová odolnost?',                  options: ['6 kA  (standard)', '10 kA', '15+ kA  (průmysl)', 'Nevím'] },
    ],
    mfrKeys: ['abb', 'siemens', 'eaton', 'schneider'],
    knowledge: `## Jistič — přehled kategorií a typových označení

**MCB (Miniature Circuit Breaker)** — modulární jistič na DIN lištu. Chrání vedení před přetížením a zkratem.
**MPCB (Motor Protection Circuit Breaker)** — motorový jistič s nastavitelným proudem. Chrání motor i vedení.

---
### ABB — řada S200 (MCB):
Nejpoužívanější průmyslová řada. Varianty: S200=6kA, S200M=10kA, S200P=15–25kA, S200U=DC.
Formát: S[póly][varianta]-[char][A]
- 1P: S201, S201M, S201P
- 2P: S202, S202M, S202P
- 3P: S203, S203M, S203P
- 4P: S204, S204M, S204P
Konkrétní příklady:
  S201-C16 = 1P 6kA C 16A
  S202-C16 = 2P 6kA C 16A
  S203-C16 = 3P 6kA C 16A
  S203M-C16 = 3P 10kA C 16A
  S203P-C16 = 3P 15kA C 16A
  S201-B6 = 1P 6kA B 6A
  S203-D20 = 3P 6kA D 20A
  S203-C10 = 3P 6kA C 10A
  S203-C25 = 3P 6kA C 25A
  S203-C32 = 3P 6kA C 32A
Speciální: SH200L = nízký IP pro zákazníky (S202-B10, S201-C6), S280UC = DC jistič (S280-UC C16)

### ABB — MPCB MS116 / MS132 / MS165:
MS116: nastavitelný rozsah 0.1–16A (DIN, S00 frame)
MS132: 0.16–32A
MS165: 10–80A
Konkrétní příklady:
  MS116-0.16 = 0.1–0.16A
  MS116-1.0 = 0.63–1.0A
  MS116-1.6 = 1–1.6A
  MS116-2.5 = 1.6–2.5A
  MS116-4.0 = 2.5–4.0A
  MS116-6.3 = 4–6.3A
  MS116-10 = 6.3–10A
  MS116-16 = 10–16A
  MS132-20 = 16–20A
  MS132-32 = 25–32A

---
### Siemens — řada 5SY (MCB):
5SY6=6kA, 5SY4=10kA, 5SY7=15kA. Suffix: -6=B, -7=C, -8=D.
Formát: 5SY[kap][póly][A]-[suffix]
Konkrétní příklady:
  5SY6316-7 = 6kA, 3P, 16A, C
  5SY4316-7 = 10kA, 3P, 16A, C
  5SY6306-7 = 6kA, 3P, 6A, C
  5SY6310-7 = 6kA, 3P, 10A, C
  5SY6116-7 = 6kA, 1P, 16A, C
  5SY6316-6 = 6kA, 3P, 16A, B
  5SY4310-7 = 10kA, 3P, 10A, C
  5SY4325-7 = 10kA, 3P, 25A, C
  5SY7316-7 = 15kA, 3P, 16A, C
Řada 5SL = residential/bytová (nižší zkratová odolnost), 5SL6116-7 = 6kA 1P 16A C.

### Siemens — MPCB 3RV2:
3RV2011=S00(0.16–1.6A), 3RV2021=S0(1.4–14A). Formát: 3RV20[frame]-[rozsah].
  3RV2011-1AA10 = S00, 1.1–1.6A
  3RV2011-4AA10 = S00, 11–16A
  3RV2021-4AA10 = S0, 14A
  3RV2031-4EA15 = S2, větší výkon

---
### Eaton — řada FAZ (MCB):
FAZ-C=6kA, FAZ-NA=10kA.
Formát: FAZ[var]-[char][A]/[P]N
  FAZ-C16/3 = 3P 6kA C 16A
  FAZ-C10/3 = 3P 6kA C 10A
  FAZ-B16/3 = 3P 6kA B 16A
  FAZN-C16/3 = 3P 6kA C 16A (s N-vodičem)
  FAZ6-C16/1 = 1P 6kA C 16A
Řada PL6 (ekonomická DIN): PL6-C16/3 = 3P 6kA C 16A

### Eaton — MPCB PKZM0 / PKZM4:
PKZM0: 0.16–16A, PKZM4: 16–63A
  PKZM0-0.16 = 0.1–0.16A
  PKZM0-1 = 0.63–1A
  PKZM0-2.5 = 1.6–2.5A
  PKZM0-4 = 2.5–4A
  PKZM0-6.3 = 4–6.3A
  PKZM0-10 = 6.3–10A
  PKZM0-16 = 10–16A

---
### Schneider — Acti9 iC60 (MCB):
iC60N=6kA, iC60H=10kA, iC60L=15kA.
Katalogový formát: A9F[var][P][A] kde var: 74=iC60N-C, 72=iC60N-B, 76=iC60N-D, 84=iC60H-C, 94=iC60L-C.
  A9F74316 = iC60N 3P C 16A
  A9F74310 = iC60N 3P C 10A
  A9F74325 = iC60N 3P C 25A
  A9F74116 = iC60N 1P C 16A
  A9F72316 = iC60N 3P B 16A
  A9F84316 = iC60H 3P C 16A (10kA)
Textový formát: "iC60N 3P C16" nebo "iC60N 3P 16A C"

### Schneider — MPCB GV2ME:
  GV2ME06 = 1–1.6A
  GV2ME08 = 2.5–4A
  GV2ME10 = 4–6.3A
  GV2ME14 = 6–10A
  GV2ME16 = 9–14A
  GV2ME20 = 13–18A
  GV2ME22 = 17–23A (25A max)

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení (generuj tato jako první):**
Kombinuj přesná označení: S203-C16, S203M-C16, 5SY4316-7, 5SY6316-7, A9F74316, FAZ-C16/3, PKZM0-10
Pro každou variantu jisti­če (6kA, 10kA), každý relevantní výrobce.
Pro MPCB: MS116-10, MS116-16, PKZM0-10, GV2ME14, 3RV2011-4AA10

**SEKUNDÁRNÍ — obecné fallbacky:**
jistič [char][proud] [póly], MCB [proud]A [char], Leitungsschutzschalter [char][proud], LS-Schalter [proud]A [char]
Motorový jistič [proud]A, MPCB [proud]A, circuit breaker [proud]A`,
  },

  // -------------------------------------------------------------------------
  // 2. Stykač
  // -------------------------------------------------------------------------
  {
    key: 'stykac',
    label: 'Stykač',
    aliases: ['stykač', 'stykac', 'kontaktor', 'schütz', 'schutz', 'contactor', 'pomocný stykač', 'pomocny stykac'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['ABB', 'Siemens', 'Eaton (Moeller)', 'Schneider Electric', 'Allen-Bradley', 'Bez preference'] },
      { key: 'subtype', text: 'Jaký typ stykače?',                                    options: ['Silový (3-pólový výkonový)', 'Pomocný (jen malé pomocné kontakty)', 'Nevím'] },
      { key: 'proud',   text: 'Jaký jmenovitý proud v ampérech? (pro silový, AC-3 — napiš číslo, např. 9 nebo 25)' },
      { key: 'civka',   text: 'Napájecí napětí cívky?',                               options: ['24 V DC', '24 V AC', '230 V AC', '110 V AC', 'Nevím'] },
      { key: 'aux',     text: 'Počet a typ pomocných kontaktů ve stykači?',            options: ['1 NO (spínací)', '1 NC (rozpínací)', '1 NO + 1 NC', 'Bez pomocných / Nevím'] },
    ],
    mfrKeys: ['abb', 'siemens', 'eaton', 'schneider', 'allen_bradley'],
    knowledge: `## Stykač — přehled kategorií a typových označení

**Silový stykač** — 3-pólový výkonový spínač pro motorové obvody (AC-3).
**Pomocný stykač** — jen pomocné kontakty (NO/NC), pro řídicí obvody.

---
### ABB — řada AF (elektronická cívka, wide-range):
Nejmodernější řada. Cívka přijímá 24–500V AC nebo 20–500V DC (různé kódy).
Formát: AF[A]-[hlavní_kontakty]-[aux]-[cívka_kód]
Hlavní kontakty: 30=3NO, 40=4NO. Aux: 10=1NO, 01=1NC, 11=1NO+1NC.
Kódy cívky: 11=100–250V AC/DC, 12=48–130V AC/DC, 13=24–60V AC/DC (tj. 24VDC i 24VAC).

Řada (AC-3 proud):
  AF09-30-10-13 = 9A, 3NO, 1NO aux, 24–60V AC/DC (tj. 24VDC)
  AF09-30-10-11 = 9A, 3NO, 1NO aux, 100–250V AC/DC (tj. 230VAC)
  AF16-30-10-13 = 16A, 3NO, 1NO aux, 24–60V AC/DC
  AF26-30-10-13 = 26A, 3NO, 1NO aux, 24–60V
  AF38-30-10-11 = 38A, 3NO, 1NO aux, 100–250V
  AF65-30-11-11 = 65A, 3NO, 1NO+1NC, 100–250V
  AF80-30-11-11 = 80A
  AF96-30-11-11 = 96A

### ABB — starší řada A (klasická, pevné napětí cívky):
Stále v databázi jako náhradní díly. Formát: A[A]-[aux][cívka]
  A9-30-10-84 = 9A, 1NO aux, 230VAC
  A12-30-10-84 = 12A, 1NO aux, 230VAC
  A16-30-10-84 = 16A, 1NO aux, 230VAC
  A26-30-10-84 = 26A, 1NO aux, 230VAC
  A30-30-10-84 = 30A, 1NO aux, 230VAC

---
### Siemens — řada 3RT2 (SIRIUS):
Nejrozšířenější průmyslová řada v CZ. Velikosti: S00(7–16A), S0(9–38A), S2(45–80A), S3(90–110A).
Formát: 3RT20[XX]-[civka_kód]

**Mapování 3RT2 model → AC-3 proud:**
  3RT2015 = S00, 7A AC-3
  3RT2016 = S00, 9A AC-3
  3RT2017 = S00, 12A AC-3
  3RT2018 = S00, 16A AC-3
  3RT2025 = S0, 17A AC-3
  3RT2026 = S0, 25A AC-3
  3RT2027 = S0, 32A AC-3
  3RT2028 = S0, 38A AC-3
  3RT2035 = S2, 40A AC-3
  3RT2036 = S2, 50A AC-3
  3RT2037 = S2, 65A AC-3
  3RT2038 = S2, 75A AC-3

**Kódy cívky (4. část čísla):**
  1BB41 = 24V DC
  1BF40 = 24V AC (50/60Hz)
  1AF00 = 110V AC (50Hz)
  1AP00 = 220V AC (50Hz)
  1AB00 = 230V AC (50Hz)

Konkrétní příklady:
  3RT2016-1BB41 = S00 9A, 24V DC
  3RT2016-1AB00 = S00 9A, 230V AC
  3RT2016-1BF40 = S00 9A, 24V AC
  3RT2017-1BB41 = S00 12A, 24V DC
  3RT2018-1BB41 = S00 16A, 24V DC
  3RT2025-1BB41 = S0 17A, 24V DC
  3RT2026-1BB41 = S0 25A, 24V DC
  3RT2027-1BB41 = S0 32A, 24V DC

**Pomocný stykač 3RH2:**
  3RH2122-1BB40 = 2NO+2NC, 24V DC
  3RH2131-1AB00 = 3NO+1NC, 230V AC

---
### Eaton — řada DILM (Moeller):
Formát: DILM[A]-[aux][cívka_kód] kde cívka jako zvláštní objednávka nebo suffix.
  DILM9-10 = 9A, 1NO aux (cívka zvlášť nebo s napětím)
  DILM12-10 = 12A, 1NO aux
  DILM17-10 = 17A, 1NO aux
  DILM25-10 = 25A, 1NO aux
  DILM32-10 = 32A, 1NO aux
  DILM40-10 = 40A
  DILM50-10 = 50A

Cívka napětí jako přípona nebo modul: (24VDC), (230V50HZ), (24V50HZ).
  DILM9-10(24VDC) = 9A, 24V DC
  DILM9-10(230V50HZ) = 9A, 230V AC

---
### Schneider — řada TeSys D / LC1D:
Nejrozšířenější řada ve světě. LC1D=výkonový, CAD=pomocný.
Formát: LC1D[kód][cívka]

**Mapování LC1D proud:**
  LC1D06 = 6A AC-3
  LC1D09 = 9A AC-3
  LC1D12 = 12A AC-3
  LC1D18 = 18A AC-3
  LC1D25 = 25A AC-3
  LC1D32 = 32A AC-3
  LC1D38 = 38A AC-3
  LC1D40A = 40A AC-3
  LC1D50A = 50A AC-3
  LC1D65A = 65A AC-3

**Kódy cívky (suffix):**
  BD = 24V DC
  B7 = 24V AC 50Hz
  F7 = 110V AC 50Hz
  M7 = 220V AC 50Hz
  P7 = 230V AC 50Hz
  ED = 48V DC
  FD = 110V DC

Konkrétní příklady:
  LC1D09BD = 9A, 24V DC
  LC1D09M7 = 9A, 220V AC
  LC1D09P7 = 9A, 230V AC
  LC1D12BD = 12A, 24V DC
  LC1D18BD = 18A, 24V DC
  LC1D25BD = 25A, 24V DC
  LC1D32BD = 32A, 24V DC

**Pomocný stykač CAD:**
  CAD32BD = 3NO+2NC, 24V DC
  CAD32P7 = 3NO+2NC, 230V AC

---
### Allen-Bradley — řada 100-C:
  100-C09D10 = 9A, 24VDC (D), 1NO aux (10)
  100-C12D10 = 12A, 24VDC
  100-C23D10 = 23A, 24VDC
  100-C30D10 = 30A, 24VDC
  100-C37D10 = 37A, 24VDC
  100-C43D10 = 43A, 24VDC

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
3RT2016-1BB41, 3RT2016-1AB00, LC1D09BD, LC1D09M7, AF09-30-10-13, DILM9-10(24VDC)
Pro každý relevantní výrobce a napětí cívky. Pro S0 (17–32A): 3RT2025, 3RT2026, 3RT2027.

**SEKUNDÁRNÍ — obecné fallbacky:**
stykač [proud]A [napětí_cívky], kontaktor [proud]A, Schütz [proud]A [napětí], contactor [proud]A DC`,
  },

  // -------------------------------------------------------------------------
  // 3. Pojistka
  // -------------------------------------------------------------------------
  {
    key: 'pojistka',
    label: 'Pojistka',
    aliases: ['pojistka', 'pojistky', 'fuse', 'sicherung', 'nh pojistka', 'válcová pojistka', 'valcova pojistka', 'skleněná pojistka', 'sklenena pojistka', 'cylindrical fuse'],
    questions: [
      { key: 'subtype', text: 'Jaký typ pojistky hledáš?',                           options: ['NH pojistka (silová, nožová)', 'Válcová pojistka (10×38 nebo 14×51)', 'Skleněná pojistka (5×20)', 'Nevím'] },
      { key: 'proud',   text: 'Jaký jmenovitý proud? (napiš číslo, např. 63)' },
      { key: 'nh_size', text: 'Stupeň (velikost) NH pojistky?',                      options: ['000 (do 100A)', '00 (do 160A)', '0 (do 160A)', '1 (do 250A)', '2 (do 400A)', '3 (do 630A)', 'Nevím'] },
      { key: 'typ_tav', text: 'Typ tavné vložky / charakteristika?',                 options: ['gG  —  obecné vedení (kabelová ochrana)', 'gM  —  motorová ochrana', 'aR  —  rychlá (ochrana polovodičů)', 'Nevím'] },
    ],
    mfrKeys: [],
    knowledge: `## Pojistka — přehled typů a typových označení

### NH pojistky (nožové):
Velké průmyslové pojistky. Výrobci jsou navzájem záměnitelní (IEC norma).

**Siemens — řada 3NA:**
Formát: 3NA3[XXX] kde číslo kóduje velikost + proud + charakteristiku.
  3NA3003 = NH00, 16A gG
  3NA3006 = NH00, 25A gG
  3NA3010 = NH00, 35A gG
  3NA3014 = NH00, 50A gG
  3NA3017 = NH00, 63A gG
  3NA3020 = NH00, 80A gG
  3NA3022 = NH00, 100A gG
  3NA3124 = NH1, 125A gG
  3NA3130 = NH1, 160A gG
  3NA3136 = NH1, 200A gG
  3NA3140 = NH1, 250A gG
  3NA3822 = NH00, 100A aM (motorová)

**ETI — populární CZ/SK výrobce:**
Řada NH-gG: NH1-gG-100A, NH00-gG-63A, NH2-gG-315A
  NH00-gG/gL-63A = 63A gG stupeň 00
  NH1-gG/gL-125A = 125A gG stupeň 1
  NH2-gG/gL-250A = 250A gG stupeň 2
  NH00-aM-63A = 63A aM stupeň 00
  NPB00-80A = NH pojistkový odpojovač 80A stupeň 00

**ABB — řada E-série:**
  E90/100gG = NH0, 100A gG
  E91/125gG = NH1, 125A gG
  E92/250gG = NH2, 250A gG

**Mersen (Ferraz Shawmut):**
  FR22GG63V16 = válcová 22×58, 63A gG 500V

---
### Válcová pojistka:
**10×38 mm** — průmyslové, do 32A. Nejčastěji v pojistkových odpojovačích.
  Siemens: 3NC1410-0MK = 10×38mm, 10A gG
  ETI: D02-25A-gG, D02-16A-gG (cylindrical 10×38)

**14×51 mm** — do 100A.

**22×58 mm** — do 100A, silná průmyslová.

---
### Skleněná pojistka (miniaturní):
**5×20 mm**: 0.1–16A. Typy: T=pomalá, F=rychlá, M=střední.
  5×20 T 1A, 5×20 F 6.3A, 5×20 T 4A, 5×20 M 2A

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
3NA3017 (Siemens 63A gG NH00), NH00-gG-63A, NH1-gG-125A, ETI NH00 63A gG
Pro válcové: D02 10×38 16A gG

**SEKUNDÁRNÍ — obecné fallbacky:**
NH gG [stupeň] [proud]A, Sicherungseinsatz [proud]A gG, válcová pojistka [proud]A
Schmelzsicherung, NH-Sicherung, HRC fuse, fuse link [proud]A`,
  },

  // -------------------------------------------------------------------------
  // 4. Napájecí zdroj
  // -------------------------------------------------------------------------
  {
    key: 'napajeci_zdroj',
    label: 'Napájecí zdroj',
    aliases: ['napájecí zdroj', 'napajeci zdroj', 'napáječ', 'napaječ', 'psu', 'power supply', 'netzteil', 'netzgerät', 'din napájecí', '24v zdroj', '24vdc'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['Phoenix Contact (QUINT/TRIO)', 'Weidmüller (PROtop)', 'Siemens (SITOP)', 'PULS', 'Mean Well', 'Murr Elektronik', 'Bez preference'] },
      { key: 'vin',     text: 'Vstupní napájení?',                                    options: ['230 V AC jednofázové', '400 V AC třífázové', 'Nevím / univerzální'] },
      { key: 'vout',    text: 'Výstupní napětí (DC)?',                                options: ['24 V DC  (nejčastější)', '48 V DC', '12 V DC', '5 V DC', 'Jiné'] },
      { key: 'iout',    text: 'Výstupní proud nebo výkon? (napiš, např. 5A nebo 120W)' },
    ],
    mfrKeys: ['phoenix', 'weidmuller', 'siemens'],
    knowledge: `## Napájecí zdroje DIN — přehled a typová označení

---
### Phoenix Contact:
**QUINT 4 (prémiová řada):** Výstup 24VDC, přetížitelnost 125%, diagnostika.
Formát: QUINT4-PS/[vstup]/24DC/[A]
  QUINT4-PS/1AC/24DC/5 = 1-fáze 230V AC, 24VDC, 5A (120W)
  QUINT4-PS/1AC/24DC/10 = 1-fáze, 24VDC, 10A (240W)
  QUINT4-PS/1AC/24DC/20 = 1-fáze, 24VDC, 20A (480W)
  QUINT4-PS/3AC/24DC/20 = 3-fáze 400V AC, 24VDC, 20A
  QUINT4-PS/3AC/24DC/40 = 3-fáze, 24VDC, 40A (960W)

**TRIO 5 (standardní průmyslový):**
Formát: TRIO-PS/[vstup]/24DC/[A]
  TRIO-PS/1AC/24DC/2.5 = 1-fáze, 24VDC, 2.5A (60W)
  TRIO-PS/1AC/24DC/5 = 1-fáze, 24VDC, 5A
  TRIO-PS/1AC/24DC/10 = 1-fáze, 24VDC, 10A
  TRIO-PS/1AC/24DC/20 = 1-fáze, 24VDC, 20A

**STEP 3 (kompaktní):**
  STEP3-PS/1AC/24DC/0.5, STEP3-PS/1AC/24DC/1.5, STEP3-PS/1AC/24DC/3

---
### PULS (německý premium výrobce):
Vysoce efektivní, kompaktní. Populární v průmyslové automatizaci.
**QS série (24VDC single-phase):**
  QS5.241 = 24VDC, 5A (120W), 1-fáze 100–240VAC
  QS10.241 = 24VDC, 10A (240W), 1-fáze
  QS20.241 = 24VDC, 20A (480W), 1-fáze
  QS40.241 = 24VDC, 40A (960W), 1-fáze

**CP série (kompaktní):**
  CP5.241 = 24VDC, 5A
  CP10.241 = 24VDC, 10A
  CP20.241 = 24VDC, 20A

**SL série (slim, slim-line):**
  SL5.100 = 24VDC, 5A
  SL10.100 = 24VDC, 10A

---
### Siemens SITOP:
**PSU100S (1/2-fázový vstup):** Formát 6EP1[XXX]-[YYY]
  6EP1331-2BA20 = PSU100S 24V/2.5A (1-fáze)
  6EP1332-2BA20 = PSU100S 24V/5A (1-fáze)
  6EP1333-2BA20 = PSU100S 24V/10A (1-fáze)
  6EP1334-2BA20 = PSU100S 24V/20A (1-fáze)

**PSU3600 (3-fázový):** Formát 6EP3[XXX]-[YYY]
  6EP3333-7SB00-0AX0 = SITOP PSU300S 24V/10A (3-fáze)
  6EP3334-7SB00-0AX0 = SITOP PSU300S 24V/20A (3-fáze)
  6EP3437-7SB00-0AX0 = SITOP PSU300S 24V/40A (3-fáze)

---
### Weidmüller:
**PRO ECO 3 (ekonomická):** 24VDC 2.5/5/10/20A.
  PRO ECO3 24VDC 5A = 5A 24VDC
  PRO ECO3 24VDC 10A = 10A 24VDC

**PROtop (pokročilá, diagnostika):**
  PROtop 24VDC 10A, PROtop 24VDC 20A

---
### Murr Elektronik:
**MCS série (kompaktní DIN):**
  MCS10-3-100-24 = 24VDC, 10A, 3-fáze 400V
  MCS20-3-100-24 = 24VDC, 20A, 3-fáze

**MICO (distributor s výstupními spoji):**
  MICO 2.5 = 2.5A ochranný modul, 4×2.5A

---
### Mean Well:
**HDR série:** DIN, kompaktní. HDR-15-24=24VDC 0.63A, HDR-30-24=24VDC 1.25A, HDR-60-24=24VDC 2.5A, HDR-100-24=24VDC 4.17A.
**NDR série:** NDR-120-24=24VDC 5A, NDR-240-24=24VDC 10A, NDR-480-24=24VDC 20A.
**DR série:** DR-120-24=24VDC 5A, DR-240-24=24VDC 10A.

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
QUINT4-PS/1AC/24DC/10, TRIO-PS/1AC/24DC/5, 6EP1333-2BA20, QS10.241, CP10.241, PRO ECO3 24VDC 10A, HDR-100-24

**SEKUNDÁRNÍ — obecné fallbacky:**
napájecí zdroj 24VDC [proud]A DIN, Netzteil 24V [proud]A, PSU 24VDC, SITOP, QUINT, TRIO, PULS`,
  },

  // -------------------------------------------------------------------------
  // 5. Svorky a příslušenství
  // -------------------------------------------------------------------------
  {
    key: 'svorka',
    label: 'Svorka',
    aliases: ['svorka', 'svorky', 'svorkovnice', 'řadová svorka', 'radova svorka', 'terminal', 'klemme', 'klemmen', 'reihenklemme', 'wago svorka', 'push-in', 'topjob'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['WAGO (TOPJOB S / LEVER-NUT)', 'Phoenix Contact (PT / UT)', 'Weidmüller (WDU / ZDU)', 'Bez preference'] },
      { key: 'tech',    text: 'Typ připojení (technologie)?',                         options: ['Šroubová', 'Push-in (tuhý/dutinkový vodič bez nástroje)', 'Pružinová klecová (CAGE CLAMP, šroubovák)', 'Páčková (LEVER-NUT)', 'Nevím'] },
      { key: 'prurez',  text: 'Průřez vodiče?',                                       options: ['1.5 mm²', '2.5 mm²', '4 mm²', '6 mm²', '10 mm²', '16 mm²', 'Jiný'] },
      { key: 'funkce',  text: 'Funkce svorky?',                                       options: ['Průchozí (standardní)', 'PE (ochranný vodič, zelenožlutá)', 'Nožová / testovací', 'Popis / čítko (příslušenství)', 'Propojka', 'Krajní doraz'] },
    ],
    mfrKeys: ['wago', 'phoenix', 'weidmuller'],
    knowledge: `## Svorky DIN — přehled a typová označení

---
### WAGO — TOPJOB S 2000 série (Push-in CAGE CLAMP):
Nejrozšířenější DIN svorka v CZ. Formát: 20[průřez]-1[vodič][barva]
Průřez kódy: 01=1.5mm², 02=2.5mm², 04=4mm², 06=6mm², 10=10mm², 16=16mm²
Barva kódy: 01=šedá, 02=oranžová, 04=modrá (N-vodič), 07=ZeŽlu (PE)
Vodič: 2=2-vodičová, 4=4-vodičová svorka

Konkrétní příklady:
  2001-1201 = TOPJOB S 2000, 1.5mm², 1-vodičová, šedá
  2002-1201 = TOPJOB S 2000, 2.5mm², 1-vodičová, šedá
  2002-1401 = TOPJOB S 2000, 2.5mm², 4-vodičová, šedá
  2004-1201 = TOPJOB S 2000, 4mm², šedá
  2006-1201 = TOPJOB S 2000, 6mm², šedá
  2010-1201 = TOPJOB S 2000, 10mm², šedá
  2002-1204 = TOPJOB S 2000, 2.5mm², modrá (neutrál)
  2002-1207 = TOPJOB S 2000, 2.5mm², ZeŽlu PE
  2004-1207 = TOPJOB S 2000, 4mm², PE
  2006-1207 = TOPJOB S 2000, 6mm², PE

**Propojky (jumpers) pro TOPJOB 2000:**
  2002-402 = propojka 2-pozice 2.5mm²
  2002-404 = propojka 4-pozice 2.5mm²
  2002-408 = propojka 8-pozice 2.5mm²
  2004-402 = propojka 2-pozice 4mm²
  2006-402 = propojka 2-pozice 6mm²

**WAGO 221 LEVER-NUT (páčkové, inline, bez DIN):**
  221-412 = 4mm² 2-vodič páčkový
  221-413 = 4mm² 3-vodič
  221-415 = 4mm² 5-vodič
  221-2401 = 0.5–2.5mm² 2-vodič

**Krajní dorazy WAGO:**
  2002-1990 = krajní doraz pro 2.5mm²
  2002-1991 = mezikusová přepážka

---
### Phoenix Contact — CLIPLINE (PT / UT):
**PT série (Push-in CAGE CLAMP):**
  PT 1,5 = 1.5mm² šedá (pt 1.5 gn = zelená, pt 1.5 bu = modrá)
  PT 2,5 = 2.5mm² šedá
  PT 2,5-PE = 2.5mm² PE zelenožlutá
  PT 2,5 BU = 2.5mm² modrá
  PT 4 = 4mm²
  PT 6 = 6mm²
  PT 10 = 10mm²

**UT série (šroubová Reakdyn):**
  UT 2,5 = 2.5mm²
  UT 2,5-TWIN = 2.5mm² dvouvodičová
  UT 4 = 4mm²
  UT 6 = 6mm²
  UT 10 = 10mm²

**ST série (pružinová klecová):**
  ST 2,5 = 2.5mm²
  ST 4 = 4mm²

**Propojky Phoenix Contact:**
  FBS 2-5 = propojka 2-pozice pro svorky 5mm rozteč
  FBS 5-5 = propojka 5-pozice pro 5mm
  FBS 10-5 = 10-pozice
  QB 5 = propojka přemostění

---
### Weidmüller — W série / Z série:
**WDU (šroubová):**
  WDU 2.5 = 2.5mm² šedá
  WDU 4 = 4mm²
  WDU 6 = 6mm²
  WDU 10 = 10mm²
  WDU 16 = 16mm²
  WDU 35 = 35mm²

**WPE (PE zelenožlutá):**
  WPE 2.5 = 2.5mm² PE
  WPE 4 = 4mm² PE
  WPE 6 = 6mm² PE

**ZDU (pružinová Z série):**
  ZDU 2.5 = 2.5mm²
  ZDU 4 = 4mm²

**WTR (testovací/nožová):**
  WTR 4 = 4mm² testovací

**Propojky Weidmüller:**
  QV 2,5/10 = propojka 10-pozice pro 2.5mm²
  QV 4/5 = propojka 5-pozice pro 4mm²

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
2002-1201 (WAGO 2.5mm² šedá), 2004-1207 (WAGO 4mm² PE), PT 2,5 (Phoenix), WDU 2.5 (Weidmüller)
Propojky: 2002-402, FBS 2-5, QV 2/10

**SEKUNDÁRNÍ — obecné fallbacky:**
svorka [průřez]mm² šedá/modrá/PE, Klemme [průřez]mm², terminal [průřez]mm², push-in terminal, Reihenklemme`,
  },

  // -------------------------------------------------------------------------
  // 6. Frekvenční měnič
  // -------------------------------------------------------------------------
  {
    key: 'frekvenční_menic',
    label: 'Frekvenční měnič',
    aliases: ['frekvenční měnič', 'frekvencni menic', 'frekvenčni měnič', 'měnič', 'menic', 'vfd', 'frequenzumrichter', 'umrichter', 'invertor', 'pohon', 'altivar', 'sinamics', 'acs', 'powerflex', 'g120', 'fc302', 'danfoss'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['Siemens (SINAMICS)', 'ABB (ACS)', 'Schneider (Altivar)', 'Danfoss (FC)', 'Allen-Bradley (PowerFlex)', 'Bez preference'] },
      { key: 'vykon',   text: 'Výkon motoru v kW? (napiš číslo, např. 2.2 nebo 15)' },
      { key: 'napajeni',text: 'Napájecí napětí sítě?',                                options: ['230 V AC jednofázové', '400 V AC třífázové', 'Nevím'] },
      { key: 'ip',      text: 'Krytí (IP)?',                                          options: ['IP20  (do rozváděče / skříně)', 'IP55  (do průmyslového prostředí)', 'IP66+  (venkovní / agresivní prostředí)', 'Nevím'] },
    ],
    mfrKeys: ['siemens', 'abb', 'schneider', 'allen_bradley'],
    knowledge: `## Frekvenční měniče — přehled a typová označení

---
### Siemens SINAMICS:

**G120C (kompaktní, vše v jednom, 3-fáze 400V):**
Formát: 6SL3210-1KE[výkon][napětí_typ]
Výkon kódy (přibližné): 11=0.75kW, 12=1.5kW, 13=2.2kW, 14=3kW, 15=4kW, 17=5.5kW, 18=7.5kW, 21=11kW, 23=15kW, 25=18.5kW, 27=22kW
  6SL3210-1KE11-8UP1 = 0.75kW (G120C, IP20)
  6SL3210-1KE12-3UP1 = 1.5kW
  6SL3210-1KE13-2UP1 = 2.2kW
  6SL3210-1KE14-3UP1 = 3kW
  6SL3210-1KE15-8UP1 = 4kW
  6SL3210-1KE17-5UP1 = 5.5kW
  6SL3210-1KE18-8UP1 = 7.5kW
  6SL3210-1KE21-3UP1 = 11kW (U=IP20, E=IP55 verze: 6SL3210-1KE13-2EF0)

**G120 modulární (PM+CU, 3-fáze 400V):**
Výkonová část PM240-2: 6SL3210-1PE[výkon]...
CU250D-2 (základní): 6SL3244-0BB13-1PA1

**V20 (ekonomický):**
  6SL3210-5BE21-8UV0 = 1-fáze 230V, 1.5kW (bez EMC filtru)
  6SL3210-5BE21-8CV0 = 1-fáze 230V, 1.5kW (s EMC filtrem C2)
  6SL3210-5BB15-5UV1 = 3-fáze 400V, 0.75kW
  6SL3210-5BB17-5UV1 = 3-fáze 400V, 1.5kW

---
### ABB ACS:
**ACS580 (generální pohon, 3-fáze 400V):**
Formát: ACS580-01-[I]-4 kde I = jmenovitý proud
  ACS580-01-04A1-4 = 1.5kW, 4.1A
  ACS580-01-05A7-4 = 2.2kW
  ACS580-01-07A3-4 = 3kW
  ACS580-01-09A4-4 = 4kW
  ACS580-01-12A6-4 = 5.5kW
  ACS580-01-017A-4 = 7.5kW
  ACS580-01-023A-4 = 11kW
  ACS580-01-031A-4 = 15kW

**ACS355 (průmyslový, IP66 varianta):**
  ACS355-03E-01A9-4 = 3-fáze, 0.75kW
  ACS355-03E-03A3-4 = 3-fáze, 1.5kW
  ACS355-03E-04A1-4 = 3-fáze, 2.2kW
  ACS355-03E-05A6-4 = 3-fáze, 3kW (IP66: ACS355-03E-05A6-4+B063)

**ACS150 (kompaktní do 7.5kW):**
  ACS150-03E-01A9-4 = 0.75kW, ACS150-03E-04A1-4 = 2.2kW

---
### Schneider Altivar:
**ATV320 (do 15kW):**
  ATV320U07M2C = 0.75kW, 1-fáze 200–240V
  ATV320U15N4B = 1.5kW, 3-fáze 380–500V
  ATV320U22N4B = 2.2kW, 3-fáze
  ATV320U40N4B = 4kW, 3-fáze
  ATV320U55N4B = 5.5kW, 3-fáze
  ATV320U75N4B = 7.5kW, 3-fáze

**ATV630 (procesní):**
  ATV630U15N4 = 1.5kW, ATV630U22N4 = 2.2kW, ATV630U30N4 = 3kW, ATV630U40N4 = 4kW

---
### Danfoss:
**FC302 (prémiový vektorový, 3-fáze 400V):**
  FC-302PK75T5E20H1 = 0.75kW
  FC-302P1K5T5E20H1 = 1.5kW
  FC-302P2K2T5E20H1 = 2.2kW
  FC-302P4K0T5E20H1 = 4kW
  FC-302P5K5T5E20H1 = 5.5kW
  FC-302P7K5T5E20H1 = 7.5kW
  FC-302P11KT5E20H1 = 11kW

**FC51 (Micro Drive, ekonomický):**
  FC-051P1K5T4E20H4 = 1.5kW 3-fáze 400V

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
6SL3210-1KE13-2UP1 (G120C 2.2kW), ACS580-01-05A7-4 (2.2kW), ATV320U22N4B (2.2kW), FC-302P2K2T5E20H1
Variuj pro každý relevantní výrobce a okolní výkonové stupně.

**SEKUNDÁRNÍ — obecné fallbacky:**
frekvenční měnič [výkon]kW 400V, VFD [výkon]kW, Frequenzumrichter [výkon]kW, SINAMICS [výkon]kW`,
  },

  // -------------------------------------------------------------------------
  // 7. Soft Starter
  // -------------------------------------------------------------------------
  {
    key: 'softstarter',
    label: 'Soft Starter',
    aliases: ['softstarter', 'soft starter', 'soft-starter', 'sanftanlasser', 'sanftstarter', 'plynný rozběh', 'plynny rozbeh', 'ats22', 'ats48', 'psr', 'pst', '3rw'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['Siemens (3RW)', 'ABB (PSR/PST/PSTB)', 'Schneider (Altistart ATS)', 'Bez preference'] },
      { key: 'vykon',   text: 'Výkon motoru v kW? (napiš číslo, např. 7.5 nebo 22)' },
      { key: 'bypass',  text: 'Integrovaný bypass kontaktor?',                        options: ['Ano  (ekonomická montáž, méně komponentů)', 'Ne  (chci softstarterové řízení i při chodu)', 'Nevím'] },
    ],
    mfrKeys: ['siemens', 'abb', 'schneider'],
    knowledge: `## Soft Startéry — přehled a typová označení

Softstartér omezuje záběrný proud motoru při rozběhu (2–4×In místo 6–8×In).

---
### Siemens SIRIUS 3RW:
**3RW40 (základní, bez integrovaného bypassu):** 3-fáze 400V.
Formát: 3RW40[XX]-[verze]
  3RW4022-1BB14 = 5.5kW / 12A při 400V
  3RW4023-1BB14 = 7.5kW / 17A
  3RW4025-1BB14 = 11kW / 25A
  3RW4026-1BB14 = 15kW / 32A
  3RW4027-1BB14 = 18.5kW / 38A
  3RW4028-1BB14 = 22kW / 45A
  3RW4036-1BB14 = 30kW / 65A
  3RW4038-1BB14 = 37kW / 75A

**3RW44 (pokročilý, s bypassem):**
  3RW4426-1BC44 = 15kW
  3RW4428-1BC44 = 22kW
  3RW4436-1BC44 = 30kW

---
### ABB PSR (ekonomický, bez bypassu):
Formát: PSR[A]-600-70 kde A = jmenovitý proud A.
  PSR3-600-70 = 1.5kW, 3A
  PSR6-600-70 = 3kW, 6A
  PSR9-600-70 = 4kW, 9A
  PSR16-600-70 = 7.5kW, 16A
  PSR25-600-70 = 11kW, 25A
  PSR30-600-70 = 15kW, 30A
  PSR37-600-70 = 18.5kW, 37A

**ABB PST/PSTB (pokročilý, s bypassem PSTB):**
  PST30-600-70 = 15kW
  PST105-600-70 = 55kW
  PSTB60-600-70 = 30kW (s bypassem)

---
### Schneider Altistart:
**ATS22 (do 75kW):**
  ATS22D12Q = 5.5kW (12A)
  ATS22D17Q = 7.5kW (17A)
  ATS22D32Q = 15kW (32A)
  ATS22D47Q = 22kW (47A)
  ATS22D62Q = 30kW (62A)
  ATS22D75Q = 37kW (75A)

**ATS48 (pokročilý, do 900kW):**
  ATS48D17Q = 7.5kW
  ATS48D32Q = 15kW
  ATS48D47Q = 22kW

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
3RW4023-1BB14 (7.5kW), PSR9-600-70 (4kW), PSR16-600-70 (7.5kW), ATS22D17Q (7.5kW)
Pro okolní výkonové stupně (±1 krok).

**SEKUNDÁRNÍ — obecné fallbacky:**
softstarter [výkon]kW, Sanftanlasser [výkon]kW, soft-starter [výkon]kW 400V`,
  },

  // -------------------------------------------------------------------------
  // 8. Transformátor
  // -------------------------------------------------------------------------
  {
    key: 'transformator',
    label: 'Transformátor',
    aliases: ['transformátor', 'transformator', 'trafo', 'transformer', 'řídicí transformátor', 'riidici transformator', 'bezpečnostní transformátor', 'bezpecnostni transformator', 'oddělovací', 'oddelovaci', 'trenn', 'steuer'],
    questions: [
      { key: 'subtype', text: 'Typ transformátoru?',                                  options: ['Řídicí (primár 230/400V → sekundár 110/230V)', 'Bezpečnostní (sekundár 24V, SELV)', 'Oddělovací (1:1 izolace)', 'Silový (jiný výkon/napětí)'] },
      { key: 'vout',    text: 'Sekundární napětí? (napiš, např. 24V nebo 110V nebo 230V)' },
      { key: 'vykon',   text: 'Výkon v VA nebo W? (napiš číslo, např. 100 nebo 500)' },
    ],
    mfrKeys: [],
    knowledge: `## Transformátory — přehled a typová označení

---
### Block (německý výrobce — nejrozšířenější v CZ):
**VSR / VCT (řídicí transformátor):**
Primár: 230V nebo 400V. Sekundár: 24V, 110V, 230V. Výkony 25VA–10kVA.
  VSR 0,063/23 = 63VA, primár 230V, sekundár 230V
  VSR 0,16/23 = 160VA, primár 230V, sekundár 230V
  VSR 0,25/23 = 250VA
  VSR 0,4/23 = 400VA
  VSR 0,63/23 = 630VA
  VSR 1,0/23 = 1kVA
  VCT 0,1/2/23 = 100VA, řídicí, primár 400V, sekundár 2×230V

**STR (řídicí transformátor průmyslový):**
  STR 100VA 2×230V/1×110V = 100VA
  STR 160VA

**VC (bezpečnostní transformátor 24V AC):**
  VC 0,04/23/24 = 40VA, 230V/24V (SELV)
  VC 0,063/23/24 = 63VA
  VC 0,16/23/24 = 160VA
  VC 0,25/23/24 = 250VA

---
### Murr Elektronik (MTS série):
Řídicí a bezpečnostní transformátory.
  MTS 40VA primár 230V sekundár 24V = bezpečnostní
  MTS 100VA 230V/110V = řídicí
  MTS 160VA 400V/230V
  MTS 250VA 400V/230V

---
### Hahn (řídicí transformátory):
  EI 102/23 = řídicí, 100VA, 400V/2×115V
  EI 96-12 = 60VA, 230/24V
  EI 144/23 = 250VA

---
### Výrobci: Block, Murr, Hahn, ABB, Siemens (malé), Würth, Lovato.

### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
VSR 0,25/23 (Block 250VA 230V), VC 0,16/23/24 (Block 160VA 24V), STR 100VA, MTS 100VA 230V/110V

**SEKUNDÁRNÍ — obecné fallbacky:**
řídicí transformátor [VA]VA, Steuertransformator [VA]VA, bezpečnostní trafo 24V [VA]VA
transformátor [výkon]VA [primár]/[sekundár]V`,
  },

  // -------------------------------------------------------------------------
  // 9. Relé
  // -------------------------------------------------------------------------
  {
    key: 'rele',
    label: 'Relé',
    aliases: ['relé', 'rele', 'relay', 'relais', 'ssr', 'solid state relay', 'elektromechanické relé', 'patice', 'g2r', 'my2', 'my4', 'rm85', 'relpol'],
    questions: [
      { key: 'subtype', text: 'Jaký typ relé?',                                       options: ['Elektromechanické (cívka + kontakty)', 'SSR (solid state, polovodičové)', 'Reléový modul na DIN (hotový modul s patičkou)'] },
      { key: 'civka',   text: 'Napájecí napětí cívky?',                               options: ['24 V DC', '24 V AC', '230 V AC', '12 V DC', '110 V AC', 'Nevím'] },
      { key: 'konf',    text: 'Konfigurace kontaktů?',                                options: ['1×CO (SPDT, přepínací)', '2×CO (DPDT, 2 přepínací)', '4×CO (4 přepínací)', '1 NO', '1 NC', 'Nevím'] },
      { key: 'proud',   text: 'Jmenovitý proud kontaktů?',                            options: ['5–6 A', '8–10 A', '16 A', 'Nevím'] },
      { key: 'montaz',  text: 'Způsob montáže?',                                      options: ['Do patice (soklu) na DIN lištu', 'Přímo na DIN (bezpaticové)', 'Na plošný spoj (PCB)', 'Nevím'] },
    ],
    mfrKeys: ['omron', 'weidmuller', 'phoenix'],
    knowledge: `## Relé — přehled typů a typových označení

---
### Omron G2R (průmyslové do patice, 10A):
Nejrozšířenější průmyslové relé. Patice: P2RF-05 (1-pól, 5-pin), P2RF-08 (2-pól, 8-pin).
Formát: G2R-[póly][příznaky] [napájení]
Příznaky: -SN=patice+LED+dioda, -S=patice, bez=-standalone
  G2R-1-SN DC24 = 1-pól SPDT, patice, LED, dioda, 24VDC
  G2R-1-SN DC12 = 1-pól, 12VDC
  G2R-1-SN AC230 = 1-pól, 230VAC
  G2R-2-SN DC24 = 2-pól DPDT, patice, LED, dioda, 24VDC, 5A
  G2R-2-SN AC230 = 2-pól, 230VAC

### Omron MY (miniaturní, 5A):
Patice: PYF08A (MY2, 8-pin), PYF14A (MY4, 14-pin).
  MY2N DC24 = 2-pól DPDT, LED, 24VDC, 5A
  MY2N DC12 = 2-pól, 12VDC
  MY2N AC230 = 2-pól, 230VAC
  MY4N DC24 = 4-pól 4CO, LED, 24VDC, 3A
  MY4N AC230 = 4-pól, 230VAC

---
### Relpol (polský výrobce, velmi populární v CZ/SK):
Nejčastěji používaná relé v průmyslových rozváděčích CZ.
**RM85 (průmyslové patičkové, 16A kontakt):**
Formát: RM85-2011-35-[napětí_kód]
napětí_kód: 1024=24VDC, 1048=48VDC, 1110=110VDC, 1012=12VDC, 5024=24VAC, 5230=230VAC
  RM85-2011-35-1024 = 1CO (SPDT), 16A, 24VDC, patice
  RM85-2011-35-5024 = 1CO, 16A, 24VAC
  RM85-2011-35-5230 = 1CO, 16A, 230VAC
  RM85-2011-35-1012 = 1CO, 16A, 12VDC

**R15 (miniaturní PCB relé):**
  R15-2011-23-1024 = 1CO, 10A, 24VDC, PCB
  R15-2011-23-5230 = 1CO, 10A, 230VAC

**RM699 (subminiaturní, 8A):**
  RM699BV-3011-85-1012 = 1CO, 24VDC

---
### Schrack (Tyco/TE Connectivity — populární CZ):
**RT (standardní průmyslové):**
  RT424F24 = 2CO, 24VDC, 8A (RT424 = 2-pól, F=LED+dioda, 24=24VDC)
  RT314F24 = 1CO, 24VDC, 16A
  RT314F230 = 1CO, 230VAC

---
### Phoenix Contact PLC-RSP (reléový DIN modul):
Hotový modul relé + patice + LED. 24VDC cívka.
  PLC-RSP-24DC/21 = 2CO, 24VDC, 8A, DIN
  PLC-RSP-24DC/21-21 = 2CO+2CO zapojeno

### Weidmüller RCIA (reléové moduly DIN):
  RCIA 024VDC 2CO 8A = 24VDC, 2 přepínací kontakty, 8A

---
### SSR (Solid State Relay):
Carlo Gavazzi, CRYDOM/Sensata.
  RA2025-D06 = vstup 3–32VDC, výstup 48–480VAC, 25A
  D2450D = 1-fáze SSR, DC vstup, 50A, 480VAC

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
G2R-2-SN DC24, MY2N DC24, RM85-2011-35-1024, RT424F24, PLC-RSP-24DC/21
Pro různá napětí cívky a počty kontaktů.

**SEKUNDÁRNÍ — obecné fallbacky:**
relé 24VDC 2CO, relay 24VDC DPDT, Relais 24V DC 2 Wechsler, patice, sokl`,
  },

  // -------------------------------------------------------------------------
  // 10. DIN lišta
  // -------------------------------------------------------------------------
  {
    key: 'din_lista',
    label: 'DIN lišta',
    aliases: ['din lišta', 'din lista', 'din rail', 'hutschiene', 'tragschiene', 'ts35', 'ns35', 'omega lišta', 'omega lista', 'montážní lišta', 'montazni lista'],
    questions: [
      { key: 'profil',  text: 'Profil DIN lišty?',                                   options: ['TS 35  (omega, standard, nejčastější)', 'TS 35  plochá (bez výstupků)', 'TS 15  (užší, 15mm)', 'G-profil  (GS 35, plochý rail)', 'Nevím'] },
      { key: 'material',text: 'Materiál?',                                            options: ['Ocel (zinkovaná, standardní)', 'Nerez (pro agresivní prostředí)', 'Hliník (pro lehké aplikace)'] },
      { key: 'delka',   text: 'Délka?',                                               options: ['1 metr', '2 metry', 'Jiná délka (napišeš)'] },
    ],
    mfrKeys: [],
    knowledge: `## DIN lišty — přehled a typová označení

### Profily (EN 60715):
- **TS 35 / NS 35** (omega, TH35, TOP hat): 35mm. Hloubka 7.5mm (standard) nebo 15mm (deep). Nejpoužívanější 98% DIN komponent.
- **TS 35 plochá (shallow)**: 35×7.5mm, mělká, pro tenké panely.
- **TS 15 / NS 15**: 15mm omega, pro malé přístroje.
- **G-profil (GS 35, C-rail)**: Otevřená C-forma, 35mm, pro svorky.

### Materiály:
- **Zinkovaná ocel**: Standard, nejčastější. Označení: St (Stahl), verzinkt.
- **Nerez A2 (AISI 304)**: Vlhko, korozivní prostředí. Označení: VA, AISI 304, Edelstahl.
- **Hliník (Al)**: Lehká varianta. Označení: Al.

### Výrobci a katalogová čísla:
**Phoenix Contact:**
  NS 35/7,5 PERF 1000MM = TS35 děrovaná, 1m, ocel
  NS 35/7,5 UNPERF 1000MM = TS35 neperforovaná, 1m
  NS 35/15 PERF 1000MM = TS35 deep (15mm hloubka), 1m

**WAGO:**
  210-112 = NS35 1m ocel zinkovaná (Omega DIN rail)
  210-113 = NS35 2m ocel
  210-197 = NS35 1m nerez

**Weidmüller:**
  TSLD35 = TS35 1m, ocel
  TSLDA35 = TS35 1m, hliník

**Generické / DB označení:**
  NS 35 1m, TS35 1000mm, Hutschiene 35mm, DIN lišta 35mm 1m

### Vyhledávací strategie:
**PRIMÁRNÍ:**
NS 35/7,5, Hutschiene NS35 1000, TS35 1m, 210-112, DIN lišta 35 1m

**SEKUNDÁRNÍ:**
DIN rail 35mm, Tragschiene NS35, omega lišta, montážní lišta 35mm`,
  },

  // -------------------------------------------------------------------------
  // 11. Rittal (rozváděčové skříně a díly)
  // -------------------------------------------------------------------------
  {
    key: 'rittal',
    label: 'Rittal',
    aliases: ['rittal', 'vx25', 'ts8', 'ax skříň', 'ax skrin', 'kx skříň', 'rozváděčová skříň', 'rozvadecova skrin', 'rozváděč', 'rozvadec', 'skříň rittal', 'skrin rittal', 'kabinet', 'cabinet'],
    questions: [
      { key: 'subtype', text: 'Co hledáš od Rittalu?',                                options: ['Celá skříň / rozváděč (nástěnná nebo stojatá)', 'Montážní deska', 'Dveře / dveřní panel', 'Sokl / plinth', 'Bočnice', 'Kabelová vývodnice / přepážka', 'Jiné příslušenství'] },
      { key: 'rada',    text: 'Řada Rittal?',                                         options: ['AX  (kompaktní nástěnná)', 'VX25  (velká stojatá, moderní)', 'TS 8  (velká stojatá, klasická)', 'KX  (malá svorkovnicová)', 'Nevím'] },
      { key: 'rozmery', text: 'Přibližné rozměry (šířka × výška × hloubka) nebo katalogové číslo?' },
    ],
    mfrKeys: ['rittal'],
    knowledge: `## Rittal — přehled produktů a katalogových čísel

### Řady skříní:
**KX (malé, IP66, nástěnné):** Pro venkovní montáž přístrojů, svorkovnicové skříňky.
  KX 1558.000 = 200×200×120mm (š×v×h), ocel
  KX 1552.000 = 150×150×80mm
  KX 1554.000 = 200×150×80mm
  KX 1562.000 = 300×200×120mm

**AX (kompaktní nástěnné, IP66):** Průmyslové rozváděče. Ocel nebo nerez. 25mm rastr.
  AX 1042.600 = 400×300×210mm (š×v×h)
  AX 1045.600 = 500×400×250mm
  AX 1049.600 = 600×500×250mm
  AX 1055.600 = 800×600×300mm
  AX 1060.600 = 1000×760×300mm
  AX nerez: AX 1042.650 = 400×300×210mm, nerez

**TS 8 (velká stojatá, IP66):** Tradiční řada, 16trubkový rám.
  TS 8646.000 = 600×2000×400mm (š×v×h)
  TS 8648.000 = 600×2000×600mm
  TS 8805.500 = 800×2000×500mm

**VX25 (velká stojatá, IP66):** Nástupce TS8. Symetrie, 25mm rastr.
  VX 8106.000 = 600×2000×400mm
  VX 8108.000 = 600×2000×600mm
  VX 8206.000 = 800×2000×600mm

### Příslušenství:
**Montážní desky:**
  AE 2680.600 = montážní deska pro AX 1042 (340×260mm)
  TS 8808.000 = montážní deska pro TS8 800×600mm

**Sokly (plinth):**
  TS 8840.000 = sokl pro TS8 600mm šíře, výška 100mm
  VX 8640.000 = sokl pro VX25

**Větrání:**
  SK 3237.010 = filtrační ventilátor 115m³/h, 230V
  SK 3305.000 = filtrační rohož 292×241mm

### Vyhledávací strategie:
**PRIMÁRNÍ — specifická katalogová čísla:**
AX 1042.600, AX 1049.600, KX 1558.000, TS 8646.000, VX 8106.000

**SEKUNDÁRNÍ:**
Rittal AX [rozměry], Rittal skříň [š×v×h], Schaltschrank [rozměry], rozváděčová skříň Rittal`,
  },

  // -------------------------------------------------------------------------
  // 12. Hlavní vypínač
  // -------------------------------------------------------------------------
  {
    key: 'hlavni_vypinac',
    label: 'Hlavní vypínač',
    aliases: ['hlavní vypínač', 'hlavni vypinac', 'odpínač', 'odpinak', 'vačkový spínač', 'vackovy spinac', 'main switch', 'hauptschalter', 'motorový odpínač', 'motorovy odpinak', 'lasttrennschalter'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['ABB (OT / OTDC)', 'Siemens (3LD)', 'Schneider (Vari-Fit / VCF)', 'Eaton', 'Bez preference'] },
      { key: 'proud',   text: 'Jmenovitý proud v ampérech? (napiš číslo, např. 32 nebo 63)' },
      { key: 'poly',    text: 'Počet pólů?',                                          options: ['3P', '4P', '3P+N', 'Jiné'] },
      { key: 'montaz',  text: 'Způsob montáže / provedení?',                          options: ['DIN lišta', 'Přímá montáž (příruba)', 'Rukojeť (plná dvířka)', 'Nevím'] },
    ],
    mfrKeys: ['abb', 'siemens', 'schneider', 'eaton'],
    knowledge: `## Hlavní vypínače — přehled a typová označení

Odpínač (Lasttrennschalter) — viditelně přerušuje obvod pro bezpečnou práci.

---
### ABB — OT série:
Formát: OT[A][P]  kde A=proud, P=póly (3=3P, 4=4P). F=přírubový vývod.
  OT16F3 = 16A, 3P, přírubový
  OT25F3 = 25A, 3P
  OT32F3 = 32A, 3P
  OT40F3 = 40A, 3P
  OT63F3 = 63A, 3P
  OT80F3 = 80A, 3P
  OT100F3 = 100A, 3P
  OT125F3 = 125A, 3P
  OT160F3 = 160A, 3P
  OT32F4 = 32A, 4P
  OT63F4 = 63A, 4P

DIN montáž: OT16D3, OT32D3.
OTDC (DC disconnect): OT16DC3, OT32DC3 (pro FVE).

---
### Siemens — 3LD:
  3LD2004-0TK51 = 3P, 25A (příruba na dveře)
  3LD2114-0TK51 = 3P, 32A
  3LD2204-0TK51 = 3P, 40A
  3LD2404-0TK51 = 3P, 63A
  3LD2604-0TK51 = 3P, 80A
  3LD2804-0TK51 = 3P, 100A

---
### Schneider — VCF (Vari-Fit):
  VCF0 = 16A, VCF1 = 25A, VCF2 = 32A, VCF3 = 40A, VCF4 = 63A, VCF5 = 80A, VCF6 = 100A
  VCF2GE40 = 32A, 3P, pro panel 40×40mm výřez.

### Eaton P-série (vačkové):
  P1-25/E (25A), P3-63/E (63A), P1-32/E (32A)

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
OT32F3, OT63F3, OT40F3, 3LD2114-0TK51, VCF2GE40

**SEKUNDÁRNÍ:**
odpínač [proud]A 3P, Hauptschalter [proud]A 3P, Lasttrennschalter [proud]A, hlavní vypínač [proud]A`,
  },

  // -------------------------------------------------------------------------
  // 13. Tlačítka a signalizace
  // -------------------------------------------------------------------------
  {
    key: 'tlacitko',
    label: 'Tlačítko',
    aliases: ['tlačítko', 'tlacitko', 'ovládací prvek', 'ovladaci prvek', 'push button', 'drucktaster', 'taster', 'pilot', 'signálka', 'signalka', 'meldeleuchte', 'kontrolka', 'selektor', 'přepínač', 'prepinac', 'nouzové zastavení', 'nouzove zastaveni', 'e-stop', 'emergency stop', 'otočný', 'xb4', 'xb5', 'm22', '22mm', '3sb'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['Schneider (XB4 / XB5)', 'Siemens (3SB / 3SA)', 'ABB (CP / MP / PB)', 'Eaton (M22)', 'Bez preference'] },
      { key: 'subtype', text: 'Co konkrétně hledáš?',                                 options: ['Tlačítko (momentové)', 'Tlačítko aretační (s aretací, odpojení otočením)', 'Signálka / kontrolka (LED)', 'Otočný přepínač / selektor', 'Nouzové zastavení (E-stop, hříbek)', 'Jiné'] },
      { key: 'prumer',  text: 'Průměr / standard?',                                   options: ['22 mm  (EN / IEC standard, nejčastější)', '30 mm  (starší nebo speciální)'] },
      { key: 'barva',   text: 'Barva tlačítka nebo signálky?',                        options: ['Zelená', 'Červená', 'Žlutá', 'Modrá', 'Bílá / černá', 'Není důležité'] },
      { key: 'kontakt', text: 'Elektrický kontakt tlačítka?',                         options: ['1×NO  (spínací)', '1×NC  (rozpínací)', '1×NO + 1×NC', 'Není důležité / bez kontaktu (jen signálka)'] },
    ],
    mfrKeys: ['schneider', 'siemens', 'eaton'],
    knowledge: `## Tlačítka a ovládací prvky — přehled a typová označení

---
### Schneider XB4 / XB5 (Ø22mm):
**XB4 (kovové plastové těleso, Ø22mm):**
Celé tlačítko (hlava + kontakt) nebo moduly (hlava ZB4 + kontakt ZBE).
Formát XB4B: XB4B[barva_kód][kontakt_kód]
Barva kódy: A=zelená, A4=červená, A5=žlutá, A6=modrá, A2=bílá, A1=černá
Kontakt kódy: 21=1NO, 22=1NC, 31=1NO+1NC

Konkrétní příklady:
  XB4BA21 = zelené momentové, 1NO
  XB4BA22 = zelené momentové, 1NC
  XB4BA31 = zelené momentové, 1NO+1NC
  XB4BA42 = červené momentové, 1NC
  XB4BA51 = žluté momentové, 1NO
  XB4BD21 = zelené s aretací (otočné odblokování), 1NO
  XB4BD33 = zelené s aretací, 2NC
  XB4BG61 = otočný selektor 2-poloh, 1NO
  XB4BK123B5 = klíčový spínač

**Nouzové zastavení XB4:**
  XB4BS542 = E-stop hříbek Ø40mm, 1NC, otočné odblokování
  XB4BS9445 = E-stop, klíčové odblokování
  XB4BT845 = E-stop hříbek

**XB5 (plastové, ekonomické):**
  XB5AA21 = zelené, 1NO
  XB5AA42 = červené, 1NC

**Přidávací kontaktní bloky ZBE:**
  ZBE101 = 1NO přídavný kontakt
  ZBE102 = 2NO
  ZBE104 = 1NO+1NC

**Signálky XB4BV (LED, 24V):**
  XB4BVB3 = zelená LED 24V
  XB4BVB4 = červená LED 24V

---
### Siemens 3SB3 (Ø22mm, modulární):
Skládá se z: těleso + hlava + kontaktní blok.
  3SB3001-0AA11 = těleso s zelenou hlavou, 1NO
  3SB3001-0AA21 = těleso s červenou hlavou, 1NO
  3SB3000-0AA11 = základní těleso + blok 1NO
  3SB3201-0AA11 = aretační těleso zelené, 1NO
  3SB3400-1B = signálka červená LED 24V AC/DC
  3SB3400-1A = signálka zelená LED
  3SB3500-1HA20 = E-stop hříbek 40mm, 2NC

Kontaktní bloky 3SB: 3SB3400-0A (1NO), 3SB3400-0B (1NC)

---
### Eaton M22 (Ø22mm, modulární):
  M22-D-G = zelená tlačítková hlava
  M22-D-R = červená tlačítková hlava
  M22-D-Y = žlutá hlava
  M22-K10 = kontaktní blok 1NO
  M22-K01 = kontaktní blok 1NC
  M22-K11 = kontaktní blok 1NO+1NC
  M22-PV-G = zelená LED signálka 24V
  M22-PV-R = červená LED signálka

---
### ABB CP série (Ø22mm):
  CP1-10G-10 = Ø22mm zelené, 1NO
  CP1-10R-10 = červené, 1NO
  CP1-10R-01 = červené, 1NC

---
### Nouzové zastavení (E-stop):
Standard EN 13850: červený hříbek Ø40mm na žlutém podkladu. Kontakt: 1NC nebo 2NC (bezpečnostní).
  Schneider XB4BS542 (otočné), XB5AS542, XB4BS9445 (klíčové)
  Siemens 3SB3500-1HA20 (hříbek 40mm, 2NC)
  Eaton M22-PV-T (stop varianta)

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
XB4BA21, XB4BA42, XB4BS542, 3SB3001-0AA11, M22-D-G + M22-K10, XB4BVB3

**SEKUNDÁRNÍ:**
tlačítko 22mm zelené 1NO, Drucktaster grün 22mm, push button green 22mm NC, signálka LED 24V`,
  },

  // -------------------------------------------------------------------------
  // 14. Průchodka
  // -------------------------------------------------------------------------
  {
    key: 'pruchovka',
    label: 'Průchodka',
    aliases: ['průchodka', 'pruchovka', 'průchodky', 'kabelová průchodka', 'kabelova pruchovka', 'kabelová vývodka', 'verschraubung', 'kabelverschraubung', 'pg průchodka', 'pg16', 'm20', 'm16', 'm25', 'kabelová šroubení'],
    questions: [
      { key: 'material',text: 'Materiál průchodky?',                                  options: ['Plast PA (polyamid, černý, standard)', 'Mosaz MS (kovová, odolná)', 'Nerez (pro korozivní prostředí)', 'Nevím'] },
      { key: 'zavit',   text: 'Metrický závit nebo jiný?',                            options: ['M16', 'M20  (nejčastější)', 'M25', 'M32', 'M40', 'M50', 'M63', 'PG (starší standard)', 'Nevím'] },
      { key: 'ip',      text: 'Požadované krytí IP?',                                options: ['IP54  (standardní)', 'IP68  (ponor, vodotěsná)', 'IP66  (silný vodní proud)', 'Nevím'] },
      { key: 'prumer',  text: 'Průměr kabelu nebo průřez? (volitelně, napiš např. 10mm nebo Ø10–18mm)' },
    ],
    mfrKeys: [],
    knowledge: `## Průchodky kabelové — přehled a typová označení

Kabelová průchodka (Kabelverschraubung) = šroubení pro zavedení kabelu do rozváděče s těsněním.

### Závitové standardy:
- **Metrický M (ISO)**: M16, M20, M25, M32, M40, M50, M63. Moderní preferovaný standard.
- **PG (Panzergewinde)**: Pg7, Pg9, Pg11, Pg13.5, Pg16, Pg21, Pg29, Pg36. Starší, stále v provozu.

### Materiály:
- **PA (polyamid)**: Standard, černý, cenový. IP54 nebo IP68.
- **Mosaz (Ms, CuZn, brass)**: Pro EMC stínění, vyšší mechanická odolnost. IP68.
- **Nerez A2/A4 (AISI 304/316)**: Korozivní prostředí. IP68.

### Výrobci a katalogová čísla:
**Jacob (Jaeger) — nejpoužívanější v CZ:**
  M20×1.5 PA IP68 = standardní, kabel 6–13mm
  M20×1.5 brass IP68 = mosazná
  M25×1.5 PA IP68 = M25 plast

**Pflitsch:**
  UNO-PLUS M20 PA IP68 = průchodka M20 plast
  UNO-PLUS M25 PA = M25

**Hummel:**
  1.209.1200.50 = M20, PA, kabel 10–14mm, IP68
  1.209.2000.50 = M25, PA

**Icotek:**
  KVT-MET M20 = M20 kovová (mosaz/zinek)

**Wiska:**
  SPRINT M20 = M20 PA IP68

**V databázi typicky označeno:**
průchodka M20, průchodka M20 PA, Kabelverschraubung M20, KV M20 PA, průchodka M20 černá IP68

### Redukce, zátky, příslušenství:
- **Redukce**: průchodka M25 s redukční vložkou pro menší kabel
- **Slepá zátka** (Verschlussstopfen): M20 PA slepá zátka — pro neobsazené otvory
- **Ochranné hadice**: PVC nebo ocelové spirálové chráničky kabelu

### Vyhledávací strategie:
**PRIMÁRNÍ:**
průchodka M20 PA, průchodka M20 mosaz IP68, Kabelverschraubung M20 PA IP68, KV M20
Pro M25: průchodka M25 PA, Kabelverschraubung M25

**SEKUNDÁRNÍ:**
kabelová průchodka M20, cable gland M20 PA, Verschraubung M20 schwarz IP68`,
  },

  // -------------------------------------------------------------------------
  // 15. Záslepka
  // -------------------------------------------------------------------------
  {
    key: 'zaslepka',
    label: 'Záslepka',
    aliases: ['záslepka', 'zaslepka', 'záslepky', 'slepá zátka', 'slepa zatka', 'blinding plug', 'closing plug', 'blindstopfen', 'verschlussstopfen', 'stopfen', 'blind plug', 'm20 záslepka', 'vývodová záslepka'],
    questions: [
      { key: 'material',text: 'Materiál záslepky?',                                   options: ['Plast PA (polyamid, černý, standard)', 'Mosaz MS (kovová)', 'Nerez', 'Nevím'] },
      { key: 'zavit',   text: 'Závit (metrický)?',                                    options: ['M16', 'M20  (nejčastější)', 'M25', 'M32', 'M40', 'M50', 'M63', 'PG', 'Jiný'] },
    ],
    mfrKeys: [],
    knowledge: `## Záslepky (slepé zátky) — přehled a typová označení

Záslepka = plastová nebo kovová zátka pro neobsazený otvor v rozváděči (kde není průchodka).

### Typy:
- **Metrická závitová** (šroubovací): M16, M20, M25, M32, M40. Nejčastěji PA černý.
- **PG závitová**: Pg9, Pg11, Pg13.5, Pg16, Pg21, Pg29.
- **Plochá snap-in** (cvaknutím): Pro kulaté vývrty bez závitu. Ø16, Ø20, Ø22, Ø25, Ø32mm.
- **DIN záslepka** (modulová): 1 modularní jednotka DIN (17.5mm), pro volné pozice v řadě.

### V databázi typicky označeno:
záslepka M20 PA, záslepka M20 černá, Blindstopfen M20, Verschlussstopfen M20 PA
záslepka M20 mosaz, slepá zátka M25, blind plug M20

### Výrobci: Pflitsch, Icotek, Wiska, Jacob, Fischer, různí generičtí.

### Konkrétní příklady v DB:
  záslepka M20 PA = M20 plastová černá
  záslepka M25 PA = M25 plastová
  Blindstopfen M20 PA = německý název M20 plast
  Verschlussstopfen M20 = M20 uzavírací zátka
  slepá zátka PG16 = PG16 zátka

### Vyhledávací strategie:
**PRIMÁRNÍ:**
záslepka M20 PA, záslepka M20 černá, Blindstopfen M20, Blindstopfen M20 PA, slepá zátka M20

**SEKUNDÁRNÍ:**
záslepka [závit], Verschlussstopfen M20, blind plug M20, closing plug M20 PA`,
  },

  // -------------------------------------------------------------------------
  // 16. Proudový chránič
  // -------------------------------------------------------------------------
  {
    key: 'chranic',
    label: 'Proudový chránič',
    aliases: ['proudový chránič', 'proudovy chranic', 'chránič', 'chranic', 'rcd', 'rccb', 'rcbo', 'fi ochrana', 'chránič proudový', 'fehlerstromschutzschalter', 'fi-schalter', 'diferential'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['ABB', 'Siemens', 'Schneider', 'Eaton', 'Bez preference'] },
      { key: 'subtype', text: 'Typ?',                                                 options: ['RCCB  (chránič bez nadproudové ochrany)', 'RCBO  (chránič + jistič v jednom)', 'Nevím'] },
      { key: 'proud',   text: 'Jmenovitý proud?',                                     options: ['16 A', '25 A', '40 A', '63 A', '100 A', 'Jiný'] },
      { key: 'typ_ac',  text: 'Typ citlivosti?',                                      options: ['Typ AC  (sinusový proudový poruch, základní)', 'Typ A  (sinusový + pulsující, pro elektronické zátěže)', 'Typ B  (univerzální vč. DC, pro FVE, VFD)', 'Nevím'] },
      { key: 'citlivost',text: 'Reziduální proud (citlivost)?',                       options: ['10 mA  (osobní ochrana, vlhké prostory)', '30 mA  (standardní osobní ochrana)', '100 mA  (selektivní / zónový)', '300 mA  (požární ochrana)', 'Nevím'] },
    ],
    mfrKeys: ['abb', 'siemens', 'schneider'],
    knowledge: `## Proudové chrániče — přehled a typová označení

**RCCB** (Residual Current Circuit Breaker): Jen chránič bez nadproudové ochrany.
**RCBO** (Combined RCCB+MCB): Chránič + jistič v jednom modulu.

### Typy citlivosti:
- **Typ AC** (~): Jen sinusové zemní proudy. Základní (nejlevnější).
- **Typ A** (A): Sinusové + pulsující DC. Nutný pro elektroniku, LED, VFD, FVE.
- **Typ B**: Hladký DC i AC. Pro FVE, nabíječe EV, frekvenční měniče s DC výstupem.

---
### ABB — F200 / FH200 série:
Formát: F[typ_pólů][proud]/[citlivost] nebo F[P][A][typ]
  F202A-25/0.03 = RCCB, 2P, 25A, 30mA, Typ A
  F202A-40/0.03 = RCCB, 2P, 40A, 30mA, Typ A
  F202A-63/0.03 = RCCB, 2P, 63A, 30mA, Typ A
  F204A-25/0.03 = RCCB, 4P, 25A, 30mA, Typ A
  F204A-40/0.03 = RCCB, 4P, 40A, 30mA, Typ A
  F204A-63/0.03 = RCCB, 4P, 63A, 30mA, Typ A
  F202AC-40/0.03 = RCCB, 2P, 40A, 30mA, Typ AC
  F204A-40/0.3 = RCCB, 4P, 40A, 300mA, Typ A (selektivní)

---
### Siemens — 5SM séia:
  5SM2012-6 = RCCB, 2P, 25A, 30mA, Typ AC
  5SM2022-6 = RCCB, 2P, 40A, 30mA, Typ AC
  5SM2032-6 = RCCB, 2P, 63A, 30mA, Typ AC
  5SM3412-6 = RCCB, 4P, 25A, 30mA, Typ AC
  5SM3422-6 = RCCB, 4P, 40A, 30mA, Typ AC
  5SM3432-6 = RCCB, 4P, 63A, 30mA, Typ AC

---
### Schneider Acti9:
Katalogový formát: A9[typ][P][A][citlivost]
  A9R14225 = iID RCCB, 2P, 25A, 30mA, Typ A
  A9R14240 = iID RCCB, 2P, 40A, 30mA, Typ A
  A9R14263 = iID RCCB, 2P, 63A, 30mA, Typ A
  A9R44425 = iID RCCB, 4P, 25A, 30mA, Typ A
  A9R44440 = iID RCCB, 4P, 40A, 30mA, Typ A
  A9R11240 = iID RCCB, 2P, 40A, 30mA, Typ AC

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
F202A-40/0.03, F204A-40/0.03, 5SM3422-6, A9R14240
Pro různé pooly, proudy (25/40/63A), citlivosti (30mA/300mA), typy (AC/A/B).

**SEKUNDÁRNÍ:**
proudový chránič [proud]A [citlivost]mA Typ A [póly]P, RCCB [proud]A 30mA, FI-Schutzschalter [proud]A 30mA`,
  },

  // -------------------------------------------------------------------------
  // 17. Přepěťová ochrana
  // -------------------------------------------------------------------------
  {
    key: 'prepetova_ochrana',
    label: 'Přepěťová ochrana',
    aliases: ['přepěťová ochrana', 'prepetova ochrana', 'spd', 'surge protection', 'bleskojistka', 'überspannungsschutz', 'ableiter', 'varistor', 'ovr', 'ots'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['ABB (OVR)', 'Siemens (5SD)', 'Phoenix Contact (Trabtech)', 'Schneider (PRD)', 'Bez preference'] },
      { key: 'trida',   text: 'Třída / typ ochrany?',                                 options: ['T1 (typ 1) — přímý blesk, venkovní přívod', 'T2 (typ 2) — distribuce, za T1', 'T1+T2 kombinovaný', 'T3 — jemná ochrana přístrojů', 'Nevím'] },
      { key: 'napeti',  text: 'Jmenovité napětí sítě?',                               options: ['230/400 V AC  (EU standard)', 'DC systém', 'Jiné'] },
      { key: 'faze',    text: 'Počet fází?',                                          options: ['1P  (1-fázová)', '1P+N', '3P+N  (3-fázová s neutrálem)', 'Jiné'] },
    ],
    mfrKeys: ['abb', 'siemens', 'phoenix'],
    knowledge: `## Přepěťová ochrana (SPD) — přehled a typová označení

### Třídy:
- **T1 (Typ 1)**: Na vstupu budovy (za HDS). Přímý blesk. Impuls 10/350µs. Iimp≥12.5kA.
- **T2 (Typ 2)**: V rozváděčích, za T1. Impuls 8/20µs. In≥5kA, Imax≥20–40kA.
- **T1+T2 kombinovaný**: Vše v jednom.
- **T3 (Typ 3)**: U citlivých přístrojů (PLC, PC). Blízko spotřebiče.

---
### ABB — OVR série:
  OVR T2 1N 40-275 P TS = T2, 1-fáze+N, 40kA, 275Vac, plug-in, thermal odpojení
  OVR T2 1N 40-275 P = T2, 1-fáze+N, 40kA, 275Vac (bez TS)
  OVR T2 3N 40-275 P TS = T2, 3-fáze+N, 40kA, 275Vac, plug-in
  OVR T1 B 50-255 P TS = T1, 3P+N, 50kA
  OVR T2 40-275 P = compact 3P T2

---
### Siemens — 5SD série:
  5SD7414-1 = T2, 4P (3+N), 40kA, 275V
  5SD7282-1 = T2, 2P (1+N), 40kA
  5SD7434-1 = T2, 4P, 25kA

---
### Phoenix Contact Trabtech:
  VAL-MS 230/3+1 = T2, 3-fáze+N, 230V
  PT-IQ-2+1-BE-230AC = T2, 2+1 pólový plug-in, 230VAC
  FLT-SEC-T1-3S-350/25-FM = T1+T2, 3-fáze, 350V

---
### Schneider:
  A9L40204 = PRD T2, 2P (1+N), 40kA, Acti9
  A9L40401 = PRD T2, 4P (3+N), 40kA

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
OVR T2 1N 40-275 P TS, OVR T2 3N 40-275 P TS, 5SD7414-1, A9L40204

**SEKUNDÁRNÍ:**
přepěťová ochrana T2 [kA]kA [póly]P+N, SPD T2 40kA 400V, Überspannungsschutz T2 40kA, bleskojistka T2`,
  },
];

// ---------------------------------------------------------------------------
// detectCategory — detects component category from user text
// ---------------------------------------------------------------------------
export function detectCategory(text) {
  const n = normalize(text);
  let best = null;
  let bestScore = 0;
  for (const cat of COMPONENT_CATEGORIES) {
    for (const alias of cat.aliases) {
      if (n.includes(normalize(alias))) {
        const score = alias.length; // prefer longer matches
        if (score > bestScore) {
          best = cat;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// getCategoryByKey
// ---------------------------------------------------------------------------
export function getCategoryByKey(key) {
  return COMPONENT_CATEGORIES.find(c => c.key === key) ?? null;
}

// ---------------------------------------------------------------------------
// listCategoryLabels — for welcome screen
// ---------------------------------------------------------------------------
export function listCategoryLabels() {
  return COMPONENT_CATEGORIES.map(c => c.label);
}
