const fs = require("fs");

const DATA_FILE = "data/picks.json";
const APP_FILE = "src/App.js";

function statusToApp(status) {
  const s = String(status || "").toUpperCase()
    .replace("É", "E")
    .replace("È", "E");
  if (s.includes("GAGN")) return "GAGNE";
  if (s.includes("PERD")) return "PERDU";
  if (s.includes("ATTENTE")) return "EN ATTENTE";
  if (s.includes("ANNUL")) return "ANNULE";
  return status || "EN ATTENTE";
}

function sportToApp(sport) {
  const s = String(sport || "").toLowerCase();
  if (s.includes("nba") || s.includes("basket")) return "Basket";
  if (s.includes("foot") || s.includes("soccer")) return "Foot";
  if (s.includes("hockey") || s.includes("nhl")) return "Hockey";
  if (s.includes("baseball") || s.includes("mlb")) return "Baseball";
  return sport || "Autre";
}

function historyRow(item) {
  if (Array.isArray(item) && item.length >= 7) {
    return [
      item[0],
      item[1],
      item[2],
      String(item[3] || ""),
      item[4] || "",
      statusToApp(item[5]),
      sportToApp(item[6])
    ];
  }

  return [
    item.date || "",
    item.match || "",
    item.marche || item.bet || item.prono || "",
    String(item.cote || ""),
    item.score_final || item.resultat || item.score_match || "",
    statusToApp(item.statut || item.status),
    sportToApp(item.sport)
  ];
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const rows = (data.history || []).map(historyRow).filter(r => r[1]);

let app = fs.readFileSync(APP_FILE, "utf8");

const next = "var ALL_PICKS = " + JSON.stringify(rows, null, 2) + ";";

const before = app;
app = app.replace(/var ALL_PICKS = \[[\s\S]*?\];/, next);

if (app === before) {
  console.error("ERREUR - bloc var ALL_PICKS introuvable dans src/App.js");
  process.exit(1);
}

fs.writeFileSync(APP_FILE, app);

console.log("OK - ALL_PICKS synchronisé");
console.log("Historique injecté:", rows.length);
console.log("Premier pick:", rows[0]?.[1] || "aucun");
