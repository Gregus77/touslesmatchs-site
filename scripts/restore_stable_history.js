const fs = require("fs");
const path = require("path");

const preferred = [
  "data/picks.json.backup-clean-history-2026-06-14-0125",
  "public/data/picks.json.backup-clean-history-2026-06-14-0125",
  "data/picks.json.backup-carolina-win-2026-06-14-0301",
  "public/data/picks.json.backup-carolina-win-2026-06-14-0301",
  "data/picks.json.backup-date-format-2026-06-14-0252",
  "public/data/picks.json.backup-date-format-2026-06-14-0252"
];

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
}

function historySize(data) {
  return Array.isArray(data?.history) ? data.history.length : 0;
}

let sourceFile = null;
let sourceData = null;

for (const file of preferred) {
  const data = read(file);
  if (data && historySize(data) >= 20) {
    sourceFile = file;
    sourceData = data;
    break;
  }
}

if (!sourceData) {
  const candidates = [];
  for (const dir of ["data", "public/data"]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.startsWith("picks.json")) continue;
      const full = path.join(dir, file);
      const data = read(full);
      if (data && historySize(data)) candidates.push({ full, data, n: historySize(data) });
    }
  }

  candidates.sort((a, b) => b.n - a.n);
  if (!candidates.length) throw new Error("Aucune sauvegarde historique trouvée");
  sourceFile = candidates[0].full;
  sourceData = candidates[0].data;
}

console.log("SOURCE_RESTAUREE=", sourceFile);
console.log("HISTORIQUE_SOURCE=", historySize(sourceData));

function normalizeDate(v) {
  const raw = String(v || "").trim();

  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return raw;

  m = raw.match(/^(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}/${m[2]}/2026`;

  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  return raw;
}

function dateKey(v) {
  const d = normalizeDate(v);
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

function normalizeStatus(v) {
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
      normalizeDate(x[0]),
      String(x[1] || "").trim(),
      String(x[2] || "").replace(" · PERDU", "").trim(),
      String(x[3] || "").trim(),
      String(x[4] || "").trim(),
      normalizeStatus(x[5]),
      String(x[6] || "").trim() || "Foot"
    ];
  }

  return [
    normalizeDate(x.date),
    String(x.match || "").trim(),
    String(x.marche || x.prono || x.bet || "").replace(" · PERDU", "").trim(),
    String(x.cote || "").trim(),
    String(x.score_final || x.score || "").trim(),
    normalizeStatus(x.statut || x.status),
    String(x.sport || "").trim() || "Foot"
  ];
}

let rows = (sourceData.history || []).map(toRow);

rows.push(
  ["14/06/2026", "Carolina Core vs Crown Legacy", "Carolina Core ou nul", "", "2-0", "GAGNÉ", "Foot"],
  ["13/06/2026", "Atlanta United II vs Chattanooga", "Atlanta United II ou nul", "", "4-4", "GAGNÉ", "Foot"],
  ["13/06/2026", "Real Monarchs vs Portland Timbers II", "Real Monarchs ou nul", "", "4-1", "GAGNÉ", "Foot"],
  ["11/06/2026", "Spurs vs Knicks", "Spurs ML", "2.05", "Défaite Spurs", "PERDU", "Basket"]
);

rows = rows.filter(r => {
  const line = `${r[1]} ${r[2]}`.toLowerCase();

  if (!r[0] || !r[1] || !r[2]) return false;
  if (r[5] === "ANNULÉ") return false;

  if (line.includes("greece vs italy")) return false;
  if (line.includes("switzerland vs australia")) return false;

  if (r[1] === "Spurs vs Knicks" && r[5] === "EN ATTENTE") return false;

  return true;
});

const byKey = new Map();

for (const r of rows) {
  const key = `${r[1]}|${r[2]}`.toLowerCase();
  const existing = byKey.get(key);

  if (!existing) {
    byKey.set(key, r);
    continue;
  }

  const priority = { "GAGNÉ": 4, "PERDU": 3, "EN ATTENTE": 2, "ANNULÉ": 1 };
  const keepNew =
    dateKey(r[0]) > dateKey(existing[0]) ||
    (dateKey(r[0]) === dateKey(existing[0]) && (priority[r[5]] || 0) > (priority[existing[5]] || 0));

  if (keepNew) byKey.set(key, r);
}

const history = [...byKey.values()].sort((a, b) => dateKey(b[0]) - dateKey(a[0]));

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

const out = {
  ...sourceData,
  history,
  stats,
  derniere_maj: new Date().toISOString()
};

out.currentPick = out.currentPick || {};
if (out.currentPick.status === "NOPICK" || out.currentPick.bet === "NOPICK" || out.currentPick.home === "Aucun pick public") {
  out.currentPick.homeLogo = "https://www.touslesmatchs.com/logo192.png";
  out.currentPick.awayLogo = "https://www.touslesmatchs.com/logo512.png";
  out.currentPick.home = out.currentPick.home || "Aucun pick public";
  out.currentPick.away = out.currentPick.away || "Analyse en attente";
}

fs.writeFileSync("data/picks.json", JSON.stringify(out, null, 2));
fs.writeFileSync("public/data/picks.json", JSON.stringify(out, null, 2));

let app = fs.readFileSync("src/App.js", "utf8");
app = app.replace(/var ALL_PICKS = \[[\s\S]*?\];/, "var ALL_PICKS = " + JSON.stringify(history, null, 2) + ";");
app = app.replace(/var STATS = \{[\s\S]*?\};|var STATS = computeStats\(\);/, `var STATS = {won:${won}, lost:${lost}, pending:${pending}, winRate:${stats.taux}, units:0};`);
fs.writeFileSync("src/App.js", app);

console.log("OK_RESTAURATION_STABLE");
console.log("history=", history.length);
console.log("stats=", stats);
console.log("top10=", history.slice(0, 10));
