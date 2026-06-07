// ---------------------------------------------------------------------------
// Internal helper — strips diacritics, lowercases. Used for robust matching.
// ---------------------------------------------------------------------------
function normalizeForSearch(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// resolveManufacturerKey
// Maps a manufacturer name (or product alias) to an internal key.
// Extended with product-name aliases — only for highly distinctive terms that
// would never appear as an alias for another manufacturer.
// ---------------------------------------------------------------------------
export function resolveManufacturerKey(name) {
  if (!name) return null;
  const n = normalizeForSearch(name);

  // WAGO — distinctive product names: CAGE CLAMP (vynalezli), LEVER-NUT, TOPJOB S
  if (n.includes('wago') || n.includes('cage clamp') || n.includes('lever-nut') || n.includes('topjob')) return 'wago';

  // ABB — zkratka je exkluzivní, nepotřebuje aliasy
  if (/\babb\b/.test(n)) return 'abb';

  // Schneider Electric — historické značky a klíčové produktové brandové jméno
  if (
    n.includes('schneider') ||
    n.includes('telemecanique') ||       // Télémécanique — bez diakritiky po normalizaci
    n.includes('merlin gerin') ||
    n.includes('merlin gerin') ||
    n.includes('square d') ||
    n.includes('acti9') || n.includes('acti 9') ||
    n.includes('tesys') ||               // TeSys — průmyslový brand Schneider
    /\blc1d\b/.test(n) ||               // TeSys D kontaktor
    n.includes('modicon') ||             // PLC řada Schneider
    n.includes('altivar') ||             // VFD řada Schneider
    n.includes('altistart') ||
    n.includes('zelio')                  // logický modul Schneider
  ) return 'schneider';

  // Siemens — brandová jména SENTRON a SIRIUS jsou exkluzivní
  if (
    n.includes('siemens') ||
    n.includes('sentron') ||             // brand pro LV ochranu
    /\bsirius\b/.test(n) ||             // brand pro průmyslové řízení motorů
    n.includes('sinamics') ||            // VFD řada Siemens
    n.includes('sitop')                  // napájecí zdroje Siemens
  ) return 'siemens';

  // Phoenix Contact — CLIPLINE je jejich registrovaný systémový brand
  if (
    n.includes('phoenix') ||
    n.includes('clipline') ||            // svorkovnicový systém Phoenix
    n.includes('trabtech') ||            // přepěťová ochrana Phoenix
    /\bquint\b/.test(n)                 // napájecí zdroje Phoenix (QUINT)
  ) return 'phoenix';

  // Weidmüller
  if (n.includes('weidm')) return 'weidmuller';

  // Allen-Bradley / Rockwell Automation
  if (
    n.includes('allen') ||
    n.includes('bradley') ||
    n.includes('rockwell') ||
    n.includes('powerflex') ||           // VFD řada Allen-Bradley
    n.includes('controllogix') ||
    n.includes('compactlogix')
  ) return 'allen_bradley';

  // Rittal — VX25 a TS8 jsou exkluzivní označení skříňových řad
  if (
    n.includes('rittal') ||
    /\bvx25\b/.test(n) ||
    n.includes('ts 8') || /\bts8\b/.test(n)
  ) return 'rittal';

  // Eaton (Moeller) — DILM a PKZM jsou výhradně Eaton/Moeller
  if (
    n.includes('eaton') ||
    n.includes('moeller') ||             // anglická transkripce
    n.includes('moller') ||              // "möller" po normalizaci → "moller"
    n.includes('klockner') ||            // "Klöckner" po normalizaci → "klockner"
    /\bdilm\b/.test(n) ||              // kontaktory Eaton
    /\bpkzm\b/.test(n)                 // motorové spouštěče Eaton
  ) return 'eaton';

  // Omron — G2R a MY jsou výhradně Omron designace
  if (
    n.includes('omron') ||
    /\bg2r\b/.test(n) ||
    /\bmy[24]n?\b/.test(n)              // MY2N, MY4N atd.
  ) return 'omron';

  return null;
}

// ---------------------------------------------------------------------------
// detectDominantManufacturer
// Returns the dominant vyrobce name if ≥50% of articles share it, else null.
// ---------------------------------------------------------------------------
export function detectDominantManufacturer(articles) {
  if (!articles.length) return null;
  const counts = {};
  for (const a of articles) {
    const mfr = (a.vyrobce ?? '').trim();
    if (!mfr) continue;
    counts[mfr] = (counts[mfr] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  const [topMfr, topCount] = sorted[0];
  return topCount / articles.length >= 0.5 ? topMfr : null;
}

// ---------------------------------------------------------------------------
// MANUFACTURER_CATEGORIES
// Keyword → array of manufacturer keys pro cross-manufacturer injekci.
// Klíče jsou normalizované (bez diakritiky) — vstupy se normalizují před porovnáním.
// Zahrnuje pouze výrobce, pro které je daná kategorie primárním produktem.
// ---------------------------------------------------------------------------
export const MANUFACTURER_CATEGORIES = {

  // --- Svorky / terminály ---
  svorka:       ['wago', 'phoenix', 'weidmuller'],
  svorky:       ['wago', 'phoenix', 'weidmuller'],
  svorkovnic:   ['wago', 'phoenix', 'weidmuller'],  // svorkovnice, svorkovnicový
  terminal:     ['wago', 'phoenix', 'weidmuller'],
  konektor:     ['phoenix', 'weidmuller'],
  pruchod:      ['phoenix', 'weidmuller', 'rittal'], // průchodka / průchodky

  // --- Jistič / MCB / MCCB ---
  jistic:       ['abb', 'siemens', 'eaton', 'schneider'], // jistič, jisticí, jistice
  mcb:          ['abb', 'siemens', 'eaton', 'schneider'],
  mccb:         ['abb', 'siemens', 'eaton', 'schneider'],

  // --- Stykač / kontaktor ---
  stykac:       ['abb', 'siemens', 'eaton', 'schneider', 'allen_bradley'], // stykač
  kontaktor:    ['abb', 'siemens', 'eaton', 'schneider', 'allen_bradley'],

  // --- Motorová ochrana / startér ---
  motorov:      ['abb', 'siemens', 'eaton', 'schneider'],  // motorová/motorový/motorovém
  spoustec:     ['abb', 'siemens', 'eaton', 'schneider'],  // spouštěč

  // --- Relé ---
  rele:         ['omron', 'abb', 'siemens', 'weidmuller', 'phoenix'],  // relé

  // --- Rozváděčové skříně / mechanika ---
  skrin:        ['rittal'],  // skříň, skříně
  rozvadec:     ['rittal'],  // rozváděč
  dvere:        ['rittal'],  // skříňové dveře
  deska:        ['rittal'],  // montážní deska
  bocnic:       ['rittal'],  // bočnice, bočnicový
  mechanika:    ['rittal'],
  panel:        ['rittal'],

  // --- Softstarter ---
  softstarter:  ['siemens', 'abb', 'schneider'],

  // --- Frekvenční měnič / pohon ---
  menic:        ['siemens', 'abb', 'schneider', 'allen_bradley'],  // měnič
  frekvencni:   ['siemens', 'abb', 'schneider', 'allen_bradley'],  // frekvenční
  vfd:          ['siemens', 'abb', 'schneider', 'allen_bradley'],
  pohon:        ['siemens', 'abb', 'schneider', 'allen_bradley'],
  invertor:     ['siemens', 'abb', 'schneider', 'allen_bradley'],

  // --- PLC / automatizace ---
  plc:          ['siemens', 'allen_bradley', 'omron', 'wago', 'schneider'],
  automatizac:  ['siemens', 'allen_bradley', 'omron', 'wago', 'schneider'],  // automatizace/automatizační

  // --- Přepěťová ochrana ---
  prepetov:     ['abb', 'siemens', 'phoenix', 'schneider'],  // přepěťová/přepěťový
  spd:          ['abb', 'siemens', 'phoenix', 'schneider'],

  // --- Napájecí zdroje ---
  napajec:      ['phoenix', 'weidmuller', 'siemens', 'schneider'],  // napájecí/napáječ
  zdroj:        ['phoenix', 'weidmuller', 'siemens', 'schneider'],

  // --- Proudový chránič / RCD ---
  chranic:      ['abb', 'siemens', 'schneider'],  // chránič
  rcd:          ['abb', 'siemens', 'schneider'],
  rccb:         ['abb', 'siemens', 'schneider'],
  rcbo:         ['abb', 'siemens', 'schneider'],
};

// ---------------------------------------------------------------------------
// resolveManufacturersByCategory
// Prohledá text zprávy, najde klíčová slova a vrátí pole klíčů výrobců.
// Umožňuje inject znalostí více výrobců při srovnávacích dotazech.
// ---------------------------------------------------------------------------
export function resolveManufacturersByCategory(messageText) {
  const n = normalizeForSearch(messageText);
  const found = new Set();
  for (const [keyword, mfrs] of Object.entries(MANUFACTURER_CATEGORIES)) {
    if (n.includes(keyword)) {
      mfrs.forEach(m => found.add(m));
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// MANUFACTURER_DOCS
// ---------------------------------------------------------------------------
export const MANUFACTURER_DOCS = {

  wago: `## WAGO — znalostní přehled

**Firma:** WAGO Kontakttechnik GmbH & Co. KG, Minden, Německo. Vynálezce technologie CAGE CLAMP (pružinová svorka bez šroubů).

**Produktové řady:**
- **221 LEVER-NUT** (inline svorky): Kompaktní páčkové svorky pro přímé spojení vodičů (bez DIN lišty). Transparentní kryt.
  Číslování: \`221-[průřez][počet_vodičů]\` — 221-412 = max 4mm², 2vodičová; 221-615 = max 6mm², 5vodičová.
  Číslo za "2": 4 = do 4mm², 6 = do 6mm². Poslední číslo: 2/3/5 = počet vodičů.
- **TOPJOB S** (DIN lišta, Push-in CAGE CLAMP): Hlavní řada rozváděčových svorek. Bez nástrojů pro tuhé vodiče a vodiče s dutinkou.
  Číslování: \`20XX-1YZZ\` kde XX kóduje průřez: 01=1.5mm², 02=2.5mm², 04=4mm², 06=6mm², 10=10mm², 16=16mm².
  Y = počet vodičů: 2=2vodičová, 4=4vodičová. Příklad: 2002-1201 = 2.5mm², 2vod.; 2004-1401 = 4mm², 4vod.
  ZZ = barva: 01-šedá (nejčastější a nejpoužívanější), 02-oranžová, 03-červená, 04-modrá, 05-černá, 06-žlutá, 07-Zelenožlutá, 08-bílá.
- **2273 PUSH WIRE** (krabičkové svorky): Pro instalační krabice, bez nástrojů pro tuhé vodiče. Suffix = počet vodičů: -203=3vod., -208=8vod.
- **285 POWER CAGE CLAMP**: Velkoprůřezové svorky 6–185mm².
- **750/753 série**: Modulární I/O systém, PLC PFC100/PFC200.

**Technologie:** CAGE CLAMP = pružina místo šroubu (vibrací odolné, gas-tight, bez retestování). Push-in = tuhý/dutinkový vodič přímo zasunut. Páčka/tlačítko pro lankový vodič.

**Typické hodnoty:** TOPJOB S 2.5mm² = max 800V, 24A; 221 série = max 450V, 32A (4mm²).`,

  abb: `## ABB — znalostní přehled (nízkonapěťové produkty)

**Firma:** ABB Ltd, Švýcarsko/Švédsko. LV divize: "System pro M compact" pro DIN lištu.

**Produktové řady:**
- **S200 MCB jistič**: S201 (1pól), S202 (2pól), S203 (3pól), S204 (4pól).
  Varianty dle zkratové vypínací schopnosti: S200=6kA, S200M=10kA, S200P=15-25kA.
  Číslování: \`S2[póly][varianta]-[char][proud]\` — S201-B16 = 1pól, 6kA, char. B, 16A. S203M-C25 = 3pól, 10kA, char. C, 25A.
  Charakteristiky: B = trip 3–5×In (kabelová ochrana), C = trip 5–10×In (obecné, motory), D = trip 10–20×In (velké motory, transformátory), K = trip 8–12×In (průmysl, IEC 60947-2), Z = trip 2–3×In (citlivá elektronika).
- **MS motorové spouštěče**: MS116 (0.1–16A), MS132 (0.16–32A), MS165 (10–80A). Zkratová + přetěžová ochrana v jednom.
- **AF kontaktory**: AF09 až AF2650 (9–2650A). Elektronické vinutí přijímá 24–500V AC/DC (jen 4 skupiny vinutí).
- **OVR přepěťová ochrana**: T1 (bleskový, 10/350µs), T2 (distribuční, 8/20µs), kombinace T1-T2.
  Číslování: \`OVR [typ] [fáze] [Imax]-[Uc] [doplňky]\` — OVR T2 1N 40-275 P TS = T2, 1fáze+N, 40kA, 275Vac, vyměnitelná vložka (P), tepelné odpojení (TS).

**Artikl formát:** S200 MCB = 2CDS[2póly-kód]001R[4místný kód]. Příklad: 2CDS251001R0164 = S201-B16.`,

  siemens: `## Siemens — znalostní přehled (LV produkty)

**Firma:** Siemens AG, Německo. LV ochrana: brand SENTRON; průmyslové řízení motorů: brand SIRIUS.

**SENTRON (ochrana a spínání):**
- **5SY MCB jistič**: 5SY6=6kA, 5SY4=10kA, 5SY7=15kA, 5SY8=25kA. DIN lišta.
  Číslování: \`5SY[kapacita][póly][proud]-[char]\`
  Příklad: 5SY4116-7 = série 5SY4 (10kA), 1pól, 16A, charakteristika C (-7).
  Charakteristika přes suffix: -6=B (3–5×In), -7=C (5–10×In), -8=D (10–20×In).
- **5SL MCB**: Budovy a infrastruktura, 6kA nebo 10kA.
- **5SM1 RCCB**: Proudový chránič (proudový střed).
- **5SD SPD**: Přepěťová ochrana, T1/T2/T1-T2 kombinace.
- **LOGO!**: Kompaktní logický modul pro jednoduchou automatizaci budov/strojů.

**SIRIUS (průmyslové řízení motorů):**
- **3RV2 motorový spouštěč**: Zkratová + přetěžová ochrana. Velikosti: S00 (≤16A/≤5.5kW), S0 (≤40A/18.5kW), S2 (≤65A/30kW), S3 (≤100A/45kW).
- **3RT2 kontaktor**: 3-pólový výkonový kontaktor. S00=7–16A, S0 do 38A, S2 do 80A, S3 do 110A.
- **3RU2 tepelné relé**: Přetěžová ochrana, samotné nebo přimontované na 3RT2.
- **3RW softstarter**: Plynné rozběhy a doběhy třífázových motorů.
- **3RA2 kombinovaný spouštěč**: 3RV2 + 3RT2 z výroby spojeny (bez kabeláže).

**Typická kombinace motorového startéru:** 3RV2 (ochrana) + 3RT2 (spínání) přišroubovány k sobě. Přidání 3RU2 = samostatná přetěžová signalizace.`,

  schneider: `## Schneider Electric — znalostní přehled (nízkonapěťové produkty)

**Firma:** Schneider Electric SE, Rueil-Malmaison, Francie. Historické značky: Merlin Gerin (ochranné přístroje), Télémécanique (průmyslové řízení motorů), Square D (USA). Sjednoceno pod Schneider Electric od ~2005.

**Acti9 — modulární DIN lišta (náhrada Multi9 / C60):**
- **iC60 MCB jistič**: iC60N=6kA, iC60H=10kA, iC60L=15kA (Icu při 400V AC).
  Typové označení: \`iC60[var] [póly] [char][proud]\` — iC60N 3P C25 = 3pól, 6kA, char. C, 25A.
  Póly: 1P, 1P+N, 2P, 3P, 4P, 3P+N. Charakteristiky: B=3–5×In, C=5–10×In, D=10–20×In, MA=magnetický (motory).
  Katalogové číslo: A9F[kód] — A9F74220 = iC60N, 2P, C, 20A.
- **iID RCCB**: Proudový chránič (bez nadproudové ochrany). Typ AC (sinusový) nebo A (pulzující DC).
- **iDPN N Vigi RCBO**: MCB + RCD v jednom modulu 1P+N, 6kA — úsporné na šíři DIN.
- **Vigi iC60**: Přídavný proudový blok add-on na iC60 (oddělený RCD modul).
- **iACT/iSW**: Stykačové odpínače na DIN lištu pro osvětlení/topení (do 63A, cívka 230VAC).

**TeSys — průmyslové řízení motorů:**
- **LC1D — TeSys D kontaktor**: Základní 3-pólový průmyslový kontaktor AC-3. LC1D06 až LC1D150 (6–150A). Pro >150A: LC1F řada.
  Číslování: \`LC1D[kód proudu][kód cívky]\` — LC1D09M7 = 9A, cívka 220VAC; LC1D25BD = 25A, 24VDC.
  Kódy cívek AC (50/60Hz): B7=24V, E7=48V, F7=110V, G7=120V, M7=220V, P7=230V, Q7=380–415V, U7=240V.
  Kódy cívek DC: BD=24V, CD=48V, ED=72V.
  Přímé mechanické spojení s GV2ME — bez propojovacích vodičů.
- **GV2ME — TeSys motorový spouštěč**: Zkratová + přetěžová, 3-pól, 1–32A. Icu=100kA (se správnou pojistkou).
  Proudové rozsahy: GV2ME06=1–1.6A, GV2ME07=1.6–2.5A, GV2ME08=2.5–4A, GV2ME10=4–6.3A, GV2ME14=6–10A, GV2ME16=9–14A, GV2ME20=13–18A, GV2ME21=17–23A, GV2ME22=20–25A, GV2ME32=24–32A.
- **GV3P — motorová ochrana 25–65A**: Pro motory do 30kW/400V.
- **LRD — TeSys tepelné relé**: Bimetalové přetěžové relé montované na LC1D.
  LRD12=5.5–8A, LRD14=7–10A, LRD16=9–13A, LRD21=12–18A, LRD22=16–24A, LRD32=23–32A.

**Compact NSX — průmyslové MCCB:**
- NSX100, NSX160, NSX250, NSX400, NSX630 (číslo = jmenovitý proud).
  Zkratová schopnost dle suffixu: B=25kA, N=36kA, F=50kA, S=65kA, H=100kA, L=150kA.
  Příklady: NSX160F = do 160A, Icu=50kA. NSX250N = do 250A, Icu=36kA.
  Spouštěče: TM-D (termomag., pevný proud) nebo Micrologic (elektronický, LSI/LSIG, nastavitelný).

**Pohony a PLC:**
- **Altivar VFD**: ATV12 (do 4kW), ATV320 (do 15kW, skalár/vektor), ATV340 (PMSM/synchronní), ATV630/930 (procesní, do MW).
- **Altistart softstarter**: ATS22 (základní), ATS48 (pokročilý, do 900kW).
- **Modicon PLC**: M221 (základní), M241/M251 (Motion, CAN), M340 (modulární rack), M580 (ePAC, EtherNet/IP, redundance).
- **Zelio Logic**: Kompaktní logický modul SR2/SR3 (analogie Siemens LOGO!), do 40 I/O, IEC 61131-3.`,

  phoenix: `## Phoenix Contact — znalostní přehled

**Firma:** Phoenix Contact GmbH & Co. KG, Blomberg, Německo. Světová jednička v elektrickém propojení. Systém CLIPLINE complete = modulární DIN lišta s interkompatibilními příslušenstvím.

**Svorky (CLIPLINE complete):**
- **UT** (šroubová, moderní Reakdyn): Samojistící šroub. UT 2,5 = 2.5mm² jmenovitý průřez. Rozsah typicky 0.5–4mm² (u UT 2,5).
- **PT** (Push-in CAGE CLAMP): Bez nástrojů — tuhý/dutinkový přímé zasunutí; tlačítko pro lankový bez dutinky. PT 2,5 = 2.5mm², max 800V.
- **ST** (pružinová klecová): Šroubovák drží pružinu, vodič se zasune, pružina přidržuje. Vibrací odolné.
- **UK** (starší šroubová série): UK 6 = 6mm². Stále dostupná.
- **PTFIX** (distribuční blok Push-in): Předmontovaný. PTFIX 6/12X2,5 = 6 vstupů + 12 výstupů, 2.5mm².

**Logika číslování svorek:**
Format: \`[Série] [průřez][-přípona][barva]\`
- UT 2,5 = šroubová, 2.5mm², šedá
- PT 2,5-PE/L/N = push-in, 2.5mm², 3úrovňová (PE+L+N)
- Barvy: BU=modrá (N), GY=šedá (výchozí), RD=červená (L), YE=žlutá, GNYE=zelenožlutá (PE)
- Funkční přípony: -PE = ochranný vodič, -TWIN = 3vodičová, -QUATTRO = 4vodičová, -3L = 3úrovňová

**Ostatní produkty:** Průmyslový Ethernet (FL Switch série), SPD přepěťová ochrana (Trabtech), QUINT/TRIO napájecí zdroje (DIN, 24VDC), PLCnext automatizace.`,

  rittal: `## Rittal — znalostní přehled

**Firma:** Rittal GmbH & Co. KG, Herborn, Německo. Světová jednička v rozváděčových skříních a klimatizaci.

**Řady skříní:**
- **KX** (malé nástěnné/svorkovnicové skříně): Od 150×150×80mm. Ocel nebo nerez. IP 66. Svorkovnicové skříně, terminálové boxy.
- **AX** (kompaktní nástěnné): Do 1000×1400mm, hloubka 80–300mm. Ocel, nerez (AISI 304), sklolaminát/GRP (pro venkov, chemii). IP 66 / NEMA 4. 25mm rastr.
- **TS 8** (velké volně stojící, přisouvatelné): 16trubkový rám, 25mm rastr, IP 66 / NEMA 4. Ocel nebo nerez. Přisazení na všechny strany.
- **VX25** (nástupce TS 8): Symetrický rám 25mm rastr, modernější přisazování, zpětně kompatibilní s TS 8 příslušenstvím. IP 66.
- **CS Toptec**: Dvojplášťová skříň pro venkovní použití (hliníkový plášť + vnitřní skříňka). Fotovoltaika, stanice.

**Logika číslování:**
- AX: prefix \`AX\` + 7místný katalogový kód (číslo nekóduje rozměry — nutno dohledat v e-katalogu).
- TS 8: čísla začínají \`8xxx\` (historicky).
- Rozměry vždy v katalogu, ne přímo v čísle.

**Příslušenství:** Montážní desky (zinkovaná ocel/nerez), kabelové vývodnice (dělené/EMC), zámky (3bodové, čtvrtotočné), větrací filtry, tepelné výměníky a klimatizace Blue e+ (do 6000W, do -30°C).`,

  eaton: `## Eaton (Moeller) — znalostní přehled

**Firma:** Eaton Corporation, USA. LV produkty pod historickým názvem Klöckner-Moeller (Moeller Electric), koupeno 2008. DŮLEŽITÉ: typová čísla ZŮSTALA BEZE ZMĚNY — DILM12-10 je dnes Eaton, dříve Moeller, stejný produkt.

**Produktové řady:**
- **FAZ6 MCB jistič** (průmyslový, IEC 60947-2): 6kA. Format: \`FAZ6-[char][proud]/[póly]\`
  FAZ6-B16/1 = B char., 16A, 1pól. FAZ6-C20/3N = C char., 20A, 3pól+N.
  Charakteristiky: B=3–5×In, C=5–10×In, D=10–20×In.
- **DILM kontaktor**: Číslo = proud AC-3 v ampérech. DILM12=12A (≈5.5kW/400V), DILM17=17A, DILM25=25A, DILM32=32A.
  Suffix pomocných kontaktů: -10=1NO, -01=1NC, -11=1NO+1NC.
  Příklad: DILM12-10 = 12A AC-3 kontaktor, 1 NO pomocný kontakt. Napětí vinutí se objednává zvlášť.
- **PKZM0 motorová ochrana**: 0.16–32A. PKZM0-4 = nastavení 4A. PKZM4 = 16–63A. Zkratová + přetěžová v jednom.
- **PKE** (elektronická motorová ochrana): Elektronický spouštěč místo bimetalového.
- **NZM MCCB** (silnoproudé jistače): NZMB=25kA, NZMN=50kA, NZMH=85–150kA. Rám 1 (≤125A), 2 (≤250A), 3 (≤600A).
  Příklad: NZMN2-A250 = 50kA, rám 2, nastavitelné, 250A.

**Moeller → Eaton:** Stejná typová čísla a katalogová čísla, jen logo. "Moeller Series" = interní označení dědičné IEC řady.`,

  weidmuller: `## Weidmüller — znalostní přehled

**Firma:** Weidmüller Interface GmbH & Co. KG, Detmold, Německo. Průkopník plastové svorky (1948). Specializace: svorky, průmyslové konektory, elektronika, značkovací systémy.

**Produktové řady (svorky):**
- **W-série (šroubová, clamping yoke)**: Nejrozšířenější řada. Funkční písmena: D=Durchgang (průchozí), PE=ochranný vodič, TR=testovací/odpojovací.
  - **WDU**: Průchozí svorka. WDU 2.5 = šroubová, 2.5mm², šedá.
  - **WPE**: Ochranný vodič (PE), zelenožlutá. WPE 2.5 = PE svorka, 2.5mm².
  - **WTR**: Test/odpojovací svorka s páčkou pro izolaci obvodu.
- **Z-série (pružinová klecová, ACT)**: Screwless svorky. ZDU=průchozí, ZPE=ochranný vodič. "Z" = Tension Clamp, vibrací odolné.
- **Klippon Connect — A-série (Push-in)**: Tuhý/dutinkový vodič přímo bez nástroje. 50% rychlejší než šroubové.
- **Klippon Connect — AS-série (Snap-in)**: Lankový bez dutinky — klik při správném zasunutí.

**Logika číslování:**
Format: \`[Série][funkce] [průřez] [barva/přípona]\`
- WDU 2.5 = W-série, průchozí, šroub, 2.5mm²
- WPE 2.5 = W-série, PE svorka, 2.5mm²
- Barvy v sufixu: GN=zelená, BL=modrá, GY=šedá (výchozí), SW=černá (Schwarz), RD=červená, GNYE=zelenožlutá (PE)

**Ostatní produkty:** Relay moduly (Klippon Relay / TERMSERIES), napájecí zdroje (PROtop, PROmax — 5–48VDC), značkovací systém M-Print PRO s tiskárnou PrintJet.`,

  omron: `## Omron — znalostní přehled

**Firma:** Omron Corporation, Japonsko. Průmyslová automatizace: relé, PLC, senzory, bezpečnost, časovače.

**Produktové řady:**
- **G2R relé** (PCB/do patice, 1 nebo 2 pólové, 10A): Nejpoužívanější řada v průmyslových rozváděčích. Číslování: \`G2R-[póly][volitelné]-[varianta] [napájení]\` — G2R-1-SN DC24 = 1pól SPDT, patice, LED indikátor, 24VDC. G2R-2-SN AC230 = 2pól DPDT, patice, LED, 230VAC.
- **MY relé** (miniaturní, 2 nebo 4 pólové, 5–10A): Montáž do patice PYF. Číslování: \`MY[póly][přípony] [napájení]\` — MY2N DC24 = 2pól DPDT, LED, 24VDC. MY2IN = přidáno testovací tlačítko. MYC = mechanický indikátor přepnutí (vizuální příznak).
- **PLC série**: CP1 (kompaktní, standalone), CJ2 (modulární střední), NX/NJ (strojová automatizace, EtherCAT).
- **E2E senzory** (indukční válcové, M8–M30): Číslování: \`E2E-X[vzdálenost][výstup][NC/NO]\` — X=stíněný, E=NPN, F=PNP, 1=NO, 2=NC. Příklad: E2E-X5E1 = stíněný, 5mm, NPN, NO.
- **E3Z senzory** (fotoelektrické kompaktní): T=průchodový, R=retroreflexní, D=difuzní.

**Patice pro relé (povinné pro panelovou montáž):**
- PYF08A = pro MY2 (8-pin); PYF14A = pro MY4 (14-pin)
- P2RF-05 = pro G2RS 1pól (5-pin); P2RF-08 = pro G2RS 2pól (8-pin)

**Důležité:** Relé MY a G2R-S vyžadují příslušnou patici — relé samotné bez patice není funkční při DIN montáži.`,

  allen_bradley: `## Allen-Bradley (Rockwell Automation) — znalostní přehled

**Firma:** Allen-Bradley = průmyslová značka Rockwell Automation, USA. Produkty identifikovány "catalog numbers" (= ekvivalent evropského čísla artiklu). V Evropě se prodávají jen IEC produkty (100-C kontaktory, 800F ovládací prvky, PowerFlex pohony).

**Produktové řady:**
- **PLC**: ControlLogix (1756) = velké systémy; CompactLogix (1769/5069) = střední výroba; Micro800 (2080) = malé/OEM stroje; MicroLogix (1766) = starší řada (mature).
- **Pohony PowerFlex**: PF523/PF525 (do 22kW, EtherNet/IP, STO); PF755/755T (výkonné, velké instalace).
- **Kontaktory 100-C (IEC)**: IEC kontaktor pro Evropu. Velikosti dle AC-3: C09 (9A), C12, C16, C23, C30, C37, C43, C60, C72, C85, C97.
  Číslování: \`100-C[velikost][vinutí][aux]\` — 100-C09D10 = 9A, 24VDC vinutí (D), 1NO (10). Vinutí: A=24VAC, D=24VDC, Z=vícenapěťový AC. Pomocné kontakty: 10=1NO, 01=1NC, 11=1NO+1NC. Suffix R (100-CR09) = spring-clamp svorky.
- **Motorová ochrana 193-EC**: E3/E3+ elektronická ochrana. Montáž přímo na 100-C kontaktor.
- **Ovládací prvky 800F** (22mm IEC standard) a **800T** (30mm, starší): Tlačítka, signálky, selektory, nouzové zastavení.

**Logika catalog numbers:** \`[Bulletin]-[Kód][Varianta]\` — Bulletin = produktová rodina (1756=ControlLogix, 100=kontaktory, 800=ovládací prvky). Za pomlčkou: typ + parametry.

**Terminologický překlad:** "contactor" = Schütz, "overload relay" = Motorschutzrelais, "push button" = Drucktaster, "pilot light" = Meldeleuchte.`,
};
ENDOFFILE
echo "Done, $(wc -l < /home/claude/manufacturers.js) lines"

