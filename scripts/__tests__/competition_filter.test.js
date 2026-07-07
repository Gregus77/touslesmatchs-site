/**
 * Tests for isLowTrustCompetition — ensures only authorized leagues pass.
 * Extracted logic from api_server.js for isolated testing.
 */

const LOW_TRUST_COMPETITION_KEYWORDS = [
  "friendly", "friendlies", "club friendly", "international friendly", "amical", "amicaux",
  "u17", "u18", "u19", "u20", "u21", "u23",
  "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
  "reserve", "reserves", "b team", "ii ", " ii", "youth", "youth championship", "academy",
  "regional cup", "state cup", "state league",
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
  // Rest of keywords from api_server.js (geo)
  "ethiopia", "nigeria", "chile", "bolivia", "peru", "venezuela", "ecuador",
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

function isLowTrustCompetition(matchOrCompetition) {
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.home, matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  if (LOW_TRUST_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword))) return true;
  if (TRUSTED_COMPETITIONS.some(tc => value.includes(tc))) return false;
  return true;
}

describe("Competition filtering — authorized leagues", () => {

  describe("MUST be allowed (trusted)", () => {
    test("Ligue 1", () => expect(isLowTrustCompetition("Ligue 1 · France")).toBe(false));
    test("Premier League", () => expect(isLowTrustCompetition("Premier League · England")).toBe(false));
    test("La Liga", () => expect(isLowTrustCompetition("La Liga · Spain")).toBe(false));
    test("Serie A", () => expect(isLowTrustCompetition("Serie A · Italy")).toBe(false));
    test("Bundesliga", () => expect(isLowTrustCompetition("Bundesliga · Germany")).toBe(false));
    test("Liga Profesional Argentina", () => expect(isLowTrustCompetition("Liga Profesional · Argentina")).toBe(false));
    test("Brasileirao", () => expect(isLowTrustCompetition("Brasileirao · Brazil")).toBe(false));
  });

  describe("MUST be blocked (excluded)", () => {
    test("Champions League", () => expect(isLowTrustCompetition("Champions League")).toBe(true));
    test("Europa League", () => expect(isLowTrustCompetition("Europa League")).toBe(true));
    test("Conference League", () => expect(isLowTrustCompetition("Conference League")).toBe(true));
    test("World Cup", () => expect(isLowTrustCompetition("World Cup")).toBe(true));
    test("Coupe de France", () => expect(isLowTrustCompetition("Coupe de France")).toBe(true));
    test("FA Cup", () => expect(isLowTrustCompetition("FA Cup · England")).toBe(true));
    test("Copa del Rey", () => expect(isLowTrustCompetition("Copa del Rey · Spain")).toBe(true));
    test("DFB-Pokal", () => expect(isLowTrustCompetition("DFB-Pokal · Germany")).toBe(true));
    test("Coppa Italia", () => expect(isLowTrustCompetition("Coppa Italia · Italy")).toBe(true));
    test("Nations League", () => expect(isLowTrustCompetition("Nations League")).toBe(true));
  });

  describe("MUST be blocked (categories)", () => {
    test("Women's football", () => expect(isLowTrustCompetition("Women Premier League")).toBe(true));
    test("Football féminin", () => expect(isLowTrustCompetition("Division 1 féminin")).toBe(true));
    test("U17", () => expect(isLowTrustCompetition("U17 World Cup")).toBe(true));
    test("U19", () => expect(isLowTrustCompetition("U19 Championship")).toBe(true));
    test("U21", () => expect(isLowTrustCompetition("U21 Euros")).toBe(true));
    test("Friendly", () => expect(isLowTrustCompetition("Club Friendly")).toBe(true));
    test("Amical", () => expect(isLowTrustCompetition("Match amical")).toBe(true));
    test("Reserves", () => expect(isLowTrustCompetition("Premier League Reserve")).toBe(true));
    test("Playoffs", () => expect(isLowTrustCompetition("Championship Playoff")).toBe(true));
    test("Barrages", () => expect(isLowTrustCompetition("Barrages Ligue 2")).toBe(true));
    test("eSports", () => expect(isLowTrustCompetition("eSport FIFA")).toBe(true));
    test("Virtual", () => expect(isLowTrustCompetition("Virtual Bundesliga")).toBe(true));
    test("Qualifications", () => expect(isLowTrustCompetition("World Cup Qualification")).toBe(true));
  });

  describe("MUST be blocked (unknown leagues default to blocked)", () => {
    test("MLS", () => expect(isLowTrustCompetition("MLS · USA")).toBe(true));
    test("Eredivisie", () => expect(isLowTrustCompetition("Eredivisie · Netherlands")).toBe(true));
    test("Liga Portugal", () => expect(isLowTrustCompetition("Liga Portugal · Portugal")).toBe(true));
    test("Random unknown league", () => expect(isLowTrustCompetition("Super League · Mongolia")).toBe(true));
  });
});
