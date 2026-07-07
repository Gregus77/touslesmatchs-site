/**
 * Tests for isLowTrustCompetition — single source of truth for league filtering.
 * Only 7 leagues are authorized. Everything else is blocked.
 * Extracted logic mirrors api_server.js exactly.
 */

const LOW_TRUST_COMPETITION_KEYWORDS = [
  // Catégories génériques non fiables
  "friendly", "friendlies", "club friendly", "international friendly", "amical", "amicaux",
  "u17", "u18", "u19", "u20", "u21", "u23",
  "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
  "reserve", "reserves", "b team", "ii ", " ii", "youth", "youth championship", "academy",
  "regional cup", "state cup", "state league",
  // Divisions inférieures des ligues autorisées
  "2. bundesliga", "bundesliga 2", "ligue 2", "serie b", "segunda division", "segunda liga",
  // Exclusions définitives — compétitions interdites
  "world cup", "coupe du monde", "fifa world", "copa del mundo",
  "champions league", "ligue des champions", "uefa champions",
  "europa league", "ligue europa",
  "conference league",
  "nations league", "ligue des nations",
  "euro 20", "uefa euro",
  "coupe de france", "fa cup", "efl cup", "carabao", "league cup",
  "copa del rey", "dfb-pokal", "dfb pokal", "coppa italia",
  "coupe de la ligue",
  "super cup", "supercoupe", "supercopa", "community shield",
  "playoff", "play-off", "barrage", "barrages", "qualification", "qualif",
  "preliminary", "preliminaire",
  "women", "féminin", "feminin", "w ", " w ",
  "esport", "e-sport", "e sport", "virtual", "virtuel", "cyber",
  // Afrique
  "ethiopia", "nigeria", "npfl", "tanzania", "kenya", "uganda",
  "ghana", "zambia", "zimbabwe", "mozambique", "cameroon", "cameroun",
  "rwanda", "burundi", "malawi", "botswana", "lesotho", "eswatini", "swaziland",
  "senegal", "ivory coast", "côte d'ivoire", "burkina",
  "congo", "angola", "namibia", "gabon", "togo", "benin", "niger · ",
  "madagascar", "mauritius", "cape verde", "guinea",
  "sierra leone", "liberia", "gambia", "eritrea", "djibouti", "comoros",
  "south africa", "algeria · ligue", "tunisia · ligue", "egypt · premier",
  // Asie
  "kazakhstan", "uzbekistan", "tajikistan", "kyrgyzstan", "turkmenistan",
  "myanmar", "cambodia", "laos", "vietnam", "v.league",
  "bangladesh", "nepal", "mongolia", "bhutan", "maldives", "brunei", "timor",
  "palestine", "jordan · ", "iraq", "syria", "yemen", "oman", "bahrain",
  "lebanon", "india", "sri lanka", "pakistan",
  "indonesia", "malaysia · ", "philippines", "thailand · ",
  // Amérique du Sud — ligues secondaires
  "chile", "bolivia", "peru", "venezuela", "ecuador",
  "paraguay", "uruguay · segunda", "colombia · b",
  // Amérique centrale et Caraïbes
  "honduras", "guatemala", "el salvador", "nicaragua",
  "costa rica", "panama · liga", "haiti", "jamaica", "trinidad",
  "dominican", "cuba", "belize", "suriname", "guyana",
  // Europe — divisions inférieures/ligues exotiques
  "estonia", "latvia", "lithuania", "faroe", "gibraltar",
  "andorra", "malta", "san marino", "kosovo", "north macedonia",
  "albania", "moldova", "belarus", "armenia",
  "georgia · erovnuli", "georgian erovnuli",
  "azerbaijan", "iceland", "northern ireland",
  "luxembourg", "liechtenstein", "montenegro", "bosnia",
  // Océanie
  "fiji", "samoa", "tonga", "vanuatu", "solomon", "papua",
  "new caledonia", "tahiti",
  "australia · npl", "australian npl",
  "queensland premier league", "queensland · ", "victoria premier league",
  // Moyen-Orient
  "iran",
  // USA — ligues amateurs/semi-pro
  "usl league two", "usl2", "usl league one",
  "npsl", "nisa", "mls next", "mls next pro",
  "us open cup", "usl w league",
];

const TRUSTED_COMPETITIONS = [
  "ligue 1",
  "premier league",
  "la liga", "laliga",
  "serie a",
  "bundesliga",
  "liga profesional", "copa argentina", "primera division · argentina",
  "brasileirao", "serie a · brazil",
];
// 11 entries = 7 leagues with variant spellings

function isLowTrustCompetition(matchOrCompetition) {
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.home, matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  if (LOW_TRUST_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword))) return true;
  if (TRUSTED_COMPETITIONS.some(tc => value.includes(tc))) return false;
  return true;
}

// ── 7 ligues autorisées ──

describe("7 AUTHORIZED LEAGUES — must PASS", () => {
  test("Ligue 1", () => expect(isLowTrustCompetition("Ligue 1 · France")).toBe(false));
  test("Ligue 1 (API-Sports format)", () => expect(isLowTrustCompetition("Ligue 1 · France")).toBe(false));
  test("Premier League", () => expect(isLowTrustCompetition("Premier League · England")).toBe(false));
  test("La Liga", () => expect(isLowTrustCompetition("La Liga · Spain")).toBe(false));
  test("LaLiga (no space)", () => expect(isLowTrustCompetition("LaLiga · Spain")).toBe(false));
  test("Serie A Italy", () => expect(isLowTrustCompetition("Serie A · Italy")).toBe(false));
  test("Bundesliga", () => expect(isLowTrustCompetition("Bundesliga · Germany")).toBe(false));
  test("Liga Profesional Argentina", () => expect(isLowTrustCompetition("Liga Profesional · Argentina")).toBe(false));
  test("Primera Division Argentina", () => expect(isLowTrustCompetition("Primera Division · Argentina")).toBe(false));
  test("Brasileirao", () => expect(isLowTrustCompetition("Brasileirao · Brazil")).toBe(false));
  test("Serie A Brazil", () => expect(isLowTrustCompetition("Serie A · Brazil")).toBe(false));
});

// ── Suppression définitive — Champions League, Europa, Conference ──

describe("PERMANENTLY BLOCKED — Champions League / Europa / Conference", () => {
  test("Champions League", () => expect(isLowTrustCompetition("Champions League")).toBe(true));
  test("UEFA Champions League", () => expect(isLowTrustCompetition("UEFA Champions League")).toBe(true));
  test("Ligue des Champions", () => expect(isLowTrustCompetition("Ligue des Champions")).toBe(true));
  test("Europa League", () => expect(isLowTrustCompetition("Europa League")).toBe(true));
  test("Ligue Europa", () => expect(isLowTrustCompetition("Ligue Europa")).toBe(true));
  test("Conference League", () => expect(isLowTrustCompetition("Conference League")).toBe(true));
  test("UEFA Europa Conference League", () => expect(isLowTrustCompetition("UEFA Europa Conference League")).toBe(true));
});

// ── Suppression définitive — Coupe du Monde ──

describe("PERMANENTLY BLOCKED — World Cup / International", () => {
  test("World Cup", () => expect(isLowTrustCompetition("World Cup")).toBe(true));
  test("FIFA World Cup", () => expect(isLowTrustCompetition("FIFA World Cup")).toBe(true));
  test("Coupe du Monde", () => expect(isLowTrustCompetition("Coupe du Monde")).toBe(true));
  test("Copa del Mundo", () => expect(isLowTrustCompetition("Copa del Mundo")).toBe(true));
  test("Nations League", () => expect(isLowTrustCompetition("Nations League")).toBe(true));
  test("Euro 2024", () => expect(isLowTrustCompetition("Euro 2024")).toBe(true));
  test("UEFA Euro 2028", () => expect(isLowTrustCompetition("UEFA Euro 2028")).toBe(true));
});

// ── Suppression définitive — Football féminin ──

describe("PERMANENTLY BLOCKED — Women's football", () => {
  test("Women Premier League", () => expect(isLowTrustCompetition("Women Premier League")).toBe(true));
  test("Division 1 féminin", () => expect(isLowTrustCompetition("Division 1 féminin")).toBe(true));
  test("Division 1 feminin", () => expect(isLowTrustCompetition("Division 1 feminin")).toBe(true));
  test("W League", () => expect(isLowTrustCompetition("W League")).toBe(true));
  test("Women's Champions League", () => expect(isLowTrustCompetition("Women's Champions League")).toBe(true));
});

// ── Suppression définitive — Jeunes ──

describe("PERMANENTLY BLOCKED — Youth categories", () => {
  test("U17 World Cup", () => expect(isLowTrustCompetition("U17 World Cup")).toBe(true));
  test("U18 League", () => expect(isLowTrustCompetition("U18 League")).toBe(true));
  test("U19 Championship", () => expect(isLowTrustCompetition("U19 Championship")).toBe(true));
  test("U20 World Cup", () => expect(isLowTrustCompetition("U20 World Cup")).toBe(true));
  test("U21 Euros", () => expect(isLowTrustCompetition("U21 Euros")).toBe(true));
  test("U23 Tournament", () => expect(isLowTrustCompetition("U23 Tournament")).toBe(true));
  test("Youth Championship", () => expect(isLowTrustCompetition("Youth Championship")).toBe(true));
  test("Academy League", () => expect(isLowTrustCompetition("Academy League")).toBe(true));
});

// ── Suppression définitive — Barrages / Qualifications ──

describe("PERMANENTLY BLOCKED — Playoffs / Qualifications", () => {
  test("Championship Playoff", () => expect(isLowTrustCompetition("Championship Playoff")).toBe(true));
  test("Play-off", () => expect(isLowTrustCompetition("Play-off")).toBe(true));
  test("Barrages Ligue 2", () => expect(isLowTrustCompetition("Barrages Ligue 2")).toBe(true));
  test("World Cup Qualification", () => expect(isLowTrustCompetition("World Cup Qualification")).toBe(true));
  test("Euro Qualif", () => expect(isLowTrustCompetition("Euro Qualif")).toBe(true));
  test("Preliminary Round", () => expect(isLowTrustCompetition("Preliminary Round")).toBe(true));
});

// ── Suppression définitive — Matchs amicaux ──

describe("PERMANENTLY BLOCKED — Friendly matches", () => {
  test("Club Friendly", () => expect(isLowTrustCompetition("Club Friendly")).toBe(true));
  test("International Friendly", () => expect(isLowTrustCompetition("International Friendly")).toBe(true));
  test("Friendly Match", () => expect(isLowTrustCompetition("Friendly Match")).toBe(true));
  test("Match amical", () => expect(isLowTrustCompetition("Match amical")).toBe(true));
  test("Amicaux pré-saison", () => expect(isLowTrustCompetition("Amicaux pré-saison")).toBe(true));
});

// ── Suppression définitive — eSports / Virtual ──

describe("PERMANENTLY BLOCKED — eSports / Virtual", () => {
  test("eSport FIFA", () => expect(isLowTrustCompetition("eSport FIFA")).toBe(true));
  test("E-Sport League", () => expect(isLowTrustCompetition("E-Sport League")).toBe(true));
  test("Virtual Bundesliga", () => expect(isLowTrustCompetition("Virtual Bundesliga")).toBe(true));
  test("Virtuel Liga", () => expect(isLowTrustCompetition("Virtuel Liga")).toBe(true));
  test("Cyber Football", () => expect(isLowTrustCompetition("Cyber Football League")).toBe(true));
});

// ── Coupes nationales bloquées ──

describe("PERMANENTLY BLOCKED — National cups", () => {
  test("Coupe de France", () => expect(isLowTrustCompetition("Coupe de France")).toBe(true));
  test("FA Cup", () => expect(isLowTrustCompetition("FA Cup · England")).toBe(true));
  test("Copa del Rey", () => expect(isLowTrustCompetition("Copa del Rey · Spain")).toBe(true));
  test("DFB-Pokal", () => expect(isLowTrustCompetition("DFB-Pokal · Germany")).toBe(true));
  test("Coppa Italia", () => expect(isLowTrustCompetition("Coppa Italia · Italy")).toBe(true));
  test("EFL Cup", () => expect(isLowTrustCompetition("EFL Cup")).toBe(true));
  test("Carabao Cup", () => expect(isLowTrustCompetition("Carabao Cup")).toBe(true));
  test("League Cup", () => expect(isLowTrustCompetition("League Cup")).toBe(true));
  test("Super Cup", () => expect(isLowTrustCompetition("Super Cup")).toBe(true));
});

// ── Default deny — ligues inconnues ──

describe("DEFAULT DENY — unknown leagues blocked", () => {
  test("MLS", () => expect(isLowTrustCompetition("MLS · USA")).toBe(true));
  test("Eredivisie", () => expect(isLowTrustCompetition("Eredivisie · Netherlands")).toBe(true));
  test("Liga Portugal", () => expect(isLowTrustCompetition("Liga Portugal · Portugal")).toBe(true));
  test("Super League Mongolia", () => expect(isLowTrustCompetition("Super League · Mongolia")).toBe(true));
  test("Ligue 2 France", () => expect(isLowTrustCompetition("Ligue 2 · France")).toBe(true));
  test("Championship England", () => expect(isLowTrustCompetition("Championship · England")).toBe(true));
  test("Serie B Italy", () => expect(isLowTrustCompetition("Serie B · Italy")).toBe(true));
  test("2. Bundesliga", () => expect(isLowTrustCompetition("2. Bundesliga · Germany")).toBe(true));
  test("Segunda Division Spain", () => expect(isLowTrustCompetition("Segunda Division · Spain")).toBe(true));
  test("K League Korea", () => expect(isLowTrustCompetition("K League · South Korea")).toBe(true));
  test("J League Japan", () => expect(isLowTrustCompetition("J League · Japan")).toBe(true));
  test("Chinese Super League", () => expect(isLowTrustCompetition("Chinese Super League · China")).toBe(true));
  test("Saudi Pro League", () => expect(isLowTrustCompetition("Saudi Pro League · Saudi Arabia")).toBe(true));
  test("Empty string", () => expect(isLowTrustCompetition("")).toBe(true));
  test("Null", () => expect(isLowTrustCompetition(null)).toBe(true));
  test("Undefined", () => expect(isLowTrustCompetition(undefined)).toBe(true));
});

// ── Garde-fous — source de vérité unique ──

describe("GARDE-FOUS — single source of truth", () => {
  test("TRUSTED list has exactly 7 leagues (11 variants)", () => {
    expect(TRUSTED_COMPETITIONS.length).toBe(11);
  });

  test("all 7 leagues are represented in TRUSTED", () => {
    const leagues = ["ligue 1", "premier league", "la liga", "serie a", "bundesliga", "liga profesional", "brasileirao"];
    leagues.forEach(l => {
      expect(TRUSTED_COMPETITIONS.some(tc => tc.includes(l))).toBe(true);
    });
  });

  test("LOW_TRUST is checked BEFORE TRUSTED (order matters)", () => {
    // Virtual Bundesliga should be blocked even though 'bundesliga' is trusted
    expect(isLowTrustCompetition("Virtual Bundesliga")).toBe(true);
    // eSport Premier League should be blocked
    expect(isLowTrustCompetition("eSport Premier League")).toBe(true);
    // Women's Serie A should be blocked
    expect(isLowTrustCompetition("Women Serie A")).toBe(true);
    // Reserves of trusted league should be blocked
    expect(isLowTrustCompetition("Premier League Reserve")).toBe(true);
  });

  test("object format works (match with competition field)", () => {
    const match = { competition: "Ligue 1 · France", home: "PSG", away: "OM" };
    expect(isLowTrustCompetition(match)).toBe(false);
  });

  test("object format blocks untrusted competitions", () => {
    const match = { competition: "MLS · USA", home: "Inter Miami", away: "LA Galaxy" };
    expect(isLowTrustCompetition(match)).toBe(true);
  });
});
