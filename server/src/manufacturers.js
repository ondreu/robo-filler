// Normalizes a manufacturer name (from EXPAND or article vyrobce) to an internal key.
export function resolveManufacturerKey(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('wago')) return 'wago';
  if (/\babb\b/.test(n)) return 'abb';
  if (n.includes('siemens')) return 'siemens';
  if (n.includes('phoenix')) return 'phoenix';
  if (n.includes('weidm')) return 'weidmuller';
  if (n.includes('allen') || n.includes('bradley') || n.includes('rockwell')) return 'allen_bradley';
  if (n.includes('rittal')) return 'rittal';
  if (n.includes('eaton') || n.includes('moeller') || n.includes('möller')) return 'eaton';
  if (n.includes('omron')) return 'omron';
  return null;
}

// Returns the dominant vyrobce name if ≥50% of articles share it, otherwise null.
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
  ZZ = barva: 01-šedá, 02-oranžová, 03-červená, 04-modrá, 05-černá, 06-žlutá, 07-Zelenožlutá, 08-bílá.
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

**Ostatní produkty:** Průmyslový Ethernet (FL Switch série), SPD přepěťová ochrana, QUINT/TRIO napájecí zdroje (DIN, 24VDC), PLCnext automatizace.`,

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
