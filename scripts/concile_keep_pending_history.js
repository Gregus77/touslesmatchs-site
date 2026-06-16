const fs = require("fs");
const path = require("path");

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normDate(v) {
  const raw = String(v || "").trim();

  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return raw;

  m = raw.match(/^(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}/${m[2]}/2026`;

  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  return raw;
}

function dateKey(v) {
  const d = normDate(v);
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

function normStatus(v) {
  const s = String(v || "").toUpperCase()
    .replace("GAGNÉ", "GAGNE")
    .replace("ANNULÉ", "ANNULE")
    .trim();

  if (s.includes("GAGNE")) return "GAGNÉ";
  if (s.includes("PERDU")) return "PERDU";
  if (s.includes("ATTENTE")) return "EN ATTENTE";
  if (s.includes("ANNULE")) return "ANNULÉ";
  return s || "EN ATTENTE";
}

function toRow(x) {
  if (Array.isArray(x)) {
    return [
      normDate(x[0]),
      String(x[1] || "").trim(),
      String(x[2] || "").replace(" · PERDU", "").trim(),
      String(x[3] || "").trim(),
      String(x[4] || "").trim(),
      normStatus(x[5]),
      String(x[6] || "").trim() || "Foot"
    ];
  }

  return [
    normDate(x.date),
    String(x.match || "").trim(),
    String(x.marche || x.prono || x.bet || "").replace(" · PERDU", "").trim(),
    String(x.cote || "").trim(),
    String(x.score_final || x.score || "").trim(),
    normStatus(x.statut || x.status),
    String(x.sport || "").trim() || "Foot"
  ];
}

function rowKey(r) {
  return `${r[1]}|${r[2]}`.toLowerCase();
}

const main = readJson("data/picks.json");
if (!main) throw new Error("data/picks.json introuvable");

let rows = Array.isArray(main.history) ? main.history.map(toRow) : [];

// 1) Récupère les EN ATTENTE depuis premium_pending.json
const premiumPending = readJson("data/premium_pending.json");
if (premiumPending && Array.isArray(premiumPending.picks)) {
  for (const p of premiumPending.picks) {
    rows.push([
      normDate(p.checked_at || p.date),
      String(p.match || "").trim(),
      String(p.bet || p.prono || "").trim(),
      String(p.cote || "").trim(),
      String(p.score || "").trim(),
      normStatus(p.status),
      String(p.sport || "").trim() || "Foot"
    ]);
  }
}

// 2) Récupère aussi les anciens EN ATTENTE présents dans les sauvegardes
for (const dir of ["data", "public/data"]) {
  if (!fs.existsSync(dir)) continue;

  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith("picks.json")) continue;

    const data = readJson(path.join(dir, f));
    if (!data || !Array.isArray(data.history)) continue;

    for (const item of data.history) {
      const r = toRow(item);
      if (r[5] === "EN ATTENTE") rows.push(r);
    }
  }
}

// Nettoyage minimal
rows = rows.filter(r => {
  if (!r[0] || !r[1] || !r[2]) return false;

  const line = `${r[1]} ${r[2]}`.toLowerCase();

  // Ces deux-là avaient été décidés comme annulés / à retirer
  if (line.includes("greece vs italy")) return false;
  if (line.includes("switzerland vs australia")) return false;

  return true;
});

// Si un pari existe en GAGNÉ/PERDU, on ne garde pas son ancien EN ATTENTE
const playedKeys = new Set(
  rows
    .filter(r => r[5] === "GAGNÉ" || r[5] === "PERDU")
    .map(rowKey)
);

rows = rows.filter(r => {
  if (r[5] === "EN ATTENTE" && playedKeys.has(rowKey(r))) return false;
  return true;
});

// Déduplication propre
const priority = { "GAGNÉ": 4, "PERDU": 3, "EN ATTENTE": 2, "ANNULÉ": 1 };
const map = new Map();

for (const r of rows) {
  const key = rowKey(r);
  const old = map.get(key);

  if (!old) {
    map.set(key, r);
    continue;
  }

  const newer = dateKey(r[0]) > dateKey(old[0]);
  const sameDateBetterStatus =
    dateKey(r[0]) === dateKey(old[0]) &&
    (priority[r[5]] || 0) > (priority[old[5]] || 0);

  if (newer || sameDateBetterStatus) map.set(key, r);
}

const history = [...map.values()].sort((a, b) => dateKey(b[0]) - dateKey(a[0]));

const played = history.filter(r => r[5] === "GAGNÉ" || r[5] === "PERDU");
const won = played.filter(r => r[5] === "GAGNÉ").length;
const lost = played.filter(r => r[5] === "PERDU").length;
const pending = history.filter(r => r[5] === "EN ATTENTE").length;

const stats = {
  total: history.length,
  gagnes: won,
  perdus: lost,
  en_attente: pending,
  taux: played.length ? Math.round((won / played.length) * 100) : 0,
  bankroll: null,
  derniere_maj: new Date().toISOString()
};

main.history = history;
main.stats = stats;
main.derniere_maj = new Date().toISOString();

writeJson("data/picks.json", main);
writeJson("public/data/picks.json", main);

// Injection dans App.js
let app = fs.readFileSync("src/App.js", "utf8");
app = app.replace(
  /var ALL_PICKS = \[[\s\S]*?\];/,
  "var ALL_PICKS = " + JSON.stringify(history, null, 2) + ";"
);
app = app.replace(
  /var STATS = \{[\s\S]*?\};|var STATS = computeStats\(\);/,
  `var STATS = {won:${won}, lost:${lost}, pending:${pending}, winRate:${stats.taux}, units:0};`
);
fs.writeFileSync("src/App.js", app);

console.log("OK - EN ATTENTE conservés dans l'historique");
console.log("history=", history.length);
console.log("stats=", stats);
console.log("en_attente=", history.filter(r => r[5] === "EN ATTENTE"));
