// ─────────────────────────────────────────────────────────────
// CLUB ELO + NATIONAL TEAM ELO
// ClubElo (clubs) : http://api.clubelo.com/{TeamName}
// Sélections nationales : table statique FIFA-calibrée
// ─────────────────────────────────────────────────────────────
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "clubelo_cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ELO = 1500;

let cache = {};
try {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  }
} catch (e) { cache = {}; }

function saveCache() {
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); } catch (e) {}
}

// ─── ELO des sélections nationales (calibré FIFA juin 2026) ──
// Source : classement FIFA + historique ELO club-level estimé
const NATIONAL_ELO = {
  // Top nations
  "France": 2050, "Spain": 2040, "England": 2020, "Brazil": 2010,
  "Argentina": 2060, "Portugal": 1990, "Netherlands": 1970, "Belgium": 1960,
  "Germany": 1960, "Italy": 1950, "Croatia": 1920, "Uruguay": 1910,
  "Switzerland": 1900, "Denmark": 1890, "Poland": 1870, "Morocco": 1870,
  "Colombia": 1870, "Mexico": 1860, "USA": 1850, "Japan": 1850,
  "Senegal": 1840, "Austria": 1840, "Turkey": 1840, "Czech Republic": 1830,
  "Romania": 1820, "Serbia": 1820, "Ukraine": 1810, "Hungary": 1800,
  "Slovakia": 1800, "Greece": 1780, "Albania": 1770, "Wales": 1770,
  "Scotland": 1760, "Norway": 1760, "Sweden": 1760, "Russia": 1750,
  "Australia": 1750, "Iran": 1740, "South Korea": 1740, "Ecuador": 1730,
  "Tunisia": 1720, "Algeria": 1720, "Egypt": 1720, "Cameroon": 1710,
  "Nigeria": 1710, "Ghana": 1700, "Ivory Coast": 1700, "Canada": 1700,
  "Chile": 1700, "Peru": 1690, "Paraguay": 1690, "Venezuela": 1680,
  "Bolivia": 1670, "Costa Rica": 1660, "Panama": 1650, "Jamaica": 1640,
  "Northern Ireland": 1650, "Republic of Ireland": 1680, "Finland": 1680,
  "Slovenia": 1700, "Bosnia and Herzegovina": 1700, "North Macedonia": 1680,
  "Iceland": 1720, "Georgia": 1700, "Kosovo": 1670, "Luxembourg": 1640,
  "Israel": 1690, "Jordan": 1640, "Saudi Arabia": 1650, "Qatar": 1620,
  "China": 1640, "Thailand": 1620, "Vietnam": 1600, "India": 1580,
  "Uzbekistan": 1660, "Kazakhstan": 1640, "Armenia": 1650,
  "New Zealand": 1620, "Burkina Faso": 1660, "Mali": 1660,
  "South Africa": 1660, "Zimbabwe": 1620, "Tanzania": 1610,
};

// ─── Alias noms clubs → slug ClubElo ────────────────────────
const CLUB_ALIASES = {
  // France
  "Paris Saint-Germain": "Paris", "Paris SG": "Paris", "PSG": "Paris",
  "Olympique de Marseille": "Marseille", "Olympique Marseille": "Marseille", "OM": "Marseille",
  "Olympique Lyonnais": "Lyon", "OL": "Lyon",
  "AS Monaco": "Monaco", "AS Saint-Etienne": "SaintEtienne",
  "Stade Rennais": "Rennes", "RC Lens": "Lens", "LOSC Lille": "Lille",
  // Espagne
  "Real Madrid": "RealMadrid", "FC Barcelona": "Barcelona", "Barça": "Barcelona",
  "Atlético Madrid": "AtleticoMadrid", "Atletico Madrid": "AtleticoMadrid",
  "Sevilla FC": "Sevilla", "Real Sociedad": "RealSociedad",
  "Athletic Bilbao": "AthleticClub", "Real Betis": "Betis",
  "Villarreal CF": "Villarreal",
  // Angleterre
  "Manchester United": "ManUnited", "Manchester City": "ManCity",
  "Arsenal FC": "Arsenal", "Arsenal": "Arsenal",
  "Liverpool FC": "Liverpool", "Liverpool": "Liverpool",
  "Chelsea FC": "Chelsea", "Chelsea": "Chelsea",
  "Tottenham Hotspur": "Tottenham", "Tottenham": "Tottenham",
  "Newcastle United": "Newcastle", "Aston Villa": "AstonVilla",
  "West Ham United": "WestHam",
  // Allemagne
  "Bayern München": "Bayern", "Bayern Munich": "Bayern",
  "Borussia Dortmund": "Dortmund", "RB Leipzig": "RBLeipzig",
  "Bayer Leverkusen": "Leverkusen", "Borussia Mönchengladbach": "Moenchengladbach",
  "Eintracht Frankfurt": "Frankfurt", "VfB Stuttgart": "Stuttgart",
  // Italie
  "Inter Milan": "Inter", "Internazionale": "Inter",
  "AC Milan": "Milan", "Juventus FC": "Juventus", "Juventus": "Juventus",
  "SSC Napoli": "Napoli", "AS Roma": "Roma", "Lazio": "Lazio",
  "Atalanta": "Atalanta", "Fiorentina": "Fiorentina",
  // Portugal
  "SL Benfica": "Benfica", "FC Porto": "Porto",
  "Sporting CP": "Sporting", "Sporting Lisbon": "Sporting",
  // Pays-Bas
  "Ajax": "Ajax", "PSV Eindhoven": "PSV", "Feyenoord": "Feyenoord",
  // Belgique
  "Club Brugge": "Brugge", "Anderlecht": "Anderlecht",
  // Turquie
  "Galatasaray": "Galatasaray", "Fenerbahçe": "Fenerbahce",
  "Besiktas": "Besiktas",
  // Russie
  "Spartak Moscow": "SpartakMoscow", "CSKA Moscow": "CSKAMoscow",
  "Zenit": "Zenit",
  // Divers
  "Fribourg": "Freiburg", "SC Freiburg": "Freiburg",
  "Boca Juniors": "BocaJuniors", "River Plate": "RiverPlate",
};

function normalizeTeamName(name) {
  if (!name) return "";
  if (CLUB_ALIASES[name]) return CLUB_ALIASES[name];
  return name.replace(/[^a-zA-Z0-9]/g, "");
}

// ─── Détecte si c'est une sélection nationale ────────────────
function isNationalTeam(name) {
  return NATIONAL_ELO.hasOwnProperty(name);
}

// ─── Fetch ELO club via ClubElo ──────────────────────────────
function fetchEloRaw(teamSlug) {
  return new Promise((resolve) => {
    const req = http.get(`http://api.clubelo.com/${teamSlug}`, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        const lines = body.trim().split("\n");
        if (lines.length < 2) return resolve(null);
        const last = lines[lines.length - 1].split(",");
        const elo = parseFloat(last[4]);
        resolve(isNaN(elo) ? null : Math.round(elo));
      });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}

// ─── API publique : ELO d'une équipe (club ou sélection) ─────
async function getElo(teamName) {
  // Sélections nationales → table statique
  if (isNationalTeam(teamName)) {
    return NATIONAL_ELO[teamName];
  }

  const slug = normalizeTeamName(teamName);
  if (!slug) return DEFAULT_ELO;

  const now = Date.now();
  const cached = cache[slug];
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    return cached.elo;
  }

  const elo = await fetchEloRaw(slug);
  const finalElo = elo || DEFAULT_ELO;
  cache[slug] = { elo: finalElo, ts: now, name: teamName };
  saveCache();
  return finalElo;
}

module.exports = { getElo, normalizeTeamName, isNationalTeam, NATIONAL_ELO };
