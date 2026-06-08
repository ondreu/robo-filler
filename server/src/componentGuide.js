// ---------------------------------------------------------------------------
// Průvodce komponentami — páteř řízeného vyhledávání
// Pro každou kategorii: otázky, znalosti výrobců, strategie vyhledávání.
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
    knowledge: `## Jistič — přehled kategorií

**MCB (Miniature Circuit Breaker)** — malý modulární jistič na DIN lištu (1–125A, typicky do 32A). Chrání vedení před přetížením a zkratem.
**MPCB (Motor Protection Circuit Breaker)** — motorový jistič (PKZ, MS, GV2ME). Nastavitelný proud, chrání motor i vedení.

### Výrobci a jejich typová označení MCB:
- **ABB S200 série**: S201=1P, S202=2P, S203=3P, S204=4P. Variant: S200=6kA, S200M=10kA, S200P=15–25kA.
  Formát: \`S2[P][var]-[char][A]\` → S203-C16 = 3P, 6kA, C char., 16A.  S203M-C16 = 3P, 10kA.
- **Siemens 5SY série**: 5SY6=6kA, 5SY4=10kA, 5SY7=15kA.
  Formát: \`5SY[kap][P][A]-[char_suffix]\` → 5SY4316-7 = 10kA, 3P, 16A, char. C (suffix -7=C, -6=B, -8=D).
- **Eaton FAZ série**: FAZ6=6kA, FAZ-DC, FAZN.
  Formát: \`FAZ[var]-[char][A]/[P]\` → FAZ6-C16/3 = 6kA, C, 16A, 3P.
- **Schneider Acti9 iC60**: iC60N=6kA, iC60H=10kA, iC60L=15kA.
  Formát: \`iC60[var] [P] [char][A]\` → iC60N 3P C16 nebo katalog A9F74316.

### Výrobci a jejich typová označení MPCB:
- **ABB MS116/MS132**: MS116 (0.1–16A), MS132 (0.16–32A), MS165 (10–80A). Formát: \`MS116-[proud]\`.
- **Siemens 3RV2**: 3RV2011=S00(0.16–1A), 3RV2021=S0(1–4A). Formát: \`3RV20[XX]-[rozsah]\`.
- **Eaton PKZM0**: PKZM0-0.16 až PKZM0-16. PKZM4=16–63A.
- **Schneider GV2ME**: GV2ME06=1–1.6A, GV2ME14=6–10A, GV2ME22=20–25A.

### Vyhledávací strategie:
Kombinuj: [výrobce_řada] + [proud] + [charakteristika] + [póly]
Příklad pro "ABB, 16A, C, 3P": S203-C16, S203 C16, jistič 16A C 3P, C16 3P, 16A C 3P, LS-Schalter 16A C, Leitungsschutzschalter C16
Vždy zahrň i varianty bez specifikace výrobce, německé výrazy (Leitungsschutzschalter, LS-Schalter) a anglické (MCB, circuit breaker).`,
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
    knowledge: `## Stykač — přehled kategorií

**Silový stykač** — 3-pólový výkonový spínač pro motorové obvody (AC-3 ≥ 6A). Montáž na DIN nebo přišroubován.
**Pomocný stykač** — jen pomocné kontakty (NO/NC), proud cívky malý, bez silových pólů.

### Výrobci a jejich typová označení:
- **ABB AF série**: AF09–AF2650. Elektronické vinutí 24–500V AC/DC.
  Formát: \`AF[A][vinutí]\` → AF09-30-10-13 = 9A, 3NO silové, 1NO+0NC aux., vinutí kód 13 (24–60V DC).
- **Siemens 3RT2**: S00=7–16A, S0=18–38A, S2=45–80A, S3=90–110A.
  Formát: \`3RT20[XX]-[civka]\` → 3RT2016-1BB41 = S00 (9A AC-3), 24V DC cívka.
  Kódy cívek DC (BB=24VDC), AC (BF=24V AC, EP=110V AC, AP=220V AC, AB=230V AC).
- **Eaton DILM**: DILM9=9A, DILM12=12A, DILM17=17A, DILM25=25A, DILM32=32A.
  Suffix aux: -10=1NO, -01=1NC, -11=1NO+1NC. Napětí cívky se objednává zvlášť (jako doplněk nebo suffix).
- **Schneider LC1D (TeSys D)**: LC1D06 (6A) až LC1D150 (150A). Pro >150A řada LC1F.
  Formát: \`LC1D[kód][civka]\` → LC1D09M7 = 9A, cívka 220VAC (M7). LC1D09BD = 9A, 24VDC (BD).
  Kódy cívek DC: BD=24V, CD=48V. Kódy cívek AC 50Hz: B7=24V, E7=48V, F7=110V, M7=220V, P7=230V.
- **Allen-Bradley 100-C**: 100-C09=9A, 100-C12, 100-C16, 100-C23, 100-C30, 100-C37, 100-C43.
  Formát: \`100-C[A][civka][aux]\` → 100-C09D10 = 9A, 24VDC (D), 1NO (10).

### Vyhledávací strategie:
Pro silový: [řada_výrobce] [proud] + stykač/kontaktor/Schütz/contactor + napětí cívky
Pro pomocný: pomocný stykač + konfigurace kontaktů
Příklad "Siemens 9A 24V DC": 3RT2016, 3RT2 9A, stykač 9A 24V DC, Schütz 9A 24V, SIRIUS 9A DC
Zahrni i varianty s přibližným proudem (±1 krok) protože jmenovité hodnoty jsou normalizované.`,
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
    knowledge: `## Pojistka — přehled typů

### NH pojistky (Knife-blade / Steckersicherung):
Velké průmyslové pojistky s nožovými kontakty. Velikosti 000/00/0/1/2/3.
- **Charakteristiky**: gG = kabelová ochrana (nejčastější), aM = motorová (jen zkrat), aR = rychlá (pro polovodiče, IGBT).
- **Výrobci**: Siemens (3NA série), ABB (E9F/E33 série), Schneider, ETI, Siba, Mersen (Ferraz).
- **Siemens 3NA**: 3NA3 (0), 3NA3 (1), 3NA3 (2), 3NA3 (3). Formát: \`3NA3[XXX]\` kde XXX kóduje proud.
- **Formát UN**: Pojistky EU mají standardní rozměry — UN pojistka = IEC norma, výrobci jsou zaměnitelní.

### Válcová pojistka:
- **10×38 mm**: Typické průmyslové použití, do 32A.
- **14×51 mm**: Silnoproudé, do 100A.
- **22×58 mm**: Velké průřezy.
- **Výrobci**: Siemens, ABB, Schneider, Eaton, ETI.

### Skleněná pojistka (miniaturní):
- **5×20 mm**: Standardní miniaturní, 0.1–16A.
- **6.3×32 mm**: Větší miniaturní.
- **Charakteristiky**: T=pomalá, F=rychlá, M=střední.

### Vyhledávací strategie:
Pro NH: gG + stupeň + proud, např. "NH gG 63A 00", "NH00 63A", "Sicherungseinsatz 63A gG"
Pro válcovou: rozměr + proud, např. "10x38 16A gG", "válcová pojistka 16A"
Zahrni německy: Schmelzsicherung, Sicherungseinsatz, NH-Sicherung, Zylindrische Sicherung
Anglicky: fuse link, HRC fuse, cylindrical fuse`,
  },

  // -------------------------------------------------------------------------
  // 4. Napájecí zdroj
  // -------------------------------------------------------------------------
  {
    key: 'napajeci_zdroj',
    label: 'Napájecí zdroj',
    aliases: ['napájecí zdroj', 'napajeci zdroj', 'napáječ', 'napaječ', 'psu', 'power supply', 'netzteil', 'netzgerät', 'din napájecí', '24v zdroj', '24vdc'],
    questions: [
      { key: 'mfr',     text: 'Máš preferovaného výrobce?',                           options: ['Phoenix Contact (QUINT/TRIO)', 'Weidmüller (PROtop)', 'Siemens (SITOP)', 'Mean Well', 'Murr', 'Bez preference'] },
      { key: 'vin',     text: 'Vstupní napájení?',                                    options: ['230 V AC jednofázové', '400 V AC třífázové', 'Nevím / univerzální'] },
      { key: 'vout',    text: 'Výstupní napětí (DC)?',                                options: ['24 V DC  (nejčastější)', '48 V DC', '12 V DC', '5 V DC', 'Jiné'] },
      { key: 'iout',    text: 'Výstupní proud nebo výkon? (napiš, např. 5A nebo 120W)' },
    ],
    mfrKeys: ['phoenix', 'weidmuller', 'siemens'],
    knowledge: `## Napájecí zdroje DIN — přehled

### Phoenix Contact:
- **QUINT 4**: Prémiové, výstup 24VDC / 5–40A. Průmyslové pro kritické aplikace. Přetížitelnost 125%.
  Formát: \`QUINT4-PS/[vstup]/24DC/[A]\` → QUINT4-PS/1AC/24DC/10.
- **TRIO 5**: Standardní průmyslový. 24VDC / 2.5–20A.
  Formát: \`TRIO-PS/[vstup]/24DC/[A]\` → TRIO-PS/1AC/24DC/5.
- **STEP 3**: Kompaktní ekonomický, 24VDC / 0.5–3A.
- **UNO POWER**: Jednofázové 24V, do 20A.

### Weidmüller:
- **PRO ECO 3**: Ekonomická řada. PRO ECO3 24VDC 5A.
- **PROtop**: Pokročilá řada s diagnostikou. 24VDC 10/20/40A.
- **CP SNT**: Starší ekonomická.

### Siemens SITOP:
- **PSU100S**: Standardní, 1/2-fázový vstup, 24VDC 2.5–40A. Formát: \`6EP1[XXX]\`.
- **PSU3600**: Výkonné třífázové, 10–40A. Formát: \`6EP3[XXX]\`.
- **PSU8600**: Modulární systém s battery buffer.

### Mean Well:
- **HDR série**: DIN lišta, 15–100W.
- **NDR série**: DIN lišta, 120–480W.
- **DR série**: Ekonomická DIN.

### Vyhledávací strategie:
24V DC + proud/výkon, DIN montáž, výrobce + řada
Příklad: "QUINT4 24V 10A", "napájecí zdroj 24VDC 5A DIN", "Netzteil 24V 5A", "PSU 24VDC 5A"
Zahrni: napájecí zdroj, napaječ, PSU, Netzteil, power supply, SITOP, QUINT, TRIO, PROtop`,
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
    knowledge: `## Svorky DIN — přehled

### WAGO:
- **TOPJOB S 2000 série** (Push-in CAGE CLAMP, DIN): Hlavní rozváděčová řada.
  Formát: \`20[XX]-1[Y][ZZ]\` kde XX=průřez (01=1.5mm², 02=2.5mm², 04=4mm², 06=6mm²), Y=počet vodičů (2/4), ZZ=barva (01=šedá, 02=oranž, 04=modrá, 07=ZeŽlu PE).
  Příklady: 2002-1201=2.5mm² šedá, 2002-1401=4vod. 2.5mm².
- **221 LEVER-NUT** (páčkové, inline, bez DIN): Tuhý/lankový vodič s páčkou. 221-412=4mm² 2-vod., 221-415=4mm² 5-vod.
- **2273 PUSH WIRE** (krabičkové): Pro instalační krabice. 2273-203=3vod., 2273-208=8vod.

### Phoenix Contact (CLIPLINE):
- **PT 2,5** (Push-in CAGE CLAMP): PT 2,5 BU (modrá), PT 2,5-PE (PE).
- **UT 2,5** (šroubová Reakdyn): UT 2,5, UT 4, UT 6.
- **ST 2,5** (pružinová klecová): ST 2,5, ST 4.
- Číslování: \`[Série] [průřez] [barva/přípona]\` — UT 2,5-TWIN, PT 2,5 BU, PTFIX 6/12X2,5.

### Weidmüller:
- **WDU** (šroubová W-série): WDU 2.5, WDU 4, WDU 6, WDU 10, WDU 16.
- **WPE** (PE svorka): WPE 2.5, WPE 4, WPE 6.
- **ZDU** (pružinová Z-série): ZDU 2.5, ZDU 4.
- **WTR** (testovací/odpojovací).

### Příslušenství:
- **Čílka (end plates/markers)**: WAGO WSB, Phoenix ZB, Weidmüller ESW. Číslování a popis pro svorky.
- **Propojky (jumpers/bridges)**: WAGO 2002-402, Phoenix FBS, Weidmüller QV. Propojují sousední svorky.
- **Krajní dorazy (end brackets/stops)**: WAGO 2002-1990, Phoenix E/TW, Weidmüller AEB.
- **Nosič na DIN lištu (mounting carrier)**: Telo svorkovnice bez vodičů.

### Vyhledávací strategie:
[výrobce] + [série] + [průřez] + [barva/funkce]
Příklady: "WAGO 2002 2.5mm² šedá", "PT 2,5 Phoenix", "WDU 2.5 Weidmüller", "svorka 2.5mm² push-in"
Zahrni: svorka, terminal, Klemme, Reihenklemme, průřez v mm², barvu (modrá, šedá, zelenožlutá, PE)`,
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
    knowledge: `## Frekvenční měniče — přehled

### Siemens SINAMICS:
- **G120 (modulární)**: Výkonová část (PM) + řídicí jednotka (CU). PM240=standardní, PM250=rekuperace, PM260=vysoké napětí.
  Formát PM: \`6SL3210-1[PM_typ][velikost]\`. Příklad: 6SL3210-1PE21-8UL0 = G120 PM240-2, 2.2kW.
  Formát CU: \`6SL3244-0BB12-1PA1\` = CU240E-2.
- **G120C (kompaktní)**: Vše v jednom. \`6SL3210-1KE[výkon][napětí]\`.
- **G120X**: Pro čerpadla/ventilátory, IP20–IP66. \`6SL3220-3YE[velikost]\`.
- **V20**: Ekonomický, jednofázový vstup nebo třífázový, do 30kW.

### ABB ACS:
- **ACS55**: Do 2.2kW, 1-fázový vstup 230V. Kompaktní.
- **ACS150**: Do 7.5kW, 1-fáze nebo 3-fáze.
- **ACS355**: Průmyslový, do 45kW. IP66 varianta.
- **ACS580**: Generální pohon, do 2800kW. \`ACS580-01-[xxxx]-4\`.
- **ACS880**: Prémiový, vektorový, rekuperace.

### Schneider Altivar:
- **ATV12**: Do 4kW, 1-fázový vstup.
- **ATV320**: Do 15kW, skalár nebo vektor.
- **ATV340**: PMSM i asynchronní.
- **ATV630**: Procesní (čerpadla, ventilátory), do 630kW.

### Danfoss FC:
- **FC51 (Micro Drive)**: Do 22kW.
- **FC301**: 1-fázový vstup, do 3.7kW.
- **FC302**: Prémiový vektorový, do 1.4MW.

### Vyhledávací strategie:
[výrobce] + [výkon]kW + [napájecí napětí] + VFD/FU/měnič/pohon
Příklady: "SINAMICS G120 2.2kW", "ACS580 4kW 400V", "Altivar ATV320 2.2kW", "frekvenční měnič 2.2kW 400V"
Zahrni: frekvenční měnič, VFD, Frequenzumrichter, Umrichter, pohon, invertor, kW + napětí`,
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
    knowledge: `## Soft Startéry — přehled

Softstartér omezuje záběrný proud motoru při rozběhu (typicky na 2–4×In).

### Siemens SIRIUS 3RW:
- **3RW40 (základní)**: Bez bypasse. 7.5–55kW/400V.
- **3RW44 (pokročilý)**: S integrovaným bypassem a diagnostikou.
- **3RW55 (prémiový)**: Komunikace, rampování, s bypassem.

### ABB:
- **PSR (ekonomický)**: Do 45kW, bez bypass. Formát: \`PSR[A]\`.
- **PST/PSTB (pokročilý)**: PST s bypassem (B). Do 1250A. Formát: \`PST[A]B\`.

### Schneider Altistart:
- **ATS22 (základní)**: 1-fázový vstup nebo 3-fázový, do 75kW.
- **ATS48 (pokročilý)**: Do 900kW, rozšířená ochrana.

### Vyhledávací strategie:
softstarter + výkon + výrobce/řada
Příklady: "3RW40 7.5kW", "PSR 15kW ABB", "Altistart ATS22 11kW", "softstarter 15kW 400V"
Zahrni: softstarter, Sanftanlasser, soft-starter, plynný rozběh`,
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
    knowledge: `## Transformátory — přehled typů

### Řídicí transformátor (Steuertransformator):
Primár 230V nebo 400V, sekundár 110V nebo 230V. Izolace řídicích obvodů od silové části.
Výrobci: Block, Murr Elektronik, Hahn, ABB (malé), Siemens.
Výkony: 25–1600 VA. Montáž na DIN nebo přišroubování.

### Bezpečnostní transformátor (Sicherheitstransformator, SELV):
Sekundár 24V nebo 12V AC, galvanická izolace pro dotyková bezpečnost.
Výrobci: Block, Murr, HAHN, Würth.

### Oddělovací transformátor (Trenntransformator):
1:1 izolace, sekundár = primár. Pro IT sítě, lékařská technika, ochrana před zemním spojením.
Výrobci: Block, ABB, Schneider.

### Vyhledávací strategie:
typ + výkon (VA) + napájecí napětí + výstupní napětí
Příklady: "řídicí transformátor 100VA 400/230V", "Steuertransformator 250VA", "bezpečnostní trafo 24V 100VA"
Zahrni: transformátor, trafo, Transformator, Steuertransformator, Sicherheitstransformator, VA + napětí`,
  },

  // -------------------------------------------------------------------------
  // 9. Relé
  // -------------------------------------------------------------------------
  {
    key: 'rele',
    label: 'Relé',
    aliases: ['relé', 'rele', 'relay', 'relais', 'ssr', 'solid state relay', 'elektromechanické relé', 'patice', 'g2r', 'my2', 'my4'],
    questions: [
      { key: 'subtype', text: 'Jaký typ relé?',                                       options: ['Elektromechanické (cívka + kontakty)', 'SSR (solid state, polovodičové)', 'Reléový modul na DIN (hotový modul s patičkou)'] },
      { key: 'civka',   text: 'Napájecí napětí cívky?',                               options: ['24 V DC', '24 V AC', '230 V AC', '12 V DC', '110 V AC', 'Nevím'] },
      { key: 'konf',    text: 'Konfigurace kontaktů?',                                options: ['1×CO (SPDT, přepínací)', '2×CO (DPDT, 2 přepínací)', '4×CO (4 přepínací)', '1 NO', '1 NC', 'Nevím'] },
      { key: 'proud',   text: 'Jmenovitý proud kontaktů?',                            options: ['5–6 A', '8–10 A', '16 A', 'Nevím'] },
      { key: 'montaz',  text: 'Způsob montáže?',                                      options: ['Do patice (soklu) na DIN lištu', 'Přímo na DIN (bezpaticové)', 'Na plošný spoj (PCB)', 'Nevím'] },
    ],
    mfrKeys: ['omron', 'weidmuller', 'phoenix'],
    knowledge: `## Relé — přehled typů

### Elektromechanická relé do patice:
#### Omron G2R (1–2 póly, 10A):
Nejrozšířenější řada průmyslových relé. Do patice P2RF.
Formát: \`G2R-[póly][přípona] [napájení]\` → G2R-1-SN DC24 = 1pól (SPDT), patice, LED, 24VDC.
G2R-2-SN AC230 = 2pól (DPDT), patice, LED, 230VAC.

#### Omron MY (2–4 póly, 5–10A):
Miniaturní řada. Do patice PYF.
Formát: \`MY[póly][přípony] [napájení]\` → MY2N DC24 = 2pól (DPDT), LED, 24VDC. MY4N AC230 = 4pól.
Patice: PYF08A pro MY2 (8-pin), PYF14A pro MY4 (14-pin).

#### Phoenix Contact PLC-RSP (reléový modul):
Hotový modul relé + patice + LED. 24VDC cívka.
Formát: \`PLC-RSP-24DC/21\` = 2CO, 24VDC, 8A.

#### Weidmüller RAION / RCL (reléové moduly):
Modulární DIN reléové sokly.

### SSR (Solid State Relay):
Bez kontaktů, spínáno opticky. Řídící napětí: typicky 4–32V DC. Výstup: 48–480V AC nebo 5–220V DC.
Výrobci: Carlo Gavazzi, CRYDOM/Sensata, Siemens, Schneider.
Formát: vstupní napětí / výstupní proud / typ výstupu (AC/DC).

### Vyhledávací strategie:
typ + napětí cívky + konfigurace kontaktů + výrobce/řada
Příklady: "G2R-2 24VDC", "MY2N DC24", "relé 24VDC 2CO 8A patice", "Relais 24V DC 2 Wechsler"
Zahrni: relé, relay, Relais, cívka, kontakty, patice, sokl, 24VDC, CO/NO/NC`,
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
    knowledge: `## DIN lišty — přehled

### Profily:
- **TS 35 / NS 35** (omega, TH35, TOP hat rail): Nejpoužívanější. Výška 35mm, šířka různá (7.5mm nebo 15mm). ISO 60715 / EN 60715. Standardní pro 98% DIN komponent.
- **TS 35 plochá** (shallow): Nižší profil, 35mm šířka ale menší hloubka.
- **TS 15 / NS 15**: Narrower 15mm omega rail pro malé přístroje.
- **G-profil (GS 35, C-rail)**: Otevřená C-forma, pro svorky bez závěsu.

### Materiály:
- **Zinkovaná ocel** (Standard, St verzinkt): Nejběžnější, cenově dostupná.
- **Nerez (A2, AISI 304)**: Pro vlhké, chemicky agresivní prostory (potravinářství, farmaceutika).
- **Hliník**: Lehká alternativa.

### Délky: Standardně 1m a 2m, dělitelné na libovolnou délku.

### Výrobci: Phoenix Contact, WAGO, Weidmüller, Schneider, Hager, Rittal, generické.
Označení v DB bývá: "NS 35", "TS35", "Hutschiene", "DIN lišta 35mm", "Tragschiene NS35".

### Vyhledávací strategie:
profil + délka + materiál
Příklady: "NS 35 1m", "TS35 1000mm ocel", "Hutschiene 35", "DIN rail 35mm", "Tragschiene NS35 1000"
Zahrni: DIN lišta, DIN rail, Hutschiene, Tragschiene, NS35, TS35, omega lišta`,
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
    knowledge: `## Rittal — přehled produktů

### Řady skříní:
- **KX (malé, IP 66)**: Od 150×150×80mm. Nástěnné, svorkovnicové. Ocel nebo nerez (A4). Pro venkovní montáž přístrojů.
- **AX (kompaktní nástěnné, IP 66)**: Do 1000×1400×300mm. Ocel nebo nerez (AISI 304). 25mm rastr. Typické rozváděčové skříně.
- **TS 8 (velké stojatá, IP 66)**: Tradiční řada. 16trubkový rám, 25mm rastr. Přisazovatelné.
- **VX25 (velká stojatá, IP 66)**: Nástupce TS8. Symetrie, 25mm rastr, zpětně kompatibilní s TS8 příslušenstvím.

### Katalogové číslování:
- AX prefix: \`AX\` + 7místný kód (např. AX 1042.600). Rozměry: šxvxh.
- TS 8 prefix: \`8xxx\` nebo \`8xxxx\`
- VX25: \`VX-25\` prefix nebo \`6U6xxxx\`
- Montážní deska: označena MP (mounting plate) nebo DIN + rozměry.
- Sokl: PS (plinth), BP (base plate), AE prefix.

### Příslušenství:
- **Montážní deska**: Do nástěnné AX / KX skříně. Ocel nebo nerez.
- **Kabelová vývodnice / vývod** (Cable entry frame): Spodní vývodnicový rám.
- **Zámky**: 3bodový, čtvrtotočný, vložkový (s klíčem).
- **Větrání**: Větrací filtry (filtrační rohož + mřížka), tepelné výměníky Blue e+.
- **Sokl (plinth)**: Sada nohou nebo plechový sokl. Výška 100–200mm.
- **Montážní profily**: Pro montáž přístrojů nebo DIN lišt v TS/VX.

### Vyhledávací strategie:
[výrobce Rittal] + [řada] + [rozměry nebo katalogové číslo]
Příklady: "Rittal AX 400×500", "VX25 800×2000×400", "TS8 montážní deska", "Rittal KX 300×300"
Zahrni: Rittal, skříň, Schaltschrank, rozváděč, AX, VX25, TS8, KX, montážní deska, příslušenství`,
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
    knowledge: `## Hlavní vypínače — přehled

Odpínač (rozváděčový hlavní vypínač) — bezpečnostní odpojení napájení, viditelně přerušuje obvod.

### ABB:
- **OT série**: OT16F3, OT32F3, OT40F3, OT63F3, OT100F3. DIN nebo příruba.
  Formát: \`OT[A][P]\` kde A=proud, P=póly (3=3P, 4=4P). F=přírubový, D=DIN.
- **OHBS / T1...T7 (příslušenství k JM jistačům)**.

### Siemens:
- **3LD2 serie**: Bezpečnostní odpínač, do 100A. Montáž na dveře rozváděče nebo do otvoru.
  Formát: \`3LD2[XX]\`.

### Schneider:
- **VCF (Vari-Fit)**: 16–125A, pro montáž do panelu.

### Eaton:
- **P1/P3**: Vačkové odpínače, různé proudové rozsahy.

### Vyhledávací strategie:
odpínač + proud + póly + výrobce
Příklady: "odpínač 63A 3P ABB", "Hauptschalter 40A 3P", "hlavní vypínač 32A DIN", "safety switch 63A"
Zahrni: odpínač, hlavní vypínač, Hauptschalter, Lasttrennschalter, vačkový, main switch, proud + póly`,
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
    knowledge: `## Tlačítka a ovládací prvky — přehled

### Schneider XB4 / XB5:
- **XB4**: Ø22mm, plastové nebo kovové (XB4B). XB4BA31 = zelené tlačítko 1NO.
- **XB5**: Ø22mm, plastové. Ekonomická varianta.
- **ZB4**: Náhradní hlavy pro XB4 tělesa.
- **XALD**: Modulární tělesa. XALE = LED, XASP = nouzové zastavení (E-stop).
  Nouzové zastavení: XB4BS54 (hříbek, obust.), XB5AT42 (plastové, klíčové odblokování).

### Siemens 3SB3:
- **3SB3001**: Základní modulární tlačítková tělesa.
- **3SB3400**: Signálky. 3SB3400-1B = červená, AC/DC universal.
- Moduly se skládají: těleso + kontaktní blok + hlava.

### Eaton M22 série:
- **M22-D-** (tělesa): M22-D-G = zelené tlačítko, M22-D-R = červené.
- **M22-K10** (kontakt 1NO), **M22-K01** (kontakt 1NC).
- **M22-PV-** (signálky): M22-PV-G = zelená LED 24V.

### ABB CP série:
- CP1-10R-10 = 22mm červené, 1NO. CP1-10G-11 = zelené, 1NO+1NC.

### Nouzové zastavení (E-stop):
Standardně červený hříbek na žlutém podkladu (EN 13850). Kontakt 1NC nebo 2NC (bezpečnostní).
Odvarvení: mechanické nebo klíčem. Standardní průměr: 40mm nebo Ø60mm hříbek.

### Vyhledávací strategie:
typ + průměr + barva + kontakt + výrobce/řada
Příklady: "XB4 22mm zelené 1NO", "3SB3001 tlačítko", "M22 signálka LED 24V", "nouzové zastavení E-stop 22mm"
Zahrni: tlačítko, Drucktaster, Taster, push button, signálka, Meldeleuchte, E-stop, barva, průměr`,
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
    knowledge: `## Průchodky kabelové — přehled

Kabelová průchodka = šroubení pro zavedení kabelu do rozváděče / krabice s těsněním.

### Závitové standardy:
- **Metrický M (ISO)**: M16, M20 (nejčastější), M25, M32, M40, M50, M63. Moderní standard, doporučený.
- **PG (Panzergewinde/Pg)**: Pg7, Pg9, Pg11, Pg13.5, Pg16, Pg21, Pg29, Pg36. Starší, stále v použití.

### Materiály a aplikace:
- **Polyamid PA / plast**: Standardní, cenově dostupný. Typicky IP54 nebo IP68.
- **Mosaz MS (CuZn)**: Pro vyšší mechanické namáhání, EMC stínění, průmysl.
- **Nerez (AISI 304/316)**: Korozivní prostředí (offshore, potravinářství, chemie).

### Výrobci:
Roxtec (speciální, těsnící systémy), Pflitsch, Jacob (Jaeger), Icotek, Hummel, ABB, Fischer (Connectors), Wiska, CMP.
V databázi typicky: průchodka M20 PA, Kabelverschraubung M20 PA, průchodka M20 nerez.

### Doplňkové produkty:
- **Redukce (reducer)**: Pro menší kabely do větší průchodky.
- **Slepé zátky (blanking plugs)**: Plomba bez kabelu.
- **Těsnicí vložky (sealing inserts)**: Pro více kabelů v jedné průchodce.
- **Ochranné hadice a příslušenství**: Pro vedení kabelu.

### Vyhledávací strategie:
materiál + závit + IP (volitelně)
Příklady: "průchodka M20 PA", "průchodka M20 mosaz IP68", "Kabelverschraubung M20 Messing", "cable gland M20 PA black IP68"
Zahrni: průchodka, Kabelverschraubung, cable gland, závit M20/M25..., materiál PA/mosaz/nerez, IP68`,
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
    knowledge: `## Záslepky (slepé zátky) — přehled

Záslepka = plastová nebo kovová zátka pro neobsazený otvor rozváděče nebo kabelového vstupu.

### Typy:
- **Metrická závitová záslepka**: M16, M20, M25, M32, M40, M50, M63. Šroubuje se do průchodkového otvoru (M-závit). Nejčastěji polyamid PA černý.
- **PG záslepka**: Pg9, Pg11, Pg13.5, Pg16, Pg21. Starší standard.
- **Plochá záslepka (snap-in)**: Pro ploché vývrty bez závitu, cvaknutím. Průměry: Ø18, Ø22, Ø25, Ø30mm.
- **DIN záslepka**: 1 modularní jednotka DIN (17.5mm šíře), pro volné pozice na DIN liště.

### Materiály: PA (polyamid, nejčastější), mosaz MS, nerez AISI316.

### Výrobci: Pflitsch, Icotek, Wiska, Jacob, Fischer, různí generičtí.
V databázi typicky: "záslepka M20 PA", "Blindstopfen M20", "Verschlussstopfen M20", "M20 zátka".

### Vyhledávací strategie:
záslepka + závit + materiál
Příklady: "záslepka M20 PA", "záslepka M20 černá", "Blindstopfen M20", "Verschlussstopfen M20 PA"
Zahrni: záslepka, zátka, Blindstopfen, Verschlussstopfen, blind plug, closing plug + závit M20/M25...`,
  },

  // -------------------------------------------------------------------------
  // 16. Proudový chránič (bonus)
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
    knowledge: `## Proudové chrániče — přehled

**RCCB** (Residual Current Circuit Breaker): Pouze chránič, bez nadproudové ochrany. Přidává se za jistič.
**RCBO** (RCCB + Overcurrent): Kombinovaný jistič + chránič v jednom modulu.

### Typy citlivosti:
- **Typ AC**: Reaguje jen na sinusové zemní proudy. Základní typ (označení ~ nebo AC).
- **Typ A**: Reaguje na sinusové i pulsující DC. Nutný pro elektroniku, frekvenční měniče, LED.
- **Typ B**: Reaguje na všechny typy vč. hladkého DC. Pro FVE, VFD, nabíječky EV.

### Výrobci:
- **ABB F200/FH200**: F202A-40/0.03 = 2P, 40A, 30mA, Typ A.
- **Siemens 5SM**: 5SM2 (RCCB Typ AC), 5SM2 032-2 = 2P, 40A, 30mA.
- **Schneider Acti9**: iID 2P 40A 30mA Typ A = katalog A9R14240.

### Vyhledávací strategie:
chránič/RCD + proud + citlivost + typ (AC/A/B) + póly
Příklady: "proudový chránič 40A 30mA Typ A 2P", "RCCB 40A 30mA", "F202A 40A", "FI-Schutzschalter 40A 30mA Typ A"
Zahrni: proudový chránič, RCD, RCCB, FI-Schutzschalter, citlivost (30mA, 300mA), typ AC/A/B`,
  },

  // -------------------------------------------------------------------------
  // 17. Přepěťová ochrana (bonus)
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
    knowledge: `## Přepěťová ochrana (SPD) — přehled

### Třídy (typy) ochrany:
- **T1 (Typ 1)**: Na vstupu budovy (za HDS). Chrání před přímým bleskem. Impuls 10/350µs. Nutný pro systémy s LPS.
- **T2 (Typ 2)**: V rozváděčích. Chrání před bleskem v síti. Impuls 8/20µs. Nejčastější pro průmyslové rozváděče.
- **T3 (Typ 3)**: U citlivých přístrojů (PLC, PC). Jemná ochrana, blízko spotřebiče.
- **Kombinované T1+T2**: Vše v jednom, praktické.

### Výrobci:
- **ABB OVR**: OVR T2 1N 40-275 P TS = T2, 1fáze+N, 40kA, 275Vac, plug-in, tepelné odpojení.
- **Siemens 5SD**: 5SD7414-1 = T2, 4P, 40kA.
- **Phoenix Contact Trabtech**: PT-IQ-2+1-BE-230AC = T2, 2-pólový.
- **Schneider PRD1 25r**: PRD1 25r+N T2 25kA.

### Vyhledávací strategie:
SPD + třída + proud blesku (kA) + napětí + póly
Příklady: "přepěťová ochrana T2 40kA 3P+N", "SPD T2 25kA 400V", "OVR T2 40kA", "Überspannungsschutz T2 40kA"
Zahrni: přepěťová ochrana, SPD, Überspannungsschutz, Ableiter, bleskojistka, T1/T2/T3, kA, VAC`,
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
