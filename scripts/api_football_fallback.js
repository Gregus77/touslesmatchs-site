const https = require("https");

const API_KEY = process.env.API_FOOTBALL_KEY;

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "v3.football.api-sports.io",
      path,
      method: "GET",
      headers: { "x-apisports-key": API_KEY }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(null); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isBadLeague(fx) {
  const name = `${fx.league?.name || ""} ${fx.league?.round || ""}`.toLowerCase();
  return (
    name.includes("u20") ||
    name.includes("u21") ||
    name.includes("u23") ||
    name.includes("youth") ||
    name.includes("women") ||
    name.includes("friendly") ||
    name.includes("reserve")
  );
}

function scoreFixture(fx) {
  let score = 6.4;
  const country = (fx.league?.country || "").toLowerCase();
  const league = (fx.league?.name || "").toLowerCase();

  if (["england", "spain", "italy", "france", "germany", "netherlands", "portugal", "belgium", "brazil", "argentina", "usa"].includes(country)) score += 0.5;
  if (league.includes("premier") || league.includes("serie a") || league.includes("liga") || league.includes("mls")) score += 0.4;
  if (fx.league?.standings) score += 0.2;

  return Math.min(8.0, score);
}

async function main() {
  if (!API_KEY) throw new Error("API_FOOTBALL_KEY manquant");

  const all = [];

  for (const offset of [0, 1, 2]) {
    const date = isoDate(offset);
    const data = await getJson(`/fixtures?date=${date}`);

    if (!data || !Array.isArray(data.response)) {
      console.log(`API-Football ${date}: réponse invalide`);
      continue;
    }

    for (const fx of data.response) {
      if (fx.fixture?.status?.short !== "NS") continue;
      if (isBadLeague(fx)) continue;

      const note = scoreFixture(fx);
      if (note < 6.5) continue;

      all.push({
        source: "API-Football",
        sport: "Football",
        match: `${fx.teams.home.name} vs ${fx.teams.away.name}`,
        league: `${fx.league.country} — ${fx.league.name}`,
        commence_time: fx.fixture.date,
        bet: `${fx.teams.home.name} ou ${fx.teams.away.name} — analyse Hermès requise`,
        cote: null,
        note: Number(note.toFixed(1)),
        premium_only: true,
        anj_status: "Foot — disponibilité bookmaker FR à vérifier"
      });
    }
  }

  all.sort((a, b) => b.note - a.note);

  console.log(JSON.stringify({
    count: all.length,
    top: all.slice(0, 12)
  }, null, 2));
}

main().catch(e => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
