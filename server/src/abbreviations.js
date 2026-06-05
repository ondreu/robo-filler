// Domain-specific abbreviation knowledge for the Robo Filler database.
// Inject this into the expand system prompt so Mistral generates correct search terms.
// Add new mappings here as you discover them — no logic changes needed.

export const ABBREVIATIONS_CONTEXT = `
ZNALOSTI DATABÁZE ROBO FILLER — zkratky a konvence:

MATERIÁLY:
- nerez, nerezový, nerezová = A2, A4, INOX, V2A, V4A, NEREZ, Edelstahl, stainless
- mosaz, mosazný = MS, Ms, CuZn, Messing, brass
- plast, plastový = PA, PA6, PE, PP, PVC, ABS, polyamid, polyetylen
- hliník, hliníkový = Al, ALU, aluminium
- pozinkovaný, zinkovaný = Zn, ZN, verzinkt
- měď, měděný = Cu, copper

BARVY (anglické zkratky):
- černá = BK, Black
- červená = RD, Red
- modrá = BU, BL, Blue
- zelená = GN, Green
- žlutá = YE, Yellow
- bílá = WH, White
- šedá = GY, GR, Grey
- oranžová = OG, OR, Orange
- hnědá = BN, Brown
- fialová = VT, VI, Violet
- žlutozelená (ochranný vodič/zemnění) = GN/YE, GNYE

PRŮCHODKY A ROZMĚRY:
- průměr = D= (např. "průměr 12 mm" → hledej "D=12")
- rozsah průměru kabelu v průchodce = formát "12,5-16,0" nebo "4-8" (čísla s pomlčkou)
- závit metrický = M12, M16, M20, M25, M32, M40, M50, M63
- závit PG = PG7, PG9, PG11, PG13.5, PG16, PG21, PG29, PG36

ELEKTRO — JISTIČE:
- jednofázový / jednopólový = 1P
- třífázový / třípólový = 3P
- třífázový čtyřpólový = 4P
- charakteristika B = "B" před proudem (B16A, B16, B10A...)
- charakteristika C = "C" před proudem (C16A, C16, C25A...)
- charakteristika D = "D" před proudem

ELEKTRO — PROUDY A KONTAKTY:
- stejnosměrný proud, DC = "=" (rovnítko v názvu)
- střídavý proud, AC = "~" (vlnka v názvu)
- spínací kontakt, normally open = NO
- rozpínací kontakt, normally closed = NC
- přepínací kontakt = CO, changeover
- kombinace kontaktů = např. "2NO+2NC", "1NO+1NC"

KRYTÍ A PROSTŘEDÍ:
- krytí = IP (IP20, IP44, IP54, IP65, IP67, IP68...)
- výbušné prostředí = Ex, ATEX, IECEx
`;
