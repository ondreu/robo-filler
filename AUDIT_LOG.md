# productKnowledge.js — Audit Log

## Purpose
Track hallucination/error audits of `server/src/productKnowledge.js`.
Every type number and claim must be verifiable from manufacturer sites or major distributors
(RS Components, Farnell, Distrelec, TME). Never guess or estimate.

---

## Audit #1 — 2026-06-09

**Branch:** `claude/amazing-davinci-y05fm4`
**Commit:** `2ee9552`
**Approach:** Parallel research agents verifying specific products against external sources.

### Categories audited (do not re-audit unless content was changed)

| Category key | Status |
|---|---|
| `jistic` | ✅ Audited — errors found and fixed |
| `prislusenstvi_jistic` | ✅ Audited — errors found and fixed |
| `stykac` | ✅ Audited — errors found and fixed |
| `prislusenstvi_stykac` | ✅ Audited |
| `nadproudova_spoust` | ✅ Audited — errors found and fixed |
| `napajeci_zdroj` | ✅ Audited — errors found and fixed |
| `softstarter` | ✅ Audited — errors found and fixed |
| `frekvencni_menic` | ✅ Partial — Schneider ATV320 + Siemens G120C fixed; ABB ACS355/ACS580 not verified |

### Categories NOT yet audited

| Category key | Priority | Notes |
|---|---|---|
| `prislusenstvi_stykac` | Low | Mostly checked alongside `stykac` |
| `casove_rele` | ✅ Audited in Audit #3 |
| `fazove_rele` | ✅ Audited in Audit #3 |
| `tlacitko` | ✅ Audited in Audit #3 |
| `nouzove_tlacitko` | ✅ Audited in Audit #3 |
| `hlavni_vypinac` | ✅ Audited in Audit #3 |
| `pruchovka` | ⚠️ Not audited — cable gland diameter ranges low risk, no specific order numbers |
| `zaslepka` | ⚠️ Not audited — no specific order numbers to verify |
| `prepetova_ochrana` | ✅ Audited in Audit #3 |
| `rittal` | ✅ Audited in Audit #3 |

---

## Audit #3 — 2026-06-09

**Branch:** `claude/kind-planck-4s3zsw`
**Commits:** `03fde3e` (fazove_rele), `6a74f8b` (all others)
**Approach:** 5 parallel research agents covering all remaining unaudited categories.

### Categories audited in Audit #3

| Category key | Status |
|---|---|
| `fazove_rele` | ✅ Audited — many errors found and fixed |
| `casove_rele` | ✅ Audited — errors found and fixed |
| `tlacitko` | ✅ Audited — many errors found and fixed |
| `nouzove_tlacitko` | ✅ Audited — errors found and fixed |
| `hlavni_vypinac` | ✅ Audited — errors found and fixed |
| `prepetova_ochrana` | ✅ Audited — errors found and fixed |
| `rittal` | ✅ Audited — errors found and fixed |
| `pruchovka` | ⚠️ Not audited (low risk: no specific order numbers to verify) |
| `zaslepka` | ⚠️ Not audited (low risk: no specific order numbers to verify) |

---

## Errors fixed in Audit #3

### casove_rele

- **Siemens 3RP2505-1AW30 function count** — 27 functions → **13** (27 = sibling -1BW30)
- **Siemens 3RP2505-1AW30 outputs** — "2CO, 5A/250VAC" → **1CO (SPDT), switching 3A; Ith=5A**
- **Siemens 3RP2505-1AW30 width** — "35 mm (2 TE)" → **17.5 mm (1 TE)**
- **ABB CT-MFD.21 order number** — 1SVR500012R2100 unverifiable → **1SVR500020R1100** (CT-MFD.21 screw); S suffix = spring-clamp, order number must be verified in ABB catalog
- **ABB CT-MFD.21 width** — 35 mm → **17.5 mm**
- **ABB CT-MFD.21 temperature** — +55 °C → **+60 °C**
- **Finder 88.02 function labels** — "A1–A7" with star-triangle → **AI/DI/GI/SW/BE/CE/DE**; star-triangle NOT a function of 88.02 (belongs to series 80)
- **Finder 88.02 supply voltage** — "12–240 V AC/DC" → **24–230 V AC/DC**
- **Finder 88.02 time ranges** — 9 ranges → **16 ranges**
- **Finder 88.02 form factor** — "DIN rail, 22.5 mm wide" → **48×48 mm panel-mount plug-in** (DIN rail requires separate socket, e.g. 94.62)

### fazove_rele

- **Siemens 3UG4511 suffix N/P** — N and P transposed: **N = 160–260 V, P = 320–500 V** (file had them reversed)
- **Siemens 3UG4511-1AN20** — this is the 160–260 V variant; correct part for 400 V system = **3UG4511-1AP20**
- **Siemens 3UG4511 asymmetry** — false claim of "fixed asymmetry 10%" removed; 3UG4511 does NOT monitor asymmetry
- **Siemens 3UG4511 response time** — < 150 ms → **< 450 ms**
- **Siemens 3UG4512 asymmetry range** — 2–15 % → **0–20 %**
- **Siemens 3UG4513-1BR20** — falsely called "digital with LED display"; corrected to **analog with potentiometers**
- **ABB CM-PFE.2 order number** — 2CSS2012400R1800 → **1SVR550826R9100**
- **ABB CM-PFE.2 response time** — "< 500 ms" → **exactly 500 ms** (ts = tv = 500 ms, fixed)
- **ABB CM-PFE.2 temperature** — +55 °C → **+60 °C**

### tlacitko

- **Schneider XB4BD21** — this is a 2-position selector switch, NOT a green pushbutton; correct green 1NO button = **XB4BA31**
- **Schneider XB5AD21** — same error; correct green 1NO XB5 = **XB5AA31**
- **Schneider AC-15 rating** — 4 A / 240 VAC → **3 A / 240 VAC**; full rating is 10 A / 600 VAC
- **Schneider ZB4BZ103** — "1NO + 1NC" → **2NO**
- **Eaton M22-D-B** — "černá (black)" → **modrá (blue)**; black head = **M22-D-S**
- **Eaton M22 contact rating** — "10 A / 230 VAC (AC-15: 4 A)" → **6 A / 500 VAC (AC-15: 6 A / 230 VAC)**
- **Siemens 3SB3001-0AA21** — color "černé" → **červené**; confirmed red by RS, TME, Kempston
- **Siemens 3SB3 color suffix scheme** — "A=black, B=green, D=red" completely wrong; color encoded in numeric digit position (AA21=red, AA31=yellow, AA41=green, AA51=blue, AA61=white); spurious part numbers removed

### nouzove_tlacitko

- **XB4BS54441** — part number doesn't exist; corrected to **XB4BS84441** (2NC+1NO, not 1NC+1NO)
- **XB4BS8444** — contacts "1NC+1NO" → **2NC**; release mechanism unconfirmed (removed key-release claim)
- **ZB4BZ103** — "1NO+1NC" → **2NO** (same error as in tlacitko)

### hlavni_vypinac

- **ABB OT voltage** — "600 V AC" → **690 V AC (IEC)** / 600 V AC (UL)
- **ABB OT25F3 UL rating** — missing: IEC=25 A, **UL=30 A**
- **ABB OT63F3/OT100F3** — order numbers added: **1SCA105332R1001** and **1SCA105004R1001**
- **ABB OT 4-pole designations** — plain OT16F4 etc. not in current catalog; correct current = **OT16F4N2, OT25F4N2, OT40F4N2, OT63F4N2**
- **Siemens 3LD2 suffix -0TK51/-0TK53** — described as "direct handle / shaft extension" → **-0TK51 = black rotary handle (standard), -0TK53 = red-yellow rotary handle (E-stop + main switch)**

### prepetova_ochrana

- **Phoenix VAL-MS 320/3+1/FM order number** — 2859160 not found anywhere → corrected to **2859181**
- **Phoenix VAL-MS Up** — ≤ 1.5 kV → **≤ 1.6 kV** (L-N, per datasheet for 2859181)
- **ABB OVR T2 1N product name** — missing QS suffix; correct: **OVR T2 1N 40-275 P TS QS** (TS = signaling contact, QS = quick-connect; not "disconnector")
- **ABB OVR T2 3N** — the 3N variant has NO TS (no signaling contact); removed false signaling claim
- **ABB OVR T2 Up** — ≤ 1.5 kV → **1.25 kV** (L-N)

### rittal

- **KX 1575.000 material** — "AISI 304 stainless steel" → **ocelový plech (carbon steel)**; dimensions and IP66 confirmed
- **SZ2471.000** — "inner mounting panel for VX25" → WRONG: it is a **rain canopy for AE enclosures**; removed
- **SZ2584.000** — "LED interior light" → WRONG: it is a **pole clamp** (discontinued January 2020); removed
- **DK7100.100 / DK7101.100 / DK7110.100** — unverifiable; added note to confirm in Rittal catalog before ordering

### Confirmed clean (no errors found)
- All 9 Rittal VX25 part numbers and dimensions
- All 6 Rittal AX part numbers and dimensions
- Siemens 3LD2 part numbers 3LD2003/2103/2203/2504 and ratings
- Schneider TeSys Vario VCF0–VCF3 and VBF0–VBF3 ratings
- ABB OT16F3 (1SCA104811R1001) and OT40F3 (1SCA104902R1001) order numbers
- ABB OT63F3 and OT100F3 existence confirmed
- Phoenix VAL-MS DC variants (2800642 and 2800628)
- Finder 88.02: 2CO DPDT 8A/250VAC, 0.05s–100h time range

---

## Audit #2 — 2026-06-09

**Branch:** `claude/happy-franklin-iynvmq`
**Approach:** 5 parallel research agents covering svorka, rele, chranic, pojistka, frekvencni_menic (ABB), and din_lista.

### Categories audited in Audit #2

| Category key | Status |
|---|---|
| `svorka` | ✅ Audited — errors found and fixed |
| `prislusenstvi_svorka` | ✅ Audited — end bracket fixed |
| `rele` | ✅ Audited — many errors found and fixed |
| `prislusenstvi_rele` | ✅ Audited — socket errors fixed |
| `chranic` | ✅ Audited — ABB type A order numbers fixed, Siemens all confirmed |
| `pojistka` | ✅ Audited — NH2 max and 690V suffix fixed |
| `din_lista` | ✅ Audited — Phoenix and Weidmüller errors fixed |
| `frekvencni_menic` (ABB) | ✅ Audited — ACS355 all confirmed, ACS580 3 wrong numbers fixed |

---

## Errors fixed in Audit #2

### Critical (wrong product / wrong order number)

- **PLC-RSC-24DC/21-AU (2966171)** — 2966171 is the STANDARD relay, not the -AU (gold contact) variant; swapped: 2966171 = standard, 2966265 = -AU
- **PLC-RSC-24DC/21 (2966011)** — 2966011 doesn't exist; corrected to 2966171 (standard)
- **PLC-RSC-24DC/21-21 (2966024)** — wrong order number; corrected to **2967060**
- **PLC-RSC-230AC/21 (2966168)** — 2966168 unverifiable; replaced with **PLC-RSC-230UC/21 (2966207)** (universal coil, current catalog equivalent)
- **PLC-RPT-24DC/21-21 (2900302)** — wrong; corrected to **2900330**
- **PLC-RPT-230AC/21 (2900328)** — 2900328 is a completely different product (switch module); entry removed
- **ABB F202A type A order numbers** — systematic error: all three used non-existent prefix "2CSF202003R"; correct prefix is "2CSF202101R":
  - F202A-25/0.03: 2CSF202003R1250 → **2CSF202101R1250**
  - F202A-40/0.03: 2CSF202003R1400 → **2CSF202101R1400**
  - F202A-63/0.03: 2CSF202003R1630 → **2CSF202101R1630**
- **ABB ACS580-01-04A8-4** — 480V US variant; 400V 1.5 kW = **ACS580-01-04A1-4**
- **ABB ACS580-01-07A2-4** — nominally 3 kW (LD) drive, not 2.2 kW; 400V 2.2 kW = **ACS580-01-05A7-4**
- **ABB ACS580-01-09A5-4** — nominally 4 kW (LD) drive, not 3 kW; 400V 3 kW = **ACS580-01-07A3-4**
- **Phoenix NS 35/7,5 UNPERF (1201916)** — wrong; corrected to **0801681**
- **Phoenix NS 35/15 UNPERF (1201929)** — wrong; corrected to **1201714**
- **Weidmüller TSLD35 2000 (0205200000)** — product designation and order number both wrong; corrected to **TS 35X7.5 2M/ST/ZN (0383400000)**
- **Weidmüller TRS 24VDC 2CO (1122780000)** — 1122780000 is actually TRS 24VUC 1CO (universal coil, 1CO); TRS 24VDC 2CO = **1123490000** (8 A, not 6 A)

### Systematic errors

- **Omron G2R-1 contact rating** — 10 A throughout → corrected to **16 A** (Ith = 16 A / 250 VAC); G2R-2 (2CO) correctly stays at 5 A
- **Omron G2R-SN sockets** — P2CF-08 listed for both variants → corrected: G2R-1-SN → **P2RF-05**, G2R-2-SN → **P2RF-08** (P2CF-08 is for MK/H3CR series, not G2R-SN)
- **Finder series 55 socket** — claimed "série 95" → corrected to **série 94 (94.04)**; 95.05 is an 8-pin socket for series 40 relays (not 14-pin for series 55)
- **Weidmüller WDU color** — "šedá" (grey) → corrected to **"béžová"** (beige/dark beige) throughout; grey is a newer separate WDU GR range

### Individual errors

- **WAGO 2002-102** end bracket — does not exist; corrected to **2002-1291**
- **Omron G2R mechanical life** — "10 × 10⁶ cycles" applies to AC coil only; DC coil variants = **20 × 10⁶**; note added
- **Relpol RM85 socket** — "GZT8-1" does not exist; corrected to **GZT80**
- **Weidmüller TRS operating temperature** — "–25 °C … +55 °C" → corrected to **–40 °C … +60 °C**
- **ABB F202 width** — "2 TE (36 mm)" → corrected to **"2 TE (35 mm)"** (actual body is 35 mm)
- **Phoenix UK 5-MTK-P/P** — description said "5 mm²" (misleading: "5" is body-series name, not conductor size); corrected to "do 4 mm²" with explanatory note
- **WAGO 2016 rated current** — was missing; added **76 A** to heading
- **NH2 max current** — heading said "do 315 A" → corrected to **"do 400 A"**; added 400NHG2B entry
- **NH 690V suffix** — "B6" / "63NHG1B6" format is wrong; correct suffix is **-690** (e.g. 63NHG1B-690)
- **Phoenix tips "6-ciferné"** — Phoenix Contact order numbers are 7-digit; corrected to "7-místné"

### Confirmed clean (no errors found)
- WAGO TOPJOB S: all 14 part numbers (2002-2016 series), suffix coding pattern, and current/voltage ratings all confirmed
- ABB ACS355: all 13 part numbers and kW/A ratings confirmed against new.abb.com
- Siemens 5SV3 RCDs: all 13 part numbers and the complete suffix decoder table confirmed
- ABB F202AC type AC: F202AC-25/0.03, -40/0.03, -63/0.03 order numbers confirmed
- Omron G2R-2-E DC24: 5 A / 250 VAC confirmed (only G2R-1 was wrong)
- Finder series 40: all four part numbers (40.51/40.52 × 24VDC/230VAC) confirmed
- Phoenix PLC-RPT-24DC/21 (2900299): confirmed
- Relpol RM85 part numbers and 16 A rating: confirmed
- Weidmüller TRS 24VDC 1CO (1122770000): confirmed
- Eaton Bussmann NH naming pattern [I]NHG[size]B: confirmed
- All 7 checked NH part numbers: confirmed

---

## Errors fixed in Audit #1

### Critical (wrong product entirely)
- **Eaton DILM7-10(230V AC)** — ID `276566` was the 48V DC variant; corrected to `276550`
- **Eaton DILM12-10(230V AC)** — ID `276845` was the 24V DC variant; corrected to `276830`
- **Phoenix QUINT4-PS/3AC/24DC/20** — `2904603` was a single-phase 40A supply; corrected to `2904622`
- **Phoenix QUINT4-PS/3AC/24DC/40** — `2904605` was a 12V DC supply; corrected to `2904623`
- **Siemens G120C 18,5 kW** — `6SL3210-1KE24-3UF0` does not exist; corrected to `6SL3210-1KE23-8UF1`

### Systematic errors
- **ABB PSR softstarter order numbers** — systematic off-by-2 shift across entire table (PSR3–PSR60); additionally PSR3 and PSR6 kW ratings were 230V values instead of 400V (PSR3: 0,75→1,5 kW; PSR6: 1,5→3,0 kW)
- **Schneider LRD relay ranges** — one-step shift starting at LRD04 in BOTH `stykac/schneider` and `nadproudova_spoust/schneider` sections; LRD03 was also missing from the brief section
  - LRD04 = 0,4–0,63 A | LRD05 = 0,63–1 A | LRD06 = 1–1,6 A | LRD07 = 1,6–2,5 A | LRD08 = 2,5–4 A
- **Siemens G120C interface labels** — multiple entries had wrong protocol labels due to misread suffix decoder; U**F** = PROFINET (not USS/Modbus), U**B** = USS/Modbus (not PROFIBUS DP); entire suffix decoder section rewritten

### Individual errors
- **Siemens 3RT2036** — rated current 50 A → **51 A** (confirmed 7+ sources)
- **Schneider A9A26926** — internal contradiction between two sections; resolved to **2NC** (matching detailed section)
- **ABB TA25DU-32** — adjustment range 22–32 A → **24–32 A**
- **ABB OT16F3 note** — stated "20 A dle IEC 60947-3"; corrected to **16 A (IEC) / 20 A (UL 508)**
- **ABB OT63F3 / OT100F3** — unverifiable order numbers removed; entries kept without order numbers
- **ABB TA25DU-0.1** — removed from `stykac/abb` brief (smallest verified = TA25DU-0.16); still present in `nadproudova_spoust/abb` detailed table — **needs verification**
- **Phoenix TRIO-PS** name → **TRIO-PS-2G** (order numbers 2903148/2903149 were correct)
- **Schneider LC1D coil codes** — M7 tightened to 220 V AC (was 220–230 V); P7 to 230 V AC (was 230–240 V)
- **Schneider ATV320 schema** — "duální zásobník" for D prefix was fabricated; corrected to power-range description (U = 0,18–7,5 kW; D = 11–22 kW)
- **LRD35 upper bound** — 30–40 A → **30–38 A**

### Unverified — keep an eye on
- **Schneider A9A26925 / A9A26926** — 2NO and 2NC OF contacts for iC60N; logically consistent but not found on current distributor listings; kept without modification
- **ABB TA25DU-0.1** in `nadproudova_spoust/abb` — smallest verified model is TA25DU-0.16

---

## Methodology notes

- Each audit session used parallel research agents (5 agents simultaneously) checking specific products
- Primary sources: RS Components, Farnell, TME, Distrelec, manufacturer sites (new.abb.com, se.com, siemens.com, mouser)
- Error rate was high: errors found in ~8 out of 10 categories checked
- Most common error types: (1) systematic table shifts, (2) order numbers pointing to wrong product variant, (3) fabricated descriptions
- Rule: if a claim cannot be confirmed from at least one verifiable source, flag it rather than guess
