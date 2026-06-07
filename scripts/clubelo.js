// ─────────────────────────────────────────────────────────────
// CLUB ELO — API gratuite pour ELO réel des clubs & sélections
// http://api.clubelo.com/{TeamName} → CSV avec ELO historique
// ─────────────────────────────────────────────────────────────
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "clubelo_cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_ELO = 1500; // ELO neutre quand équipe inconnue

// Charge le cache disque (persistant entre runs)
let cache = {};
try {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  }
} catch (e) { cache = {}; }

function saveCache() {
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); } catch (e) {}
}

// Normalise un nom d'équipe pour l'URL ClubElo
// "Paris Saint-Germain" → "PSG"
// "Real Madrid" → "RealMadrid"
// "Manchester United" → "ManUnited"
function normalizeTeamName(name) {
  if (!name) return "";
  const aliases = {
    "Paris Saint-Germain": "PSG",
    "Paris SG": "PSG",
    "PSG": "PSG",
    "Real Madrid": "RealMadrid",
    "FC Barcelona": "Barcelona",
    "Barça": "Barcelona",
    "Atlético Madrid": "AtleticoMadrid",
    "Atletico Madrid": "AtleticoMadrid",
    "Manchester United": "ManUnited",
    "Manchester City": "ManCity",
    "Bayern München": "Bayern",
    "Bayern Munich": "Bayern",
    "Borussia Dortmund": "Dortmund",
    "Inter Milan": "Inter",
    "Internazionale": "Inter",
    "AC Milan": "Milan",
    "Olympique Marseille": "Marseille",
    "Olympique Lyonnais": "Lyon",
    "Olympique de Marseille": "Marseille",
    "OM": "Marseille",
    "OL": "Lyon",
  };
  if (aliases[name]) return aliases[name];
  // Sinon : enlève espaces et caractères spéciaux
  return name.replace(/[^a-zA-Z0-9]/g, "");
}

// Récupère l'ELO actuel d'une équipe via ClubElo
function fetchEloRaw(teamSlug) {
  return new Promise((resolve) => {
    const req = http.get(`http://api.clubelo.com/${teamSlug}`, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        // CSV format: Rank,Club,Country,Level,Elo,From,To
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

// API publique : ELO d'une équipe (avec cache 24h)
async function getElo(teamName) {
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

module.exports = { getElo, normalizeTeamName };
