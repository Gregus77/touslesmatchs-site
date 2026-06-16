const https = require("https");

const API_KEY = process.env.THE_ODDS_API_KEY;

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data.slice(0, 200))); }
      });
    }).on("error", reject);
  });
}

function bestOutcome(event) {
  const outcomes = [];

  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;
      for (const outcome of market.outcomes || []) {
        if (!outcome.price || outcome.price < 1.35 || outcome.price > 2.20) continue;
        outcomes.push({
          team: outcome.name,
          price: Number(outcome.price),
          bookmaker: bookmaker.title,
        });
      }
    }
  }

  outcomes.sort((a, b) => a.price - b.price);
  return outcomes[0] || null;
}

function scoreCandidate(event, outcome) {
  let score = 6.5;

  if (outcome.price >= 1.45 && outcome.price <= 1.75) score += 0.8;
  if (event.sport_key.includes("soccer")) score += 0.4;
  if (event.sport_key.includes("tennis")) score += 0.2;
  if (event.sport_key.includes("baseball")) score -= 0.4;

  return Math.max(5.5, Math.min(8.4, score));
}

async function main() {
  if (!API_KEY) throw new Error("THE_ODDS_API_KEY manquant");

  const url = `https://api.the-odds-api.com/v4/sports/upcoming/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${API_KEY}`;
  const events = await getJson(url);

  if (!Array.isArray(events)) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  const candidates = [];

  for (const event of events) {
    const outcome = bestOutcome(event);
    if (!outcome) continue;

    const score = scoreCandidate(event, outcome);

    candidates.push({
      source: "The Odds API",
      sport: event.sport_title,
      sport_key: event.sport_key,
      match: `${event.home_team} vs ${event.away_team}`,
      commence_time: event.commence_time,
      bet: `${outcome.team} vainqueur`,
      cote: outcome.price,
      bookmaker: outcome.bookmaker,
      note: Number(score.toFixed(1)),
      premium_only: true,
      anj_status: "EU bookmakers — vérifier disponibilité FR",
    });
  }

  candidates.sort((a, b) => b.note - a.note || a.cote - b.cote);

  console.log(JSON.stringify({
    count: candidates.length,
    top: candidates.slice(0, 10),
  }, null, 2));
}

main().catch(e => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
