// ─────────────────────────────────────────────────────────────
// THE ODDS API — cotes réelles + scan multi-sports
// https://the-odds-api.com (gratuit jusqu'à 500 req/mois)
// Variable env : ODDS_API_KEY
// ─────────────────────────────────────────────────────────────
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const ODDS_KEY = process.env.ODDS_API_KEY || "";
const CACHE_PATH = path.join(__dirname, "oddsapi_cache.json");
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min (les cotes bougent)

let cache = {};
try {
  if (fs.existsSync(CACHE_PATH)) cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
} catch (e) { cache = {}; }

function saveCache() {
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); } catch (e) {}
}

// ─── HTTP helper avec cache ──────────────────────────────────
function oddsGet(endpoint) {
  return new Promise((resolve) => {
    const url = `/v4${endpoint}${endpoint.includes("?") ? "&" : "?"}apiKey=${ODDS_KEY}`;
    const req = https.request({
      hostname: "api.the-odds-api.com",
      path: url,
      method: "GET",
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── Normalisation pour matching équipes ─────────────────────
function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\bfc\b|\bsc\b|\bac\b|\baf\b|\bcf\b|\bca\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  const aw = na.split(" "), bw = nb.split(" ");
  if (aw[0].length >= 4 && bw[0].length >= 4 && aw[0] === bw[0]) return true;
  return false;
}

// ─── Récupère les cotes pour un sport ────────────────────────
// sportKey ex : soccer_uefa_nations_league, soccer_fifa_world_cup,
//                icehockey_nhl, baseball_mlb, basketball_nba
async function getOddsForSport(sportKey) {
  if (!ODDS_KEY) return [];
  const cacheKey = `odds_${sportKey}`;
  const now = Date.now();
  if (cache[cacheKey] && (now - cache[cacheKey].ts) < CACHE_TTL_MS) {
    return cache[cacheKey].data;
  }
  const data = await oddsGet(`/sports/${sportKey}/odds?regions=eu&markets=h2h&oddsFormat=decimal`);
  if (!Array.isArray(data)) return [];
  cache[cacheKey] = { ts: now, data };
  saveCache();
  return data;
}

// ─── Trouve les cotes 1X2 pour un match donné ────────────────
async function getMatchOdds(sportKey, homeName, awayName) {
  const events = await getOddsForSport(sportKey);
  for (const ev of events) {
    const homeMatch = teamsMatch(ev.home_team, homeName);
    const awayMatch = teamsMatch(ev.away_team, awayName);
    const reverseMatch = teamsMatch(ev.home_team, awayName) && teamsMatch(ev.away_team, homeName);
    if ((homeMatch && awayMatch) || reverseMatch) {
      const odds = extractH2HOdds(ev, reverseMatch);
      if (odds) return odds;
    }
  }
  return null;
}

function extractH2HOdds(event, reversed) {
  const allHome = [], allAway = [], allDraw = [];
  for (const book of (event.bookmakers || [])) {
    for (const market of (book.markets || [])) {
      if (market.key !== "h2h") continue;
      for (const out of (market.outcomes || [])) {
        const name = out.name;
        const price = parseFloat(out.price);
        if (isNaN(price)) continue;
        if (name === event.home_team) (reversed ? allAway : allHome).push(price);
        else if (name === event.away_team) (reversed ? allHome : allAway).push(price);
        else if (name === "Draw" || name === "Tie") allDraw.push(price);
      }
    }
  }
  if (!allHome.length || !allAway.length) return null;
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  return {
    cote_domicile: Math.round(avg(allHome) * 100) / 100,
    cote_exterieur: Math.round(avg(allAway) * 100) / 100,
    cote_nul: allDraw.length ? Math.round(avg(allDraw) * 100) / 100 : null,
    nb_bookmakers: (event.bookmakers || []).length,
  };
}

// ─── Liste tous les sports actifs ────────────────────────────
async function listActiveSports() {
  if (!ODDS_KEY) return [];
  const data = await oddsGet(`/sports/?all=false`);
  return Array.isArray(data) ? data : [];
}

// ─── Récupère tous les matchs d'un sport pour une date ───────
async function getEventsForSport(sportKey, targetDateISO) {
  const events = await getOddsForSport(sportKey);
  if (!targetDateISO) return events;
  return events.filter(ev => {
    if (!ev.commence_time) return false;
    return ev.commence_time.slice(0, 10) === targetDateISO;
  });
}

module.exports = {
  getOddsForSport,
  getMatchOdds,
  getEventsForSport,
  listActiveSports,
  hasKey: () => !!ODDS_KEY,
};
