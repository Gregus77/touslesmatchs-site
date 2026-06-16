const fs = require("fs");

const DATA_FILES = ["data/picks.json", "public/data/picks.json"];
const LOGO_LEFT = "https://www.touslesmatchs.com/logo192.png";
const LOGO_RIGHT = "https://www.touslesmatchs.com/logo512.png";

function pad(n){ return String(n).padStart(2, "0"); }

function normalizeDate(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return raw;
  m = raw.match(/^(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}/${m[2]}/2026`;
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return raw;
}

function parseDate(v) {
  const d = normalizeDate(v);
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  return Number(`${m[3]}${m[2]}${m[1]}`);
}

function normStatus(v) {
  const s = String(v || "").toUpperCase()
    .replace("GAGNÉ", "GAGNE")
    .replace("ANNULÉ", "ANNULE")
    .trim();

  if (s.includes("GAGNE")) return "GAGNÉ";
  if (s.includes("PERDU")) return "PERDU";
  if (s.includes("ANNULE")) return "ANNULÉ";
  if (s.includes("ATTENTE")) return "EN ATTENTE";
  return s || "EN ATTENTE";
}

function toRow(x) {
  if (Array.isArray(x)) {
    return [
      normalizeDate(x[0]),
      String(x[1] || "").trim(),
      String(x[2] || "").replace(" · PERDU", "").trim(),
      String(x[3] || "").trim(),
      String(x[4] || "").trim(),
      normStatus(x[5]),
      String(x[6] || "").trim() || "Foot"
    ];
  }

  return [
    normalizeDate(x.date),
    String(x.match || "").trim(),
    String(x.marche || x.prono || x.bet || "").replace(" · PERDU", "").trim(),
    String(x.cote || "").trim(),
    String(x.score_final || x.score || "").trim(),
    normStatus(x.statut || x.status),
    String(x.sport || "").trim() || "Foot"
  ];
}

function cleanRows(rows) {
  const fixed = [];

  for (const item of rows) {
    const r = toRow(item);
    const [date, match, bet, cote, score, status, sport] = r;
    if (!date || !match || !bet) continue;
    if (status === "ANNULÉ") continue;

    const lower = `${match} ${bet}`.toLowerCase();

    if (lower.includes("greece vs italy")) continue;
    if (lower.includes("switzerland vs australia")) continue;

    if (match === "Spurs vs Knicks") {
      if (status === "EN ATTENTE") continue;
      fixed.push(["11/06/2026", "Spurs vs Knicks", "Spurs ML", "2.05", "Défaite Spurs", "PERDU", "Basket"]);
      continue;
    }

    if (match === "Carolina Core vs Crown Legacy") {
      fixed.push(["14/06/2026", match, "Carolina Core ou nul", cote, "2-0", "GAGNÉ", "Foot"]);
      continue;
    }

    if (match === "Atlanta United II vs Chattanooga") {
      fixed.push(["13/06/2026", match, "Atlanta United II ou nul", cote, "4-4", "GAGNÉ", "Foot"]);
      continue;
    }

    if (match === "Real Monarchs vs Portland Timbers II") {
      fixed.push(["13/06/2026", match, "Real Monarchs ou nul", cote, "4-1", "GAGNÉ", "Foot"]);
      continue;
    }

    fixed.push([date, match, bet, cote, score, status, sport]);
  }

  const byKey = new Map();
  for (const r of fixed) {
    const key = `${r[1]}|${r[2]}`.toLowerCase();
    const old = byKey.get(key);
    if (!old || parseDate(r[0]) >= parseDate(old[0])) byKey.set(key, r);
  }

  return [...byKey.values()].sort((a, b) => parseDate(b[0]) - parseDate(a[0]));
}

function computeStats(history) {
  const played = history.filter(r => r[5] === "GAGNÉ" || r[5] === "PERDU");
  const gagnes = played.filter(r => r[5] === "GAGNÉ").length;
  const perdus = played.filter(r => r[5] === "PERDU").length;
  const en_attente = history.filter(r => r[5] === "EN ATTENTE").length;

  return {
    total: history.length,
    gagnes,
    perdus,
    en_attente,
    taux: played.length ? Math.round((gagnes / played.length) * 100) : 0,
    bankroll: null,
    derniere_maj: new Date().toISOString()
  };
}

for (const file of DATA_FILES) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.history = cleanRows(data.history || []);
  data.stats = computeStats(data.history);

  data.currentPick = data.currentPick || {};
  const isNoPick = data.currentPick.status === "NOPICK" || data.currentPick.bet === "NOPICK" || data.currentPick.home === "Aucun pick public";
  if (isNoPick) {
    data.currentPick.homeLogo = LOGO_LEFT;
    data.currentPick.awayLogo = LOGO_RIGHT;
    data.currentPick.home = data.currentPick.home || "Aucun pick public";
    data.currentPick.away = data.currentPick.away || "Analyse en attente";
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

console.log("OK - historique nettoyé, dates uniformisées, stats recalculées.");
