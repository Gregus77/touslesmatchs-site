const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.API_FOOTBALL_KEY;
const FILE = path.join(__dirname, "..", "data", "premium_pending.json");

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "x-apisports-key": API_KEY || "" }
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsTeam(fx, name) {
  const raw = norm(`${fx.teams?.home?.name || ""} ${fx.teams?.away?.name || ""}`);
  return norm(name).split(" ").filter(x => x.length > 2).every(x => raw.includes(x));
}

function parseTeams(match) {
  if (!match.includes(" vs ")) return null;
  const [home, away] = match.split(" vs ");
  return { home: home.trim(), away: away.trim() };
}

function verdictForPick(pick, fx) {
  const teams = parseTeams(pick.match);
  if (!teams) return null;

  const apiHome = fx.teams.home.name;
  const apiAway = fx.teams.away.name;
  const hg = fx.goals.home;
  const ag = fx.goals.away;

  if (hg == null || ag == null) return null;

  const bet = norm(pick.bet);
  const target = bet.includes(norm(teams.away).split(" ")[0]) ? teams.away : teams.home;

  let targetGoals, otherGoals;

  if (norm(apiHome).includes(norm(target).split(" ")[0])) {
    targetGoals = hg;
    otherGoals = ag;
  } else {
    targetGoals = ag;
    otherGoals = hg;
  }

  const isDoubleChance = bet.includes("nul");
  const won = isDoubleChance ? targetGoals >= otherGoals : targetGoals > otherGoals;

  return {
    status: won ? "GAGNÉ" : "PERDU",
    score: `${hg}-${ag}`
  };
}

async function main() {
  if (!API_KEY) throw new Error("API_FOOTBALL_KEY manquante");

  const data = loadJson(FILE, { picks: [] });
  const pending = data.picks.filter(p => p.status === "EN ATTENTE");

  console.log(`Picks à vérifier: ${pending.length}`);

  for (const pick of pending) {
    const date = pick.date;
    const url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
    const json = await getJson(url);
    const fixtures = Array.isArray(json?.response) ? json.response : [];

    const teams = parseTeams(pick.match);
    if (!teams) {
      console.log(`SKIP ${pick.match}`);
      continue;
    }

    const fx = fixtures.find(f =>
      containsTeam(f, teams.home) && containsTeam(f, teams.away)
    );

    if (!fx) {
      console.log(`NON TROUVÉ: ${pick.match}`);
      continue;
    }

    const status = fx.fixture?.status?.short;
    if (!["FT", "AET", "PEN"].includes(status)) {
      console.log(`EN COURS/ATTENTE: ${pick.match} (${status})`);
      continue;
    }

    const result = verdictForPick(pick, fx);
    if (!result) {
      console.log(`RESULTAT IMPOSSIBLE: ${pick.match}`);
      continue;
    }

    pick.status = result.status;
    pick.score = result.score;
    pick.checked_at = new Date().toISOString();

    console.log(`${result.status}: ${pick.match} ${result.score}`);
  }

  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log("OK - premium_pending.json mis à jour");
}

main().catch(e => {
  console.error("ERREUR - " + e.message);
  process.exit(1);
});
