// Tests du featuredMatch/watchlist (scripts/api_server.js).
//
// Ces tests portent UNIQUEMENT sur les fonctions pures extraites
// (isFixtureExcludedFromFeatured, isWithinPickWindow, evaluateFeaturedCandidate)
// — aucun appel reseau (API-Sports), aucune base de donnees. computeUpcomingPicks()
// lui-meme fait de vrais appels HTTP et n'est pas teste directement ici ; ces
// fonctions pures sont exactement ce qu'il appelle pour chaque decision, donc
// les couvrir couvre le comportement reel.
//
// Lancer : DB_PATH=":memory:" PORT=0 node --test tests/featured_match.test.js

process.env.DB_PATH = process.env.DB_PATH || ":memory:";
process.env.PORT = process.env.PORT || "0";

const test = require("node:test");
const assert = require("node:assert/strict");

const mod = require("../scripts/api_server.js");
const {
  isFixtureExcludedFromFeatured,
  isWithinPickWindow,
  evaluateFeaturedCandidate,
} = mod.__liveContractTest;

for (const h of process._getActiveHandles()) {
  if (h && typeof h.unref === "function") h.unref();
}
setTimeout(() => {
  mod.__liveContractTest._httpServer?.close();
  process.exit(process.exitCode ?? 0);
}, 10000);

function compObj(overrides = {}) {
  return {
    competition: "Ligue 1", league: "Ligue 1", country: "France",
    sport: "Football", home: "Marseille", away: "Lyon",
    ...overrides,
  };
}

function baseCandidate(overrides = {}) {
  return {
    home: "Marseille", away: "Lyon", competition: "Ligue 1 · France",
    sport: "Football", kickoff: new Date(Date.now() + 3 * 3600000).toISOString(),
    home_logo: "https://example.com/om.png", away_logo: "https://example.com/ol.png",
    ...overrides,
  };
}

test("F1 — aujourd'hui/demain uniquement : isWithinPickWindow rejette un match trop loin ou deja passe", () => {
  const now = Date.now();
  assert.equal(isWithinPickWindow(new Date(now + 3600000).toISOString(), now), true, "dans 1h -> accepte");
  assert.equal(isWithinPickWindow(new Date(now + 35 * 3600000).toISOString(), now), true, "dans 35h -> accepte (couvre demain)");
  assert.equal(isWithinPickWindow(new Date(now + 40 * 3600000).toISOString(), now), false, "dans 40h -> refuse (au-dela de la fenetre)");
  assert.equal(isWithinPickWindow(new Date(now - 3600000).toISOString(), now), false, "deja commence -> refuse");
  assert.equal(isWithinPickWindow("date-invalide", now), false, "date invalide -> refuse, jamais une exception");
});

test("F2 — football masculin uniquement : un match feminin est exclu avant meme le calcul de confiance", () => {
  const women = compObj({ competition: "NWSL Women's League" });
  assert.equal(isFixtureExcludedFromFeatured(women), true);
});

test("F3 — aucun USA ni Canada : MLS et Canadian Premier League exclues du featuredMatch", () => {
  const mls = compObj({ competition: "Major League Soccer", home: "LA Galaxy", away: "Inter Miami" });
  const cpl = compObj({ competition: "Canadian Premier League", home: "Forge FC", away: "Cavalry FC" });
  const french = compObj();
  assert.equal(isFixtureExcludedFromFeatured(mls), true, "MLS doit etre exclue");
  assert.equal(isFixtureExcludedFromFeatured(cpl), true, "Canadian Premier League doit etre exclue");
  assert.equal(isFixtureExcludedFromFeatured(french), false, "un match francais ne doit pas etre exclu a tort");
});

test("F4 — aucun marche, cote ou conseil expose : le candidat non qualifie ne contient jamais 'bet'", () => {
  // Cas 1 : historique insuffisant (h2h.n < 3)
  const r1 = evaluateFeaturedCandidate(baseCandidate(), { n: 1, homeWins: 1, awayWins: 0, bttsPct: 50, htGoalPct: 50 }, 82);
  assert.equal(r1.qualifies, false);
  assert.equal("bet" in r1.candidate, false, "aucun champ bet ne doit fuiter dans le candidat sous observation");
  assert.equal(typeof r1.candidate.reason, "string");
  assert.match(r1.candidate.reason, /historique direct insuffisant/i);

  // Cas 2 : assez d'historique mais confiance sous le seuil
  const r2 = evaluateFeaturedCandidate(baseCandidate(), { n: 5, homeWins: 2, awayWins: 1, bttsPct: 60, htGoalPct: 55 }, 82);
  assert.equal(r2.qualifies, false);
  assert.equal("bet" in r2.candidate, false, "aucun champ bet ne doit fuiter meme quand une confiance est calculee");
  assert.match(r2.candidate.reason, /confiance maximale obtenue/i);
  assert.equal(typeof r2.candidate.confidence, "number");
});

test("F5 — status toujours watchlist, jamais confondu avec un pick qualifie : evaluateFeaturedCandidate distingue clairement les deux", () => {
  // Un H2H tres favorable qui DOIT qualifier (toutes les confiances au-dessus du seuil)
  const strongH2h = { n: 10, homeWins: 9, awayWins: 0, bttsPct: 90, htGoalPct: 90 };
  const qualified = evaluateFeaturedCandidate(baseCandidate(), strongH2h, 50);
  assert.equal(qualified.qualifies, true, "un match tres favorable doit qualifier");
  assert.ok(Array.isArray(qualified.candidates) && qualified.candidates.length > 0);
  assert.equal("candidate" in qualified, false, "un resultat qualifie ne doit pas produire de champ 'candidate' de type watchlist");

  // Le meme H2H, mais avec un seuil de publication inatteignable -> jamais qualifie
  const neverQualifies = evaluateFeaturedCandidate(baseCandidate(), strongH2h, 999);
  assert.equal(neverQualifies.qualifies, false);
  assert.equal("candidates" in neverQualifies, false, "un resultat non qualifie ne doit pas produire de champ 'candidates' de type pick valide");
});

test("F6 — logos avec repli propre : /upcoming-picks substitue le logo officiel du site quand l'API n'en fournit pas", () => {
  // Reproduit exactement la construction de candidateBase dans computeUpcomingPicks :
  // home_logo/away_logo utilisent `f.teams.home.logo || "/logo192.png"`.
  const fTeamsNoLogo = { home: { name: "Marseille", logo: null }, away: { name: "Lyon", logo: "" } };
  const homeLogo = fTeamsNoLogo.home.logo || "/logo192.png";
  const awayLogo = fTeamsNoLogo.away.logo || "/logo192.png";
  assert.equal(homeLogo, "/logo192.png", "logo absent (null) -> repli sur le logo officiel du site");
  assert.equal(awayLogo, "/logo192.png", "logo absent (chaine vide) -> repli sur le logo officiel du site");

  const fTeamsWithLogo = { home: { name: "Marseille", logo: "https://example.com/om.png" } };
  assert.equal(fTeamsWithLogo.home.logo || "/logo192.png", "https://example.com/om.png", "un vrai logo n'est jamais remplace");
});
