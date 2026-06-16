const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data", "picks.json");
const PUBLIC = path.join(__dirname, "..", "public", "data", "picks.json");
const PENDING = path.join(__dirname, "..", "data", "premium_pending.json");

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function dateFr(d) {
  if (!d) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y,m,day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  return d;
}

function normalizeStatus(s) {
  s = String(s || "EN ATTENTE").toUpperCase();
  if (s === "GAGNE") return "GAGNÉ";
  if (s === "PERDU") return "PERDU";
  if (s === "ANNULE") return "ANNULÉ";
  if (s === "GAGNÉ") return "GAGNÉ";
  return "EN ATTENTE";
}

const site = readJson(DATA, { currentPick: {}, history: [] });
const pending = readJson(PENDING, { picks: [] });

site.history = Array.isArray(site.history) ? site.history : [];

let added = 0;
let updated = 0;

for (const p of pending.picks || []) {
  const match = String(p.match || "").trim();
  if (!match) continue;

  const row = [
    dateFr(p.date),
    match,
    p.bet || p.prono || "",
    p.cote || "",
    p.score || "",
    normalizeStatus(p.status),
    p.sport || "Foot"
  ];

  const idx = site.history.findIndex(h => Array.isArray(h) && String(h[1]).toLowerCase() === match.toLowerCase());

  if (idx >= 0) {
    site.history[idx] = row;
    updated++;
  } else {
    site.history.unshift(row);
    added++;
  }
}

const played = site.history.filter(p => Array.isArray(p) && ["GAGNÉ", "PERDU"].includes(p[5]));
const won = played.filter(p => p[5] === "GAGNÉ").length;
const lost = played.filter(p => p[5] === "PERDU").length;
const pendingCount = site.history.filter(p => Array.isArray(p) && p[5] === "EN ATTENTE").length;

site.stats = {
  total: site.history.length,
  gagnes: won,
  perdus: lost,
  en_attente: pendingCount,
  taux: played.length ? Math.round((won / played.length) * 100) : 0,
  bankroll: null,
  derniere_maj: new Date().toISOString()
};

site.derniere_maj = new Date().toISOString();

fs.writeFileSync(DATA, JSON.stringify(site, null, 2));
fs.mkdirSync(path.dirname(PUBLIC), { recursive: true });
fs.writeFileSync(PUBLIC, JSON.stringify(site, null, 2));

console.log(`OK - Premium vers site: ${added} ajouté(s), ${updated} mis à jour`);
console.log(`Stats: ${site.stats.gagnes}G / ${site.stats.perdus}P / ${site.stats.en_attente} attente - ${site.stats.taux}%`);
