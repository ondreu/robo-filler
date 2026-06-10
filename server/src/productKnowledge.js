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
        doc: `## Siemens — Jističe SENTRON 5SY6 / 5SY7

### Produktové řady

**5SY6** — Standardní SENTRON MCB, Icn = 6 kA (IEC/EN 60898-1)
  Charakteristiky: B, C, D
  Konfigurace: 1P, 2P, 3P, 4P (a 1P+N, 3P+N)
  Šířka: 1 modul = 18 mm na pól

**5SY7** — Průmyslový MCB, Icu = 15 kA (IEC/EN 60947-2)
  Charakteristiky: B, C, D
  Vhodné pro průmyslové napájení, generátory, těžký průmysl

---

### Formát typového označení (ověřeno z RS Components, Siemens Mall)

  5SY[série][P][AA]-[X]

  Kde:
    série:  6 = 5SY6 (6 kA), 7 = 5SY7 (15 kA)
    P:      počet pólů (1 = 1P, 2 = 2P, 3 = 3P, 4 = 4P)
    AA:     jmenovitý proud — přímá 2-ciferná hodnota
              06 = 6 A, 10 = 10 A, 13 = 13 A, 16 = 16 A,
              20 = 20 A, 25 = 25 A, 32 = 32 A, 40 = 40 A, 63 = 63 A
    -X:     vypínací charakteristika v sufixu
              -6 = křivka B  (3–5×In)
              -7 = křivka C  (5–10×In)  ← nejběžnější
              -8 = křivka D  (10–20×In)

  Příklady:
    5SY6316-7 = 5SY6, 3P, C křivka, 16 A
    5SY7325-7 = 5SY7, 3P, C křivka, 25 A
    5SY6106-6 = 5SY6, 1P, B křivka, 6 A

---

### Přehled dostupných proudů

  1 | 2 | 3 | 4 | 6 | 8 | 10 | 13 | 16 | 20 | 25 | 32 | 40 | 50 | 63 A

---

### Klíčová typová označení — 5SY6 (6 kA, ověřeno z RS Components / Siemens Mall)

  1P (šroubové):
    5SY6106-6  = 1P, B, 6 A     5SY6110-6  = 1P, B, 10 A    5SY6116-6  = 1P, B, 16 A
    5SY6106-7  = 1P, C, 6 A     5SY6110-7  = 1P, C, 10 A    5SY6116-7  = 1P, C, 16 A
    5SY6125-7  = 1P, C, 25 A    5SY6110-8  = 1P, D, 10 A    5SY6116-8  = 1P, D, 16 A

  2P:
    5SY6206-6  = 2P, B, 6 A     5SY6210-6  = 2P, B, 10 A    5SY6216-6  = 2P, B, 16 A
    5SY6206-7  = 2P, C, 6 A     5SY6210-7  = 2P, C, 10 A    5SY6216-7  = 2P, C, 16 A
    5SY6225-7  = 2P, C, 25 A

  3P:
    5SY6306-6  = 3P, B, 6 A     5SY6310-6  = 3P, B, 10 A    5SY6316-6  = 3P, B, 16 A
    5SY6306-7  = 3P, C, 6 A     5SY6310-7  = 3P, C, 10 A    5SY6316-7  = 3P, C, 16 A
    5SY6325-7  = 3P, C, 25 A    5SY6332-7  = 3P, C, 32 A
    5SY6306-8  = 3P, D, 6 A     5SY6316-8  = 3P, D, 16 A

  4P:
    5SY6406-6  = 4P, B, 6 A
    5SY6410-7  = 4P, C, 10 A    5SY6416-7  = 4P, C, 16 A    5SY6425-7  = 4P, C, 25 A

### Klíčová typová označení — 5SY7 (15 kA, ověřeno z RS Components)

    5SY7106-6  = 1P, B, 6 A     5SY7116-6  = 1P, B, 16 A
    5SY7106-7  = 1P, C, 6 A     5SY7116-7  = 1P, C, 16 A
    5SY7206-6  = 2P, B, 6 A     5SY7206-7  = 2P, C, 6 A     5SY7210-7  = 2P, C, 10 A
    5SY7306-7  = 3P, C, 6 A     5SY7310-7  = 3P, C, 10 A    5SY7316-7  = 3P, C, 16 A
    5SY7325-7  = 3P, C, 25 A    5SY7332-7  = 3P, C, 32 A
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

  A9F73106  = iC60N, 1P, B křivka,  6 A
  A9F73110  = iC60N, 1P, B křivka, 10 A
  A9F73116  = iC60N, 1P, B křivka, 16 A
  A9F74106  = iC60N, 1P, C křivka,  6 A
  A9F74110  = iC60N, 1P, C křivka, 10 A
  A9F74206  = iC60N, 2P, C křivka,  6 A
  A9F74210  = iC60N, 2P, C křivka, 10 A
  A9F74316  = iC60N, 3P, C křivka, 16 A
  A9F74325  = iC60N, 3P, C křivka, 25 A
  A9F74332  = iC60N, 3P, C křivka, 32 A
  A9F75316  = iC60N, 3P, D křivka, 16 A
  A9F74610  = iC60N, 1P+N, C křivka, 10 A

---

### Příslušenství (A9 kompatibilní)

  OF (pomocný kontakt):    A9A26924 = 1NO+1NC pro iC60N
                           A9A26925 = 2NO
                           A9A26926 = 2NC
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

### Kódování typových čísel (platí pro všechny řady TOPJOB S)

  Kód za pomlčkou určuje funkci svorky (stejný vzor přes všechny průřezy):
    xx01  = průchozí (feed-through), šedá
    xx04  = modrá (neutrální vodič N)
    xx07  = zeleno-žlutá (PE — ochranný/zemnicí vodič)
    xx01  (verze bez konektoru) a další varianty dle řady

### Řada 2002 — 2,5 mm², 24 A, 800 V (nejpoužívanější)

  2002-1201  = průchozí svorka, šedá, 2,5 mm², Push-in CAGE CLAMP®
  2002-1204  = průchozí svorka, modrá (N vodič), 2,5 mm²
  2002-1207  = PE zemnicí svorka, zeleno-žlutá, 2,5 mm²
  2002-2201  = dvoupodlažní (double-deck) svorka, šedá, 2,5 mm²

### Řada 2004 — 4 mm², 32 A, 800 V

  2004-1201  = průchozí svorka, šedá, 4 mm²
  2004-1207  = PE zemnicí svorka, zeleno-žlutá, 4 mm²

### Řada 2006 — 6 mm², 41 A, 800 V

  2006-1201  = průchozí svorka, šedá, 6 mm²
  2006-1204  = průchozí svorka, modrá (N vodič), 6 mm²
  2006-1207  = PE zemnicí svorka, zeleno-žlutá, 6 mm²

### Řada 2010 — 10 mm², 57 A, 800 V

  2010-1201  = průchozí svorka, šedá, 10 mm²
  2010-1207  = PE zemnicí svorka, zeleno-žlutá, 10 mm²

### Řada 2016 — 16 mm², 76 A, 800 V

  2016-1201  = průchozí svorka, šedá, 16 mm²
  2016-1204  = průchozí svorka, modrá (N vodič), 16 mm²
  2016-1207  = PE zemnicí svorka, zeleno-žlutá, 16 mm²

---

### Příslušenství TOPJOB S (jumper, dorazy)

  2002-404   = propojovací mostek (jumper bar) pro řadu 2002, 4-pólový
  2004-404   = propojovací mostek pro řadu 2004
  2002-405   = 5-pólový jumper pro 2002
  2002-1291  = koncový doraz (end bracket/stopper) pro 2002

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
  - Číslo řady udává průřez: 2002=2,5mm², 2004=4mm², 2006=6mm², 2010=10mm², 2016=16mm²
  - Kód 1207 = PE terminál (zeleno-žlutá) v dané řadě
  - Kód 1204 = modrá (neutrální N) ve stejné řadě
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
  UK 5-MTK-P/P (3004032) = odpojovací, do 4 mm², test zásuvka (číslo "5" = označení série, nikoliv průřez)

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
  - Číslo v závorce = 7-místné obj. číslo Phoenix Contact
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

  WDU 2,5    (1020000000) = průchozí, béžová,  2,5 mm², šroubové
  WDU 2,5 GE (1020020000) = průchozí, žlutá,  2,5 mm²
  WDU 4      (1020100000) = průchozí, béžová,  4 mm²,   šroubové
  WDU 4 BL   (1020180000) = průchozí, modrá,   4 mm²    (N vodič)
  WDU 6      (1020200000) = průchozí, béžová,  6 mm²,   šroubové
  WDU 10     (1020300000) = průchozí, béžová,  10 mm²,  šroubové
  WDU 16     (1020400000) = průchozí, béžová,  16 mm²,  šroubové
  WDU 35     (1020500000) = průchozí, béžová,  35 mm²,  šroubové

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

  2002-1291  = koncový doraz pro řadu 2002
  2004-102   = koncový doraz pro řadu 2004 (ověřit v katalogu)
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
    TA25DU-1.0  = nastavení 0,63–1,0 A
    TA25DU-4    = nastavení 2,8–4,0 A
    TA25DU-6,5  = nastavení 4,5–6,5 A
    TA25DU-11   = nastavení 7,5–11 A
    TA25DU-19   = nastavení 13–19 A
    TA25DU-32   = nastavení 24–32 A
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
    3RT2036  = 51 A, 22,0 kW  (S2)

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

  DILM7-10(230V50HZ,240V60HZ) = 7A/3kW,  1NO aux, 230V AC    (ID: 276550)
  DILM7-01(230V50HZ,240V60HZ) = 7A/3kW,  1NC aux, 230V AC    (ID: 276585)
  DILM7-01(24VDC)         = 7A/3kW,  1NC aux, 24V DC     (ID: 276600)
  DILM9-10(230V50HZ,240V60HZ) = 9A/4kW,  1NO aux, 230V AC    (ID: 276690)
  DILM9-10(24VDC)         = 9A/4kW,  1NO aux, 24V DC     (ID: 276705)
  DILM9-01(230V50HZ,240V60HZ) = 9A/4kW,  1NC aux, 230V AC    (ID: 276725)
  DILM9-01(24VDC)         = 9A/4kW,  1NC aux, 24V DC     (ID: 276740)
  DILM12-10(230V50HZ,240V60HZ) = 12A/5,5kW, 1NO, 230V AC     (ID: 276830)
  DILM12-10(24VDC)        = 12A/5,5kW, 1NO, 24V DC       (ID: 276845)
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
      M7  = 220 V AC 50/60 Hz
      P7  = 230 V AC 50/60 Hz      ← nejběžnější AC varianta v EU
      Q7  = 380 V AC 50/60 Hz
      S7  = 200 V AC 50 Hz

---

### Klíčová typová označení (ověřeno z se.com)

  LC1D09BD   = 9A/4kW,   24V DC cívka
  LC1D09M7   = 9A/4kW,   220V AC cívka
  LC1D09P7   = 9A/4kW,   230V AC cívka
  LC1D12BD   = 12A/5,5kW, 24V DC cívka
  LC1D12M7   = 12A/5,5kW, 220V AC cívka
  LC1D18BD   = 18A/7,5kW, 24V DC cívka
  LC1D18M7   = 18A/7,5kW, 220V AC cívka
  LC1D25BD   = 25A/11kW,  24V DC cívka
  LC1D32BD   = 32A/15kW,  24V DC cívka
  LC1D40ABD  = 40A/18,5kW, 24V DC cívka (přípona A = 40A varianta)
  LC1D50ABD  = 50A/22kW,  24V DC cívka

---

### Příslušenství TeSys D

  **Přetěžovací relé (Overload Relay) — LRD série:**
  LRD01    = nastavení 0,1–0,16 A
  LRD02    = nastavení 0,16–0,25 A
  LRD03    = nastavení 0,25–0,4 A
  LRD04    = nastavení 0,4–0,63 A
  LRD05    = nastavení 0,63–1 A
  LRD06    = nastavení 1–1,6 A
  LRD07    = nastavení 1,6–2,5 A
  LRD08    = nastavení 2,5–4 A
  LRD10    = nastavení 4–6 A
  LRD12    = nastavení 5,5–8 A
  LRD14    = nastavení 7–10 A
  LRD16    = nastavení 9–13 A
  LRD21    = nastavení 12–18 A
  LRD22    = nastavení 16–24 A
  LRD35    = nastavení 30–38 A

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
  TA25DU-32     = nastavení 24–32 A

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
  LRD04    = 0,4–0,63 A
  LRD05    = 0,63–1 A
  LRD06    = 1–1,6 A
  LRD07    = 1,6–2,5 A
  LRD08    = 2,5–4 A
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

  // ─── Relé ─────────────────────────────────────────────────────────────────
  rele: {
    label: 'Relé',
    aliases: [
      'relé', 'rele', 'relay', 'řídicí relé', 'miniaturní relé',
      'průmyslové relé', 'elektromagnetické relé',
    ],
    questions: [
      'Kolik kontaktů a jaký typ? (1CO = SPDT, 2CO = DPDT)',
      'Napětí cívky? (24VDC, 24VAC, 230VAC)',
      'Jmenovitý proud kontaktů? (6A, 10A)',
      'Způsob montáže? (patice na DIN lištu, přímý DIN rail, PCB)',
    ],
    manufacturers: {
      omron: {
        label: 'Omron',
        doc: `## Omron – Miniaturní relé G2R

### Schéma: G2R-[póly]-[varianta] [napětí_cívky]

  Počet pólů: 1 = 1CO (SPDT, 16 A), 2 = 2CO (DPDT, 5 A)
  Varianta: E = PCB montáž, SN = pro patici + LED + testovací tlačítko

### PCB montáž (varianta E)

  G2R-1-E DC24  = 1CO, 24 VDC, PCB, 16 A / 250 VAC
  G2R-1-E DC12  = 1CO, 12 VDC, PCB, 16 A / 250 VAC
  G2R-1-E AC230 = 1CO, 230 VAC, PCB, 16 A / 250 VAC
  G2R-2-E DC24  = 2CO, 24 VDC, PCB, 5 A / 250 VAC
  G2R-2-E DC12  = 2CO, 12 VDC, PCB, 5 A / 250 VAC
  G2R-2-E AC230 = 2CO, 230 VAC, PCB, 5 A / 250 VAC

### Patice montáž (varianta SN, pro DIN lištu)

  G2R-1-SN DC24  = 1CO, 24 VDC, patice P2RF-05, LED + test button
  G2R-1-SN DC12  = 1CO, 12 VDC, patice P2RF-05
  G2R-1-SN AC230 = 1CO, 230 VAC, patice P2RF-05
  G2R-2-SN DC24  = 2CO, 24 VDC, patice P2RF-08
  G2R-2-SN DC12  = 2CO, 12 VDC, patice P2RF-08
  G2R-2-SN AC230 = 2CO, 230 VAC, patice P2RF-08

### Parametry kontaktů

  G2R-1 (1CO): Ith = 16 A, 250 VAC / 30 VDC
  G2R-2 (2CO): Ith = 5 A, 250 VAC / 30 VDC
  Mechanická životnost (DC cívka): 20 × 10⁶ cyklů
  Mechanická životnost (AC cívka): 10 × 10⁶ cyklů
  Elektrická životnost: 100 × 10³ cyklů (jmenovité zatížení)

### Patice (příslušenství)

  P2RF-05 = 5-pin patice pro G2R-1-SN, DIN 35 mm, šroubové svorky
  P2RF-08 = 8-pin patice pro G2R-2-SN, DIN 35 mm, šroubové svorky
  POZOR: P2CF-08 je oktalová patice pro série MK/H3CR — není kompatibilní s G2R-SN!
`,
      },
      phoenix_contact: {
        label: 'Phoenix Contact',
        doc: `## Phoenix Contact – Relé PLC-RSC / PLC-RPT

### PLC-RSC (šroubové svorky, přímá DIN montáž)

  PLC-RSC-24DC/21    (2966171) = 1CO, 24 VDC, šroubové svorky, 6 A / 250 VAC
  PLC-RSC-24DC/21-AU (2966265) = 1CO, 24 VDC, šroubové svorky, 6 A / 250 VAC (Au kontakty)
  PLC-RSC-24DC/21-21 (2967060) = 2CO, 24 VDC, šroubové svorky, 6 A / 250 VAC
  PLC-RSC-230UC/21   (2966207) = 1CO, 230 V AC/DC (univerzální cívka), šroubové svorky, 6 A

### PLC-RPT (push-in svorky, přímá DIN montáž)

  PLC-RPT-24DC/21    (2900299) = 1CO, 24 VDC, push-in svorky, 6 A / 250 VAC
  PLC-RPT-24DC/21-21 (2900330) = 2CO, 24 VDC, push-in svorky, 6 A / 250 VAC

### Parametry

  Montáž: přímo na DIN 35 mm lištu (integrovaná základna)
  Kontakty: AgNi, 6 A / 250 VAC
  LED indikace cívky: ano (standardní varianty)
  Pracovní teplota: –25 °C … +70 °C
  Číslo v závorce = objednací číslo Phoenix Contact (7místné)
`,
      },
      finder: {
        label: 'Finder',
        doc: `## Finder – Relé série 40, 55

### Série 40 – Miniaturní relé do patice (oktal 8-pin)

  Schéma: 40.[konfigurace].[napájení].[napětí_cívky].[verze]
  Napájení kódy: 7 = DC (low-power cívka), 9 = AC

  40.51.7.012.0000 = 1CO, 12 VDC, 8 A, pro patici série 94
  40.51.7.024.0000 = 1CO, 24 VDC, 8 A, pro patici série 94
  40.51.9.230.0000 = 1CO, 230 VAC, 8 A, pro patici série 94
  40.52.7.024.0000 = 2CO, 24 VDC, 8 A, pro patici série 94
  40.52.9.230.0000 = 2CO, 230 VAC, 8 A, pro patici série 94

  Kontakty: Ith = 8 A / 250 VAC
  Pin konfigurace: 8-pin oktal

### Série 55 – Řídicí relé 4CO

  55.34.9.024.0040 = 4CO, 24 VDC, 7 A, pro patici série 94 (94.04)
  55.34.9.230.0040 = 4CO, 230 VAC, 7 A, pro patici série 94 (94.04)

  Pin konfigurace: 14-pin (pro patici 94.04)
  POZOR: série 95 patice jsou pro relé série 40 (8-pin oktal) — ne pro série 55!
`,
      },
      weidmuller: {
        label: 'Weidmüller',
        doc: `## Weidmüller – Relé TRS

### TRS – miniaturní relé pro přímou DIN montáž

  TRS 24VDC 1CO (1122770000) = 1CO, 24 VDC, 6 A / 250 VAC, DIN 35 mm
  TRS 24VDC 2CO (1123490000) = 2CO, 24 VDC, 8 A / 250 VAC, DIN 35 mm
  TRS 230VAC 1CO              = 1CO, 230 VAC, 6 A / 250 VAC, DIN 35 mm

### Parametry

  Kontakty: 6 A (1CO) / 8 A (2CO) / 250 VAC
  LED indikace: ano
  Pracovní teplota: –40 °C … +60 °C
  Číslo v závorce = objednací číslo Weidmüller
`,
      },
      relpol: {
        label: 'Relpol',
        doc: `## Relpol – Průmyslové relé RM85

### RM85 – jednonastavitelné relé (1CO/SPDT), 16 A, pro patici GZT8

  Schéma: RM85-2011-35-[napětí_cívky]

  RM85-2011-35-1024 = 1CO, 24 VDC cívka, 16 A / 250 VAC, pro patici GZT80
  RM85-2011-35-5230 = 1CO, 230 VAC cívka, 16 A / 250 VAC, pro patici GZT80
  RM85-2011-35-1012 = 1CO, 12 VDC cívka, 16 A / 250 VAC, pro patici GZT80

### Parametry RM85

  Konfigurace: 1CO (SPDT – NO + NC + COM)
  Jmenovitý proud kontaktů: 16 A / 250 VAC
  Materiál kontaktů: AgSnO2
  Mechanická životnost: 30 × 10⁶ cyklů
  Montáž: výhradně do patice GZT80 (DIN 35 mm) nebo GZT80E (PCB montáž)
  Pracovní teplota: –40 °C … +70 °C
  Norma: IEC 61810-1
`,
      },
    },
  }, // end rele

  // ─── Příslušenství relé ────────────────────────────────────────────────────
  prislusenstvi_rele: {
    label: 'Příslušenství relé',
    aliases: [
      'patice relé', 'patice', 'podnožka relé', 'relay socket', 'relay base',
      'příslušenství relé', 'prislusenstvi rele', 'socket pro relé',
    ],
    questions: [
      'Pro jaký typ relé? (Omron G2R, Finder 40, Finder 55)',
      'Počet pinů? (8-pin oktal, 14-pin)',
      'Způsob připojení? (šroubové svorky, push-in)',
    ],
    manufacturers: {
      omron: {
        label: 'Omron',
        doc: `## Omron – Patice série P2RF pro relé G2R

  P2RF-05  = 5-pin patice, DIN 35 mm, šroubové svorky — pro G2R-1-SN (1CO)
  P2RF-08  = 8-pin patice, DIN 35 mm, šroubové svorky — pro G2R-2-SN (2CO)

  POZOR: P2CF-08 je oktalová patice pro série MK a H3CR — není pro G2R-SN!

### Kompatibilita

  G2R-1-SN → P2RF-05 (5-pin, DIN 35 mm)
  G2R-2-SN → P2RF-08 (8-pin, DIN 35 mm)
  G2R-1-E / G2R-2-E → PCB přímá montáž (bez patice)
`,
      },
      finder: {
        label: 'Finder',
        doc: `## Finder – Patice série 94 (8-pin) a 95 (14-pin)

### Série 94 – pro relé Finder 40 (8-pin oktal)

  94.72   = 8-pin, DIN 35 mm, šroubové svorky
  94.72.2 = 8-pin, DIN 35 mm, šroubové svorky + aretace relé
  94.02.1 = 8-pin, PCB montáž

### Série 94 – pro relé Finder 55 (14-pin) a Finder 40 (8-pin)

  94.04   = 14-pin, DIN 35 mm, šroubové svorky — pro série 55 (4CO relé)
  95.05   = 8-pin oktal, DIN 35 mm — pro série 40 (1CO/2CO relé)
  95.05.2 = 8-pin oktal, DIN 35 mm + aretace relé

  POZOR: 95.05 je 8-pin patice pro série 40, nikoliv 14-pin pro série 55!

### Kompatibilita

  Finder 40.51 / 40.52 (1CO / 2CO, 8-pin) → patice série 95 (95.05)
  Finder 55.34 (4CO, 14-pin)               → patice série 94 (94.04)
`,
      },
      relpol: {
        label: 'Relpol',
        doc: `## Relpol – Patice GZT8 pro relé RM85

### GZT80 – DIN 35 mm patice pro RM85 (8-pin)

  GZT80   = 8-pin, DIN 35 mm, šroubové svorky
             Kompatibilní s: RM85 (1CO, 16 A)
             Šroubové svorky max. průřez: 2,5 mm²

### GZT14-1 – DIN 35 mm patice pro R15 (14-pin)

  GZT14-1 = 14-pin, DIN 35 mm, šroubové svorky
             Kompatibilní s: R15 série (4CO)

### Kompatibilita

  Relpol RM85 (1CO, 8-pin) → GZT80 (DIN)
  Relpol R15  (4CO, 14-pin) → GZT14-1 (DIN)
`,
      },
    },
  }, // end prislusenstvi_rele

  // ─── Časové relé ──────────────────────────────────────────────────────────
  casove_rele: {
    label: 'Časové relé',
    aliases: [
      'časové relé', 'casove rele', 'timer relay', 'časovač',
      'zpožďovací relé', 'multifunkční časovač', 'on-delay', 'off-delay',
    ],
    questions: [
      'Jaká časovací funkce? (zapínací prodleva, vypínací prodleva, blikač, multifunkční)',
      'Jaký časový rozsah? (sekundy, minuty, hodiny)',
      'Napájecí napětí? (24VDC, 230VAC, univerzální 12–240V)',
      'Kolik výstupních kontaktů? (1CO, 2CO)',
    ],
    manufacturers: {
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Časové relé 3RP2505

### 3RP2505-1AW30 – Multifunkční časové relé (1CO, 13 funkcí)

  3RP2505-1AW30 = 13 časovacích funkcí, 12–240 V AC/DC, 1CO, Ith=5 A
  3RP2505-1BW30 = 27 časovacích funkcí, 12–240 V AC/DC, 2CO (varianta s více funkcemi)

### Parametry 3RP2505-1AW30

  Napájení: 12–240 V AC/DC (univerzální vstup)
  Počet funkcí: 13 (zapínací prodleva, vypínací prodleva, blikač,
                 hvězda-trojúhelník, jednorázový impuls a další)
  Časový rozsah: 0,05 s … 360 000 s (= 100 hod), 7 rozsahů přepínačem
  Výstupní kontakty: 1CO (SPDT), spínací proud 3 A / 250 VAC (Ith = 5 A)
  Montáž: DIN 35 mm lišta, šířka 17,5 mm (1 TE)
  Pracovní teplota: –25 °C … +60 °C
  LED indikace: stav výstupu + napájení
`,
      },
      abb: {
        label: 'ABB',
        doc: `## ABB – Časové relé CT-MFD.21

### CT-MFD.21 / CT-MFD.21S – Multifunkční časové relé

  CT-MFD.21  (1SVR500020R1100) = 7 časovacích funkcí, 12–240 V AC/DC, 2CO, 5 A / 250 VAC
  CT-MFD.21S = varianta s pružinovými svorkami (S = spring-clamp); objednací č. ověřit v katalogu ABB

### Parametry

  Napájení: 12–240 V AC/DC (univerzální)
  Počet funkcí: 7 (zapínací prodleva, vypínací prodleva, blikač start/stop,
                 hvězda-trojúhelník, jednorázový impuls)
  Časový rozsah: 0,05 s … 100 hod (7 rozsahů)
  Výstupní kontakty: 2CO (2× přepínací), 5 A / 250 VAC
  Montáž: DIN 35 mm lišta, šířka 17,5 mm (1 TE)
  Pracovní teplota: –20 °C … +60 °C
  Objednací číslo v závorce = ABB číslo
`,
      },
      finder: {
        label: 'Finder',
        doc: `## Finder – Multifunkční časové relé série 88

### 88.02.0.240.0000 – 2CO, 24–230 V AC/DC, panelová montáž 48×48 mm

  88.02.0.240.0000 = multifunkční časovač, 24–230 V AC/DC, 2CO, 8 A / 250 VAC

  DŮLEŽITÉ: 88.02 je zásuvný časovač s čelním panelem 48×48 mm — NENÍ DIN modulem
  22,5 mm. Pro montáž na DIN 35 mm lištu nutno použít zásuvku (socket), např. Finder 94.62.

### Časovací funkce série 88.02

  AI = zapínací prodleva (ON-delay)
  DI = vypínací prodleva (OFF-delay)
  GI = jednorázový impuls
  SW = symetrický blikač
  BE = blikač s předvolbou startu
  CE = blikač s předvolbou zastavení
  DE = asymetrický blikač

  Pozn.: Hvězda-trojúhelník funkce (star-delta) NENÍ součástí série 88.02
         (tuto funkci nabízí Finder série 80, např. 80.82)

### Parametry

  Napájení: 24–230 V AC/DC (univerzální vstup)
  Výstupní kontakty: 2CO (DPDT), 8 A / 250 VAC
  Časový rozsah: 0,05 s … 100 hod (16 rozsahů potenciometrem)
  Nastavení: 2 potenciometry (čas + rozsah) + přepínač funkce
  Montáž: čelní panel 48×48 mm (DIN lišta přes zásuvku 94.62)
  Norma: IEC/EN 61812-1
`,
      },
    },
  }, // end casove_rele

  // ─── Fázové relé ──────────────────────────────────────────────────────────
  fazove_rele: {
    label: 'Fázové relé',
    aliases: [
      'fázové relé', 'fazove rele', 'monitorovací relé', 'phase monitoring',
      'asymetrie', 'sled fází', 'výpadek fáze', 'kontrola fáze',
      'podpětí', 'přepětí sítě',
    ],
    questions: [
      'Monitorované napětí sítě? (3×320–500 V, 3×160–690 V)',
      'Které poruchy sledovat? (výpadek fáze, sled fází, asymetrie, podpětí)',
      'Nastavitelné prahy nebo pevné?',
      'Počet výstupních kontaktů? (1CO, 2CO)',
    ],
    manufacturers: {
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Monitorovací relé 3UG45xx

### 3UG4511-1AP20 – Základní fázové relé (pevné prahy)

  3UG4511-1AP20 = 3× 320–500 V AC, 1CO, sled fází + výpadek fáze, auto reset

  Funkce: sledování sledu fází, výpadku fáze (bez sledování asymetrie)
  Výstup: 1CO (přepínací), 3 A / 240 VAC
  Reakce: výpad < 450 ms
  Montáž: DIN 35 mm, šířka 22,5 mm

  Pozn.: 3UG4511-1AN20 = varianta 160–260 V AC; pro 400V síť použít -1AP20

### 3UG4512-1AR20 – Rozšířené fázové relé (nastavitelné prahy)

  3UG4512-1AR20 = 3× 160–690 V AC, 1CO, nastavitelná asymetrie + podpětí, auto/ruční reset

  Funkce: sled fází, výpadek fáze, nastavitelná asymetrie (0–20 %),
          nastavitelné podpětí
  Vstupní napětí: 160–690 V AC (50/60 Hz)
  Výstup: 1CO, 3 A / 240 VAC
  Montáž: DIN 35 mm, šířka 22,5 mm

### 3UG4513-1BR20 – Rozšířené fázové relé s 2CO výstupy

  3UG4513-1BR20 = 3× 160–690 V AC, 2CO, analogové nastavení potenciometrem, auto/ruční reset

  Funkce: vše jako 3UG4512 (sled fází, výpadek, nastavitelná asymetrie + podpětí)
  Výstup: 2CO (2× přepínací), 3 A / 240 VAC
  Nastavení: potenciometry (analogové) — není digitální displej
  Montáž: DIN 35 mm, šířka 22,5 mm

### Kódování sufixu 3UG45xx

  3UG4511: základní (1CO, pevné prahy, sled/výpadek bez asymetrie)
  3UG4512: rozšířené (1CO, nastavitelná asymetrie + podpětí)
  3UG4513: rozšířené s 2CO výstupy
  N = vstup 160–260 V, P = vstup 320–500 V, R = vstup 160–690 V
  A = auto reset, B = auto + ruční reset
`,
      },
      abb: {
        label: 'ABB',
        doc: `## ABB – Monitorovací relé CM-PFE.2

### CM-PFE.2 – Kontrola fází třífázové sítě

  CM-PFE.2 (1SVR550826R9100) = 3× 200–500 V AC, 1CO, DIN 35 mm, šířka 22,5 mm

### Funkce

  Sleduje: sled fází (nesprávné pořadí L1-L2-L3), výpadek fáze
  Výstup: 1CO (přepínací), 4 A / 250 VAC
  Reakce: 500 ms při výpadku fáze (ts = tv = 500 ms, pevná hodnota)

### Parametry

  Vstupní napětí: 3× 200–500 V AC (50/60 Hz) – pokrývá evropský standard 3×400 V
  Napájení měřicí části: z měřené sítě (bez externího napájení)
  Reset: automatický při obnovení správného stavu fází
  Montáž: DIN 35 mm lišta, šířka 22,5 mm (1 TE)
  Pracovní teplota: –20 °C … +60 °C
  Norma: IEC 60255-1
  Objednací číslo v závorce = ABB číslo
`,
      },
    },
  }, // end fazove_rele

  // ─── Tlačítka ─────────────────────────────────────────────────────────────
  tlacitko: {
    label: 'Tlačítka',
    aliases: [
      'tlačítko', 'tlacitko', 'ovladač', 'pushbutton', 'spínač tlačítkový',
      'signálka', 'kontrolka', 'startovací tlačítko', 'stop tlačítko',
    ],
    questions: [
      'Průměr montáže? (Ø22 mm = standard)',
      'Barva? (černá, zelená, červená, žlutá)',
      'Typ operace? (momentální/impulsní, aretované/fixační)',
      'Typ kontaktu? (1NO, 1NC)',
      'Materiál čelní desky? (kovový = XB4, plastový = XB5)',
    ],
    manufacturers: {
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric – Tlačítka Harmony XB4 / XB5

### Harmony XB4 – kovová (zinkový slitinový) čelní deska, Ø22 mm

  XB4BA21 = černé, Ø22 mm, momentální, 1NO, kovová deska
  XB4BA31 = zelené, Ø22 mm, momentální, 1NO, kovová deska (START)
  XB4BA42 = červené, Ø22 mm, momentální, 1NC, kovová deska (STOP)

  Pozn.: XB4BD21 je přepínač (selektor 2-polohy), NIKOLI zelené tlačítko — neplést

  Ø montážního výřezu: 22 mm
  Proud kontaktu: 10 A / 600 VAC (AC-15: 3 A / 240 VAC)
  Norma: IEC 60947-5-1

### Harmony XB5 – plastová (polyamidová) čelní deska, IP66, Ø22 mm

  XB5AA21 = černé, Ø22 mm, momentální, 1NO, IP66
  XB5AA31 = zelené, Ø22 mm, momentální, 1NO, IP66
  XB5AA42 = červené, Ø22 mm, momentální, 1NC, IP66

  Pozn.: XB5AD21 je přepínač (selektor 2-polohy), NIKOLI zelené tlačítko — neplést

  Ø montážního výřezu: 22 mm
  Proud kontaktu: 10 A / 600 VAC

### Kontaktní bloky (příslušenství, objednávány zvlášť u modulárních verzí)

  ZB4BZ101 = 1NO kontaktní blok pro XB4
  ZB4BZ102 = 1NC kontaktní blok pro XB4
  ZB4BZ103 = 2NO kontaktní blok pro XB4
  ZB5AZ101 = 1NO kontaktní blok pro XB5
  ZB5AZ102 = 1NC kontaktní blok pro XB5

### XB4 vs. XB5

  XB4: kovová deska, vyšší mechanická odolnost, průmyslové prostředí
  XB5: plastová deska, IP66 (lepší těsnost), lehčí, ekonomičtější
  Kontaktní bloky XB4 a XB5 nejsou vzájemně zaměnitelné
`,
      },
      eaton: {
        label: 'Eaton',
        doc: `## Eaton – Tlačítka RMQ-Titan M22 / M22-I

### M22 – Modulární systém, Ø22 mm, IP67/IP69K

  Schéma: M22-[varianta]-[barva]  +  M22-[typ_bloku]

  Ovládací hlavy (momentální tlačítka):
    M22-D-G  = zelená ovládací hlava, Ø22 mm, momentální, IP67
    M22-D-R  = červená ovládací hlava, Ø22 mm, momentální, IP67
    M22-D-S  = černá ovládací hlava, Ø22 mm, momentální, IP67
    M22-D-B  = modrá ovládací hlava, Ø22 mm, momentální, IP67
    M22-D-Y  = žlutá ovládací hlava, Ø22 mm, momentální, IP67

  Kontaktní bloky (objednávány zvlášť):
    M22-K10  = 1NO kontaktní blok (snap-on, zadní montáž)
    M22-K01  = 1NC kontaktní blok
    M22-K11  = 1NO + 1NC kontaktní blok

### Sestavení kompletní jednotky

  Kompletní tlačítko = ovládací hlava + kontaktní blok, např.:
    M22-D-G + M22-K10  = zelené momentální tlačítko, 1NO

### Parametry M22

  Průměr montážního výřezu: Ø22 mm
  Proud kontaktu: 6 A / 500 VAC (AC-15: 6 A / 230 VAC, 4 A / 400 VAC)
  Krytí čelní desky: IP67/IP69K (závisí na provedení základny)
  Norma: IEC 60947-5-1
`,
      },
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Tlačítka SIRIUS ACT 3SB3

### 3SB3 – Modulární systém, Ø22 mm

  Schéma: 3SB3[xxx]-[varianta][barva][kontakt]

  Potvrzené příklady (ověřeno RS, TME, Kempston Controls):
    3SB3001-0AA21 = Ø22 mm, červené, momentální, 1NO

  Kódování barev v sufixu — barva je zakódována v číslicové pozici sufixu:
    -0AA21 = červená | -0AA31 = žlutá | -0AA41 = zelená
    -0AA51 = modrá  | -0AA61 = bílá

  DŮLEŽITÉ: Původní kódové schéma A=černá, B=zelená, D=červená je NESPRÁVNÉ.
            Barva se NEKÓDUJE v písmenné části sufixu.
            Pro přesná typová označení vždy ověřit v aktuálním katalogu
            Siemens SIRIUS ACT 3SB3.

### Parametry 3SB3

  Průměr montážního výřezu: Ø22 mm
  Proud kontaktu: 10 A / 240 VAC
  Krytí: IP65 (s krytkou)
  Norma: IEC 60947-5-1
`,
      },
    },
  }, // end tlacitko

  // ─── Nouzové tlačítko ─────────────────────────────────────────────────────
  nouzove_tlacitko: {
    label: 'Nouzové tlačítko',
    aliases: [
      'nouzové tlačítko', 'nouzove tlacitko', 'E-stop', 'emergency stop',
      'hřibové tlačítko', 'hribove tlacitko', 'nouzový stop',
      'nouzový vypínač', 'bezpečnostní tlačítko',
    ],
    questions: [
      'Průměr hřibu? (Ø40 mm = standard, Ø60 mm = velký)',
      'Způsob odjištění? (otočení = twist-release, klíč = key-release, tah = pull-release)',
      'Průměr montáže? (Ø22 mm = standard)',
      'Typ kontaktu? (1NC, 2NC, 1NC+1NO)',
    ],
    manufacturers: {
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric – Nouzový stop Harmony XB4 / XB5

### Harmony XB4 – kovová deska, Ø22 mm

  ZB4BS54 = Ø40 mm červený hřib, Ø22 mm výřez, twist-release aretace, žlutá deska
            → HLAVA POUZE – nutno přidat tělo (ZB4BZ009) + kontaktní blok

  Kompletní jednotky (hlava + tělo + kontakty):
    XB4BS84441  = Ø40 mm hřib, twist-release, 2NC + 1NO
    XB4BS8444   = Ø40 mm hřib, 2NC (způsob odjištění ověřit v katalogu)

  Dílčí komponenty XB4:
    ZB4BS54    = Ø40 mm červený hřib, twist-release (hlava)
    ZB4BZ009   = tělo Ø22 mm (base)
    ZB4BZ102   = 1NC kontaktní blok
    ZB4BZ101   = 1NO kontaktní blok
    ZB4BZ103   = 2NO kontaktní blok

### Harmony XB5 – plastová deska, Ø22 mm

  ZB5AS844    = Ø40 mm červený hřib, twist-release, IP66 (nástupce ZB5AS54)

  Kompletní:
    XB5AS54442  = Ø40 mm, twist-release, 1NC + 1NO

### Parametry

  Ø montážního výřezu: 22,3 mm
  NC kontakty: přímo-rozepínací princip (direct opening action) dle IEC 60947-5-5
  Proud NC kontaktu: 10 A / 240 VAC (AC-15)
  Barva hřibu: červená, deska žlutá (dle ISO 13850)
  Krytí: IP65 (XB4), IP66 (XB5)
  Aretace: twist nebo key – nikdy ne samočinně resetovatelné
  Normy: IEC 60947-5-5, ISO 13850
`,
      },
    },
  }, // end nouzove_tlacitko

  // ─── Hlavní vypínač ───────────────────────────────────────────────────────
  hlavni_vypinac: {
    label: 'Hlavní vypínač',
    aliases: [
      'hlavní vypínač', 'hlavni vypinac', 'odpínač', 'odpinac',
      'odpojovač', 'isolator switch', 'bezpečnostní odpínač',
      'servisní spínač', 'load break switch',
    ],
    questions: [
      'Počet pólů? (3P = třífázový, 4P = třífázový + N)',
      'Jmenovitý proud? (16A, 25A, 40A, 63A, 100A)',
      'Způsob montáže? (DIN lišta, přímá montáž na panel/dveře)',
      'Ovládání? (přímé rukojetí, prodloužená hřídel na dveře)',
    ],
    manufacturers: {
      abb: {
        label: 'ABB',
        doc: `## ABB – Odpínač OT série (Safety switch / Load break switch)

### OTxF3 – 3-pólové odpínače

  OT16F3  (1SCA104811R1001) = 3P, 16 A (IEC) / 20 A (UL), 690 VAC (IEC) / 600 VAC (UL)
  OT25F3  (1SCA104857R1001) = 3P, 25 A (IEC) / 30 A (UL), 690 VAC
  OT40F3  (1SCA104902R1001) = 3P, 40 A / 690 VAC
  OT63F3  (1SCA105332R1001) = 3P, 63 A / 690 VAC
  OT100F3 (1SCA105004R1001) = 3P, 100 A / 690 VAC

### OTxF4N2 – 4-pólové odpínače (3P+N), aktuální katalogové označení

  OT16F4N2  = 4P, 16 A / 690 VAC
  OT25F4N2  = 4P, 25 A / 690 VAC
  OT40F4N2  = 4P, 40 A / 690 VAC
  OT63F4N2  = 4P, 63 A / 690 VAC

  Pozn.: Starší označení bez N2 (OT16F4 apod.) se v aktuálním katalogu neobjevuje

### Parametry OT série

  Napětí: do 690 V AC (IEC) / 600 V AC (UL) / 250 V DC
  Spínací kategorie: AC-23A (motorové zátěže), AC-22A (odporové + smíšené)
  Krytí: IP65 s krytem, IP20 na svorkách
  Montáž: DIN 35 mm nebo šrouby do výřezu panelu
  Normy: IEC 60947-3, UL 508
  Vhodné jako hlavní vypínač rozvaděče dle IEC 61439
  Objednací číslo v závorce = ABB číslo
`,
      },
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Odpínače 3LD2

### 3LD2 – Výkonové odpojovače (load break switch), 3P

  Schéma: 3LD2[xxx]-0TK[51/53]

  3LD2003-0TK51 = 3P, 16 A, DIN 35 mm nebo přímá montáž, IP65 s krytem
  3LD2103-0TK51 = 3P, 25 A
  3LD2203-0TK51 = 3P, 32 A
  3LD2504-0TK51 = 3P, 63 A

  Suffix -0TK51: černá rotační rukojeť (standardní hlavní vypínač)
  Suffix -0TK53: červeno-žlutá rotační rukojeť (nouzový stop + hlavní vypínač)

### Parametry 3LD2

  Napětí: do 690 V AC
  Spínací kategorie: AC-23A (motorové zátěže)
  Krytí: IP65 se standardním krytem
  Montáž: DIN 35 mm lišta nebo přímá montáž šrouby
  Norma: IEC/EN 60947-3
  Vhodné jako hlavní vypínač rozvaděče dle IEC 61439
`,
      },
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric – Odpínače TeSys Vario VCF / VBF

### VCF – odpojovač + nouzový stop, montáž na dveře skříně (ověřeno z se.com)

  VCF0 = 3P, 25 A, 690 V AC, AC-23A, pro montáž na dveře
  VCF1 = 3P, 32 A, 690 V AC, AC-23A
  VCF2 = 3P, 40 A, 690 V AC, AC-23A
  VCF3 = 3P, 63 A, 690 V AC, AC-23A

  VCF = žluto-červená rukojeť (kombinace hlavní vypínač + nouzový stop)
  Kategorie: IEC 60947-3 (odpojovač) + IEC 60947-5-5 (nouzový stop)

### VBF – čistý odpojovač (jen hlavní vypínač), montáž na dveře

  VBF0 = 3P, 25 A, černá rukojeť
  VBF1 = 3P, 32 A, černá rukojeť
  VBF2 = 3P, 40 A, černá rukojeť
  VBF3 = 3P, 63 A, černá rukojeť

### Parametry TeSys Vario VCF/VBF

  Napětí: do 690 V AC (50/60 Hz)
  Spínací kategorie: AC-23A (motorové + odporové zátěže)
  Montáž: na přední dveře rozvaděče (šrouby z přední strany)
  Norma: IEC/EN 60947-3
  Vhodné jako hlavní vypínač dle IEC 61439

  Poznámka: GV7 je motorový jistič (IEC 60947-4-1, AC-3) — NENÍ odpojovač.
            Pro hlavní vypínač vždy použít VCF nebo VBF.
`,
      },
    },
  }, // end hlavni_vypinac

  // ─── Průchodka ────────────────────────────────────────────────────────────
  pruchovka: {
    label: 'Průchodka',
    aliases: [
      'průchodka', 'pruchovka', 'kabelová průchodka', 'cable gland',
      'vývodka', 'kabelová vývodka', 'PG průchodka', 'metrická průchodka',
      'SKINTOP', 'kabelová průchodnice',
    ],
    questions: [
      'Závit? (M16, M20, M25, M32, M40, M50, M63 nebo PG7, PG9, PG11, PG16)',
      'Průměr kabelu?',
      'Materiál? (polyamid = plast, niklovaná mosaz)',
      'Krytí? (IP68, IP69K)',
    ],
    manufacturers: {
      lapp: {
        label: 'Lapp',
        doc: `## Lapp – Průchodky SKINTOP

### SKINTOP ST-M – plastové (polyamid PA6), metrický závit, IP68/IP69K

  SKINTOP ST-M16×1,5  = M16, kabel Ø4–10 mm,  IP68/IP69K, černá
  SKINTOP ST-M20×1,5  = M20, kabel Ø7–13 mm,  IP68/IP69K, černá
  SKINTOP ST-M25×1,5  = M25, kabel Ø13–18 mm, IP68/IP69K, černá
  SKINTOP ST-M32×1,5  = M32, kabel Ø18–25 mm, IP68/IP69K, černá
  SKINTOP ST-M40×1,5  = M40, kabel Ø22–32 mm, IP68/IP69K, černá
  SKINTOP ST-M50×1,5  = M50, kabel Ø28–38 mm, IP68/IP69K, černá
  SKINTOP ST-M63×1,5  = M63, kabel Ø34–48 mm, IP68/IP69K, černá

  Specifická varianta: SKINTOP STR-M25B (53111330) = M25, PA6, IP68/IP69K, černá

### SKINTOP MS-M – niklovaná mosaz, metrický závit, IP68

  SKINTOP MS-M16×1,5  = M16, niklovaná mosaz, kabel Ø4–10 mm,  IP68
  SKINTOP MS-M20×1,5  = M20, niklovaná mosaz, kabel Ø7–13 mm,  IP68
  SKINTOP MS-M25×1,5  = M25, niklovaná mosaz, kabel Ø13–18 mm, IP68
  SKINTOP MS-M32×1,5  = M32, niklovaná mosaz, kabel Ø18–25 mm, IP68
  SKINTOP MS-M40×1,5  = M40, niklovaná mosaz, kabel Ø22–32 mm, IP68
  SKINTOP MS-M50×1,5  = M50, niklovaná mosaz, kabel Ø28–38 mm, IP68

### SKINTOP ST-PG – plastové, PG závit (starší norma)

  SKINTOP ST-PG7    = PG7,   kabel Ø3–6,5 mm, IP68
  SKINTOP ST-PG9    = PG9,   kabel Ø4–8 mm,   IP68
  SKINTOP ST-PG11   = PG11,  kabel Ø5–10 mm,  IP68
  SKINTOP ST-PG13,5 = PG13,5 kabel Ø6–12 mm,  IP68
  SKINTOP ST-PG16   = PG16,  kabel Ø10–14 mm, IP68
  SKINTOP ST-PG21   = PG21,  kabel Ø13–18 mm, IP68

### Obecné parametry SKINTOP

  Krytí ST-M: IP68 (ponoření) + IP69K (vysokotlaký oplach)
  Krytí MS-M: IP68
  Materiál těsnění: NBR (standard)
  Teplota: –20 °C … +80 °C (PA6), –40 °C … +100 °C (mosaz)
  Norma: IEC 60529, EN 50262
`,
      },
    },
  }, // end pruchovka

  // ─── Záslepka ─────────────────────────────────────────────────────────────
  zaslepka: {
    label: 'Záslepka',
    aliases: [
      'záslepka', 'zaslepka', 'blanking plug', 'záslepný kryt',
      'výplňový dílec', 'panel plug', 'záslepné víčko',
    ],
    questions: [
      'Pro jaký otvor? (Ø22 mm výřez pro tlačítko, metrický závit M16/M20/M25)',
      'Materiál? (plast, kov)',
      'Požadované krytí? (IP40, IP68)',
    ],
    manufacturers: {
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric – Záslepky panelových výřezů Harmony

### Záslepky pro Ø22 mm výřezy (série XB2/XB4/XB5)

  XB2EZ09 = plastová záslepka pro Ø22,3 mm výřez, IP40
            Materiál: ABS plast
            Barva: šedá/černá
            Kompatibilní s XB2, XB4, XB5 řadou (stejný Ø22 mm výřez)

### Použití

  Zakrytí nevyužitých výřezů Ø22 mm v čelní desce rozvaděče.
  Krytí IP40 při použití záslepky (bez tlačítka).
`,
      },
      lapp: {
        label: 'Lapp',
        doc: `## Lapp – Záslepky pro průchodkové otvory SKINTOP BLIND

### Záslepky pro metrické závity

  SKINTOP BLIND M16×1,5 = záslepka pro M16 otvor, polyamid PA6, IP68
  SKINTOP BLIND M20×1,5 = záslepka pro M20 otvor, polyamid PA6, IP68
  SKINTOP BLIND M25×1,5 = záslepka pro M25 otvor, polyamid PA6, IP68
  SKINTOP BLIND M32×1,5 = záslepka pro M32 otvor, polyamid PA6, IP68
  SKINTOP BLIND M40×1,5 = záslepka pro M40 otvor, polyamid PA6, IP68
  SKINTOP BLIND M50×1,5 = záslepka pro M50 otvor, polyamid PA6, IP68
  SKINTOP BLIND M63×1,5 = záslepka pro M63 otvor, polyamid PA6, IP68

### Použití

  Zakrytí nevyužitých průchodkových otvorů s metrickým závitem v rozvaděčové skříni.
  Udržuje IP68 krytí skříně i bez průchodky.
  Materiál: polyamid PA6, černá.
`,
      },
    },
  }, // end zaslepka

  // ─── Proudový chránič ─────────────────────────────────────────────────────
  chranic: {
    label: 'Proudový chránič',
    aliases: [
      'proudový chránič', 'proudovy chranic', 'RCD', 'RCCB',
      'chránič', 'chranic', 'diferenciální spínač', 'reziduální chránič',
      'FI chránič', 'FI spínač',
    ],
    questions: [
      'Počet pólů? (2P = jednofázový, 4P = třífázový)',
      'Jmenovitý proud? (16A, 25A, 40A, 63A, 100A)',
      'Reziduální proud (citlivost)? (10mA, 30mA, 100mA, 300mA, 500mA)',
      'Typ? (AC = pouze sinusový, A = AC + pulsující DC, B = AC + pulsující + hladký DC)',
    ],
    manufacturers: {
      abb: {
        label: 'ABB',
        doc: `## ABB – Proudové chrániče F202 / F204

### Schéma: F2[póly][typ]-[In]/[IΔn]

  F202 = 2-pólové (jednofázové obvody)
  F204 = 4-pólové (třífázové obvody)
  Typy: AC = pouze sinusový AC, A = AC + pulsující DC

### F202 – 2-pólové

  F202AC-25/0.03  (2CSF202001R1250) = 2P, 25 A, 30 mA, typ AC
  F202AC-40/0.03  (2CSF202001R1400) = 2P, 40 A, 30 mA, typ AC
  F202AC-63/0.03  (2CSF202001R1630) = 2P, 63 A, 30 mA, typ AC
  F202AC-63/0.1                     = 2P, 63 A, 100 mA, typ AC
  F202AC-63/0.3                     = 2P, 63 A, 300 mA, typ AC
  F202AC-100/0.5                    = 2P, 100 A, 500 mA, typ AC
  F202A-25/0.03   (2CSF202101R1250) = 2P, 25 A, 30 mA, typ A
  F202A-40/0.03   (2CSF202101R1400) = 2P, 40 A, 30 mA, typ A
  F202A-63/0.03   (2CSF202101R1630) = 2P, 63 A, 30 mA, typ A

### F204 – 4-pólové

  F204AC-25/0.03  = 4P, 25 A, 30 mA, typ AC
  F204AC-40/0.03  = 4P, 40 A, 30 mA, typ AC
  F204AC-63/0.03  = 4P, 63 A, 30 mA, typ AC
  F204AC-63/0.1   = 4P, 63 A, 100 mA, typ AC
  F204AC-63/0.3   = 4P, 63 A, 300 mA, typ AC
  F204AC-100/0.5  = 4P, 100 A, 500 mA, typ AC
  F204A-40/0.03   = 4P, 40 A, 30 mA, typ A
  F204A-63/0.03   = 4P, 63 A, 30 mA, typ A

### Parametry F202/F204

  Napětí: 230/400 V AC (50/60 Hz)
  Montáž: DIN 35 mm lišta
  Šířka: F202 = 2 TE (35 mm), F204 = 4 TE (72 mm)
  Norma: IEC/EN 61008-1 (RCCB)
  Objednací čísla v závorce = ABB čísla

### Typy reziduálního proudu (přehled)

  AC = sinusový střídavý (50/60 Hz) – základní ochrana
  A  = AC + pulsující stejnosměrný – doporučeno pro SMPS, invertory
  B  = AC + pulsující + hladký DC – pro frekvenční měniče, UPS, solární
  F  = jako typ A, odolný 150 Hz – pro frekvenční měniče s filtrací
`,
      },
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Proudové chrániče 5SV3

### Formát typového označení (ověřeno z RS Components, Siemens Mall)

  5SV3 [XX] [Y] - [Z]
    XX = kód citlivosti + konfigurace pólů:
         11 = 2P, 10 mA
         31 = 2P, 30 mA    |  34 = 4P, 30 mA
         41 = 2P, 100 mA
         61 = 2P, 300 mA   |  64 = 4P, 300 mA
    Y  = proud: 1=16A, 2=25A, 4=40A, 6=63A
    -Z = typ: -6 = Typ A (standard)

### 2P — 30 mA, Typ A (230 V AC)

  5SV3311-6  = 2P, 16 A, 30 mA, Typ A
  5SV3312-6  = 2P, 25 A, 30 mA, Typ A
  5SV3314-6  = 2P, 40 A, 30 mA, Typ A
  5SV3316-6  = 2P, 63 A, 30 mA, Typ A

### 2P — 10 mA, Typ A (citlivý, pro zdravotnictví, koupelny)

  5SV3111-6  = 2P, 16 A, 10 mA, Typ A

### 2P — 100 mA, Typ A

  5SV3412-6  = 2P, 25 A, 100 mA, Typ A
  5SV3416-6  = 2P, 63 A, 100 mA, Typ A

### 2P — 300 mA, Typ A (selektivní / požární ochrana)

  5SV3614-6  = 2P, 40 A, 300 mA, Typ A

### 4P — 30 mA, Typ A (400 V AC, třífázové obvody)

  5SV3342-6  = 4P, 25 A, 30 mA, Typ A
  5SV3344-6  = 4P, 40 A, 30 mA, Typ A
  5SV3346-6  = 4P, 63 A, 30 mA, Typ A

### 4P — 300 mA, Typ A

  5SV3642-6  = 4P, 25 A, 300 mA, Typ A
  5SV3646-6  = 4P, 63 A, 300 mA, Typ A

### Parametry 5SV3

  Napětí: 230 V AC (2P) / 400 V AC (4P), 50/60 Hz
  Montáž: DIN 35 mm lišta
  Norma: IEC/EN 61008-1
  Typ A: citlivý na AC + pulsující DC (standard pro průmyslové panely)
  Poznámka: Siemens 5SV3 nerozlišuje „typ AC" a „typ A" — aktuální produkty
            jsou vždy Typ A (-6 suffix), který splňuje požadavky obou.
`,
      },
    },
  }, // end chranic

  // ─── Přepěťová ochrana ────────────────────────────────────────────────────
  prepetova_ochrana: {
    label: 'Přepěťová ochrana',
    aliases: [
      'přepěťová ochrana', 'prepetova ochrana', 'svodič přepětí', 'SPD',
      'surge protection', 'přepěťový svodič', 'bleskojistka',
      'Type 1', 'Type 2', 'Typ 1', 'Typ 2', 'ochrana před bleskem',
    ],
    questions: [
      'Třída SPD? (Type 1 = hlavní přívod/bleskosvodná zóna, Type 2 = rozvodnice, Type 1+2 = kombinovaný)',
      'Napětí sítě? (230/400 V AC, DC fotovoltaika 600/1000 V)',
      'Topologie? (3+0, 3+1, 1+1)',
    ],
    manufacturers: {
      phoenix_contact: {
        label: 'Phoenix Contact',
        doc: `## Phoenix Contact – Přepěťové ochrany VAL-MS

### VAL-MS – Type 2 SPD pro AC sítě 230/400 V

  VAL-MS 320/3+1/FM    (2859181) = Type 2, 3+1 topologie, 320 V AC, DIN lišta
  VAL-MS 320/3+1/FM-UD           = Type 2, 3+1, 320 V AC, + dálková signalizace

  Parametry:
    Topologie 3+1: ochrana L1, L2, L3 vůči PE + N vůči PE
    Maximální výbojový proud Imax: 40 kA (8/20 µs) na pól
    Ochranná hladina Up: ≤ 1,6 kV (L-N)
    Jmenovité napětí Uc: 320 V AC (vhodné pro TN-C-S, TN-S, TT sítě 230/400 V)

### VAL-MS – Type 2 SPD pro DC fotovoltaické systémy

  VAL-MS 600DC-PV/2+V  (2800642) = Type 2, 600 V DC, 2+V topologie, DIN lišta
  VAL-MS 1000DC-PV/2+V (2800628) = Type 2, 1000 V DC, 2+V topologie, DIN lišta

  Parametry:
    Imax: 40 kA
    Pro FV systémy s max. napětím stringu 600 V resp. 1000 V DC

### Obecné parametry VAL-MS

  Montáž: DIN 35 mm lišta
  Indikace závady: vizuální okénko (zelená = OK, červená = vyměnit)
  Výměnné kartridže: ano (bezšroubová výměna)
  Norma: IEC 61643-11, EN 61643-11
  Čísla v závorce = objednací číslo Phoenix Contact

### Třídy SPD (přehled dle IEC 61643-11)

  Type 1 (třída I):  Iimp ≥ 12,5 kA (10/350 µs), pro bleskosvodná zóny 0/1
  Type 2 (třída II): Imax ≥ 40 kA (8/20 µs), pro hlavní a dílčí rozvodnice
  Type 3 (třída III): Up ≤ 1,5 kV, terminálová ochrana u citlivých zátěží
`,
      },
      abb: {
        label: 'ABB',
        doc: `## ABB – Přepěťové ochrany OVR T2

### OVR T2 – Type 2 SPD pro AC sítě 230/400 V, DIN lišta

  OVR T2 1N 40-275 P TS QS (2CTB803972R0500) = Type 2, 1+N, Uc=275 V AC,
    Imax=40 kA, TS = svorky pro dálkovou signalizaci, QS = rychlospojkové svorky
  OVR T2 3N 40-275 P QS    (2CTB803973R1100) = Type 2, 3+N, Uc=275 V AC,
    Imax=40 kA, QS = rychlospojkové svorky (bez TS = bez dálkové signalizace)

### Schéma typového označení OVR T2

  OVR T[třída] [póly] [Imax]-[Uc] [P=s ochr.] [přípona]
  Přípona: TS = pomocný kontakt pro dálkovou signalizaci,
           QS = quick-connect svorky (bezšroubové)
  Termická pojistka (tepelný odpojovač): je standardní součástí všech OVR T2

### Parametry OVR T2

  Třída: Type 2 (IEC/EN 61643-11, třída II)
  Maximální výbojový proud Imax: 40 kA (8/20 µs) na pól
  Ochranná hladina Up: 1,25 kV (L-N)
  Jmenovité napětí Uc: 275 V AC (pro síť 230/400 V TN-S, TN-C-S)
  Montáž: DIN 35 mm lišta
  Indikace závady: vizuální okénko (zelená/červená) + dálková signalizace (TS verze)
  Norma: IEC/EN 61643-11
  Objednací číslo v závorce = ABB číslo
`,
      },
    },
  }, // end prepetova_ochrana

  // ─── Frekvenční měniče ────────────────────────────────────────────────────
  frekvencni_menic: {
    label: 'Frekvenční měniče',
    aliases: [
      'frekvenční měnič', 'frekvencni menic', 'frekvenční měniče',
      'VFD', 'inverter', 'pohon', 'frekvenčák', 'variátor',
      'SINAMICS', 'Altivar', 'ATV', 'ACS', 'měnič',
    ],
    questions: [
      'Výkon motoru? (kW)',
      'Napájecí napětí? (1×230 V, 3×400 V)',
      'Preferovaný výrobce? (Siemens, Schneider, ABB)',
      'Komunikační protokol? (Modbus RTU, PROFIBUS, PROFINET)',
    ],
    manufacturers: {
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – SINAMICS G120C (kompaktní VFD)

### Schéma: 6SL3210-1KE[xx]-[yZ][verze]

  6SL3210 = SINAMICS produktová řada
  1KE     = G120C (kompaktní)
  [xx]    = kód výkonu (11=0,55kW, 12=0,75kW, 13=1,1kW, 14=1,5kW, 15=2,2kW ...)

  Suffix [yZ]:
    y (1. písmeno) = EMC filtr: U = bez integrovaného filtru, A = s filtrem třídy A
    Z (2. písmeno) = komunikace: B = USS/Modbus RTU, P = PROFIBUS DP, F = PROFINET/EtherNet/IP

  Příklady: UB = bez filtru + USS/Modbus, UP = bez filtru + PROFIBUS, UF = bez filtru + PROFINET
            AB = s filtrem + USS/Modbus, AP = s filtrem + PROFIBUS, AF = s filtrem + PROFINET

### Katalogová čísla G120C (3× 380–480 V AC, ověřeno z Kempston Controls, Parmley Graham, RS)

  6SL3210-1KE11-8AP0 = 0,55 kW  (PROFIBUS DP, s filtrem A)
  6SL3210-1KE12-3AF2 = 0,75 kW  (PROFINET, s filtrem A)
  6SL3210-1KE13-2AP0 = 1,1 kW   (PROFIBUS DP, s filtrem A)
  6SL3210-1KE14-3UF1 = 1,5 kW   (PROFINET, bez filtru)
  6SL3210-1KE15-8UP1 = 2,2 kW   (PROFIBUS DP, bez filtru)
  6SL3210-1KE17-5UF1 = 3,0 kW   (PROFINET, bez filtru)
  6SL3210-1KE18-8UB1 = 4,0 kW   (USS/Modbus RTU, bez filtru)
  6SL3210-1KE21-3UF1 = 5,5 kW   (PROFINET, bez filtru)
  6SL3210-1KE21-7UP1 = 7,5 kW   (PROFIBUS DP, bez filtru)
  6SL3210-1KE22-6UB0 = 11 kW    (USS/Modbus RTU, bez filtru)
  6SL3210-1KE23-8UF1 = 18,5 kW  (PROFINET, bez filtru)  ← pozor: KE23, nikoli KE24!

### Parametry G120C

  Výkonový rozsah: 0,55–18,5 kW
  Vstupní napětí: 3× 380–480 V AC (±10 %), 50/60 Hz
  Výstupní frekvence: 0–550 Hz
  Přetížitelnost: 150 % / 60 s, 200 % / 3 s
  Krytí: IP20 (základní), IP55 (Push-through varianta)
  Komunikace: dle sufixu – USS/Modbus RTU, PROFIBUS DP, PROFINET
  Montáž: DIN 35 mm lišta nebo šrouby

### Příslušenství G120C

  BOP-2 (6SL3255-0AA00-4CA1) = základní ovládací panel
  IOP-2                       = inteligentní panel s displejem
`,
      },
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric – Altivar ATV320

### Schéma: ATV320[U/D][kód_výkonu][kód_napětí][topologie]

  U = výkonový rozsah 0,18–7,5 kW; D = výkonový rozsah 11–22 kW
  Kód napětí: M2 = 200–240 V 1F, M3 = 200–240 V 3F, N4 = 380–500 V 3F
  Topologie: C = kompakt, B = book (tenký, 35 mm šířka)

### Katalogová čísla ATV320

  ATV320U07M2C = 0,75 kW, 200–240 V 1F, kompaktní
  ATV320U11M2C = 1,1 kW,  200–240 V 1F, kompaktní
  ATV320U15N4C = 1,5 kW,  380–500 V 3F, kompaktní
  ATV320U22N4C = 2,2 kW,  380–500 V 3F, kompaktní
  ATV320U30N4C = 3,0 kW,  380–500 V 3F, kompaktní
  ATV320U40N4C = 4,0 kW,  380–500 V 3F, kompaktní
  ATV320U55N4C = 5,5 kW,  380–500 V 3F, kompaktní
  ATV320U75N4C = 7,5 kW,  380–500 V 3F, kompaktní
  ATV320D11N4C = 11 kW,   380–500 V 3F, kompaktní
  ATV320D15N4C = 15 kW,   380–500 V 3F, kompaktní
  ATV320D22N4C = 22 kW,   380–500 V 3F, kompaktní

### Book (tenká) varianta – pro úsporu místa v skříni

  ATV320U07M2B = 0,75 kW, 200–240 V 1F, book (šířka 35 mm)
  ATV320U15N4B = 1,5 kW,  380–500 V 3F, book
  ATV320U22N4B = 2,2 kW,  380–500 V 3F, book

### Parametry ATV320

  Výkonový rozsah: 0,18–22 kW
  Přetížitelnost: 150 % / 60 s
  Krytí: IP20 (kompakt), IP65/IP66 s krytem
  Komunikace: Modbus RTU (standard), PROFIBUS/CANopen/EtherNet (přídavná karta)
  Montáž: DIN 35 mm nebo šrouby
`,
      },
      abb: {
        label: 'ABB',
        doc: `## ABB – Frekvenční měniče ACS355 / ACS580

### ACS355 – kompaktní série (0,37–22 kW, 3× 380–480 V)

  Schéma: ACS355-03E-[proud_kód]-4
  03E = 3F vstup, evropský trh; 4 = 400 V třída

  ACS355-03E-01A2-4 = 0,37 kW, 1,2 A
  ACS355-03E-01A9-4 = 0,55 kW, 1,9 A
  ACS355-03E-02A4-4 = 0,75 kW, 2,4 A
  ACS355-03E-03A3-4 = 1,1 kW,  3,3 A
  ACS355-03E-04A1-4 = 1,5 kW,  4,1 A
  ACS355-03E-05A6-4 = 2,2 kW,  5,6 A
  ACS355-03E-07A3-4 = 3,0 kW,  7,3 A
  ACS355-03E-08A8-4 = 4,0 kW,  8,8 A
  ACS355-03E-12A5-4 = 5,5 kW,  12,5 A
  ACS355-03E-15A6-4 = 7,5 kW,  15,6 A
  ACS355-03E-23A1-4 = 11 kW,   23,1 A
  ACS355-03E-31A0-4 = 15 kW,   31,0 A
  ACS355-03E-44A0-4 = 22 kW,   44,0 A

### ACS580 – střední série (0,75–500 kW), 3× 380–480 V

  ACS580-01-02A7-4 = 0,75 kW
  ACS580-01-03A4-4 = 1,1 kW
  ACS580-01-04A1-4 = 1,5 kW   ← pozor: ne -04A8-4 (to je US 480V varianta)
  ACS580-01-05A7-4 = 2,2 kW
  ACS580-01-07A3-4 = 3,0 kW

### Parametry ACS355

  Vstupní napětí: 3× 380–480 V AC (ACS355-03E), nebo 1× 200–240 V (ACS355-01)
  Krytí: IP20 základní, IP66 varianta s krytem (R1–R4)
  Komunikace: Modbus RTU (standard), PROFIBUS/EtherNet/IP (rozšiřující modul)
  Montáž: DIN 35 mm (malé výkony) nebo šrouby
`,
      },
    },
  }, // end frekvencni_menic

  // ─── Rittal ───────────────────────────────────────────────────────────────
  rittal: {
    label: 'Rittal',
    aliases: [
      'rittal', 'Rittal', 'rozvaděčová skříň', 'rozvadecka skrin',
      'skříň', 'skrin', 'TS8', 'VX25', 'AX', 'KX',
      'rittal skříň', 'rittal příslušenství', 'RiLine',
    ],
    questions: [
      'Typ skříně? (stojaté TS8/VX25, nástěnné AX/KX)',
      'Rozměry? (výška × šířka × hloubka v mm)',
      'Materiál? (ocelový plech RAL 7035, nerezová ocel AISI 304)',
      'Stupeň krytí? (IP54, IP55, IP66)',
    ],
    manufacturers: {
      rittal: {
        label: 'Rittal',
        doc: `## Rittal – Rozvaděčové skříně a příslušenství

### VX25 – moderní stojaté baying skříně (nástupce TS 8)

  Parametry: ocel (tl. 1,5 mm), RAL 7035, IP 55 / NEMA 12
  Katalogová čísla (ověřeno z rittal.com, RS Components, IEC Supply):

  H2000 × W600:
    8604.000 = H2000 × W600 × D400 mm
    8606.000 = H2000 × W600 × D600 mm

  H2000 × W800:
    8804.000 = H2000 × W800 × D400 mm
    8806.000 = H2000 × W800 × D600 mm

  H2000 × W1000:
    8004.000 = H2000 × W1000 × D400 mm
    8006.000 = H2000 × W1000 × D600 mm

  H1800 × W600:
    8684.000 = H1800 × W600 × D400 mm
    8686.000 = H1800 × W600 × D600 mm

  H1800 × W800:
    8886.000 = H1800 × W800 × D600 mm

  Formát katalogu: 4-místné číslo bez prefixu + .000 (příklad: 8606.000)
  VX25 využívá 25mm instalační mřížku; příslušenství SZ/DK kompatibilní

### AX – kompaktní nástěnné skříně (ocel, IP 66 / IK 10)

  Katalogová čísla (ověřeno z RS Components, automation24, Rittal.com):

  1033.000 = H300 × W300 × D210 mm, ocel, IP 66  ← min. hloubka je 210 mm
  1034.000 = H400 × W300 × D210 mm, ocel, IP 66
  1045.000 = H500 × W400 × D210 mm, ocel, IP 66
  1054.000 = H600 × W600 × D250 mm, ocel, IP 66
  1058.000 = H800 × W600 × D250 mm, ocel, IP 66
  1059.000 = H800 × W600 × D400 mm, ocel, IP 66  (větší hloubka)

  Formát: 4-místné číslo + .000 (příklad: 1033.000)

### KX – kompaktní nástěnné skříně (ocel), IP 66

  KX 1575.000 = H300 × W300 × D155 mm, ocelový plech, IP 66  (nejmenší hloubka 155 mm)

  Pozn.: KX 1575.000 je z ocelového plechu (ne z nerezové oceli AISI 304);
         pro nerezové provedení ověřit aktuální katalog Rittal

### SZ – příslušenství pro skříně

  SZ2309.000 = montážní úchytka pro DIN 35 mm podpěrnou lištu (snap-on)
  SZ2482.600 = průchodkový otvor / interface flap
  SZ2561.500 = plastová deska pro průchodky (kabelové pole)

### DK – DIN lišty a kabelové žlaby

  DK7100.100 = DIN 35 mm lišta perforovaná, délka 1000 mm
  DK7101.100 = DIN 35 mm lišta hladká, délka 1000 mm
  DK7110.100 = kabelový žlab perforovaný 60 × 60 mm, délka 1000 mm

### Poznámky

  VX25: 4-místné číslo + .000 (příklad: 8606.000) — nástupce TS 8
  AX/KX: 4-místné číslo + .000 (příklad: 1033.000)
  AX minimální hloubka = 210 mm; pro 155 mm hloubku → KX 1575.000
  KX 1575.000 = ocelový plech (ne nerez); pro nerez ověřit katalog
  DK artikly (DK7100/7101/7110) nebyly ověřeny — před objednávkou potvrdit v katalogu Rittal
`,
      },
    },
  }, // end rittal

  // ─── Pojistky ─────────────────────────────────────────────────────────────
  pojistka: {
    label: 'Pojistky',
    aliases: [
      'pojistka', 'pojistky', 'NH pojistka', 'nožová pojistka',
      'tavná pojistka', 'vložka pojistky', 'fuse link', 'gG pojistka',
      'silová pojistka', 'pojistková vložka', 'pojistkový nůž',
    ],
    questions: [
      'Jmenovitý proud? (16A, 35A, 63A, 100A, 160A, 200A, 250A, 315A, 400A, 630A)',
      'Velikost NH? (000, 00, 0, 1, 2, 3)',
      'Charakteristika? (gG = obecné, aM = motorová)',
      'Napětí? (500 V AC = standard, 690 V AC)',
    ],
    manufacturers: {
      eaton: {
        label: 'Eaton (Bussmann)',
        doc: `## Eaton Bussmann – NH pojistkové vložky (nožové pojistky)

### Schéma: [proud]NHG[velikost]B

  [proud]    = jmenovitý proud (A)
  NHG        = NH nůž, charakteristika gG
  [velikost] = 000 / 00 / 0 / 1 / 2 / 3
  B          = 500 V AC varianta

### Velikost NH 000 (do 100 A)

  16NHG000B  = 16 A,  NH 000, 500 V AC, gG
  20NHG000B  = 20 A,  NH 000, 500 V AC, gG
  25NHG000B  = 25 A,  NH 000, 500 V AC, gG
  35NHG000B  = 35 A,  NH 000, 500 V AC, gG
  50NHG000B  = 50 A,  NH 000, 500 V AC, gG
  63NHG000B  = 63 A,  NH 000, 500 V AC, gG
  80NHG000B  = 80 A,  NH 000, 500 V AC, gG
  100NHG000B = 100 A, NH 000, 500 V AC, gG

### Velikost NH 00 (do 160 A)

  100NHG00B  = 100 A, NH 00, 500 V AC, gG
  125NHG00B  = 125 A, NH 00, 500 V AC, gG
  160NHG00B  = 160 A, NH 00, 500 V AC, gG

### Velikost NH 0 (do 160 A)

  63NHG0B    = 63 A,  NH 0, 500 V AC, gG
  100NHG0B   = 100 A, NH 0, 500 V AC, gG
  125NHG0B   = 125 A, NH 0, 500 V AC, gG
  160NHG0B   = 160 A, NH 0, 500 V AC, gG

### Velikost NH 1 (do 250 A)

  63NHG1B    = 63 A,  NH 1, 500 V AC, gG
  100NHG1B   = 100 A, NH 1, 500 V AC, gG
  125NHG1B   = 125 A, NH 1, 500 V AC, gG
  160NHG1B   = 160 A, NH 1, 500 V AC, gG
  200NHG1B   = 200 A, NH 1, 500 V AC, gG
  250NHG1B   = 250 A, NH 1, 500 V AC, gG

### Velikost NH 2 (do 400 A)

  100NHG2B   = 100 A, NH 2, 500 V AC, gG
  160NHG2B   = 160 A, NH 2, 500 V AC, gG
  200NHG2B   = 200 A, NH 2, 500 V AC, gG
  250NHG2B   = 250 A, NH 2, 500 V AC, gG
  315NHG2B   = 315 A, NH 2, 500 V AC, gG
  400NHG2B   = 400 A, NH 2, 500 V AC, gG

### Velikost NH 3 (do 630 A)

  315NHG3B   = 315 A, NH 3, 500 V AC, gG
  355NHG3B   = 355 A, NH 3, 500 V AC, gG
  400NHG3B   = 400 A, NH 3, 500 V AC, gG
  500NHG3B   = 500 A, NH 3, 500 V AC, gG
  630NHG3B   = 630 A, NH 3, 500 V AC, gG

### Parametry NH pojistek gG

  Vypínací schopnost: 120 kA AC
  Charakteristika gG: ochrana před přetížením i zkratem (General purpose)
  Norma: IEC 60269-1, VDE 0636-2, DIN 43620
  Fyzické rozměry (dle DIN 43620):
    NH 000: délka ~73 mm, šířka ~22 mm
    NH 00:  délka ~73 mm, šířka ~26 mm
    NH 0:   délka ~73 mm, šířka ~33 mm
    NH 1:   délka ~73 mm, šířka ~44 mm
    NH 2:   délka ~73 mm, šířka ~55 mm
    NH 3:   délka ~73 mm, šířka ~67 mm

### Varianta 690 V AC

  Pro vyšší napětí (690 V AC): přidá se přípona -690 (ne "6")
  Příklad: 63NHG1B-690 = 63 A, NH 1, 690 V AC, gG
`,
      },
    },
  }, // end pojistka

  // ===========================================================================
  // NAPÁJECÍ ZDROJ (SMPS — Switched-Mode Power Supply)
  // ===========================================================================
  napajeci_zdroj: {
    label: 'Napájecí zdroj',
    aliases: [
      'napájecí zdroj', 'napajeci zdroj', 'zdroj', 'spínaný zdroj',
      'SMPS', 'DIN rail PSU', 'průmyslový zdroj', 'napájení',
      'QUINT', 'TRIO', 'SITOP', 'stabilizovaný zdroj',
      'primární spínaný', 'DC zdroj',
    ],
    questions: [
      { key: 'mfr',    text: 'Preferovaný výrobce?',                         options: ['Phoenix Contact', 'Siemens', 'Bez preference'] },
      { key: 'vstup',  text: 'Napájecí napětí vstupu?',                      options: ['1× 100–240 V AC (jednofázový)', '3× 400 V AC (třífázový)'] },
      { key: 'vystup', text: 'Výstupní napětí?',                             options: ['24 V DC (standard)', '12 V DC', 'Jiné'] },
      { key: 'proud',  text: 'Výstupní proud / výkon?',                      options: ['2,5 A (60 W)', '5 A (120 W)', '10 A (240 W)', '20 A (480 W)', '40 A (960 W)'] },
    ],
    manufacturers: {
      phoenix_contact: {
        label: 'Phoenix Contact',
        doc: `## Phoenix Contact – Napájecí zdroje QUINT4-PS a TRIO-PS

### QUINT4-PS – Výkonové DIN PSU s diagnostikou (24 V DC výstup)

  Schéma: QUINT4-PS/[vstup]/[výstup]/[proud]

  Jednofázový vstup (100–240 V AC):
    QUINT4-PS/1AC/24DC/5  (2904600) =  5 A / 120 W
    QUINT4-PS/1AC/24DC/10 (2904601) = 10 A / 240 W
    QUINT4-PS/1AC/24DC/20 (2904602) = 20 A / 480 W

  Třífázový vstup (3× 400–500 V AC):
    QUINT4-PS/3AC/24DC/20 (2904622) = 20 A / 480 W
    QUINT4-PS/3AC/24DC/40 (2904623) = 40 A / 960 W

### TRIO-PS-2G – Kompaktní DIN PSU, 2. generace (24 V DC výstup)

  Schéma: TRIO-PS-2G/[vstup]/[výstup]/[proud]

  Jednofázový vstup (100–240 V AC):
    TRIO-PS-2G/1AC/24DC/5  (2903148) =  5 A / 120 W
    TRIO-PS-2G/1AC/24DC/10 (2903149) = 10 A / 240 W

### Vlastnosti QUINT4-PS

  Vstup: 100–240 V AC, 50/60 Hz (jednofázové varianty)
  Výstup: 24 V DC ±1 % (nastavitelné 18–29,5 V)
  Diagnostika: LED + potenciál pro signalizaci, SFB (selectivity function)
  Montáž: DIN 35 mm lišta
  Krytí: IP20
  Pracovní teplota: –25 °C … +60 °C
  Normy: IEC 62368-1, UL 508A
  Číslo v závorce = objednací číslo Phoenix Contact
`,
      },
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Napájecí zdroje SITOP PSU100S

### SITOP PSU100S – Standardní DIN PSU, 24 V DC výstup

  Schéma: 6EP1[xxx]-[yyy]

  Jednofázový vstup (100–240 V AC):
    6EP1331-2BA20 =  2,5 A /  60 W, 24 V DC
    6EP1332-2BA20 =  5 A /  120 W, 24 V DC
    6EP1333-2BA20 = 10 A /  240 W, 24 V DC
    6EP1334-2BA20 = 20 A /  480 W, 24 V DC

### Vlastnosti PSU100S

  Vstup: 100–240 V AC, 50/60 Hz (automatický výběr)
  Výstup: 24 V DC ±1 % (nastavitelné 22–26 V)
  Indikace: zelená LED (výstup OK)
  Montáž: DIN 35 mm lišta
  Krytí: IP20
  Pracovní teplota: –25 °C … +60 °C
  Normy: IEC 62368-1, UL 508
`,
      },
    },
  }, // end napajeci_zdroj

  // ===========================================================================
  // DIN LIŠTA
  // ===========================================================================
  din_lista: {
    label: 'DIN lišta',
    aliases: [
      'DIN lišta', 'din lista', 'nosná lišta', 'montážní lišta',
      'omega lišta', 'NS35', 'TS35', 'tophat rail', 'DIN rail',
      '35mm lišta', 'hutní lišta',
    ],
    questions: [
      { key: 'sirka',  text: 'Šířka lišty?',                                 options: ['35 mm (DIN 35 = standard pro průmysl)', '15 mm (DIN 15 = pro malé prvky)'] },
      { key: 'material', text: 'Materiál?',                                   options: ['Ocel (pozinkovaná)', 'Nerez', 'Hliník'] },
      { key: 'delka',  text: 'Délka?',                                        options: ['2000 mm (standardní tyč)', '1000 mm', 'Zkrácená na míru'] },
    ],
    manufacturers: {
      phoenix_contact: {
        label: 'Phoenix Contact',
        doc: `## Phoenix Contact – DIN lišty NS35

### NS 35 – Standardní DIN 35 lišta (EN 60715)

  NS 35/ 7,5 UNPERF 2000MM (0801681) = 35×7,5 mm, ocel, 2000 mm, neperforovaná
  NS 35/15 UNPERF 2000MM    (1201714) = 35×15 mm, ocel, 2000 mm, neperforovaná
  NS 35/ 7,5 PERF 2000MM   (0801733) = 35×7,5 mm, ocel, 2000 mm, perforovaná (otvory Ø6,3 mm á 25 mm)

### Parametry

  Profil: symetrický omega profil (top-hat) dle EN 60715 / IEC 60715
  Materiál: pozinkovaná ocel (standard), alternativně nerez nebo hliník
  Výška profilu: 7,5 mm nebo 15 mm (standardní pro svorky a jistítka: 7,5 mm)
  Montážní délka: 2000 mm, zkracuje se na míru
  Číslo v závorce = objednací číslo Phoenix Contact
`,
      },
      wago: {
        label: 'WAGO',
        doc: `## WAGO – DIN lišty série 210

### 210-112 – 35 mm DIN lišta, 1000 mm

  210-112 = 35×7,5 mm, ocel pozinkovaná, 1000 mm, neperforovaná
  210-113 = 35×7,5 mm, ocel pozinkovaná, 2000 mm, neperforovaná

### Parametry

  Profil: EN 60715 / IEC 60715 omega (top-hat)
  Šířka: 35 mm, výška profilu: 7,5 mm
  Materiál: pozinkovaná ocel
  Použití: montáž svorkovnic WAGO a průmyslových komponent na DIN lištu
`,
      },
      weidmuller: {
        label: 'Weidmüller',
        doc: `## Weidmüller – DIN lišty TS 35X7.5

### TS 35X7.5 – 35 mm standardní DIN lišta

  TS 35X7.5 2M/ST/ZN (0383400000) = 35×7,5 mm, pozinkovaná ocel, 2000 mm, neperforovaná

### Parametry

  Profil: dle EN 60715 / IEC 60715
  Šířka: 35 mm, výška: 7,5 mm
  Materiál: pozinkovaná ocel
  Montáž do skříně: přes boční otvory nebo konec lišty
  Číslo v závorce = objednací číslo Weidmüller
`,
      },
    },
  }, // end din_lista

  // ===========================================================================
  // SOFTSTARTER (Softstartér / Motorový regulátor rozběhu)
  // ===========================================================================
  softstarter: {
    label: 'Softstarter',
    aliases: [
      'softstarter', 'soft starter', 'softstartér', 'plynulý rozběh',
      'motorový regulátor', 'rozběhový regulátor', '3RW', 'ATS22', 'PSR',
      'elektronický spouštěč', 'omezovač rozběhového proudu',
    ],
    questions: [
      { key: 'mfr',   text: 'Preferovaný výrobce?',                          options: ['Siemens', 'ABB', 'Schneider', 'Bez preference'] },
      { key: 'vykon', text: 'Výkon motoru? (kW)',                             options: ['Do 5,5 kW', '7,5 kW', '11 kW', '15 kW', '22 kW', '30 kW+'] },
      { key: 'vstup', text: 'Napájecí napětí?',                              options: ['3× 200–480 V AC (standard)', '3× 380–600 V AC'] },
    ],
    manufacturers: {
      siemens: {
        label: 'Siemens',
        doc: `## Siemens – Softstartéry SIRIUS 3RW40

### 3RW40 – Standardní softstartéry, 200–480 V AC, 24 V DC řídicí napětí

  Schéma: 3RW40[xx]-1BB14
    [xx] = kód výkonového stupně
    1BB14: základní varianta, 24 VDC řídicí obvod

  3RW4022-1BB14 = do  5,5 kW (400 V), Ie = 12 A
  3RW4023-1BB14 = do  7,5 kW (400 V), Ie = 17 A
  3RW4025-1BB14 = do 11,0 kW (400 V), Ie = 25 A
  3RW4026-1BB14 = do 15,0 kW (400 V), Ie = 32 A
  3RW4027-1BB14 = do 18,5 kW (400 V), Ie = 37 A
  3RW4028-1BB14 = do 22,0 kW (400 V), Ie = 45 A
  3RW4036-1BB14 = do 30,0 kW (400 V), Ie = 63 A
  3RW4038-1BB14 = do 37,0 kW (400 V), Ie = 72 A

### Parametry 3RW40

  Napájecí napětí (silová část): 3× 200–480 V AC, 50/60 Hz
  Řídicí napětí: 24 V DC (varianty -1BB14)
  Funkce: plynulý rozběh, plynulé zastavení (brzdění napětím)
  Nastavení: potenciometry (rozběhové napětí, čas rozběhu, čas dobrzďování)
  Bypass: interní bypass relé (nulové ztráty za chodu)
  Montáž: přímá (šrouby) nebo na DIN 35 mm lištu (s adaptérem)
  Norma: IEC/EN 60947-4-2
`,
      },
      abb: {
        label: 'ABB',
        doc: `## ABB – Softstartéry PSR (kompaktní)

### PSR – Jednoduché softstartéry, 24–690 V AC, pro přímé zapojení

  Schéma: PSR[proud]- [verze]

  PSR3-600-11  (1SFA896103R1100) =  3 A,  1,5 kW (400 V), 208–600 V AC vstup
  PSR6-600-11  (1SFA896104R1100) =  6 A,  3,0 kW (400 V)
  PSR9-600-11  (1SFA896105R1100) =  9 A,  4,0 kW (400 V)
  PSR16-600-11 (1SFA896107R1100) = 16 A,  7,5 kW (400 V)
  PSR25-600-11 (1SFA896108R1100) = 25 A, 11,0 kW (400 V)
  PSR37-600-11 (1SFA896110R1100) = 37 A, 18,5 kW (400 V)
  PSR60-600-11 (1SFA896112R1100) = 60 A, 30,0 kW (400 V)

### Parametry PSR

  Napájecí napětí (silová část): 24–690 V AC, 50/60 Hz
  Řídicí napětí: ze silové sítě (bez externího napájení)
  Funkce: plynulý rozběh (rampa napětí), volitelné plynulé zastavení
  Nastavení: jeden potenciometr pro počáteční napětí
  Bypass: interní bypass relé
  Montáž: DIN 35 mm lišta
  Norma: IEC/EN 60947-4-2
  Číslo v závorce = objednací číslo ABB
`,
      },
      schneider: {
        label: 'Schneider Electric',
        doc: `## Schneider Electric – Softstartéry Altistart ATS22

### ATS22 – Průmyslové softstartéry, 3× 208–600 V AC

  Schéma: ATS22[xxx]S6U

  ATS22D17S6U = 17 A,  7,5 kW (400 V), 3× 208–600 V AC
  ATS22D32S6U = 32 A, 15,0 kW (400 V)
  ATS22D47S6U = 47 A, 22,0 kW (400 V)
  ATS22D62S6U = 62 A, 30,0 kW (400 V)
  ATS22D75S6U = 75 A, 37,0 kW (400 V)

  Suffix S6U: 3× 208–600 V AC, vestavěný bypass

### Parametry ATS22

  Napájecí napětí: 3× 208–600 V AC, 50/60 Hz
  Řídicí napětí: 24 V DC nebo 110–240 V AC (dle verze)
  Funkce: plynulý rozběh + zastavení, ochrana motoru (tepelná, fázová)
  Komunikace: Modbus (vestavěný)
  Bypass: interní
  Montáž: přímá montáž nebo DIN 35 mm
  Norma: IEC/EN 60947-4-2
`,
      },
    },
  }, // end softstarter

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

/**
 * Agreguje docs pro daného výrobce přes všechny kategorie kde se vyskytuje.
 * @param {string} mfrKey
 * @returns {string}
 */
export function getKnowledgeDocByMfr(mfrKey) {
  const parts = [];
  for (const cat of Object.values(PRODUCT_KNOWLEDGE)) {
    if (cat.manufacturers?.[mfrKey]?.doc) {
      parts.push(cat.manufacturers[mfrKey].doc);
    }
  }
  return parts.join('\n\n---\n\n');
}

/**
 * Vrátí klíče výrobců pro kategorii odpovídající textu.
 * @param {string} text
 * @returns {string[]}
 */
export function resolveManufacturersByCategory(text) {
  const key = detectCategory(text);
  if (!key) return [];
  const cat = PRODUCT_KNOWLEDGE[key];
  return Object.keys(cat?.manufacturers ?? []);
}

/**
 * Vrátí seznam kategorií { key, label } pro zobrazení v průvodci.
 */
export function listCategories() {
  return Object.entries(PRODUCT_KNOWLEDGE).map(([key, cat]) => ({ key, label: cat.label }));
}

/**
 * Vrátí pole questions pro danou kategorii (z productKnowledge).
 */
export function getCategoryQuestions(key) {
  return PRODUCT_KNOWLEDGE[key]?.questions ?? [];
}

/**
 * Sestaví inject string pro AI na základě detekovaného kontextu zprávy.
 * Logika: kategorie+výrobce → specifický doc; jen kategorie → všechny docs kategorie;
 *         jen výrobce → agregace přes kategorie.
 *
 * @param {string} text - zpráva uživatele
 * @param {string|null} mfrKey - klíč výrobce (pokud znám)
 * @returns {{ doc: string, label: string }}
 */
export function buildKnowledgeContext(text, mfrKey = null) {
  const catKey = detectCategory(text);

  if (catKey && mfrKey) {
    const cat = PRODUCT_KNOWLEDGE[catKey];
    const doc = getKnowledgeDoc(catKey, mfrKey);
    if (doc) return { doc, label: `${cat?.label ?? catKey} — ${mfrKey}`, catKey };
  }

  if (catKey) {
    const cat = PRODUCT_KNOWLEDGE[catKey];
    const doc = getKnowledgeDoc(catKey);
    if (doc) return { doc, label: cat?.label ?? catKey, catKey };
  }

  if (mfrKey) {
    const doc = getKnowledgeDocByMfr(mfrKey);
    if (doc) return { doc, label: mfrKey, catKey: null };
  }

  return { doc: '', label: '', catKey: null };
}
