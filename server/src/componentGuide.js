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
  // 0a. Příslušenství jističů
  // -------------------------------------------------------------------------
  {
    key: 'prislusenstvi_jistic',
    label: 'Příslušenství jističů',
    aliases: [
      'pomocný kontakt jistič', 'pomocny kontakt jistic', 'signalizační kontakt jistič', 'signalizacni kontakt jistic',
      'alarm kontakt jistič', 'hilfsschalter jistič', 'auxiliary contact breaker',
      'dálkové vypnutí', 'dalkove vypnuti', 'shunt trip', 'vypínací cívka jistič', 'vypinaci civka jistic',
      'podpěťová spoušť', 'podpetova spous', 'undervoltage release', 'undervoltage trip',
      'motorový pohon jistič', 'motorovy pohon jistic', 'motorový ovladač', 'motor operator',
      'rozšiřovací modul jistič', 'rozsirujici modul jistic', 'S2C', 'add-on jistič',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce jističe?',               options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'acc_type', text: 'Jaký typ příslušenství?',        options: ['Pomocný / signalizační kontakt', 'Dálkové vypnutí (shunt trip)', 'Podpěťová spoušť (undervoltage release)', 'Motorový pohon / ovladač', 'Jiné'] },
      { key: 'breaker',  text: 'Typ nebo řada jističe? (napiš, např. S200, S200M, 5SY6, FAZ, iC60N)' },
    ],
    mfrKeys: ['abb', 'siemens', 'eaton', 'schneider'],
    knowledge: `## Příslušenství jističů — přehled

Jističe MCB/MPCB lze doplnit o: pomocné/signalizační kontakty, dálkové vypnutí (shunt trip), podpěťovou spoušť, motorový pohon. Vždy záleží na řadě a rámu jističe.

---
### ABB — příslušenství S200 / S200M / S200P:
**Pomocné kontakty (Auxiliary/Alarm):**
  S2C-H6R     = 1NO + 1NC, pravý (standardní)
  S2C-H6L     = 1NO + 1NC, levý
  S2C-H2R     = 2× pomocný (2NO nebo 2NC), pravý
  S2C-A1      = 1× pomocný NO nebo NC (volitelný)
**Signalizační (alarmový) kontakt:**
  S2C-AL2R    = alarmový (trip signal) kontakt, pravý
  S2C-AL2L    = alarmový kontakt, levý
**Dálkové vypnutí (shunt trip):**
  S2C-ST06T   = shunt trip 6 V AC/DC
  S2C-ST24T   = shunt trip 24 V AC/DC
  S2C-ST110T  = shunt trip 110 V AC/DC
  S2C-ST230T  = shunt trip 230 V AC/DC
**Podpěťová spoušť:**
  S2C-UAB12   = undervoltage release 12 V AC/DC
  S2C-UAB24   = undervoltage release 24 V AC/DC
  S2C-UA230T  = undervoltage release 230 V AC/DC
**Motorový pohon:**
  S2C-MT      = motorový ovladač (remote on/off) pro S200
  M2C-MT6     = motorový pohon 6A (pro větší rámy)

---
### Siemens — příslušenství 5SY / 5SL:
Pomocné a alarmové kontakty se připevňují zboku na DIN jistič.
**Pomocné kontakty (5ST3 série):**
  5ST3010     = 1NO + 1NC pomocný kontakt
  5ST3020     = 2× pomocný
  5ST3030     = 1× alarmový (trip indicator)
**Dálkové vypnutí (MX / remote trip):**
  5ST3040     = dálkový (shunt trip) 24 V DC
  5ST3041     = dálkový vypínač 230 V AC
**Podpěťová spoušť:**
  5ST3050     = undervoltage release 230 V AC
  5ST3051     = undervoltage release 24 V DC
**Motorový pohon:**
  5ST3060     = motorový pohon pro 5SY (24–48 V DC/AC)
  5ST3070     = motorový pohon 230 V AC

---
### Eaton — příslušenství FAZ / PL6:
**Pomocné kontakty (PKZ-M/FAZ serie):**
  PKZ M-I1    = 1× pomocný kontakt (NO nebo NC) pro PKZM0/FAZ
  PKZ M-I11   = 1NO + 1NC
  PKZ-MFAZ    = montážní adapter
**Dálkové vypnutí:**
  FAZ-NA-ST   = shunt trip pro FAZ-NA
  PKZ M-ST    = shunt trip pro PKZM0
**Podpěťová spoušť:**
  PKZ M-UVT   = undervoltage trip pro PKZM0
  FAZ-NA-UA   = undervoltage pro FAZ

---
### Schneider Electric — příslušenství iC60 / C60N:
**Pomocné kontakty:**
  A9A26924    = OF (auxiliary contact) 1NO+1NC pro iC60N
  A9A26926    = OF 2NO
  A9A26927    = SD (signal alarm/trip) contact
**Dálkové vypnutí:**
  A9A26476    = MX (shunt trip) 12 V DC pro iC60N
  A9A26477    = MX 24 V DC
  A9A26479    = MX 230 V AC
**Podpěťová spoušť:**
  A9A26485    = MN (undervoltage release) 24 V DC
  A9A26488    = MN 230 V AC
**Motorový pohon:**
  A9A26524    = motorový pohon 24 V DC pro iC60N
`,
  },

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
  // 2a. Příslušenství stykačů
  // -------------------------------------------------------------------------
  {
    key: 'prislusenstvi_stykac',
    label: 'Příslušenství stykačů',
    aliases: [
      'pomocný kontakt', 'pomocne kontakty', 'pomocny kontakt', 'hilfsschalter', 'auxiliary contact',
      'přídavný kontakt', 'pridavny kontakt', 'blok kontaktů', 'blok kontaktu', 'kontaktní blok',
      'rc člen', 'rc clen', 'rc článek', 'rc clanek', 'rc prvek',
      'tlumič cívky', 'tlumíc civky', 'přepěťový člen stykač', 'prepetovy clen stykac',
      'mechanické blokování stykač', 'mechanicke blokovani stykac', 'vzájemné blokování',
      'pneumatický časový člen', 'pneumaticky casovy clen', 'časový člen stykač',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce stykače?',                           options: ['ABB', 'Siemens', 'Schneider Electric', 'Eaton (Moeller)', 'Bez preference'] },
      { key: 'acc_type', text: 'Jaký typ příslušenství?',                    options: ['Pomocný kontakt', 'Varistor / RC člen (potlačení napětí cívky)', 'Mechanické blokování', 'Pneumatický / časový člen', 'Jiné'] },
      { key: 'contactor',text: 'Řada nebo typ stykače? (napiš, např. A9, A16, LC1D09, 3RT2016, DILM7)' },
    ],
    mfrKeys: ['abb', 'siemens', 'schneider', 'eaton'],
    knowledge: `## Příslušenství stykačů — přehled

Příslušenství stykačů: pomocné kontakty (blokové kontakty), varistory/RC členy (potlačení přepětí cívky), mechanická blokování, časové členy.

---
### ABB — příslušenství stykačů řady A / AF:
**Pomocné kontakty (blokové):**
  CA4-01 = 1NC (pro A9–A75)
  CA4-10 = 1NO (pro A9–A75)
  CA4-11 = 1NO + 1NC (pro A9–A75)
  CA4-22 = 2NO + 2NC
  CA4-31 = 3NO + 1NC
  CA4-40 = 4NO
  CA4-04 = 4NC
Pro větší stykače (AF): CAF4-01, CAF4-10, CAF4-11
**Varistory / RC členy:**
  RC4-7    = RC člen, A9–A16 (230 V AC)
  VA4-3    = varistor, A9–A16 (24–48 V DC)
  VA4-6    = varistor, A26–A45
  RC4-6    = RC člen A26–A45
**Mechanické blokování:**
  ADP4-2   = mechanické blokování pro 2× stykač A9–A75
  ADPAF    = pro AF stykače

---
### Siemens — příslušenství 3RT2:
**Pomocné kontakty S00 (3RT2015–3RT2018):**
  3RH2911-1HA01 = 1NO + 1NC, bočně montovaný, S00
  3RH2911-1FA22 = 2NO + 2NC, S00
  3RH2911-2HA01 = 1NO + 1NC, čelně montovaný, S00
**Pomocné kontakty S0 a výše (3RT2025+):**
  3RH2921-1AA01 = 1NO, S0–S12
  3RH2921-1AA10 = 1NC, S0–S12
  3RH2921-1HA01 = 1NO + 1NC, S0–S12
**Varistory / RC členy:**
  3RT2916-1CC00 = varistor/RC, S00, 24–48 V DC
  3RT2916-1BB00 = RC člen, S00, 24–48 V AC/DC
  3RT2926-1BB00 = RC člen, S0–S3
  3RT2926-1CC00 = varistor, S0, 24–48 V DC
**Mechanické blokování:**
  3RA1924-2A  = blokování 2× 3RT S00
  3RA1924-1A  = blokování 2× 3RT S0

---
### Schneider Electric — příslušenství LC1D:
**Pomocné kontakty:**
  LADN11   = 1NO + 1NC (LC1D09–LC1D38)
  LADN20   = 2NO
  LADN02   = 2NC
  LADN31   = 3NO + 1NC
  LADN40   = 4NO
  LADN04   = 4NC
  LAD8N11  = 1NO + 1NC, čelní blok
Pro LC1D40–D65: LADL11, LADL20, LADL02
**Varistory / RC členy:**
  LAD7B106 = varistor 230 V AC pro LC1D09–D38
  LAD7B012 = RC člen 12 V DC
  LAD7B024 = RC člen 24 V DC
  LAD8N    = RC/varistor blok
**Mechanické blokování:**
  LAD9R    = blokování 2× LC1D09–D38

---
### Eaton (Moeller) — příslušenství DILM:
**Pomocné kontakty:**
  DILA-XHI11  = 1NO + 1NC (DILM7–DILM38)
  DILA-XHI20  = 2NO
  DILA-XHI02  = 2NC
  DILM170-XHI11 = 1NO + 1NC pro větší DILM
**Varistory / RC členy:**
  DILA-XHIV11 = 1NO + 1NC + varistor (DILM7–DILM38)
  DILM-XSPV   = varistor 24 V DC
  DILM-XSPA   = RC člen 230 V AC
**Mechanické blokování:**
  DILM32-XMK32 = blokování 2× DILM7–DILM32
`,
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
  // 2b. Nadproudová spouště (tepelná / elektronická ochrana motoru)
  // -------------------------------------------------------------------------
  {
    key: 'nadproudova_spoust',
    label: 'Nadproudová spouště',
    aliases: [
      'nadproudová spouště', 'nadproudova spoust', 'tepelná spouště', 'tepelna spoust',
      'nadproudové relé', 'nadproudove rele', 'motorová tepelná ochrana',
      'thermal overload', 'overload relay', 'überlastrelais', 'thermisches überlastrelais',
      '3RU2', 'TA25DU', 'TA42DU', 'TA75DU', 'LRD12', 'LRD16', 'LRD22', 'ZB12', 'ZB32',
    ],
    questions: [
      { key: 'mfr',   text: 'Výrobce?',                                                   options: ['Siemens (3RU2)', 'ABB (TA-DU)', 'Schneider Electric (LRD)', 'Eaton (ZB)', 'Bez preference'] },
      { key: 'proud', text: 'Jmenovitý proud motoru nebo nastavovací rozsah? (napiš číslo, např. 7.5 nebo 11)' },
      { key: 'frame', text: 'Velikost stykače (frame), pokud znáš?',                      options: ['S00  — do 16A  (3RT2015–18, A9–A16, LC1D09–D18, DILM7–17)', 'S0   — 17–40A (3RT2025–38, A26–A38, LC1D25–38, DILM25–38)', 'Větší (S2 a výše, nad 40A)', 'Nevím'] },
    ],
    mfrKeys: ['siemens', 'abb', 'schneider', 'eaton'],
    knowledge: `## Nadproudová spouště — tepelná/elektronická ochrana motoru

Nadproudová spouště se montuje na kontaktor nebo vedle něj. Klíčový parametr: rozsah nastavení proudu musí obsahovat jmenovitý proud motoru (In). Frame (S00/S0/S2) musí odpovídat kontaktoru.

---
### Siemens 3RU2 — tepelné spouště:
**3RU2116 — pro S00 (k 3RT2016–3RT2018, In do 16 A):**
  3RU2116-1AB0  = 1.1–1.6 A
  3RU2116-1BB0  = 1.4–2.0 A
  3RU2116-1CB0  = 1.8–2.5 A
  3RU2116-1DB0  = 2.2–3.2 A
  3RU2116-1EB0  = 2.8–4.0 A
  3RU2116-1GB0  = 4.5–6.3 A
  3RU2116-1HB0  = 5.5–8.0 A
  3RU2116-1JB0  = 7.0–10 A
  3RU2116-1KB0  = 9.0–12.5 A
  3RU2116-4AB0  = 11–16 A
**3RU2126 — pro S0 (k 3RT2025–3RT2038, In 17–40 A):**
  3RU2126-4CB0  = 17–22 A
  3RU2126-4DB0  = 22–32 A
  3RU2126-4EB0  = 28–40 A
**3RU2136 — pro S2 (k 3RT2045+, In 40–100 A):**
  3RU2136-4FB0  = 36–45 A
  3RU2136-4GB0  = 45–63 A
  3RU2136-4HB0  = 55–80 A

---
### ABB — TA-DU tepelné spouště:
**TA25DU — pro A9–A16 (S00), In do 19 A:**
  TA25DU-1.4  = 1.0–1.4 A
  TA25DU-2.4  = 1.7–2.4 A
  TA25DU-4.0  = 2.8–4.0 A
  TA25DU-6.5  = 4.5–6.5 A
  TA25DU-8.5  = 6.0–8.5 A
  TA25DU-11   = 7.5–11 A
  TA25DU-14   = 10–14 A
  TA25DU-19   = 13–19 A
**TA42DU — pro A26–A38 (S0), In do 28 A:**
  TA42DU-25   = 18–25 A
  TA42DU-28   = 20–28 A
**TA75DU — pro A40–A75, In do 80 A:**
  TA75DU-32   = 22–32 A
  TA75DU-52   = 36–52 A
  TA75DU-63   = 45–63 A
  TA75DU-80   = 55–80 A

---
### Schneider LRD — pro LC1D:
**Pro LC1D09–LC1D18 (S00, do 18 A):**
  LRD06  = 1.0–1.6 A
  LRD08  = 2.5–4.0 A
  LRD10  = 4.0–6.0 A
  LRD12  = 5.5–8.0 A
  LRD14  = 7.0–10 A
  LRD16  = 9.0–13 A
  LRD21  = 12–18 A
**Pro LC1D25–LC1D38 (S0, do 40 A):**
  LRD22  = 16–24 A
  LRD32  = 23–32 A
  LRD35  = 30–40 A

---
### Eaton ZB — pro DILM série:
**ZB12 — pro DILM7–DILM15 (S00, do 12 A):**
  ZB12-1.6  = 1.0–1.6 A
  ZB12-2.5  = 1.6–2.5 A
  ZB12-4    = 2.5–4.0 A
  ZB12-6    = 4.0–6.0 A
  ZB12-10   = 6.0–10 A
  ZB12-12   = 8.0–12 A
**ZB32 — pro DILM17–DILM32 (S0, do 40 A):**
  ZB32-20   = 14–20 A
  ZB32-25   = 18–25 A
  ZB32-40   = 25–40 A
`,
  },

  // -------------------------------------------------------------------------
  // 3a. Pojistkové spodky, základny a odpínače
  // -------------------------------------------------------------------------
  {
    key: 'pojistkovy_spodek',
    label: 'Pojistkový spodek / odpínač',
    aliases: [
      'pojistkový spodek', 'pojistkovy spodek', 'pojistkový základna', 'pojistkova zakladna',
      'nh spodek', 'nh základna', 'nh zakladna', 'nh odpínač', 'nh odpinak',
      'pojistkový odpínač', 'pojistkovy odpinak', 'lasttrennschalter', 'sicherungsunterteil',
      'válcová základna', 'valcova zakladna', 'válcový pojistkový spodek', 'cylindrical fuse holder',
      'pojistková základna', 'pojistkova zakladna',
      'spodek pojistky', 'základna pojistky', 'zakladna pojistky',
      'fuse holder', 'fuse base', 'fuse disconnect', 'sicherungshalter',
      'NH00', 'NH0 spodek', 'NH1 spodek', 'NH2 spodek', 'NH3 spodek',
      '3NP', 'OS63', 'OFAAH', 'INF', 'SNM',
    ],
    questions: [
      { key: 'type',   text: 'Jaký typ pojistky (pro tuto základnu)?',  options: ['NH nožová (silová, průmyslová)', 'Válcová 10×38 (do 32A)', 'Válcová 14×51 (do 63A)', 'Válcová 22×58', 'Nevím'] },
      { key: 'poles',  text: 'Počet pólů?',                              options: ['1-pólový', '2-pólový', '3-pólový', '4-pólový', 'Nevím'] },
      { key: 'size',   text: 'Velikost (stupeň) NH pojistky?',           options: ['NH00 (do 100A)', 'NH0 (do 160A)', 'NH1 (do 250A)', 'NH2 (do 400A)', 'NH3 (do 630A)', 'Nevím / válcová'] },
    ],
    mfrKeys: ['abb', 'siemens', 'schneider', 'eaton'],
    knowledge: `## Pojistkové spodky a odpínače — přehled

**NH spodky (Sicherungsunterteil)**: základny pro nožové NH pojistky, montáž na DIN lištu nebo přímá.
**NH odpínače (Lasttrennschalter)**: jako spodek + bezpečnostní odpojení pod zatížením.
**Válcové pojistkové základny**: pro 10×38 mm a 14×51 mm válcové pojistky.

---
### ABB — NH spodky OS série:
**NH00 (do 100A):**
  OS63J03   = 3P, 63A, NH00, šroubový
  OS100J03  = 3P, 100A, NH00
**NH0 (do 160A):**
  OS160J03  = 3P, 160A, NH0, šroubový
**NH odpínače (OS + OT odpínač):**
  OT63F3    = odpínač 63A, 3P (bez pojistek)
  OS63J12   = 1P NH00 pojistkový spodek

---
### Siemens — 3NP pojistkové odpínače:
**NH00 (do 100A, 3-pólové):**
  3NP4062-0CA01 = 3P, NH00, 100A, DIN lišta
  3NP4062-0CA21 = 3P, NH00, 100A, přímá montáž
**NH0 (do 160A):**
  3NP4062-0CA51 = 3P, NH0, 160A
**NH1 (do 250A):**
  3NP4062-0CB01 = 3P, NH1, 250A

---
### Schneider Electric — INF / ISFT série:
**NH válcová základna:**
  DF101A10     = 1P, 10×38, 10A, DIN
  DF101A32     = 1P, 10×38, 32A
  DF201A32     = 2P, 10×38, 32A
  DF201A63     = 2P, 14×51, 63A
**NH odpínač (INF základna):**
  INS80        = odpínač 80A, DIN
  INS125       = odpínač 125A
  INS250       = odpínač 250A

---
### Eaton — NZM NH odpínače:
  NZMB1-AF100  = 3P, NH00, 100A
  NZMN1-A100   = 3P, NH0, 100A
  NZMN2-A250   = 3P, NH1, 250A

---
### Válcové pojistkové základny (10×38 / 14×51):
**Phoenix Contact:**
  UK 5-HESILA 250/1/P = 1P válcová základna 10×38, DIN (do 25A)
  UK 10-HESILA 500/1/P = 1P válcová základna 10×38, do 63A
**Weidmüller:**
  WSI 6/1    = 1P válcová 10×38, 6mm²
  WSI 16/1   = 1P válcová 14×51, 16mm²
**ABB:**
  E91/32     = pojistková základna válcová 1P, 10×38
`,
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
  // 5a. Příslušenství svorek
  // -------------------------------------------------------------------------
  {
    key: 'prislusenstvi_svorka',
    label: 'Příslušenství svorek',
    aliases: [
      'čílko', 'čilko', 'cilko', 'krajní doraz', 'krajni doraz', 'endklammer', 'end bracket',
      'propojka svorek', 'propojka svorky', 'přemostovač svorek', 'premostovac svorek',
      'querbrücke', 'querbrucke', 'jumper svorka', 'přemostit svorku', 'přemostění svorky',
      'nosič popisků', 'nosic popiku', 'nosic popisku', 'popisek svorky', 'štítek svorky',
      'stitek svorky', 'beschriftungsträger', 'marker svorka',
      'krycí plech svorky', 'kryci plech svorky', 'krytka svorky', 'cover svorka',
      'krycí přepážka', 'kryci prepazka',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce svorek?',                                           options: ['WAGO', 'Phoenix Contact', 'Weidmüller', 'ABB', 'Bez preference'] },
      { key: 'acc_type', text: 'Jaký typ příslušenství?',                                   options: ['Čílko / Krajní doraz (end bracket)', 'Propojka / Přemostovač', 'Nosič popisků / Štítek', 'Krycí plech / Krytka / Přepážka', 'Jiné'] },
      { key: 'series',   text: 'Pro jakou řadu svorek? (napiš, např. PT 2.5, WDU 2.5, 2273, 221-2, TOPJOB S)' },
    ],
    mfrKeys: ['wago', 'phoenix', 'weidmuller'],
    knowledge: `## Příslušenství svorek — přehled

Svorky vyžadují příslušenství: čílka/krajní dorazy (end bracket), propojky/přemostovače (jumper bridges), nosiče popisků, krycí plechy a krytky.

---
### WAGO — příslušenství svorek:
**WAGO 221 (LEVER-NUT) — příslušenství:**
  221-500  = čílko pro 221-xxx (end cover)
  221-2401 = propojka 2-pólová 24 V (pro montáž PE)
Série 221: 221-412 (2×do 4mm²), 221-413 (3×), 221-415 (5×)

**WAGO 2273 (PUSH-WIRE, šroubová typ):**
  2273-499 = čílko pro 2273 řadu (5mm rozteč)
  2273-XXX = svorky pro vodiče 0.5–2.5 mm²

**WAGO TOPJOB S (2002 / 2004 / 2006 řady — Push-In CAGE CLAMP, 5mm rozteč):**
  XXXX-YYZZ = "XXXX" -označuje řadu pro velikost vodiče (např. 2002=2.5mm², 2006=6mm²). "YY" -označuje počet zdířek (např. 14=4pólová, 13=3pólová). "ZZ" označuje barvu (91=šedá, 92=oranžová)
  2002-1391 = čílko pro 2002 (2.5mm²)
  2004-1391 = čílko pro 2004 (4mm²)
  2006-1391 = čílko pro 2006 (6mm²)
  2010-1391 = čílko pro 2010 10mm²
  2002-402 = propojka 2P pro TOPJOB S 2002 (2002-403 má 3 póly, 2002-404 má 4 póly atd..)
  2004-402 = propojka 2P pro 2004 (20024-403 má 3 póly, 2004-404 má 4 póly atd..)
  2009-114  = Inline Marker WMB-Inline pro 5mm svorky (TOPJOB S 2002, 279 série) — SPRÁVNÉ typové označení pro nosiče štítků!
  2009-115  = Inline Marker WMB-Inline pro 6mm svorky (TOPJOB S 2004)
  WMB-Inline = systémové označení inline markovacího systému WAGO pro DIN svorky

**WAGO 279 řada (TOPJOB S šroubová, starší, 5mm rozteč):**
  279-1xx   = svorkovnice řady 279 (např. 279-101 = 1-pólová, 279-133 = 3-pólová)
  279-100   = čílko/end cover pro 279 řadu
  2009-114  = Inline Marker Carrier (nosič popisků) pro 279 řadu — SPRÁVNÉ označení! (ne "etiketa 279", ne "štítek pro 279-xxx")
  WMB-Inline = systémové označení — hledej "WMB" nebo "2009-114" v DB

**WAGO 280 řada (šroubová, 35mm²):**
  280-999 = čílko pro 280 řadu
  280-483 = propojka 3P

---
### Phoenix Contact — příslušenství svorek:
**Čílka pro PT / UT / MKDS:**
  3030150 = E/UK — čílko pro UT 2.5, PT 2.5 (3mm rozteč) — nejpoužívanější!
  3030163 = E/UT 4 — čílko pro UT 4 mm²
  3030216 = E/UT 6 — čílko pro UT 6 mm²
  3030229 = E/UT 10 — čílko pro UT 10 mm²
  3030232 = E/UT 16 — čílko pro UT 16 mm²

**Propojky (jumper bridges):**
  3030107 = FBS 2-5 — propojka 2-pólová pro PT/UT 2.5 (5mm rozteč)
  3030085 = FBS 3-5 — propojka 3-pólová PT/UT 2.5
  3030098 = FBS 10-5 — propojka 10-pólová
  3030056 = QTC 2,5 — propojka 2P pro PT 2.5
  1201459 = FBS 2-5 — propojka 2P (jiné balení)

**Nosiče popisků:**
  0810916 = KMK BIG — nosič štítků
  1204562 = KMK 3 — nosič pro PT 2.5 série
  3030026 = MK — označovací svorka

---
### Weidmüller — příslušenství svorek:
**Čílka pro WDU / ZDU:**
  1052500000 = EW — čílko pro WDU 2.5 / ZDU 2.5 (základní, nejpoužívanější)
  1052600000 = EW 4  — čílko pro WDU 4
  1052700000 = EW 6  — čílko pro WDU 6
  1052800000 = EW 10 — čílko pro WDU 10
  1052900000 = EW 16 — čílko pro WDU 16

**Propojky:**
  1024340000 = QV 2,5/2 — propojka 2-pólová pro WDU 2.5
  1024350000 = QV 2,5/3 — propojka 3-pólová
  1024370000 = QV 2,5/10 — propojka 10-pólová
  1024380000 = QV 4/2 — propojka 2P pro WDU 4

**Nosiče popisků:**
  1608510000 = M 2,5/5 — popisek/štítek pro WDU 2.5 (5×5mm)
  1608530000 = M 4/5 — pro WDU 4

---
### ABB — příslušenství svorek:
Řady: TS (šroubová), TNL (průchozí), TPN (PE).
  4820T = čílko pro TS řadu (2.5 / 4 mm²)
  BEW10/5 = propojka 10P pro TS

---
### Obecné typy vyhledávání:
- Čílko konkrétní: "čílko 2273", "end cover 221", "E/UK 2.5", "EW 2.5"
- Propojka obecně: "QV 2.5", "FBS 2-5", "querbrücke 2.5"
- Nosič popisků: "MK 2.5", "KMK", "popisek svorky", "štítek svorky"
`,
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
  // 6a. Příslušenství frekvenčních měničů
  // -------------------------------------------------------------------------
  {
    key: 'prislusenstvi_menic',
    label: 'Příslušenství frekvenčních měničů',
    aliases: [
      'brzdný odpor', 'brzdny odpor', 'braking resistor', 'bremswiderstand', 'dynamické brzdění',
      'emc filtr měnič', 'emc filtr vfd', 'emc filtr frekvenční', 'vstupní filtr měnič',
      'tlumivka měnič', 'tlumivka vfd', 'síťová tlumivka', 'sitova tlumivka', 'line reactor', 'netzrosseln', 'netzdrossel',
      'sinusový filtr', 'sinusovy filtr', 'výstupní filtr měnič', 'du/dt filtr',
      'rozšiřovací karta měnič', 'io karta měnič', 'komunikační karta měnič',
      'panel operátora měnič', 'display měnič', 'bop', 'itc', 'sip20',
      'příslušenství měnič', 'prislusenstvi menic', 'příslušenství vfd',
      'FSA', 'FSB', 'FSC', 'FSD', 'FSE',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce frekvenčního měniče?',                options: ['Siemens (SINAMICS G120 / G120C)', 'ABB (ACS355 / ACS580)', 'Schneider (Altivar)', 'Danfoss (FC302)', 'Bez preference'] },
      { key: 'acc_type', text: 'Jaký typ příslušenství?',                     options: ['Brzdný odpor', 'EMC filtr (vstupní / síťový)', 'Tlumivka (síťová / výstupní)', 'Sinusový / du/dt filtr', 'Rozšiřovací karta / komunikační modul', 'Operátorský panel / display'] },
      { key: 'power',    text: 'Výkon měniče nebo motor (napiš, např. 1.5kW nebo 4kW)?',   hint: 'Potřebujeme pro správný výběr příslušenství' },
    ],
    mfrKeys: ['siemens', 'abb', 'schneider'],
    knowledge: `## Příslušenství frekvenčních měničů — přehled

Měniče vyžadují externe příslušenství: brzdné odpory (dynamické brzdění), EMC filtry (omezení rušení), síťové/výstupní tlumivky, sinusové filtry, komunikační a I/O karty.

---
### Siemens SINAMICS G120 — příslušenství:
**Brzdné odpory (Power Module PM240):**
  6SL3201-0BE14-8AA0 = brzdný odpor 0.37 kW PM240
  6SL3201-0BE15-5AA0 = brzdný odpor 0.55 kW
  6SL3201-0BE21-0AA0 = brzdný odpor 1.1 kW
  6SL3201-0BE21-5AA0 = brzdný odpor 1.5 kW
  6SL3201-0BE22-2AA0 = brzdný odpor 2.2 kW
  6SL3201-0BE24-0AA0 = brzdný odpor 4.0 kW
  6SL3201-0BE25-5AA0 = brzdný odpor 5.5 kW
  6SL3201-0BE27-5AA0 = brzdný odpor 7.5 kW
  6SL3201-0BE21-1AA0 = brzdný odpor 11 kW
  6SL3201-0BE21-5AB0 = brzdný odpor 15 kW
**EMC filtry (vstupní):**
  6SL3203-0BE13-2AA0 = EMC filtr 3A, FSA
  6SL3203-0BE15-5AA0 = EMC filtr 5.5A, FSA
  6SL3203-0BE21-0AA0 = EMC filtr 10A, FSA
  6SL3203-0BE21-8AA0 = EMC filtr 18A, FSB
  6SL3203-0BE22-7AA0 = EMC filtr 27A, FSC
**Operátorské panely:**
  6SL3255-0AA00-4CA1 = BOP-2 (Basic Operator Panel)
  6SL3256-0LC00-1JA0 = IOP-2 (Intelligent Operator Panel)

---
### ABB ACS355 / ACS580 — příslušenství:
**EMC filtry:**
  3AXD50000016760 = EMC filtr pro ACS355, 3A
  3AXD50000195516 = EMC filtr pro ACS355, 8A
  3AXD50000011678 = EMC filtr pro ACS580-01, 16A
**Brzdné odpory:**
  3AUA0000058609  = brzdný odpor ACS355, 0.37–0.75 kW
  3AUA0000058610  = brzdný odpor ACS355, 1.1–2.2 kW
  3AUA0000058613  = brzdný odpor ACS355, 4–7.5 kW
**Komunikační adaptéry:**
  3AXD10000465138 = FPBA-01 PROFIBUS adaptér pro ACS355/580
  3AXD10000461788 = FENA-21 Ethernet/PROFINET adaptér

---
### Schneider Altivar — příslušenství:
**EMC filtry:**
  VW3A4420        = EMC filtr pro Altivar 312, 3-fázový
  VW3A4436        = EMC filtr pro Altivar 320, 18A
**Brzdné odpory:**
  VW3A7601        = brzdný odpor Altivar, 72Ω
  VW3A7606        = brzdný odpor 27Ω
  VW3A7702        = brzdný odpor 10Ω

---
### Danfoss FC302 — příslušenství:
**Brzdné odpory:**
  175U3375        = brzdný odpor 68Ω pro FC302, 1.5 kW
  175U3376        = brzdný odpor 47Ω pro FC302, 2.2 kW
**Komunikační karty:**
  130B1119        = PROFIBUS MCA101 karta
  130B1137        = PROFINET MCA120 karta
`,
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
  // 8a. Časové relé (time delay / timer relays)
  // -------------------------------------------------------------------------
  {
    key: 'casove_rele',
    label: 'Časové relé',
    aliases: [
      'časové relé', 'casove rele', 'časovač', 'casovac', 'timer relé', 'timer relay',
      'zpožďovací relé', 'zpozd relé', 'zpoždění zapnutí', 'zpozdeni zapnuti',
      'on-delay', 'off-delay', 'přepínač hvězda trojúhelník časový', 'hvězda trojúhelník timer',
      'zeitrelais', 'zeitschalter', 'zpoždění vypnutí', 'zpozdeni vypnuti',
      '8.01', '8.04', '8.30', '88.02', '3RP2', 'CT-AHS', 'CT-ERS', 'CT-MVS',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce?',                         options: ['Finder (8.xx / 88.xx)', 'Siemens (3RP2)', 'ABB (CT série)', 'Schneider Electric', 'Bez preference'] },
      { key: 'func',     text: 'Funkce časování?',                  options: ['Zpoždění zapnutí (on-delay)', 'Zpoždění vypnutí (off-delay)', 'Multifunkční (on + off + blikání…)', 'Hvězda-trojúhelník (star-delta)', 'Zapínací / blikací impulz'] },
      { key: 'voltage',  text: 'Napájecí napětí cívky / řídící?',  options: ['24 V DC', '24 V AC', '230 V AC', '24–240 V AC/DC  (univerzální)', 'Jiné'] },
    ],
    mfrKeys: [],
    knowledge: `## Časové relé — přehled

Časová relé (timer relays) zajišťují zpoždění zapnutí/vypnutí nebo multifunkční časování. Montáž na DIN lištu nebo do patice. Klíčové parametry: funkce, rozsah časování, napájení.

---
### Finder — řady 8.xx a 88.xx:
**8.01 — zpoždění zapnutí (on-delay), 1× přepínací kontakt:**
  8.01.8.024.0000 = 24 V AC/DC, 0.1 s–10 h
  8.01.8.230.0000 = 230 V AC, 0.1 s–10 h
**8.04 — zpoždění zapnutí (on-delay), 1× přepínací:**
  8.04.8.024.0000 = 24 V AC/DC, rozsah 0.1 s–10 h (DIN lišta)
  8.04.8.230.0000 = 230 V AC, 0.1 s–10 h
**8.30 — zpoždění vypnutí (off-delay), 1× přepínací:**
  8.30.8.024.0000 = 24 V AC/DC
  8.30.8.230.0000 = 230 V AC
**88.02 — multifunkční (8 funkcí), 2× přepínací:**
  88.02.0.240.0000 = 24–240 V AC/DC (nejpoužívanější, univerzální napájení)
  88.02.0.240.0060 = 24–240 V + potenciometr + displej

---
### Siemens — 3RP2:
**3RP2025 — multifunkční (on-delay + off-delay + impulz):**
  3RP2025-1AP30 = 24–240 V AC/DC, 0.05 s–100 h, 1× přepínací
  3RP2025-1BB30 = 24 V DC, 0.05 s–100 h
**3RP2005 — zpoždění zapnutí:**
  3RP2005-1AW30 = 24–240 V AC/DC, 0.5 s–10 h
**3RP2574 — hvězda-trojúhelník timer:**
  3RP2574-1NP30 = 24–240 V AC/DC, nastavitelné zpoždění přepnutí Y→Δ

---
### ABB — CT série:
**CT-AHS — on-delay, 1 C/O:**
  CT-AHS-24DC    = 24 V DC, 0.1 s–10 h
  CT-AHS-24AC    = 24 V AC
  CT-AHS-110AC   = 110 V AC
  CT-AHS-230AC   = 230 V AC
**CT-ERS — off-delay:**
  CT-ERS-24DC    = 24 V DC
  CT-ERS-230AC   = 230 V AC
**CT-MVS — hvězda-trojúhelník:**
  CT-MVS-24DC    = 24 V DC
  CT-MVS-230AC   = 230 V AC
`,
  },

  // -------------------------------------------------------------------------
  // 8b. Monitorovací relé (napěťová a fázová ochrana)
  // -------------------------------------------------------------------------
  {
    key: 'monitorovaci_rele',
    label: 'Monitorovací relé',
    aliases: [
      'monitorovací relé', 'monitorovaci rele', 'fázové relé', 'fazove rele',
      'sledování fází', 'sledovani fazi', 'fázová ochrana', 'fazova ochrana',
      'sled fází', 'výpadek fáze', 'vypadek faze', 'nesymetrie fází', 'nesymetrie fazi',
      'napěťové relé', 'napetove rele', 'podpěťové relé', 'prepetove rele',
      'phase monitoring', 'phase failure relay', 'phase sequence relay', 'voltage monitoring',
      'phasenwächter', 'phasenueberwachung', 'spannungsüberwachung',
      '3UG46', '3UG4615', '3UG4616', 'CM-PFE', 'CM-UFK', 'EMD-FL',
    ],
    questions: [
      { key: 'mfr',     text: 'Výrobce?',                    options: ['Siemens (3UG46)', 'ABB (CM série)', 'Phoenix Contact (EMD-FL)', 'Carlo Gavazzi', 'Bez preference'] },
      { key: 'func',    text: 'Co má relé hlídat?',          options: ['Výpadek fáze + sled fází (3-fáze)', 'Nesymetrie fází (asymetrie)', 'Podpětí / přepětí (1 nebo 3 fáze)', 'Vše výše (kombinované)'] },
      { key: 'voltage', text: 'Napájecí (síťové) napětí?',   options: ['3×400 V AC (standard EU)', '3×230 V AC', '3×200–500 V AC (univerzální)', 'Jiné'] },
    ],
    mfrKeys: ['siemens', 'abb', 'phoenix'],
    knowledge: `## Monitorovací relé — fázová a napěťová ochrana

Hlídají 3-fázové napájení: výpadek fáze, špatný sled fází, nesymetrie, podpětí/přepětí. Po detekci chyby rozepnou výstupní kontakt → odstaví zátěž nebo signalizují poruchu.

---
### Siemens — 3UG4615 / 3UG4616:
**3UG4615 — výpadek fáze + sled fází + nesymetrie:**
  3UG4615-1CR20 = 3×160–690 V AC, 1 NO + 1 NC, šroubová svorka, DIN
  3UG4615-1CW30 = 3×160–690 V AC, 1 NO + 1 NC, pružinová svorka
**3UG4616 — výpadek fáze + sled fází + nesymetrie + podpětí:**
  3UG4616-1CR20 = 3×160–690 V AC, 1 NO + 1 NC, DIN lišta
  3UG4616-1CW30 = 3×160–690 V AC, pružinová svorka
**3UG4622 — podpětí/přepětí 1-fázové:**
  3UG4622-1AW30 = 1×24–240 V AC/DC, nastavitelné pásmo

---
### ABB — CM série:
**CM-PFE — výpadek fáze + sled fází:**
  CM-PFE.2   = 3×200–500 V AC, 2× přepínací, DIN lišta (nejpoužívanější)
  CM-PFS.2   = 3×200–500 V AC, 2× přepínací, s nastavitelnou asymetrií
**CM-UFK — podpětí/přepětí 1-fázové:**
  CM-UFK.1   = 1×24–240 V AC/DC, 1× přepínací
**CM-ENN — univerzální napěťový monitor:**
  CM-ENN.1   = 3×100–500 V AC, výpadek + sled + nesymetrie, 1× C/O

---
### Phoenix Contact — EMD-FL:
**EMD-FL-3V-400 — výpadek fáze + sled fází:**
  2866067 = EMD-FL-3V-400, 3×400 V AC, 1 NO + 1 NC, DIN
  2866080 = EMD-FL-3V-500, 3×500 V AC
**EMD-FL-V-1AC-230V — jednofázové podpětí/přepětí:**
  2902834 = EMD-FL-V-1AC-230V, nastavitelné, 1× C/O

---
### Carlo Gavazzi:
  DP3-CB40 = 3-fázový monitor výpadku fáze + sledu fází, 220–480 V
  DP3-PB40 = rozšířená verze s nastavením
`,
  },

  // -------------------------------------------------------------------------
  // 9a. Patice relé (relay sockets / bases)
  // -------------------------------------------------------------------------
  {
    key: 'patice_rele',
    label: 'Patice relé',
    aliases: [
      'patice relé', 'patice rele', 'sokl relé', 'sokl rele', 'zásuvka relé', 'zasuvka rele',
      'patice', 'socket relé', 'relay socket', 'relay base', 'relay holder',
      'fassung', 'sockel', 'fassung rele', 'sockel rele',
      'patice my2', 'patice my4', 'patice g2r', 'patice rm85',
      'p2cf', 'gzt8', 'gzt11', 'gzt14',
    ],
    questions: [
      { key: 'mfr',   text: 'Výrobce relé (pro které hledáš patici)?', options: ['OMRON (MY / G2R)', 'Finder (60 / 62)', 'Relpol (RM85 / R15)', 'Schrack / TE', 'Bez preference'] },
      { key: 'pins',  text: 'Počet pinů (paty relé)?',                  options: ['8 pinů  — 2P/2CO (MY2, 62.02, RM85)', '11 pinů — 3P/3CO (MY3, 62.03)', '14 pinů — 4P/4CO (MY4, 62.04, R15)', 'Nevím'] },
      { key: 'mount', text: 'Způsob montáže patice?',                   options: ['DIN lišta (šroubová svorka)', 'DIN lišta (pružinová svorka)', 'Přímá montáž na panel / šroub', 'Nevím'] },
    ],
    mfrKeys: [],
    knowledge: `## Patice relé — přehled

Patice (sokly, zásuvky) jsou nezbytné pro montáž relé na DIN lištu nebo panel. Každé relé má kompatibilní patici od výrobce nebo kompatibilní třetí strany.

---
### OMRON — patice pro MY a G2R:
**MY2 (8-pin, 2P):**
  P2CF-08-E   = DIN lišta, šroubová svorka, pro MY2 / G2R-2
  P2RF-08-E   = DIN lišta, push-in, pro MY2
  P2R-08P     = plošný spoj (PCB), pro MY2
  P7CF-08-E   = patice pro G7J-2A (DIN)
**MY3 (11-pin, 3P):**
  P2CF-11-E   = DIN lišta, šroubová, pro MY3 / G2R-3
  P2R-11P     = PCB, pro MY3
**MY4 (14-pin, 4P):**
  P2CF-14-E   = DIN lišta, šroubová, pro MY4 / G2R-4
  P2RF-14-E   = DIN lišta, push-in, pro MY4
  P2R-14P     = PCB, pro MY4
**LED indikátor:**
  P2RVC-8     = LED indikátor + dioda pro 8-pin patici
  P2RVC-11    = LED indikátor pro 11-pin

---
### Finder — patice pro řady 60/62/66:
**8-pin (2P — pro Finder 62.02 / 60.12):**
  90.02.3     = DIN lišta, šroubová svorka (nejpoužívanější)
  90.02.9     = DIN lišta, pružinová svorka
  94.01.1     = LED indikátor pro 8-pin patici
  95.85.3     = patice s ochranným varistorem, 8-pin
**11-pin (3P — pro Finder 62.03 / 60.13):**
  90.03.3     = DIN lišta, šroubová
  90.03.9     = DIN lišta, pružinová
**14-pin (4P — pro Finder 62.04 / 60.14):**
  90.04.3     = DIN lišta, šroubová
  90.04.9     = DIN lišta, pružinová
  95.65.3     = patice s varistorem, 14-pin
**Příslušenství patic:**
  99.01       = ochranny modul varistor pro patice 90.02/90.03/90.04
  99.02.9.024 = LED + dioda modul 24 V DC

---
### Relpol — patice pro RM85 / R15:
**RM85 (8-pin, 2P):**
  GZT8-1      = DIN lišta, šroubová svorka (pro RM85)
  GZT8-2      = přímá montáž na panel (pro RM85)
  GZM8-1      = miniaturní patice 8-pin DIN
**R15 / RM14 (14-pin, 4P):**
  GZT14-1     = DIN lišta, šroubová (pro R15)
  GZT14-2     = přímá montáž (pro R15)
**11-pin (RM11):**
  GZT11-1     = DIN lišta (pro RM11)

---
### Schrack / TE Connectivity — patice:
**8-pin:**
  SRC010005   = 8-pin DIN, šroubová svorka
  SRY010005   = 8-pin DIN, pružinová
**11-pin:**
  SRC011005   = 11-pin DIN
**14-pin:**
  SRC014005   = 14-pin DIN

---
### Obecné vyhledávání:
- 8-pin DIN: "patice 8-pin DIN", "P2CF-08", "90.02.3", "GZT8"
- 11-pin DIN: "patice 11-pin DIN", "P2CF-11", "90.03.3", "GZT11"
- 14-pin DIN: "patice 14-pin DIN", "P2CF-14", "90.04.3", "GZT14"
- Pro konkrétní relé: hledej patici dle typu (MY2 → P2CF-08-E, RM85 → GZT8-1)
`,
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
  // 9c. DIN lišta — dorazy a příchytky
  // -------------------------------------------------------------------------
  {
    key: 'din_lista_prislusenstvi',
    label: 'DIN lišta — dorazy a příchytky',
    aliases: [
      'doraz lišty', 'doraz listy', 'doraz DIN lišty', 'doraz din listy',
      'end stop DIN', 'end bracket DIN', 'endanschlag', 'abschlusswinkel',
      'příchytka DIN', 'prychytka DIN', 'prychytka lišty', 'klín lišty', 'klin listy',
      'upevnění lišty', 'fixátor lišty', 'fixator listy', 'zajištění svorek DIN',
      'dorazy svorek', 'dorazy na listu', 'zarážka lišty',
      'E/NS 35', 'D-UK', 'AB35', 'NSYBCH35',
    ],
    questions: [
      { key: 'mfr',   text: 'Výrobce?',                      options: ['Phoenix Contact', 'Weidmüller', 'ABB', 'Schneider Electric', 'Bez preference'] },
      { key: 'type',  text: 'Typ příslušenství?',            options: ['Doraz / krajní záraz (end stop, zabrání posunutí svorek)', 'Příchytka / klín (fixace lišty nebo svorek)', 'Svorka pro uzemnění lišty (PE klip)'] },
      { key: 'width', text: 'Šířka DIN lišty?',              options: ['35 mm  (NS35/TS35 — standard)', '15 mm  (NS15)', '75 mm  (NS75)', 'Nevím'] },
    ],
    mfrKeys: [],
    knowledge: `## DIN lišta — dorazy a příchytky

Dorazy (end stops) zabraňují svorkovnicím ve sklouznutí z DIN lišty. Příchytky/klíny fixují svorky nebo DIN lištu v rozváděči.

---
### Phoenix Contact — dorazy a příchytky NS35:
**Dorazy pro NS 35:**
  3030169  = E/NS 35×15 — doraz pro TS35 / NS35 lištu, pás (nejpoužívanější)
  3030008  = E/NS 35N — doraz s nosem, DIN 35
  0201528  = D-UK — příchytka/klín pro svorkovnici na NS35
**Příchytky:**
  0201535  = D-UK/5 — rozšířená příchytka

---
### Weidmüller — dorazy NS35:
  1064400000 = AEK 35 — doraz pro NS35, ocelový (sada)
  1063200000 = KSW 35 — klín/příchytka pro NS35
  0517500000 = EW NS35 — doraz s výklopem

---
### Schneider Electric:
  NSYBCH35M  = doraz DIN 35 mm (kovový, montáž šroubem)
  NSYBCH35   = doraz DIN 35 mm (plastový)

---
### ABB:
  1SNA011200R0100 = doraz G-profil / TS35, ocelový
  1SNA011204R0200 = příchytka NS35

---
### Siemens:
  8WH9040-1AA00  = doraz / end clamp pro DIN 35 mm lištu
  8WH9040-6AA00  = příchytka svorek na DIN lištu

---
### Obecně:
- Dorazy se objednávají vždy po párech (levý + pravý konec svorkovnice)
- Pro NS35 hledej: "doraz NS35", "end stop TS35", "E/NS 35", "AEK 35"
- Příchytky/klíny: "D-UK", "KSW 35", "klín DIN", "fixace svorky"
`,
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
  // 10a. Příslušenství Rittal (zámky, závěsy, ventilátory, topení, desky)
  // -------------------------------------------------------------------------
  {
    key: 'prislusenstvi_rittal',
    label: 'Příslušenství Rittal',
    aliases: [
      'zámek skříně', 'zamek skrine', 'zámek rozváděče', 'zamek rozvadece',
      'závěs skříně', 'zaves skrine', 'závěs rozváděče', 'pantová pánev',
      'ventilátor skříně', 'ventilator skrine', 'ventilátor rozváděč', 'ventilator rozvadec',
      'filtr ventilátoru', 'filtr skříně', 'filtrační rohož', 'filtrmatta', 'filtermatte',
      'montážní deska rittal', 'montazni deska rittal', 'montážní deska skříně', 'montazni deska skrine',
      'topení skříně', 'topeni skrine', 'ohřívač skříně', 'ohrivac skrine', 'anti-condensation', 'condensation heater',
      'kabelová průchodka rittal', 'kabelova pruchovka rittal', 'vývodová deska rittal',
      'příslušenství Rittal', 'prislusenstvi rittal', 'Rittal SK', 'Rittal SZ', 'Rittal SV',
      'SK 3213', 'SK 3240', 'SK 3241', 'SK 3105', 'SZ 2455', 'SZ 2586',
    ],
    questions: [
      { key: 'acc_type', text: 'Jaký typ příslušenství Rittal?',    options: ['Ventilátor / chladicí jednotka', 'Filtrační rohož / Filtrační jednotka', 'Topení / ohřívač (kondenzace)', 'Zámek / cylindrická vložka', 'Závěs / pant', 'Montážní deska', 'Vývodová deska / kabelová průchodka'] },
      { key: 'enclosure',text: 'Série rozváděče?',                  options: ['AX (nástěnný, malý)', 'KX (nástěnný, větší)', 'TS 8 (stojatý)', 'VX 25 (stojatý, velký)', 'Nevím / univerzální'] },
      { key: 'size',     text: 'Rozměr nebo výkon (pokud víš)? (napiš, např. 60W, 200×200mm, 250m³/h)' },
    ],
    mfrKeys: [],
    knowledge: `## Příslušenství Rittal — ventilátory, filtry, topení, zámky, závěsy

---
### Ventilátory a filtrační jednotky (SK série):
**Malé ventilátory s filtrem (pro AX/KX skříně):**
  SK 3213.100 = ventilátor 20 W, 60 m³/h, 230 V AC, 150×150 mm
  SK 3213.200 = ventilátor 20 W, 60 m³/h, 115 V AC
  SK 3240.100 = ventilátor 30 W, 105 m³/h, 230 V AC, 150×150 mm
  SK 3240.200 = ventilátor 30 W, 105 m³/h, 115 V AC
  SK 3241.100 = ventilátor 35 W, 130 m³/h, 230 V AC, 150×150 mm
**Větší ventilátory (pro TS8/VX25):**
  SK 3244.100 = ventilátor 50 W, 230 m³/h, 230 V, 254×254 mm
  SK 3245.100 = ventilátor 65 W, 300 m³/h, 230 V
**Výstupní mřížky (pro odtah vzduchu):**
  SK 3323.100 = výstupní mřížka, 150×150 mm
  SK 3324.100 = výstupní mřížka, 254×254 mm

---
### Filtrační rohože (náhradní, SK série):
  SK 3286.000 = filtrační rohož pro SK 3213/3240/3241, 122×122 mm (balení 10 ks)
  SK 3287.000 = filtrační rohož pro SK 3244/3245, 220×220 mm (balení 10 ks)

---
### Topení / ohřívač (kondenzace, SK série):
  SK 3105.100 = PTC ohřívač 10 W, 130–250 V AC/DC (nástěnná montáž, univerzální)
  SK 3105.200 = PTC ohřívač 20 W, 130–250 V AC/DC
  SK 3109.100 = vyhřívací tyč 15 W, 230 V AC (pro TS8/VX25)
  SK 3109.200 = vyhřívací tyč 30 W, 230 V AC

---
### Zámky a cylindrické vložky (SZ série):
  SZ 2586.000 = zámek (vačkový), trojhranný klíč 3 mm, standard Rittal
  SZ 2587.000 = zámek s cylindrickou vložkou (klíčový)
  SZ 4315.000 = záchytná vložka pro TS8/VX25
  SZ 4315.100 = zámek pro TS8 dveře

---
### Závěsy a panty (SZ série):
  SZ 2455.000 = závěs (pant) pro AX / KX nástěnné skříně — levý
  SZ 2455.200 = závěs pravý pro AX / KX
  SZ 2459.000 = těžký závěs pro TS8 / VX25 dveře

---
### Montážní desky:
  AX 2600.000 = montážní deska pro AX skříně (ocel, černá)
  TS 8600.500 = montážní deska TS8 600×500 mm
  VX 8617.035 = montážní deska VX25 600×600 mm

---
### Vývodové desky / kabelové průchodky:
  SZ 2362.000 = vývodová deska (kabelová), dělená, pro AX/KX
  SZ 2362.120 = vývodová deska pro TS8 dno
`,
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
  // 13a. Příslušenství tlačítek a signalizace
  // -------------------------------------------------------------------------
  {
    key: 'prislusenstvi_tlacitko',
    label: 'Příslušenství tlačítek',
    aliases: [
      'kontaktní blok', 'kontaktni blok', 'kontakt blok tlačítko', 'blok kontakt tlačítko',
      'přídavný kontakt tlačítko', 'pridavny kontakt tlacitko', 'blok tlačítka', 'blok tlacitka',
      'NO NC blok', 'spínací blok', 'rozpínací blok',
      'led modul tlačítko', 'led modul tlacitko', 'signálkový modul', 'signalkovy modul',
      'lampový modul', 'lampovy modul', 'illuminated modul', 'žárovkový modul', 'zarovkovy modul',
      'montážní rámeček tlačítko', 'montazni ramecek tlacitko', 'rámeček tlačítko',
      'upevňovací matice tlačítko', 'upevnovaci matice tlacitko',
      'kontaktní přístroj', 'kontaktni pristroj',
      'ZB4B', 'M22-K', '3SB14',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce tlačítkové sestavy?',           options: ['Schneider Electric (XB4 / XB5)', 'Eaton (M22 / RMQ)', 'Siemens (3SB)', 'ABB (CP / MP série)', 'Bez preference'] },
      { key: 'acc_type', text: 'Jaký typ příslušenství?',               options: ['Kontaktní blok (NO / NC / NO+NC)', 'LED / signálkový modul', 'Montážní rámeček / základna', 'Upevňovací kroužek / matice', 'Jiné'] },
      { key: 'diameter', text: 'Průměr otvoru ve dveřích rozváděče?',   options: ['22 mm  (nejběžnější — XB4, M22, 3SB3)', '30 mm  (starší průmysl)', 'Jiný'] },
    ],
    mfrKeys: ['schneider', 'eaton', 'siemens', 'abb'],
    knowledge: `## Příslušenství tlačítek — kontaktní bloky, LED moduly, rámečky

Tlačítka, signálky a selektory se skládají z hlavy (ovládací prvek) a příslušenství: kontaktní bloky, LED/žárovkové moduly, montážní rámečky.

---
### Schneider Electric — XB4 (kovové, 22 mm):
**Kontaktní bloky (ZB4BZ série):**
  ZB4BZ101    = 1NO (spínací kontakt)
  ZB4BZ102    = 1NC (rozpínací kontakt)
  ZB4BZ103    = 1NO + 1NC
  ZB4BZ104    = 2NO
  ZB4BZ105    = 2NC
  ZB4BZ201    = 1NO (šroubový, zpomaleně)
  ZB4BZ209    = 1NO (zlatý, nízké napětí)
**LED / žárovkové moduly (ZB4BV série):**
  ZB4BV3      = LED modul, zelená, 24 V AC/DC
  ZB4BV4      = LED modul, červená, 24 V AC/DC
  ZB4BV5      = LED modul, oranžová, 24 V
  ZB4BV6      = LED modul, bílá, 24 V
  ZB4BV7      = LED modul, modrá, 24 V
  ZB4BVB3     = LED modul, zelená, 110–120 V AC
  ZB4BVD3     = LED modul, zelená, 230 V AC

**XB5 (plastové, 22 mm) kontaktní bloky:**
  ZB5AZ101    = 1NO (spínací)
  ZB5AZ102    = 1NC (rozpínací)
  ZB5AZ103    = 1NO + 1NC
  ZB5AV3      = LED modul zelená 24 V
  ZB5AV4      = LED modul červená 24 V

---
### Eaton — M22 série (22 mm):
**Kontaktní bloky:**
  M22-K10     = 1NO (spínací)
  M22-K01     = 1NC (rozpínací)
  M22-K11     = 1NO + 1NC
  M22-K20     = 2NO
  M22-K02     = 2NC
  M22-KPVS    = 1NO + 1NC (pro zpomalenou funkci)
**LED moduly:**
  M22-LEDC-G  = LED modul, zelená, 12–30 V DC
  M22-LEDC-R  = LED modul, červená
  M22-LEDC-Y  = LED modul, žlutá
  M22-LEDC-W  = LED modul, bílá
  M22-LEDC-B  = LED modul, modrá
  M22-A-LED-G = LED modul s adaptérem, zelená, 24 V AC/DC
**Rámečky:**
  M22-A        = montážní adaptér pro M22
  M22-TH       = uchycovací matice (panel thickness < 3mm)

---
### Siemens — 3SB3 série (22 mm):
**Kontaktní bloky:**
  3SB3400-0A  = 1NO, šroubová svorka
  3SB3400-1A  = 1NC, šroubová svorka
  3SB3400-0B  = 1NO, pružinová svorka
  3SB3400-0E  = 1NO, zlaté kontakty (nízké napětí)
  3SB3901-0AV = 1NO + 1NC, šroubová (přídavný blok)
**LED moduly:**
  3SB3400-1PA = LED modul, zelená, 24 V AC/DC
  3SB3400-1QA = LED modul, červená, 24 V AC/DC
  3SB3400-1RA = LED modul, žlutá/oranžová, 24 V
  3SB3400-1SA = LED modul, bílá, 24 V
  3SB3400-1TA = LED modul, modrá, 24 V

---
### ABB — CP / MP série (22 mm):
**Kontaktní bloky:**
  1SFA611600R1001 = 1NO
  1SFA611600R1002 = 1NC
  1SFA611600R1003 = 1NO + 1NC
  MCB-10 = 1NO (záměnný s XB4/M22 v montáži)
**LED / signálkový modul:**
  LED-24DC-G  = LED zelená 24 V DC
  LED-24DC-R  = LED červená 24 V DC
`,
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

  // -------------------------------------------------------------------------
  // 18. Vodiče a kabely
  // -------------------------------------------------------------------------
  {
    key: 'vodic_kabel',
    label: 'Vodič / Kabel',
    aliases: [
      'vodič', 'vodic', 'kabel', 'kabely', 'vodiče', 'ovládací kabel', 'ovladaci kabel',
      'silový kabel', 'silovy kabel', 'datový kabel', 'datovy kabel', 'řídicí kabel',
      'rizdici kabel', 'stíněný kabel', 'stineny kabel', 'gumový kabel', 'gumovy kabel',
      'olflex', 'ölflex', 'liycy', 'liyy', 'nyy', 'nhxmh', 'h07rn-f', 'topflex',
      'unitronic', 'heludata', 'helupower', 'lapp', 'helukabel',
      'Leitung', 'Kabel', 'Steuerleitung', 'Energiekabel',
    ],
    questions: [
      {
        key: 'subtype',
        text: 'Co hledáš?',
        options: [
          'Jednožilový vodič (H07V-K, RADOX, ÖLFLEX HEAT, UL, NSGAFÖU…)',
          'Vícežilový kabel (ÖLFLEX CLASSIC, TOPFLEX, NYY-J, LiYCY…)',
        ],
      },
      // ── Jednožilový vodič ──────────────────────────────────────────────────
      {
        key: 'wire_typ',
        text: 'Typ / norma vodiče?',
        options: [
          'Standardní instalační (H07V-K, PVC 70°C)',
          'Bezhalogenový (H07Z-K, FRNC)',
          'Flexibilní (H05V-K)',
          'RADOX (125°C / solární / 4GKW)',
          'ÖLFLEX HEAT (125°C / 180°C / 260°C)',
          'UL / CSA certifikovaný',
          'Těžký průmysl (NSGAFÖU, NSHXAFÖ)',
          'Speciální (PTFE, Silikon, ALPHAWIRE)',
          'Bez omezení',
        ],
        onlyIf: { key: 'subtype', value: 'Jednožilový' },
      },
      {
        key: 'prurez',
        text: 'Průřez vodiče (mm²)?',
        options: ['0.25', '0.35', '0.5', '0.75', '1.0', '1.5', '2.5', '4.0', '6.0', '10.0', '16.0', '25.0', '35.0', '50.0', '70.0', '95.0', 'Bez omezení'],
        onlyIf: { key: 'subtype', value: 'Jednožilový' },
      },
      {
        key: 'barva',
        text: 'Barva vodiče?',
        options: [
          'Černá (BK)', 'Červená (RD)', 'Hnědá (BN)', 'Oranžová (OG)', 'Žlutá (YE)',
          'Zelená (GN)', 'Zeleno-žlutá PE (GNYE)',
          'Světle modrá (LBU)', 'Tmavě modrá (DBU)', 'Šedá (GY)',
          'Fialová (VT)', 'Bílá (WH)', 'Růžová (PK)', 'Bez omezení',
        ],
        onlyIf: { key: 'subtype', value: 'Jednožilový' },
      },
      {
        key: 'vyrobce',
        text: 'Výrobce (volitelně)?',
        options: ['LAPP', 'HELUKABEL', 'HUBER+SUHNER (RADOX)', 'KABLO VRCHLABÍ', 'LEONI', 'ALPHAWIRE', 'DESCA', 'Bez preference'],
        onlyIf: { key: 'subtype', value: 'Jednožilový' },
      },
      // ── Vícežilový kabel ──────────────────────────────────────────────────
      {
        key: 'pocetZil',
        text: 'Počet žil?',
        options: ['2', '3', '4', '5', '7', '8', '10', '12', '14', '16', '18', '20', '25', '30', 'více než 30', 'Bez omezení'],
        onlyIf: { key: 'subtype', value: 'Vícežilový' },
      },
      {
        key: 'kabel_prurez',
        text: 'Průřez žil (mm²)?',
        options: ['0.14', '0.25', '0.34', '0.5', '0.75', '1.0', '1.5', '2.5', '4.0', '6.0', '10.0', '16.0', '25.0', '35.0', 'Bez omezení'],
        onlyIf: { key: 'subtype', value: 'Vícežilový' },
      },
      {
        key: 'stineni',
        text: 'Stínění?',
        options: ['Bez stínění', 'Stíněný (Cu oplet / fólie)', 'Bez omezení'],
        onlyIf: { key: 'subtype', value: 'Vícežilový' },
      },
      {
        key: 'materialPlaste',
        text: 'Materiál pláště?',
        options: ['PVC (standardní)', 'PUR (olejuvzdorný, ohebný)', 'Bezhalogenový (FRNC/LSZH)', 'Gumový (EPR/EPDM)', 'Bez omezení'],
        onlyIf: { key: 'subtype', value: 'Vícežilový' },
      },
      {
        key: 'retiez',
        text: 'Použití v energetickém řetězu (e-chain)?',
        options: ['Ano — vysoce ohebný pro e-chain', 'Ne — standardní pevné uložení', 'Bez omezení'],
        onlyIf: { key: 'subtype', value: 'Vícežilový' },
      },
      {
        key: 'kabel_vyrobce',
        text: 'Výrobce (volitelně)?',
        options: ['LAPP (ÖLFLEX)', 'Helukabel', 'Nexans', 'HUBER+SUHNER', 'Bez preference'],
        onlyIf: { key: 'subtype', value: 'Vícežilový' },
      },
    ],
    mfrKeys: ['lapp', 'helukabel', 'nexans', 'huber_suhner'],
    knowledge: `## Vodiče a kabely — přehled kategorií a typových označení

### Přehled norem a typů kabelů:
- **IEC 60227** — kabely s PVC izolací, 300/500V nebo 450/750V.
- **IEC 60245** — kabely s gumovou izolací.
- **EN 50525** — harmonizovaná norma pro LV kabely v EU (nahrazuje HD 603).
- **VDE 0276** — německá norma, silové kabely (NYY, NAYY atd.).

### Kódování průřezu a žil:
- **[počet]G[průřez]** = N žil + zelenožlutá ochranná žíla PE (G = mit Grün-Gelbem Schutzleiter)
  Příklad: 5G2.5 = 4 provozní žíly + 1 PE žíla, každá 2.5mm²
- **[počet]x[průřez]** = N žil bez PE žíly
  Příklad: 4x1.5 = 4 žíly 1.5mm², žádná PE

---
### LAPP — ÖLFLEX® ovládací kabely:
**ÖLFLEX® CLASSIC 110** — standardní ovládací kabel PVC, 300/500V, -20 až +80°C:
  3G1.5 = 3žily+PE, 1.5mm² | 5G2.5 = 5žil+PE, 2.5mm² | 7G1.5 = 7žil+PE, 1.5mm²
  Stíněný: ÖLFLEX CLASSIC 110 CY = s Cu opletem
  PUR: ÖLFLEX CLASSIC 110 PUR = olej/chemie odolný

**ÖLFLEX® CHAIN 90** — pro energetické řetězy, vysoce ohebný, PVC:
  4G1.5, 5G2.5 atd.

**ÖLFLEX® ROBUST 200** — PUR plášť, UV stálý:
  Vhodný pro venkovní stroje, těžký průmysl.

**UNITRONIC® LiYCY** — stíněný datový kabel (Cu oplet), 250V:
  2x0.25, 4x0.25, 4x0.34 (Profibus), 2x2x0.22 (párový)
**UNITRONIC® LiYY** — nestíněný datový kabel:
  Stejné průřezy jako LiYCY.

---
### Helukabel:
**TOPFLEX® 600** — vysoce ohebný ovládací, PVC, 300/500V:
  5G2.5, 7G1.5 atd.
**TOPFLEX® 600-C** — stíněný:
  Cu oplet, EMC ochrana.
**HELUPOWER® 1000** — ekvivalent NYY-J:
  4x16, 4x10, 4x6 atd.
**JZ-600** — gumový ovládací kabel H07RN-F:
  3G1.5, 4G2.5, 5G1.5 atd.
**HELUDATA® LiYCY** — stíněný datový:
  4x0.25, 4x0.34

---
### Nexans — standardní silové kabely:
**NYY-J** — PVC silový kabel 0.6/1kV, pevné uložení:
  4x1.5, 4x2.5, 4x6, 4x10, 4x16, 4x25mm²
**NHXMH** — bezhalogenový silový, 0.6/1kV:
  4x1.5, 4x2.5, 4x6mm² — pro budovy, FV systémy
**LiYCY** — stíněný datový kabel:
  4x0.25, 4x0.34, 2x2x0.25

---
### HUBER+SUHNER — koaxiální a solární kabely:
**Koaxiální kabely:**
  RG-58 C/U = 50Ω, průměr 5mm, běžné RF aplikace
  RG-174 = 50Ω, ultra-tenký (3mm)
  LMR-195 = 50Ω, nízká ztráta
  LMR-400 = 50Ω, průměr 10.3mm, velké instalace, nízká útlum
**RADOX® kabely:**
  RADOX 125 = bezhalogenový, 125°C, pro lokomotivy, FV, průmysl

---
### Vyhledávací strategie:
**PRIMÁRNÍ — specifická typová označení:**
ÖLFLEX CLASSIC 110 5G2.5, ÖLFLEX CLASSIC 110 CY 4G1.5
TOPFLEX 600 5G2.5, HELUDATA LiYCY 4x0.25
NYY-J 4x16, NHXMH 4x1.5, H07RN-F 3G1.5

**SEKUNDÁRNÍ:**
ovládací kabel [žíly] [průřez], Steuerleitung [žíly]G[průřez], control cable
datový kabel stíněný [průřez], LiYCY [žíly]x[průřez], shielded data cable
silový kabel [průřez], NYY [žíly]x[průřez], power cable [průřez]`,
  },
];

// ---------------------------------------------------------------------------
// detectCategory — detects component category from user text
// ---------------------------------------------------------------------------
export function detectCategory(text) {
  const norm = normalize(text).trim();
  return COMPONENT_CATEGORIES.find(cat =>
    normalize(cat.label) === norm ||
    cat.aliases.some(alias => normalize(alias) === norm),
  ) ?? null;
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
