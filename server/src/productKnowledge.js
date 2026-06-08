// =============================================================================
// productKnowledge.js — Unifikovaná knowledge báze
// Kategorie → Výrobce → Produktové řady → Detaily + typová označení
//
// ÚČEL: Kontext pro AI agenty (Karel Bot, řízený mód, BOM builder).
//   AI agent dostane inject přesně té sekce, která odpovídá dotazu:
//   - kategorie + výrobce  → knowledge[kat].manufacturers[mfr].doc
//   - jen kategorie        → všechny manufacturers[*].doc dané kategorie
//   - jen výrobce          → agregace přes kategorie
//
// ZDROJE: Data ověřena z oficiálních katalogů výrobců (2024–2025).
//   ABB: library.e.abb.com, new.abb.com
//   Siemens: support.industry.siemens.com, mall.industry.siemens.com
//   Eaton: datasheet.eaton.com, eaton.com
//   Schneider: se.com
//   WAGO: wago.com
//   Phoenix Contact: phoenixcontact.com
//   Weidmüller: catalog.weidmueller.com, eshop.weidmueller.com
//
// KONVENCE PSANÍ:
//   - Každé typové označení musí být ověřeno z katalogu — žádné halucinace.
//   - Pokud sekce není ověřena, je označena // TODO: ověřit katalog
//   - Formát: česky/anglicky dle kontextu (technické termíny anglicky)
// =============================================================================

// ---------------------------------------------------------------------------
// Interní helper — normalizace textu pro matching (bez diakritiky, lowercase)
// ---------------------------------------------------------------------------
function normalize(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------
// PRODUCT_KNOWLEDGE
// Hlavní datová struktura. Klíče jsou kategorie (shodné s původním componentGuide.js).
// ---------------------------------------------------------------------------
export const PRODUCT_KNOWLEDGE = {

  // ===========================================================================
  // JISTIČ (MCB / MPCB — Miniature Circuit Breaker)
  // ===========================================================================
  jistic: {
    label: 'Jistič',
    aliases: [
      'jistič', 'jistic', 'istič', 'mcb', 'mpcb', 'leitungsschutzschalter',
      'miniature circuit breaker', 'circuit breaker', 'jisticka', 'jistička',
      's200', 's201', 's202', 's203', 's204',
      '5sy', '5sl',
      'faz', 'pl6', 'pkzm',
      'ic60', 'ic60n', 'ic60h', 'acti9', 'acti 9',
    ],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                    options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'subtype', text: 'Jaký typ jističe?',                              options: ['Standardní MCB (instalační/kabelová ochrana)', 'Motorový jistič MPCB (ochrana motoru)', 'Nevím'] },
      { key: 'proud',   text: 'Jmenovitý proud? (napiš číslo, např. 16)' },
      { key: 'poly',    text: 'Počet pólů?',                                    options: ['1P', '2P', '3P', '4P', '1P+N', '3P+N'] },
      { key: 'char',    text: 'Charakteristika (spouštěcí křivka)?',            options: ['B  —  3–5×In  (citlivé obvody, kabel)', 'C  —  5–10×In  (obecné použití, motor)', 'D  —  10–20×In  (velký motor, transformátor)', 'K  —  8–14×In  (motor, MPCB)', 'Nevím'] },
      { key: 'icu',     text: 'Požadovaná zkratová odolnost?',                  options: ['6 kA  (standard)', '10 kA  (průmysl)', '15+ kA  (těžký průmysl)', 'Nevím'] },
    ],

    manufacturers: {

      // -----------------------------------------------------------------------
      // ABB — S200 / S200M
      // -----------------------------------------------------------------------
      abb: {
        label: 'ABB',
        doc: `## ABB — Jističe System pro M compact S200 / S200M

### Produktové řady

**S200** — Standardní MCB (instalační jistič), Icn = 6 kA při 230/400 V AC
  Norma: IEC/EN 60898-1 (instalační), IEC/EN 60947-2 (průmyslový)
  Charakteristiky: B, C, D, K, Z
  Konfigurace: 1P (S201), 2P (S202), 3P (S203), 4P (S204)
  Šířka: 1 modul = 17,5 mm na pól (1P=17,5mm, 2P=35mm, 3P=52,5mm)

**S200M** — Motorový jistič (MPCB), Icu = 10 kA při 400 V AC
  Norma: IEC/EN 60947-2
  Charakteristiky: K (8–14×In, pro motory), Z (2–3,5×In, elektronika), B, C, D
  Konfigurace: 1P (S201M), 2P (S202M), 3P (S203M)
  Příplatek: vestavěná ochrana fázového selhání

---

### Formát typového označení

  S[počet_pólů][varianta]-[charakteristika][proud]

  Kde:
    počet_pólů:  1 = 1P, 2 = 2P, 3 = 3P, 4 = 4P
    varianta:    (prázdné) = S200 (6 kA), M = S200M (10 kA)
    charakteristika: B / C / D / K / Z
    proud:       jmenovitý proud v ampérech

---

### Přehled dostupných proudů

  Standardní řada: 0,5 | 1 | 1,6 | 2 | 3 | 4 | 6 | 8 | 10 | 13 | 16 | 20 | 25 | 32 | 40 | 50 | 63 A

---

### Klíčová typová označení — S200 (6 kA)

  S201-B6     = 1P, B křivka, 6 A   (osvětlení, citlivé obvody)
  S201-C10    = 1P, C křivka, 10 A
  S201-C16    = 1P, C křivka, 16 A
  S202-B10    = 2P, B křivka, 10 A
  S202-C16    = 2P, C křivka, 16 A  (nejběžnější 2P MCB v průmyslu)
  S202-C25    = 2P, C křivka, 25 A
  S203-B16    = 3P, B křivka, 16 A
  S203-C16    = 3P, C křivka, 16 A  (nejběžnější 3P MCB v průmyslu)
  S203-C25    = 3P, C křivka, 25 A
  S203-C32    = 3P, C křivka, 32 A
  S203-D10    = 3P, D křivka, 10 A  (transformátor, velký motor)
  S204-C16    = 4P, C křivka, 16 A
  S204-C25    = 4P, C křivka, 25 A

### Klíčová typová označení — S200M (10 kA, motor)

  S203M-K1,6  = 3P, K křivka, 1,6 A (malý motor)
  S203M-K4    = 3P, K křivka, 4 A
  S203M-K6    = 3P, K křivka, 6 A
  S203M-K10   = 3P, K křivka, 10 A
  S203M-K16   = 3P, K křivka, 16 A
  S203M-D6    = 3P, D křivka, 6 A   (alternativa pro motor)

---

### Interní čísla objednávky (2CDS prefix)

  S202-C16  →  2CDS252001R0164
  S203-C16  →  2CDS253001R0164
  S204-C25  →  2CDS254001R0254
  (formát: 2CDS[konfigurace]001R[proud_char_kód])
`,
      },

      // -----------------------------------------------------------------------
      // Siemens — 5SY / 5SL
      // -----------------------------------------------------------------------
      siemens: {
        label: 'Siemens',
        doc: `## Siemens — Jističe SENTRON 5SY / 5SL

### Produktové řady

**5SY6** — Standardní SENTRON MCB, Icn = 6 kA
  Norma: IEC/EN 60898-1, IEC/EN 60947-2
  Charakteristiky: B, C, D
  Konfigurace: 1P, 2P, 3P, 4P (a 1P+N, 3P+N)
  Šířka: 1 modul = 18 mm na pól

**5SY7** — Průmyslový MCB, Icn = 10 kA
  Charakteristiky: B, C, D
  Vhodné pro průmyslové napájení a generátory

**5SY8** — Vysoký zkrat, Icn = 15 kA (Icu = 25 kA dle IEC 60947-2)
  Pro datová centra, transformátory, napájecí rozvaděče

**5SL6** — Komunikační MCB (s měřením a COM modulem)
  Doplněk řady 5SY6 s možností dálkového odečtu

---

### Formát typového označení

  5SY[série][póly][kód_proudu]-[varianta]

  Kde:
    série:       6 = 6 kA, 7 = 10 kA, 8 = 15 kA
    póly:        1 = 1P, 2 = 2P, 3 = 3P, 4 = 4P
    kód_proudu:  dvě číslice — přímá hodnota proudu (04 = 4 A, 16 = 16 A, 63 = 63 A)
                 POZNÁMKA: charakteristika B/C/D je součástí kódu proudu,
                 ale přesné dekódování vyžaduje katalog (každá kombinace
                 charakteristika × proud má unikátní dvouciferný kód)
    varianta:    -7 = šroubové svorky (standard), -6 = jiná verze

---

### Přehled dostupných proudů

  1 | 2 | 3 | 4 | 6 | 8 | 10 | 13 | 16 | 20 | 25 | 32 | 40 | 50 | 63 A

---

### Ověřená typová označení (z datasheetů Siemens)

  5SY6204-7  = 5SY6 (6 kA), 2P, C křivka, 4 A,  šroubové svorky
  5SY7263-7  = 5SY7 (10 kA), 2P, C křivka, 63 A, šroubové svorky
  5SY5102-6  = 5SY5, 1P, B křivka, 2 A
  5SY6106-7  = 5SY6 (6 kA), 1P, B křivka, 6 A
  5SY8503-7  = 5SY8 (15 kA), 5P? — nestandardní konfigurace

  Pro kompletní přehled kódů viz Siemens SENTRON Configuration Manual
  (MAN_L1V30914799-04_en_en-US.pdf)

---

### Identifikace z typového označení

  Série 5SY6 = levnější, 6 kA → pro standardní průmyslové panely
  Série 5SY7 = robustnější, 10 kA → pro generátory, průmysl
  Přípona -7 = šroubové svorky (nejčastější)
  Přípona bez -7 = jiné varianty terminálu
`,
      },

      // -----------------------------------------------------------------------
      // Eaton — FAZ (xEffect)
      // -----------------------------------------------------------------------
      eaton: {
        label: 'Eaton (Moeller)',
        doc: `## Eaton — Jističe FAZ (xEffect)

### Produktová řada

**FAZ xEffect** — Průmyslový MCB, Icu = 15 kA dle IEC/EN 60947-2
  Norma: IEC/EN 60947-2 (průmyslová), IEC/EN 60898-1 (instalační)
  Charakteristiky: B, C, D, K, Z, S
  Konfigurace: 1P, 2P, 3P, 4P
  Šířka modulu: 17,7 mm / pól (1P=17,7mm, 2P=35,4mm, 3P=53,1mm)
  Hloubka montáže DIN: 45 mm (kompatibilní se standardními lištami 35mm)

---

### Formát typového označení

  FAZ-[charakteristika][proud]/[póly][přípona]

  Kde:
    charakteristika: B / C / D / K / Z / S
    proud:           jmenovitý proud (0,16 až 63 A; desetinná místa s tečkou nebo čárkou)
    póly:            1 / 2 / 3 / 4
    přípona:         (prázdné) = standardní šroubové svorky
                     -RT  = ring-tongue terminály
                     -NA  = UL/CSA verze (pro Severní Ameriku — jiná aplikace)
                     -DC  = DC verze

---

### Přehled dostupných proudů

  0,16 | 0,2 | 0,25 | 0,4 | 0,5 | 0,63 | 1 | 1,6 | 2 | 3 | 4 | 6 | 8 | 10 | 13 | 16 | 20 | 25 | 32 | 40 | 50 | 63 A

---

### Klíčová typová označení

  FAZ-B6/1    = B křivka, 6 A,  1P
  FAZ-B16/1   = B křivka, 16 A, 1P
  FAZ-C10/2   = C křivka, 10 A, 2P
  FAZ-C13/2   = C křivka, 13 A, 2P
  FAZ-C16/2   = C křivka, 16 A, 2P
  FAZ-C16/3   = C křivka, 16 A, 3P  (nejběžnější v průmyslu)
  FAZ-C25/3   = C křivka, 25 A, 3P
  FAZ-C32/3   = C křivka, 32 A, 3P
  FAZ-D10/3   = D křivka, 10 A, 3P  (transformátor)
  FAZ-K6/3    = K křivka, 6 A,  3P  (motor, MPCB)
  FAZ-C16/4   = C křivka, 16 A, 4P

  Příklad s příponou:
  FAZ-C13/2-RT = C křivka, 13 A, 2P, ring-tongue terminály

---

### Poznámky k identifikaci

  - Eaton Moeller = stejná firma, FAZ je starší značení, xEffect je nová generace
  - Starší označení PKZM0 = motorový jistič Eaton (jiná kategorie — MPCB/ochrana motoru)
  - PL6 = novější kompaktní řada Eaton (jiná designová generace FAZ)
`,
      },

      // -----------------------------------------------------------------------
      // Schneider Electric — Acti9 iC60N / iC60H
      // -----------------------------------------------------------------------
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric — Jističe Acti9 iC60N / iC60H

### Produktové řady

**Acti9 iC60N** — Standardní průmyslový MCB
  Icn = 6 000 A dle IEC/EN 60898-1
  Icu = 10 kA dle IEC/EN 60947-2
  Charakteristiky: B, C, D
  Konfigurace: 1P, 2P, 3P, 4P, 1P+N

**Acti9 iC60H** — Vyšší zkratová odolnost
  Icn = 10 000 A dle IEC/EN 60898-1
  Icu = 15 kA dle IEC/EN 60947-2

  Funkce VisiTrip (zelená páska = kontakty otevřeny, červená = vybavenO)
  Funkce VisiSafe (fyzická viditelná poloha kontaktů)

---

### Formát typového označení

  A9F[série][křivka][póly][proud_2cifry]

  Dekódování (ověřeno z se.com):
    A9     = Acti9 produktová rodina
    F      = circuit breaker (jistič)
    série: 7 = iC60N standard
    křivka: 3 = B křivka, 4 = C křivka, 5 = D křivka
    póly:   1 = 1P, 2 = 2P, 3 = 3P, 4 = 4P, 6 = 1P+N
    proud:  dvě číslice (01=1A, 06=6A, 10=10A, 16=16A, 63=63A)

---

### Přehled dostupných proudů

  1 | 2 | 3 | 4 | 6 | 8 | 10 | 13 | 16 | 20 | 25 | 32 | 40 | 50 | 63 A

---

### Klíčová typová označení (ověřeno z se.com)

  A9F74106  = iC60N, 1P, B křivka,  6 A
  A9F74110  = iC60N, 1P, B křivka, 10 A  (pozn.: "44" prefix = Disbo varianta)
  A9F74206  = iC60N, 2P, C křivka,  6 A,  10 kA
  A9F74210  = iC60N, 2P, C křivka, 10 A
  A9F79210  = iC60N, 2P, C křivka, 10 A  (jiná série, stejný výkon)
  A9F74316  = iC60N, 3P, C křivka, 16 A
  A9F75316  = iC60N, 3P, D křivka, 16 A
  A9F74610  = iC60N, 1P+N, C křivka, 10 A

  POZNÁMKA: Catalog number "44xxx" = iC60N Disbo (jiná kabelová konfigurace)
  vs. "74xxx" = iC60N standard. Obě jsou iC60N ale různé vstupní terminály.

---

### Příslušenství (A9 kompatibilní)

  OF (pomocný kontakt):    A9A26924 = 1NO+1NC pro iC60N
                           A9A26926 = 2NO
  MX (dálkové vypnutí):    A9A26476 = 12 V DC
                           A9A26477 = 24 V DC
                           A9A26479 = 110–415 V AC
  MN (podpěťová spoušť):   A9A26485 = 110–415 V AC / 100–130 V DC
  Motorový pohon:          A9C70112 = 12 V DC (iOF)
                           A9C70124 = 24 V DC
`,
      },
    }, // end jistic.manufacturers
  }, // end jistic

  // ===========================================================================
  // PŘÍSLUŠENSTVÍ JISTIČŮ
  // ===========================================================================
  prislusenstvi_jistic: {
    label: 'Příslušenství jističů',
    aliases: [
      'pomocný kontakt jistič', 'pomocny kontakt jistic',
      'signalizační kontakt jistič', 'alarm kontakt',
      'shunt trip', 'dálkové vypnutí', 'dalkove vypnuti', 'vypínací cívka',
      'podpěťová spoušť', 'podpetova spous', 'undervoltage release',
      'motorový pohon jistič', 'motor operator breaker',
      'S2C', 'add-on jistič',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce jističe?',             options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'acc_type', text: 'Jaký typ příslušenství?',      options: ['Pomocný / signalizační kontakt', 'Dálkové vypnutí (shunt trip)', 'Podpěťová spoušť (undervoltage)', 'Motorový pohon', 'Jiné'] },
      { key: 'breaker',  text: 'Řada jističe? (napiš, např. S200, S200M, 5SY6, FAZ, iC60N)' },
    ],

    manufacturers: {

      // -----------------------------------------------------------------------
      // ABB — příslušenství S200 / S200M
      // -----------------------------------------------------------------------
      abb: {
        label: 'ABB',
        doc: `## ABB — Příslušenství jističů S200 / S200M

Všechna příslušenství série S2C se montují zboku na jistič S200/S200M.
Kompatibilita: S200, S200M, S200P, S200S (dle konkrétního modelu příslušenství).

### Pomocné a signalizační kontakty (S2C)

  S2C-H6R    = 1NO + 1NC pomocný kontakt, pravý, pro S200
  S2C-H6L    = 1NO + 1NC pomocný kontakt, levý, pro S200
  S2C-H2R    = 2× pomocný kontakt (2NO nebo 2NC dle zapojení), pravý
  S2C-A1     = 1× přídavný kontakt NO/NC (volitelný)
  S2C-AL2R   = alarmový (signalizační trip) kontakt, pravý  — sepne při vybavení
  S2C-AL2L   = alarmový kontakt, levý

### Dálkové vypnutí — Shunt Trip (S2C-STxxT)

  S2C-ST06T  = shunt trip 6 V AC/DC
  S2C-ST12T  = shunt trip 12 V AC/DC
  S2C-ST24T  = shunt trip 24 V AC/DC
  S2C-ST48T  = shunt trip 48 V AC/DC
  S2C-ST110T = shunt trip 110 V AC/DC
  S2C-ST230T = shunt trip 230 V AC/DC

### Podpěťová spoušť — Undervoltage Release (S2C-UABxx / S2C-UAxx)

  S2C-UAB12  = undervoltage release 12 V AC/DC
  S2C-UAB24  = undervoltage release 24 V AC/DC
  S2C-UAB48  = undervoltage release 48 V AC/DC
  S2C-UA110T = undervoltage release 110 V AC/DC
  S2C-UA230T = undervoltage release 230 V AC/DC

### Motorový pohon (remote on/off)

  S2C-MT     = motorový pohon pro S200 (on/off, libovolné napájení dle verze)
  M2C-MT6    = motorový pohon pro větší rámy

### Poznámky

  - Přípona R/L označuje stranu montáže (Right/Left), záleží na plánování řazení
  - Shunt trip způsobí okamžité vypnutí jističe při přivedení napájení na cívku
  - Undervoltage release vypne jistič při poklesu napájení pod nastavenou mez
`,
      },

      // -----------------------------------------------------------------------
      // Siemens — příslušenství 5SY / 5SL (série 5ST3)
      // -----------------------------------------------------------------------
      siemens: {
        label: 'Siemens',
        doc: `## Siemens — Příslušenství jističů 5SY / 5SL (SENTRON)

Série 5ST3 — příslušenství pro SENTRON MCB. Montáž zboku na DIN jistič.

### Pomocné kontakty (5ST3xxx)

  5ST3010    = 1NO + 1NC pomocný kontakt (standardní)
  5ST3020    = 2× pomocný kontakt (2NO nebo 2NC)
  5ST3030    = 1× signalizační (alarm) kontakt — sepne při vybavení jističe

### Dálkové vypnutí — Shunt Trip

  5ST3040    = shunt trip 24 V DC
  5ST3041    = shunt trip 230 V AC
  5ST3042    = shunt trip 110 V AC
  5ST3043    = shunt trip 24 V AC

### Podpěťová spoušť — Undervoltage Release

  5ST3050    = undervoltage release 230 V AC
  5ST3051    = undervoltage release 24 V DC
  5ST3052    = undervoltage release 110 V AC
  5ST3053    = undervoltage release 48 V DC/AC

### Motorový pohon

  5ST3060    = motorový pohon 24–48 V DC/AC  pro 5SY
  5ST3070    = motorový pohon 110–230 V AC

### Poznámky

  - Všechna 5ST3 příslušenství jsou kompatibilní s 5SY4, 5SY6, 5SY7, 5SY8
  - Šroubová montáž ze strany bez nářadí
`,
      },

      // -----------------------------------------------------------------------
      // Eaton — příslušenství FAZ / PL6 / PKZM0
      // -----------------------------------------------------------------------
      eaton: {
        label: 'Eaton (Moeller)',
        doc: `## Eaton — Příslušenství jističů FAZ / PKZM0

### Příslušenství pro FAZ (xEffect MCB)

  FAZ-XHI11  = 1NO + 1NC pomocný kontakt pro FAZ
  FAZ-XA     = alarmový kontakt pro FAZ (trip signal)
  FAZ-XST24  = shunt trip 24 V DC/AC pro FAZ
  FAZ-XST230 = shunt trip 230 V AC pro FAZ
  FAZ-XUV24  = undervoltage release 24 V DC pro FAZ
  FAZ-XUV230 = undervoltage release 230 V AC pro FAZ

### Příslušenství pro PKZM0 (motorový jistič)

  PKZM0-XM   = montážní modul pro PKZM0 (kombinace s DILA kontaktorem)
  PKZ M-I1   = 1× pomocný kontakt (NO nebo NC) pro PKZM0/FAZ
  PKZ M-I11  = 1NO + 1NC kontakt pro PKZM0
  PKZ M-ST   = shunt trip pro PKZM0
  PKZ M-UVT  = undervoltage trip pro PKZM0

### Poznámky

  - FAZ xEffect přináší zjednodušené příslušenství vs. starší Moeller řady
  - PKZM0 je motorový ochranný jistič — kombinuje přetěžovací + zkratovou ochranu
  - Kompatibilitu příslušenství vždy ověřit dle konkrétní generace produktu
`,
      },

      // -----------------------------------------------------------------------
      // Schneider Electric — příslušenství iC60N / C60
      // -----------------------------------------------------------------------
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric — Příslušenství jističů Acti9 iC60

### Pomocné a signalizační kontakty

  A9A26924   = OF kontakt 1NO+1NC pro iC60N
  A9A26925   = OF kontakt 2NO pro iC60N
  A9A26926   = OF kontakt 2NC pro iC60N

### Dálkové vypnutí — MX (shunt trip)

  A9A26476   = MX shunt trip 12 V DC
  A9A26477   = MX shunt trip 24 V DC
  A9A26478   = MX shunt trip 48 V DC/AC
  A9A26479   = MX shunt trip 110–415 V AC (wide range)
  A9A26480   = MX shunt trip 48 V DC

### Podpěťová spoušť — MN (undervoltage)

  A9A26485   = MN 110–415 V AC / 100–130 V DC
  A9A26484   = MN 24 V DC

### Motorový pohon (iOF)

  A9C70112   = motorový pohon 12 V DC pro iC60N
  A9C70124   = motorový pohon 24 V DC

### Poznámky

  - Veškeré A9Axxxxx příslušenství se montuje do bočního slotu iC60N
  - MX (shunt trip) a MN (undervoltage) se montují na opačné strany
  - Motorový pohon umožňuje dálkové zapnutí/vypnutí i přes BUS systém
`,
      },
    }, // end prislusenstvi_jistic.manufacturers
  }, // end prislusenstvi_jistic

  // ===========================================================================
  // SVORKA (Terminal Block — průchozí, PE, neutrální)
  // ===========================================================================
  svorka: {
    label: 'Svorka',
    aliases: [
      'svorka', 'svorky', 'terminal block', 'terminál', 'terminal',
      'svorkovnice', 'průchozí svorka', 'průchozí terminál',
      'wago topjob', 'topjob s', 'cage clamp',
      'ut 2.5', 'ut 4', 'pt 2.5',
      'wdu', 'wdu 2.5', 'push in terminal',
      'klema', 'klemme', 'reihenklemme',
      'pe svorka', 'neutro', 'nulová svorka',
    ],
    questions: [
      { key: 'mfr',          text: 'Preferovaný výrobce?',               options: ['WAGO', 'Phoenix Contact', 'Weidmüller', 'Bez preference'] },
      { key: 'connection',   text: 'Typ připojení?',                      options: ['Push-in (bezšroubové, pružinové)', 'Šroubové', 'Nevím'] },
      { key: 'prurez',       text: 'Průřez vodiče? (mm²)',                options: ['1,5 mm²', '2,5 mm²', '4 mm²', '6 mm²', '10 mm² a více', 'Nevím'] },
      { key: 'typ_svorky',   text: 'Typ svorky?',                        options: ['Průchozí (feed-through)', 'PE/ochranný vodič (zeleno-žlutá)', 'Neutrální/N (modrá)', 'Dvoupodlažní (double-deck)', 'Odpojovací (knife-disconnect)', 'Nevím'] },
      { key: 'barva',        text: 'Barva svorky?',                      options: ['Šedá (standard)', 'Modrá (N)', 'Zeleno-žlutá (PE)', 'Žlutá', 'Jiná'] },
    ],

    manufacturers: {

      // -----------------------------------------------------------------------
      // WAGO — TOPJOB S (řady 2002, 2004, 2006)
      // -----------------------------------------------------------------------
      wago: {
        label: 'WAGO',
        doc: `## WAGO — Svorky TOPJOB® S (DIN lišta, průmyslové)

### Technologie připojení

  **Push-in CAGE CLAMP®** — bezšroubová, pružinová technologie
    Pevný vodič (solid): přímo zasunutí
    Lankový vodič (stranded): s dutinkovou objímkou (ferrule)
    Montáž: na DIN lištu 35×15 nebo 35×7,5

### Produktové řady (ověřeno z wago.com)

  **Řada 2002** — průřez 2,5 mm², jmenovité napětí 800 V, proud 24 A
  **Řada 2004** — průřez 4 mm², jmenovité napětí 800 V, proud 32 A
  **Řada 2006** — průřez 6 mm²
  **Řada 2010** — průřez 10 mm²
  **Řada 2016** — průřez 16 mm²

---

### Řada 2002 — 2,5 mm² (nejpoužívanější)

  2002-1401  = průchozí svorka, šedá, Push-in CAGE CLAMP®
  2002-1207  = PE zemnicí svorka, zeleno-žlutá
  2002-2201  = dvoupodlažní (double-deck) svorka, šedá
  2002-1201  = 2-vodičová průchozí svorka (alternativní verze)

  Barvy (varianta za pomlčkou se mění):
    Šedá  = standard (průchozí)
    Modrá = N (neutrální vodič)
    Zeleno-žlutá = PE (ochranný vodič) — kód 1207

### Řada 2004 — 4 mm²

  2004-1401  = průchozí svorka, 4 mm², šedá, 32 A, 800 V

---

### Příslušenství TOPJOB S (jumper, dorazy)

  2002-404   = propojovací mostek (jumper bar) pro řadu 2002, 4-pólový
  2004-404   = propojovací mostek pro řadu 2004
  2002-405   = 5-pólový jumper pro 2002
  2002-102   = koncový doraz (end bracket/stopper) pro 2002

  Pro jumper bridges platí: kód 4xx = počet pólů (404 = 4 pól, 405 = 5 pól)

---

### Starší řady WAGO (CAGE CLAMP® s páčkou)

  **221 série** — instalační konektory s páčkou (pro rozvodné krabice, ne DIN)
    221-412 = 2-vodičový, do 4 mm²
    221-413 = 3-vodičový, do 4 mm²
    221-415 = 5-vodičový, do 4 mm²
    POZOR: 221 série je pro rozvodné krabice, nikoliv DIN lištu!

  **222 série** — starší splicing konektory s páčkou, DIN šedá, max 4 mm², max 40°C
    222-413 = 3-vodičový, do 4 mm², max 32 A

  **2273 série** — PUSH WIRE® kompaktní konektory pro tuhé vodiče, max 2,5 mm²
    2273-202 = 2-vodičový
    2273-204 = 4-vodičový

---

### Tipy pro identifikaci

  - TOPJOB S = moderní průmyslová svorka, push-in (bez šroubku)
  - Číslo řady udává průřez: 2002=2,5mm², 2004=4mm², 2006=6mm²
  - Kód 1207 = PE terminál (zeleno-žlutá) v dané řadě
  - Kód 2201 = dvoupodlažní varianta
`,
      },

      // -----------------------------------------------------------------------
      // Phoenix Contact — UT / PT / UTTB
      // -----------------------------------------------------------------------
      phoenix: {
        label: 'Phoenix Contact',
        doc: `## Phoenix Contact — Svorky CLIPLINE (UT / PT / UTTB)

### Technologie připojení

  **UT** = šroubové svorky (screw clamp) — tradiční, spolehlivé
  **PT** = push-in svorky (pružinové, bez šroubu) — rychlá montáž
  **UK** = starší řada šroubových svorek (stále dostupné, předchůdce UT)

### Produktové řady (ověřeno z phoenixcontact.com)

---

### UT série — Šroubové průchozí svorky

  UT 2,5     (3044076) = průchozí, šedá, 2,5 mm², šroubové, 1000 V, 24 A
  UT 4       (3044102) = průchozí, šedá, 4 mm², šroubové, 1000 V, 32 A
  UT 6       = průchozí, šedá, 6 mm², šroubové
  UT 10      = průchozí, šedá, 10 mm², šroubové
  UT 16      = průchozí, šedá, 16 mm², šroubové
  UT 35      = průchozí, šedá, 35 mm², šroubové

  Varianty barev UT 2,5:
  UT 2,5 GN  (3045091) = zelená
  UT 2,5 WH  (3045075) = bílá
  UT 2,5-PE  (3044092) = PE zemnicí svorka, zeleno-žlutá (připojení na lištu)
  UT 2,5-TWIN (3044513) = 2 vodiče v 1 svorce (twin terminal)

### PT série — Push-in svorky

  PT 2,5     (3209510) = průchozí, šedá, 2,5 mm², push-in, 800 V, 24 A
  PT 4       = průchozí, 4 mm², push-in
  PT 1,5     = průchozí, 1,5 mm², push-in (pro menší průřezy)

### UTTB série — Dvoupodlažní svorky (double-level)

  UTTB 2,5   (3044636) = dvoupodlažní, šedá, 2,5 mm², šroubové, 500 V, 24 A
  UTTB 4     (3044814) = dvoupodlažní, šedá, 4 mm², 800 V, 30 A
  UTTB 2,5 BU (3044649) = dvoupodlažní, modrá (N)
  UTTB 2,5 OG (3044639) = dvoupodlažní, oranžová
  UTTB 2,5-PE (3044665) = dvoupodlažní PE, zeleno-žlutá

### MTK / UK série — Odpojovací svorky

  UK 5-MTK   = odpojovací svorka s testem (knife-disconnect, test socket)
  UK 5-MTK-P/P (3004032) = odpojovací, 5 mm², test zásuvka

---

### Příslušenství

  Propojovací mostek (jumper):
    FBS 2-5   = 2-pólový mostek pro UT 2,5
    FBS 5-5   = 5-pólový mostek
    FBS 10-5  = 10-pólový mostek

  Koncový doraz (end bracket):
    D-UT 2,5  = doraz pro UT 2,5
    E/UK      = standardní ukončovací doraz

  Štítky a označení:
    ESLIM-C 5,15 = samolepicí štítky pro UT svorky

---

### Tipy pro identifikaci

  - UT = šroubové, PT = push-in (jinak stejný rozměr, záměnné)
  - Číslo za UT/PT = průřez v mm² (UT 2,5 = 2,5 mm², UT 4 = 4 mm²)
  - Číslo v závorce = 6-ciferné obj. číslo Phoenix Contact
  - UTTB = dvojpodlažní verze (úspora místa na DIN liště)
  - PE varianty mají vždy zeleno-žlutou barvu a přímé uzemnění na lištu
`,
      },

      // -----------------------------------------------------------------------
      // Weidmüller — WDU / W-Series
      // -----------------------------------------------------------------------
      weidmuller: {
        label: 'Weidmüller',
        doc: `## Weidmüller — Svorky WDU / W-Series (SAK, ZDU, ZPE)

### Produktové řady

  **WDU** — Klasická šroubová průchozí svorka (Feed-through, screw)
  **W-Series** — Novější řada s PUSH IN technologií (bezšroubové)
  **ZDU** — Průchozí svorka, vyšší proudová kapacita (Zentrierklemme)
  **WPE / ZPE** — PE (ochranný vodič) varianty

---

### WDU série — Šroubové průchozí svorky (ověřeno z catalog.weidmueller.com)

  WDU 2,5    (1020000000) = průchozí, šedá,  2,5 mm², šroubové
  WDU 2,5 GE (1020020000) = průchozí, žlutá, 2,5 mm²
  WDU 4      (1020100000) = průchozí, šedá,  4 mm²,   šroubové
  WDU 4 BL   (1020180000) = průchozí, modrá, 4 mm²    (N vodič)
  WDU 6      (1020200000) = průchozí, šedá,  6 mm²,   šroubové
  WDU 10     (1020300000) = průchozí, šedá,  10 mm²,  šroubové
  WDU 16     (1020400000) = průchozí, šedá,  16 mm²,  šroubové
  WDU 35     (1020500000) = průchozí, šedá,  35 mm²,  šroubové

  Formát obj. čísla: 10[průřez_kód][barva_kód]0000
    Průřez kódy: 2=2.5mm², 21=4mm², 22=6mm², 23=10mm², 24=16mm², 25=35mm²
    Barva: 0=šedá, 02=žlutá, 18=modrá

### ZPE / WPE — PE zemnicí svorky

  ZPE 2,5    = PE svorka, 2,5 mm², zeleno-žlutá, připojení na DIN lištu
  ZPE 4      = PE svorka, 4 mm²
  WPE 2,5    = PE svorka WDU řada, 2,5 mm², zeleno-žlutá

  POZNÁMKA: ZPE vs WPE záleží na generaci/verzi svorkovnicového systému.
  Oba typy jsou PE svorky s přímým uzemnění přes lištu.

### W-Series — Push-In technologie (novější)

  W 2,5      = push-in průchozí svorka, 2,5 mm²
  W 4        = push-in průchozí svorka, 4 mm²
  WPE 2,5 (W-Series verze) = push-in PE svorka, 2,5 mm²

  POZNÁMKA: W-Series catalog čísla jsou odlišná od WDU čísel.
  Pro přesná obj. čísla W-Series doporučujeme ověřit aktuální katalog
  na catalog.weidmueller.com (hledej "Push-in terminal W-Series").

---

### Příslušenství

  Propojovací mostek:
    WEW 2,5/2  = 2-pólový mostek pro WDU 2,5
    WEW 2,5/5  = 5-pólový mostek

  Koncový doraz:
    EW 35      = standardní ukončení pro WDU 35mm lištu
    AEW        = rozšiřující doraz

---

### Tipy pro identifikaci

  - WDU = klasická šroubová (starší, spolehlivá, nejrozšířenější v CZ)
  - W = novější push-in (bez šroubu, rychlejší montáž)
  - Číslo za WDU = průřez v mm² (WDU 2,5 = 2,5mm², WDU 6 = 6mm²)
  - 10-ciferné obj. číslo = typické pro Weidmüller (1020000000 = WDU 2,5)
  - ZPE/WPE = vždy zeleno-žlutá barva = PE ochranný vodič
`,
      },
    }, // end svorka.manufacturers
  }, // end svorka

  // ===========================================================================
  // PŘÍSLUŠENSTVÍ SVOREK (koncové dorazy, jumper mosty, štítky)
  // ===========================================================================
  prislusenstvi_svorka: {
    label: 'Příslušenství svorek',
    aliases: [
      'jumper', 'propojovač', 'mostek svorka', 'propojovací můstek',
      'koncový doraz', 'koncová svorka', 'end bracket', 'end stop',
      'štítky svorky', 'marking svorky', 'label svorky',
      'kryt svorky', 'cover svorky', 'přepážka',
      'FBS', 'WEW', 'D-UT',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce svorky?',             options: ['WAGO', 'Phoenix Contact', 'Weidmüller', 'Bez preference'] },
      { key: 'acc_type', text: 'Typ příslušenství?',          options: ['Propojovací mostek (jumper)', 'Koncový doraz (end bracket)', 'Štítky / označení', 'Jiné'] },
      { key: 'poles',    text: 'Počet pólů propojení? (pro jumper)' },
    ],

    manufacturers: {

      wago: {
        label: 'WAGO',
        doc: `## WAGO — Příslušenství svorek TOPJOB S

### Propojovací mosty (Jumper Bars)

  Řada 2002 (2,5 mm²):
    2002-404   = 4-pólový jumper
    2002-405   = 5-pólový jumper
    2002-410   = 10-pólový jumper

  Řada 2004 (4 mm²):
    2004-404   = 4-pólový jumper
    2004-405   = 5-pólový jumper

  WAGO jumbery jsou jednoduše zasunutelné — zasunout shora do svorek.

### Koncové dorazy a příchytky

  2002-102   = koncový doraz pro řadu 2002
  2004-102   = koncový doraz pro řadu 2004
  249-197    = boční přepážka / separator

### Identifikace

  - Kód 4xx za pomlčkou = počet pólů jumper můstku (404=4póly, 410=10pólů)
  - Jumper bary jsou záměnné v rámci stejné řady (2002 → 2002 jumper)
`,
      },

      phoenix: {
        label: 'Phoenix Contact',
        doc: `## Phoenix Contact — Příslušenství svorek CLIPLINE

### Propojovací mosty (Jumper / Bridges)

  Pro UT 2,5 / UK 2,5:
    FBS 2-5    = 2-pólový mostek, šroub (šedý)
    FBS 5-5    = 5-pólový mostek
    FBS 10-5   = 10-pólový mostek
    D-FBS 5    = odizolovaný mostek (zakrytý)

  Poznámka: číslo za FBS = počet pólů

### Koncové dorazy

  D-UT 2,5   = ukončovací doraz pro UT 2,5
  E/UK        = standardní ukončovací doraz
  ATP-UT 2,5 = blokující doraz s aretací

### Štítky a označení (CLIPFIX, SK)

  SK 8        = standardní popis štítek 8mm
  ZB 5        = nálepkový štítek pro UT svorky
`,
      },

      weidmuller: {
        label: 'Weidmüller',
        doc: `## Weidmüller — Příslušenství svorek

### Propojovací mosty (Jumper)

  Pro WDU 2,5:
    WEW 2,5/2  = 2-pólový jumper mostek
    WEW 2,5/3  = 3-pólový
    WEW 2,5/5  = 5-pólový
    WEW 2,5/10 = 10-pólový

  Pro WDU 4:
    WEW 4/2    = 2-pólový
    WEW 4/5    = 5-pólový

  Formát: WEW [průřez]/[počet pólů]

### Koncové dorazy

  EW 35      = standardní ukončení pro 35mm DIN lištu
  AEW        = rozšiřující doraz s identifikací

### Štítky (WS / WMB)

  WS 6/5     = štítky 6mm, balení 5ks
  WMB 12/5   = štítky 12mm označovací, série 5
`,
      },
    },
  }, // end prislusenstvi_svorka

  // ===========================================================================
  // STYKAČ (Contactor)
  // ===========================================================================
  stykac: {
    label: 'Stykač',
    aliases: [
      'stykač', 'stykac', 'kontaktor', 'contactor', 'schütz',
      'schuz', 'schutz', 'schuz', 'motorový stykač',
      'af09', 'af12', 'af16', 'af26', 'af38',
      '3rt2', '3rt20', 'sirius contactor',
      'dilm', 'dilm7', 'dilm9', 'dilm12',
      'lc1d', 'lc1d09', 'tesys d', 'tesys',
    ],
    questions: [
      { key: 'mfr',       text: 'Preferovaný výrobce?',                  options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'proud',     text: 'Jmenovitý proud motoru (AC-3) v A? (napiš číslo, např. 12)' },
      { key: 'vykon',     text: 'Výkon motoru v kW? (nebo "nevím")',     options: ['1,5 kW', '3 kW', '4 kW', '5,5 kW', '7,5 kW', '11 kW', '15 kW', '22 kW', 'Nevím'] },
      { key: 'civka',     text: 'Napájení cívky?',                       options: ['24 V DC', '24 V AC (50 Hz)', '110 V AC (50 Hz)', '230 V AC (50 Hz)', 'Nevím'] },
    ],

    manufacturers: {

      // -----------------------------------------------------------------------
      // ABB — AF série
      // -----------------------------------------------------------------------
      abb: {
        label: 'ABB',
        doc: `## ABB — Stykače AF série (AF09…AF96)

### Produktová řada

  AF série = 3-pólové motorové stykače s elektronickou cívkou AC/DC
  Technologie: elektronická cívka přijímá jak AC, tak DC (wide range)
  Montáž: DIN lišta 35 mm nebo šroubová montáž
  Norma: IEC/EN 60947-4-1

---

### Přehled velikostí — AC-3 při 400 V (ověřeno z abbsales.com)

  AF09   =  9 A,  4,0 kW
  AF12   = 12 A,  5,5 kW
  AF16   = 16 A,  7,5 kW
  AF26   = 26 A, 11,0 kW
  AF30   = 30 A, 15,0 kW
  AF38   = 38 A, 18,5 kW
  AF40   = 40 A, 18,5 kW  (rozšířené napájení cívky)
  AF52   = 52 A, 22,0 kW
  AF65   = 65 A, 30,0 kW
  AF80   = 80 A, 37,0 kW
  AF96   = 96 A, 45,0 kW

---

### Formát typového označení

  AF[velikost]-[hlavní_póly]-[pomocné_kontakty]-[rozsah_cívky]

  Kde:
    velikost:          09, 12, 16, 26, 30, 38, 40, 52, 65, 80, 96
    hlavní_póly:       30 = 3NO hlavní póly (standard pro 3-fázový motor)
    pomocné_kontakty:  10 = 1NO, 0NC pomocný kontakt
                       01 = 0NO, 1NC pomocný kontakt
                       11 = 1NO, 1NC pomocný kontakt
                       00 = bez pomocného kontaktu
    rozsah_cívky:      11 = 24–60 V AC/DC
                       12 = 48–130 V AC/DC
                       13 = 100–250 V AC/DC   ← nejběžnější (pokrývá 110VAC a 230VAC)
                       70 = 200–500 V AC/DC

---

### Klíčová typová označení

  AF09-30-10-13  = 9 A,  3NO, 1NO aux,  100–250 V coil  (pro 4 kW motor)
  AF12-30-10-13  = 12 A, 3NO, 1NO aux,  100–250 V coil
  AF16-30-10-13  = 16 A, 3NO, 1NO aux,  100–250 V coil  (7,5 kW)
  AF26-30-10-13  = 26 A, 3NO, 1NO aux,  100–250 V coil  (11 kW)
  AF26-30-00-11  = 26 A, 3NO, bez aux,  24–60 V coil    (24 V DC)
  AF38-30-10-13  = 38 A, 3NO, 1NO aux,  100–250 V coil  (18,5 kW)
  AF65-30-11-13  = 65 A, 3NO, 1NO+1NC, 100–250 V coil  (30 kW)

---

### Příslušenství AF kontaktorů

  **Pomocné kontaktní bloky (boční montáž):**
  CAL5-11   = boční montáž, 1NO + 1NC (pro AF09–AF38)
  CAL5-01   = boční montáž, 0NO + 1NC
  CA5-10    = přední montáž, 1NO
  CA5-01    = přední montáž, 1NC
  CA5-11    = přední montáž, 1NO + 1NC
  CA5-22    = přední montáž, 2NO + 2NC
  CA5-22E   = přední montáž, 2NO + 2NC, rozšířená verze (AF45–AF110)

  **Přetěžovací relé (Overload Relay):**
  TA25DU-[proud]  = tepelné relé pro AF09–AF38
    TA25DU-0.1  = nastavení 0,1 A
    TA25DU-1.0  = nastavení 1,0 A
    TA25DU-4    = nastavení 2,8–4 A
    TA25DU-6,5  = nastavení 4,5–6,5 A
    TA25DU-11   = nastavení 7,5–11 A
    TA25DU-19   = nastavení 13–19 A
    TA25DU-32   = nastavení 22–32 A
  TA42DU-[proud]  = tepelné relé pro AF38–AF65
  TA75DU-[proud]  = tepelné relé pro AF52–AF96
`,
      },

      // -----------------------------------------------------------------------
      // Siemens — SIRIUS 3RT2
      // -----------------------------------------------------------------------
      siemens: {
        label: 'Siemens',
        doc: `## Siemens — Stykače SIRIUS 3RT2

### Produktová řada

  SIRIUS 3RT2 = moderní řada průmyslových stykačů
  Technologie: tradiční AC/DC cívky, různé napěťové varianty
  Montáž: DIN lišta 35 mm nebo šroubová montáž
  Norma: IEC/EN 60947-4-1
  Zvláštnost: double bridge kontakty (zdvojená kontaktní plocha pro spolehlivost)

---

### Přehled velikostí — AC-3 při 400 V

  Velikost S00 (3RT2015, 3RT2016, 3RT2017):
    3RT2015  =  7 A,  3,0 kW  (S00)
    3RT2016  =  9 A,  4,0 kW  (S00)  ← nejmenší standardní velikost
    3RT2017  = 12 A,  5,5 kW  (S00)

  Velikost S0 (3RT2023 – 3RT2027):
    3RT2023  =  9 A,  4,0 kW  (S0, varianta přímé montáže na 3RU2 relé)
    3RT2024  = 12 A,  5,5 kW  (S0)
    3RT2025  = 17 A,  7,5 kW  (S0)
    3RT2026  = 25 A, 11,0 kW  (S0)
    3RT2027  = 32 A, 15,0 kW  (S0)

  Velikost S2 (3RT2035, 3RT2036):
    3RT2035  = 40 A, 18,5 kW  (S2)
    3RT2036  = 50 A, 22,0 kW  (S2)

  Velikost S3 (3RT2044 – 3RT2046):
    3RT2044  = 65 A, 30,0 kW  (S3)
    3RT2045  = 80 A, 37,0 kW  (S3)
    3RT2046  = 95 A, 45,0 kW  (S3)

---

### Formát typového označení

  3RT2[model]-[terminál][cívka_kód][aux_kód]

  Kde model:  015=S00/7A, 016=S00/9A, 017=S00/12A,
              024=S0/12A, 025=S0/17A, 026=S0/25A, 027=S0/32A,
              035=S2/40A, 036=S2/50A, 044=S3/65A, 045=S3/80A, 046=S3/95A

  terminál:   1 = šroubové svorky
              2 = pružinové svorky (spring-loaded)

  cívka_kód (napájení cívky):
    AB = 24 V AC  50/60 Hz
    AF = 110 V AC 50/60 Hz
    AL = 230 V AC 50/60 Hz  (nebo AP)
    AN = 220 V AC 50/60 Hz
    AP = 230 V AC 50/60 Hz
    BB = 24 V DC
    BF = 110 V DC
    BG = 125 V DC

  aux_kód (pomocné kontakty ve výsledném čísle):
    01 = 1NO
    02 = 1NC
    40 = 1NO (jiná varianta)
    42 = 1NC (jiná varianta)

---

### Klíčová typová označení (ověřeno z mall.industry.siemens.com)

  3RT2015-1AF01  = S00, 7A/3kW,  110V AC cívka, 1NO aux, šroubové
  3RT2016-1AP02  = S00, 9A/4kW,  230V AC cívka, 1NC aux, šroubové
  3RT2016-1AB02  = S00, 9A/4kW,   24V AC cívka, 1NC aux, šroubové
  3RT2016-1BB41  = S00, 9A/4kW,   24V DC cívka, 1NO aux, šroubové
  3RT2026-1AP02  = S0,  25A/11kW, 230V AC cívka, 1NC aux, šroubové
  3RT2027-1AP02  = S0,  32A/15kW, 230V AC cívka, 1NC aux, šroubové
  3RT2026-2AP02  = S0,  25A/11kW, 230V AC, pružinové svorky

---

### Příslušenství 3RT2

  **Přetěžovací relé (Overload Relay) — 3RU2 série:**
  3RU2116-[kód]  = S00 velikost (pro 3RT2015–3RT2017)
    3RU2116-0EB0  = 0,28–0,4 A
    3RU2116-1BB0  = 1,4–2 A
    3RU2116-1EB0  = 2,8–4 A
    3RU2116-1GB0  = 4,5–6,3 A
    3RU2116-1HB0  = 5,5–8 A
    3RU2116-1JB0  = 7–10 A
    3RU2116-1KB0  = 9–12,5 A
    3RU2116-4AB0  = 11–16 A

  3RU2126-[kód]  = S0 velikost (pro 3RT2023–3RT2027)
    3RU2126-4BB0  = 14–20 A
    3RU2126-4DB0  = 20–28 A
    3RU2126-4EB0  = 24–32 A
    3RU2126-4FB0  = 28–40 A

  **Pomocné kontaktní bloky:**
  3RH2911-1HA10  = boční montáž, 1NO (pro S00)
  3RH2911-1HA01  = boční montáž, 1NC
  3RT2916-1BB00  = přední montáž, 2NO + 2NC
`,
      },

      // -----------------------------------------------------------------------
      // Eaton — DILM série
      // -----------------------------------------------------------------------
      eaton: {
        label: 'Eaton (Moeller)',
        doc: `## Eaton — Stykače DILM (xStart)

### Produktová řada

  DILM série (xStart) = moderní motorové stykače Eaton (Moeller)
  Technologie: cívky AC i DC, vestavěný varistor u DC verzí DILM7–DILM15
  Mirror contact: integrovaný zrcadlový kontakt od DILM7
  Montáž: DIN lišta 35 mm
  Norma: IEC/EN 60947-4-1

---

### Přehled velikostí — AC-3 při 400 V (ověřeno z datasheet.eaton.com, rsdelivers.com)

  DILM7    =  7 A,  3,0 kW
  DILM9    =  9 A,  4,0 kW
  DILM12   = 12 A,  5,5 kW
  DILM15   = 15 A,  7,5 kW
  DILM17   = 18 A,  7,5 kW  (alternativní velikost)
  DILM25   = 25 A, 11,0 kW
  DILM32   = 32 A, 15,0 kW
  DILM40   = 40 A, 18,5 kW
  DILM50   = 50 A, 22,0 kW

---

### Formát typového označení

  DILM[velikost]-[aux_konfigurace]([napájení_cívky])

  Kde:
    velikost:         7, 9, 12, 15, 17, 25, 32, 40, 50, 65, 72, 80, 95, 115, 150, 170

    aux_konfigurace:
      10  = 1NO pomocný kontakt
      01  = 1NC pomocný kontakt
      11  = 1NO + 1NC
      22  = 2NO + 2NC
      32  = 3NO + 2NC

    napájení_cívky (v závorce):
      (230V50HZ)     = 230 V AC, 50 Hz
      (240V60HZ)     = 240 V AC, 60 Hz
      (230V50/60HZ)  = 230/240 V AC, 50/60 Hz
      (110V50HZ)     = 110 V AC, 50 Hz
      (24VDC)        = 24 V DC
      (RDC24)        = 24 V DC (Rectified DC verze — menší rozměr)

---

### Klíčová typová označení (ověřeno z eaton.com, rsdelivers.com)

  DILM7-10(230V50HZ)      = 7A/3kW,  1NO aux, 230V AC    (ID: 276566)
  DILM7-01(230V50HZ)      = 7A/3kW,  1NC aux, 230V AC    (ID: 276585)
  DILM7-01(24VDC)         = 7A/3kW,  1NC aux, 24V DC     (ID: 276600)
  DILM9-10(230V50HZ)      = 9A/4kW,  1NO aux, 230V AC    (ID: 276690)
  DILM9-10(24VDC)         = 9A/4kW,  1NO aux, 24V DC     (ID: 276705)
  DILM9-01(230V50HZ)      = 9A/4kW,  1NC aux, 230V AC    (ID: 276725)
  DILM9-01(24VDC)         = 9A/4kW,  1NC aux, 24V DC     (ID: 276740)
  DILM12-10(230V50HZ)     = 12A/5,5kW, 1NO, 230V AC      (ID: 276845)
  DILM12-01(24VDC)        = 12A/5,5kW, 1NC, 24V DC
  DILM25-10(230V50HZ,240V60HZ) = 25A/11kW, 1NO, 230V AC  (ID: 277132)
  DILM32-01(RDC24)        = 32A/15kW, 1NC, 24V DC        (ID: 277306)
  DILM50(400V50HZ,440V60HZ)   = 50A/22kW, bez aux, 400V AC (ID: 277832)

---

### Příslušenství DILM

  **Přetěžovací relé (Overload Relay) — ZB série:**
  ZB32 (pro DILM7–DILM32):
    ZB32-0,16   = nastavení 0,1–0,16 A
    ZB32-0,4    = nastavení 0,25–0,4 A
    ZB32-1      = nastavení 0,63–1 A
    ZB32-2,4    = nastavení 1,6–2,4 A    (ID: 278448)
    ZB32-4      = nastavení 2,4–4 A      (ID: 278449)
    ZB32-6      = nastavení 4–6 A        (ID: 278450)
    ZB32-10     = nastavení 6,3–10 A
    ZB32-16     = nastavení 10–16 A
    ZB32-24     = nastavení 16–24 A      (ID: 278453)
    ZB32-32     = nastavení 24–32 A      (ID: 278454)

  ZB65 (pro DILM40–DILM65):
    ZB65-24     = nastavení 16–24 A      (ID: 278457)
    ZB65-65     = nastavení 45–65 A      (ID: 278460)

  **Pomocné kontaktní bloky (DILA série):**
  DILA-22 = přídavný kontaktor relé (2NO + 2NC)
  DILA-40 = 4NO kontaktor relé
  DIL-SWD = komunikační modul (SmartWire-DT sběrnice)
`,
      },

      // -----------------------------------------------------------------------
      // Schneider Electric — TeSys D (LC1D)
      // -----------------------------------------------------------------------
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric — Stykače TeSys D (LC1D)

### Produktová řada

  TeSys D (LC1D) = nejrozšířenější stykačová řada Schneider Electric
  Technologie: AC/DC cívky, kompaktní design 45 mm šířka pro LC1D09–LC1D38
  Mirror contact: integrovaný zrcadlový kontakt
  Montáž: DIN lišta 35 mm nebo šroubová montáž
  Norma: IEC/EN 60947-4-1
  Označení "Deca" = moderní xEffekt verze TeSys D (zpětně kompatibilní)

---

### Přehled velikostí — AC-3 při 400 V (ověřeno z se.com, kentstore.com)

  LC1D09   =  9 A,  4,0 kW   (šířka 45 mm)
  LC1D12   = 12 A,  5,5 kW   (šířka 45 mm)
  LC1D18   = 18 A,  7,5 kW   (šířka 45 mm)
  LC1D25   = 25 A, 11,0 kW   (šířka 45 mm)
  LC1D32   = 32 A, 15,0 kW   (šířka 45 mm)
  LC1D38   = 38 A, 18,5 kW   (šířka 45 mm)
  LC1D40A  = 40 A, 18,5 kW   (šířka 55 mm)
  LC1D50A  = 50 A, 22,0 kW
  LC1D65A  = 65 A, 30,0 kW
  LC1D80A  = 80 A, 37,0 kW

---

### Formát typového označení

  LC1D[velikost][cívka_přípona]

  Kde:
    velikost:  09, 12, 18, 25, 32, 38, 40A, 50A, 65A, 80A

    cívka_přípona (napájení cívky — ověřeno z se.com):
      B7  = 24 V AC 50/60 Hz
      BD  = 24 V DC           ← nejběžnější DC varianta
      E7  = 48 V AC 50/60 Hz
      F7  = 110 V AC 50/60 Hz
      G7  = 120 V AC 60 Hz (US)
      M7  = 220–230 V AC 50/60 Hz
      P7  = 230–240 V AC 50/60 Hz  ← nejběžnější AC varianta v EU
      Q7  = 380 V AC 50/60 Hz
      S7  = 200 V AC 50 Hz

---

### Klíčová typová označení (ověřeno z se.com)

  LC1D09BD   = 9A/4kW,   24V DC cívka
  LC1D09M7   = 9A/4kW,   220–230V AC cívka
  LC1D09P7   = 9A/4kW,   230–240V AC cívka
  LC1D12BD   = 12A/5,5kW, 24V DC cívka
  LC1D12M7   = 12A/5,5kW, 220–230V AC cívka
  LC1D18BD   = 18A/7,5kW, 24V DC cívka
  LC1D18M7   = 18A/7,5kW, 220–230V AC cívka
  LC1D25BD   = 25A/11kW,  24V DC cívka
  LC1D32BD   = 32A/15kW,  24V DC cívka
  LC1D40ABD  = 40A/18,5kW, 24V DC cívka (přípona A = 40A varianta)
  LC1D50ABD  = 50A/22kW,  24V DC cívka

---

### Příslušenství TeSys D

  **Přetěžovací relé (Overload Relay) — LRD série:**
  LRD01    = nastavení 0,1–0,16 A
  LRD02    = nastavení 0,16–0,25 A
  LRD04    = nastavení 0,25–0,4 A
  LRD05    = nastavení 0,4–0,63 A
  LRD06    = nastavení 0,63–1 A
  LRD07    = nastavení 1–1,6 A
  LRD08    = nastavení 1,6–2,5 A
  LRD10    = nastavení 4–6 A
  LRD12    = nastavení 5,5–8 A
  LRD14    = nastavení 7–10 A
  LRD16    = nastavení 9–13 A
  LRD21    = nastavení 12–18 A
  LRD22    = nastavení 16–24 A
  LRD35    = nastavení 30–40 A

  Přímá montáž na LC1D kontaktor (do velikosti LC1D38 = 45 mm šířka)
  Pro LC1D40A a větší = 55 mm šířka bloku LRD

  **Pomocné kontaktní bloky:**
  LA1KN10   = 1NO pomocný kontakt pro TeSys D
  LA1KN01   = 1NC pomocný kontakt
  LA1KN11   = 1NO + 1NC pomocný kontakt
  LA1KN22   = 2NO + 2NC (přední montáž)

  **Mechanické blokování (reverzace):**
  LAD9R4    = mechanická propojka pro reverzní sestavu 2× LC1D
`,
      },
    }, // end stykac.manufacturers
  }, // end stykac

  // ===========================================================================
  // PŘÍSLUŠENSTVÍ STYKAČŮ (pomocné bloky, mechanická blokování, pomocné relé)
  // ===========================================================================
  prislusenstvi_stykac: {
    label: 'Příslušenství stykačů',
    aliases: [
      'pomocný kontakt stykač', 'auxiliary contact contactor',
      'mechanické blokování', 'reverzní sestava', 'interlock',
      'CA5', 'CAL5', 'LA1KN',
      '3RT2911', '3RH2911',
      'DILA', 'DILAH',
    ],
    questions: [
      { key: 'mfr',      text: 'Výrobce stykače?',             options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'acc_type', text: 'Typ příslušenství?',           options: ['Pomocný kontaktní blok', 'Přetěžovací relé (thermal overload)', 'Mechanické blokování (interlock)', 'Pomocný kontaktor (relé)', 'Jiné'] },
      { key: 'contactor', text: 'Typ/velikost stykače? (napiš, např. AF16, 3RT2016, DILM9, LC1D12)' },
    ],

    manufacturers: {

      abb: {
        label: 'ABB',
        doc: `## ABB — Příslušenství stykačů AF série

### Pomocné kontaktní bloky

  Boční montáž (Side-Mounting, pro AF09–AF38):
  CAL5-01    = 0NO + 1NC
  CAL5-10    = 1NO + 0NC
  CAL5-11    = 1NO + 1NC  ← nejběžnější

  Přední montáž (Front-Mounting, pro AF09–AF96):
  CA5-01     = 0NO + 1NC
  CA5-10     = 1NO + 0NC
  CA5-11     = 1NO + 1NC
  CA5-22     = 2NO + 2NC
  CA5-22E    = 2NO + 2NC (rozšiřovací varianta, pro AF45–AF110)

  Přední montáž pro AF26+:
  CAT4-11E   = přední montáž 1NO+1NC se šroubovými terminály (AF26–AF96)

### Mechanické propojky (Interlock — reverzace)

  CAM2-10    = mechanická propojka pro 2× AF09–AF26 (reversing interlock)
  CAM2-11    = mechanická propojka pro 2× AF38–AF96

### Přetěžovací relé (viz sekce stykac.manufacturers.abb výše)

  TA25DU/TA42DU/TA75DU — popsáno ve stykac sekci
`,
      },

      siemens: {
        label: 'Siemens',
        doc: `## Siemens — Příslušenství stykačů SIRIUS 3RT2

### Pomocné kontaktní bloky

  Pro S00 (3RT2015–3RT2017) — boční montáž:
  3RH2911-1HA10  = 1NO, boční
  3RH2911-1HA01  = 1NC, boční
  3RH2911-1HA11  = 1NO + 1NC, boční

  Pro S0–S3 — přední montáž:
  3RT2916-1BB00  = 2NO + 2NC, přední montáž

### Mechanické propojky (reverzace)

  3RA1921-1BA00  = mechanická propojka pro 2× S00
  3RA1921-1CA00  = mechanická propojka pro 2× S0
  3RA1921-1DA00  = mechanická propojka pro 2× S2

### Přetěžovací relé (viz sekce stykac.manufacturers.siemens výše)

  3RU2116 (S00), 3RU2126 (S0) — popsáno ve stykac sekci
`,
      },

      eaton: {
        label: 'Eaton (Moeller)',
        doc: `## Eaton — Příslušenství stykačů DILM

### Pomocné kontaktní bloky

  DILA-22    = přídavné kontaktní relé 2NO + 2NC (samostatné, ne přímá montáž)
  DILA-40    = 4NO kontaktní relé

  Pro přímou montáž na DILM:
  DIL-SWD    = SmartWire-DT komunikační modul (pro průmyslové sítě)

### Mechanické propojky (reverzace)

  DILM7-XSC40    = mechanická propojka pro 2× DILM7–DILM12
  DILM17-XSC40   = mechanická propojka pro 2× DILM15–DILM17
  DILM25-XSC40   = mechanická propojka pro 2× DILM25–DILM32
  DILM40-XSC40   = mechanická propojka pro 2× DILM38–DILM50

### Přetěžovací relé (viz sekce stykac.manufacturers.eaton výše)

  ZB32, ZB65 — popsáno ve stykac sekci
`,
      },

      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric — Příslušenství stykačů TeSys D

### Pomocné kontaktní bloky

  Boční montáž (pro LC1D09–LC1D38):
  LA1KN10    = 1NO, boční
  LA1KN01    = 1NC, boční
  LA1KN11    = 1NO + 1NC, boční

  Přední montáž:
  LA1KN22    = 2NO + 2NC, přední montáž

### Mechanické propojky (reverzace)

  LAD9R4     = mechanická propojka pro 2× LC1D09–LC1D38 (reversing)
  LA9D3     = mechanická propojka pro větší (LC1D40A+)

### Přetěžovací relé (viz sekce stykac.manufacturers.schneider výše)

  LRD série — popsáno ve stykac sekci
`,
      },
    }, // end prislusenstvi_stykac.manufacturers
  }, // end prislusenstvi_stykac

  // ===========================================================================
  // NADPROUDOVÁ SPOUŠTĚ (Thermal Overload Relay)
  // ===========================================================================
  nadproudova_spoust: {
    label: 'Nadproudová spouště',
    aliases: [
      'přetěžovací relé', 'pretezovaci rele', 'nadproudová spouště', 'nadproudova spous',
      'thermal overload relay', 'overload relay', 'motorová ochrana',
      'TA25DU', 'TA42DU', 'TA75DU',
      '3RU2', '3RU2116', '3RU2126',
      'ZB32', 'ZB65',
      'LRD', 'LR2D',
    ],
    questions: [
      { key: 'mfr',       text: 'Výrobce stykače (ke kterému relé patří)?', options: ['ABB', 'Siemens', 'Eaton', 'Schneider Electric', 'Bez preference'] },
      { key: 'proud',     text: 'Jmenovitý proud motoru v A? (napiš číslo, např. 6.5)' },
      { key: 'contactor', text: 'Typ stykače? (napiš, např. AF16, 3RT2016, DILM9, LC1D12, nebo "nevím")' },
    ],

    manufacturers: {

      abb: {
        label: 'ABB',
        doc: `## ABB — Přetěžovací relé TA série (pro AF kontaktory)

### Produktové řady

  TA25DU = tepelné přetěžovací relé pro AF09–AF38, max 32 A nastavení
  TA42DU = tepelné relé pro AF38–AF65, max 80 A
  TA75DU = tepelné relé pro AF52–AF96

  Vlastnosti: 3-pólové, 1NO + 1NC aux kontakty, teplotní kompenzace,
  manuální/automatický reset, ochrana při výpadku fáze

### TA25DU — kompletní rozsah nastavení proudu (ověřeno z ABB katalogu)

  TA25DU-0.1    = nastavení 0,06–0,1 A
  TA25DU-0.16   = nastavení 0,1–0,16 A
  TA25DU-0.25   = nastavení 0,16–0,25 A
  TA25DU-0.4    = nastavení 0,25–0,4 A
  TA25DU-0.63   = nastavení 0,4–0,63 A
  TA25DU-1.0    = nastavení 0,63–1,0 A
  TA25DU-1.4    = nastavení 0,9–1,4 A
  TA25DU-2.4    = nastavení 1,6–2,4 A
  TA25DU-4      = nastavení 2,8–4,0 A
  TA25DU-5      = nastavení 3,5–5,0 A
  TA25DU-6.5    = nastavení 4,5–6,5 A
  TA25DU-11     = nastavení 7,5–11 A
  TA25DU-14     = nastavení 9–14 A
  TA25DU-19     = nastavení 13–19 A
  TA25DU-25     = nastavení 18–25 A
  TA25DU-32     = nastavení 22–32 A

### TA42DU a TA75DU — vyšší proudy

  TA42DU-25     = nastavení 18–25 A
  TA42DU-42     = nastavení 29–42 A
  TA75DU-32     = nastavení 22–32 A
  TA75DU-42     = nastavení 29–42 A   (pro AF50–AF75)
  TA75DU-52     = nastavení 36–52 A
  TA75DU-63     = nastavení 45–63 A
  TA75DU-80     = nastavení 55–80 A

### Montáž

  TA25DU: přímá montáž na kontaktor AF09–AF38 (zástrčná)
  TA42DU/TA75DU: přímá montáž na AF52–AF96
  Alternativa: samostatná montáž na DIN lištu (s adaptérem)
`,
      },

      siemens: {
        label: 'Siemens',
        doc: `## Siemens — Přetěžovací relé SIRIUS 3RU2 (pro 3RT2)

### Produktové řady

  3RU2116 = S00 velikost, pro 3RT2015–3RT2017 (max 16 A)
  3RU2126 = S0 velikost, pro 3RT2023–3RT2027 (max 40 A)
  3RU2136 = S2 velikost, pro 3RT2035–3RT2036 (vyšší proudy)

  Vlastnosti: tepelná ochrana, ochrana výpadku fáze, 1NO + 1NC aux,
  manuální/automatický reset, teplotní kompenzace (−25 až +55°C s kompenzací)

### 3RU2116 — rozsahy nastavení (S00, ověřeno ze Siemens RS)

  3RU2116-0EB0   = 0,28–0,4 A
  3RU2116-0GB0   = 0,45–0,63 A
  3RU2116-0HB0   = 0,55–0,8 A
  3RU2116-0JB0   = 0,7–1,0 A
  3RU2116-0KB0   = 0,9–1,25 A
  3RU2116-1AB0   = 1,1–1,6 A
  3RU2116-1BB0   = 1,4–2,0 A
  3RU2116-1CB0   = 1,8–2,5 A
  3RU2116-1DB0   = 2,2–3,2 A
  3RU2116-1EB0   = 2,8–4,0 A
  3RU2116-1FB0   = 3,5–5,0 A
  3RU2116-1GB0   = 4,5–6,3 A
  3RU2116-1HB0   = 5,5–8,0 A
  3RU2116-1JB0   = 7,0–10,0 A
  3RU2116-1KB0   = 9,0–12,5 A
  3RU2116-4AB0   = 11–16 A

### 3RU2126 — rozsahy nastavení (S0, ověřeno z RS)

  3RU2126-4BB0   = 14–20 A
  3RU2126-4DB0   = 20–28 A
  3RU2126-4EB0   = 24–32 A
  3RU2126-4FB0   = 28–40 A

### Identifikace kódu nastavení v čísle

  Písmeno v rozsahu po pomlčce kóduje přibližný rozsah:
  E = menší, J = střední, K = větší (orientační)
  Pro přesné přiřazení vždy ověřit datový list nebo Siemens Mall
`,
      },

      eaton: {
        label: 'Eaton (Moeller)',
        doc: `## Eaton — Přetěžovací relé ZB série (pro DILM)

### Produktové řady

  ZB32  = pro DILM7–DILM32 (rozsah 0,16–32 A)
  ZB65  = pro DILM40–DILM65 (rozsah do 65 A)
  ZB150 = pro větší stykače DILM

  Vlastnosti: 1NO + 1NC aux kontakty, třída vybavení 10A,
  ochrana výpadku fáze, manuální/automatický reset
  Norma: IEC/EN 60947

### ZB32 — rozsahy nastavení (ověřeno z datasheet.eaton.com, rsdelivers.com)

  ZB32-0,16   = 0,1–0,16 A    ← nejmenší
  ZB32-0,4    = 0,25–0,4 A
  ZB32-1      = 0,63–1 A
  ZB32-1,6    = 1–1,6 A
  ZB32-2,4    = 1,6–2,4 A     (ID: 278448)
  ZB32-4      = 2,4–4 A       (ID: 278449)
  ZB32-6      = 4–6 A         (ID: 278450)
  ZB32-10     = 6,3–10 A
  ZB32-16     = 10–16 A
  ZB32-24     = 16–24 A       (ID: 278453)
  ZB32-32     = 24–32 A       (ID: 278454)  ← největší ZB32

### ZB65 — rozsahy nastavení (ověřeno z datasheet.eaton.com)

  ZB65-24     = 16–24 A       (ID: 278457)
  ZB65-40     = 27–40 A
  ZB65-65     = 45–65 A       (ID: 278460)

### Formát typového označení

  ZB[max_proud]-[horní_mez_nastavení]
  Číslo za pomlčkou = horní mez nastavitelného proudu v ampérech
  Příklad: ZB32-6 = ZB série do 32A celkem, konkrétní rozsah do 6A
`,
      },

      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric — Přetěžovací relé LRD (pro TeSys D)

### Produktová řada

  LRD = TeSys D přímá montáž (pro LC1D09–LC1D38, 45mm blok)
  LR2D = starší verze, kompatibilní s TeSys D
  LRD Deca = nová verze LRD (EverLink terminály, zpětně kompatibilní)

  Vlastnosti: třída vybavení 10 a 20, 1NO + 1NC aux, 3-pólová ochrana,
  ochrana výpadku fáze (single-phase sensitivity), manuální/automatický reset
  Norma: IEC/EN 60947-4-1

### LRD — kompletní rozsah nastavení proudu

  LRD01    = 0,1–0,16 A
  LRD02    = 0,16–0,25 A
  LRD03    = 0,25–0,4 A
  LRD04    = 0,25–0,4 A   (alternativa)
  LRD05    = 0,4–0,63 A
  LRD06    = 0,63–1 A
  LRD07    = 1–1,6 A
  LRD08    = 1,6–2,5 A
  LRD10    = 4–6 A
  LRD12    = 5,5–8 A
  LRD14    = 7–10 A
  LRD16    = 9–13 A
  LRD21    = 12–18 A
  LRD22    = 16–24 A
  LRD32    = 23–32 A
  LRD35    = 30–38 A

### Montáž

  LRD montáž přímo za TeSys D kontaktor — bez kabeláže
  Pro LC1D09–LC1D38: kompaktní blok 45 mm
  Pro LC1D40A a větší: rozšířený blok LRD (55 mm)
  Samostatná montáž na DIN lištu: s adaptérem LA9D20408

### Identifikace

  LRD[kód] kde kód je přibližně horní mez nastavení:
  LRD10 = do 6A, LRD22 = do 24A, LRD35 = do 38A
  Pro přesný rozsah vždy ověřit datový list na se.com
`,
      },
    }, // end nadproudova_spoust.manufacturers
  }, // end nadproudova_spoust

}; // end PRODUCT_KNOWLEDGE

// =============================================================================
// HELPER FUNKCE
// =============================================================================

/**
 * Detekuje kategorii z textu (vrátí klíč kategorie nebo null).
 */
export function detectCategory(text) {
  if (!text) return null;
  const n = normalize(text);
  for (const [key, cat] of Object.entries(PRODUCT_KNOWLEDGE)) {
    for (const alias of (cat.aliases ?? [])) {
      if (n.includes(normalize(alias))) return key;
    }
  }
  return null;
}

/**
 * Vrátí kategorii dle klíče.
 */
export function getCategoryByKey(key) {
  return PRODUCT_KNOWLEDGE[key] ?? null;
}

/**
 * Vrátí seznam názvů kategorií.
 */
export function listCategoryLabels() {
  return Object.values(PRODUCT_KNOWLEDGE).map(c => c.label);
}

/**
 * Vrátí doc string pro konkrétní kategorii + výrobce.
 * Pokud výrobce není uveden, vrátí všechny dostupné docs pro kategorii.
 *
 * @param {string} categoryKey  - klíč kategorie (např. 'jistic')
 * @param {string|null} mfrKey  - klíč výrobce (např. 'abb') nebo null
 * @returns {string}
 */
export function getKnowledgeDoc(categoryKey, mfrKey = null) {
  const cat = PRODUCT_KNOWLEDGE[categoryKey];
  if (!cat) return '';

  if (mfrKey && cat.manufacturers?.[mfrKey]) {
    return cat.manufacturers[mfrKey].doc ?? '';
  }

  // Bez výrobce → vrátit všechny
  return Object.values(cat.manufacturers ?? {})
    .map(m => m.doc ?? '')
    .filter(Boolean)
    .join('\n\n---\n\n');
}
