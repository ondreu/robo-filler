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
| `svorka` | High | WAGO, Phoenix, Weidmüller — many order numbers |
| `prislusenstvi_svorka` | High | End brackets, markers, bridges |
| `prislusenstvi_stykac` | Medium | Mostly checked alongside `stykac` |
| `rele` | High | Specific coil voltages, order numbers |
| `prislusenstvi_rele` | Medium | |
| `casove_rele` | Medium | Timer settings, order numbers |
| `fazove_rele` | Medium | |
| `tlacitko` | Low | |
| `nouzove_tlacitko` | Low | |
| `hlavni_vypinac` | Medium | Rotary isolators — order numbers risky |
| `pruchovka` | Low | Cable glands — standard sizes |
| `zaslepka` | Low | |
| `chranic` | High | RCDs — trip currents and type codes critical |
| `prepetova_ochrana` | Medium | SPD levels and order numbers |
| `rittal` | Medium | Enclosure dimensions |
| `pojistka` | High | Fuse types and ratings — order numbers risky |
| `din_lista` | Low | Standard profiles |
| `frekvencni_menic` (ABB) | Medium | ACS355/ACS580 not verified |

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
