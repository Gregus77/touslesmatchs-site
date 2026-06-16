const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PENDING_FILE = path.join(ROOT, "data", "premium_pending.json");
const PICKS_FILE = path.join(ROOT, "data", "picks.json");
const PUBLIC_FILE = path.join(ROOT, "public", "data", "picks.json");

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function frDate(iso) {
  if (!iso || !iso.includes("-")) return iso || "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function computeStats(history) {
  const won = history.filter(p => p.statut === "GAGNÉ" || p.statut === "GAGNE").length;
  const lost = history.filter(p => p.statut === "PERDU").length;
  const pending = history.filter(p => p.statut === "EN ATTENTE").length;
  const played = won + lost;

  return {
    total: history.length,
    gagnes: won,
    perdus: lost,
    en_attente: pending,
    taux: played ? Math.round((won / played) * 100) : 0,
    bankroll: null,
    derniere_maj: new Date().toISOString()
  };
}

const pending = load(PENDING_FILE, { picks: [] });
const picksData = load(PICKS_FILE, { currentPick: {}, history: [] });

picksData.history = Array.isArray(picksData.history) ? picksData.history : [];

let added = 0;
let updated = 0;
let ignored = 0;

for (const p of pending.picks || []) {
  if (!["GAGNÉ", "GAGNE", "PERDU"].includes(p.status)) {
    ignored++;
    continue;
  }

  const key = norm(`${p.date} ${p.match}`);
  const existing = picksData.history.find(h => norm(`${h.date} ${h.match}`) === key || norm(h.match) === norm(p.match));

  const row = {
    id: p.id,
    date: frDate(p.date),
    match: p.match,
    sport: p.sport || "Football",
    marche: p.bet || "",
    cote: p.cote || "",
    mise_euros: "",
    statut: p.status === "GAGNE" ? "GAGNÉ" : p.status,
    score: Number(p.note || 0),
    score_final: p.score || "",
    verifie_le: frDate((p.checked_at || new Date().toISOString()).slice(0, 10)),
    explication_resultat: "Résultat Premium vérifié automatiquement.",
    gain_perte: ""
  };

  if (existing) {
    Object.assign(existing, row);
    updated++;
  } else {
    picksData.history.unshift(row);
    added++;
  }
}

picksData.stats = computeStats(picksData.history);
picksData.derniere_maj = new Date().toISOString();

save(PICKS_FILE, picksData);
save(PUBLIC_FILE, picksData);

const today = new Date().toISOString().slice(0, 10);
const learningFile = path.join(ROOT, "data", `hermes_learning_${today}.md`);

const wonToday = (pending.picks || []).filter(p => p.status === "GAGNÉ" || p.status === "GAGNE");
const lostToday = (pending.picks || []).filter(p => p.status === "PERDU");
const waitToday = (pending.picks || []).filter(p => p.status === "EN ATTENTE");

const note = `# Apprentissage Hermès - ${today}

## Résultats Premium suivis
- Gagnés: ${wonToday.length}
- Perdus: ${lostToday.length}
- En attente: ${waitToday.length}

## Picks gagnés
${wonToday.map(p => `- ${p.match} | ${p.bet} | ${p.score || "score inconnu"} | note ${p.note || "?"}/10`).join("\n") || "- Aucun"}

## Picks perdus
${lostToday.map(p => `- ${p.match} | ${p.bet} | ${p.score || "score inconnu"} | note ${p.note || "?"}/10`).join("\n") || "- Aucun"}

## Règle d'apprentissage
Hermès doit renforcer les critères qui ont validé les picks gagnants, mais rester prudent : un bon résultat ne suffit pas à prouver une méthode. Les matchs non trouvés ou en attente doivent rester hors statistiques jouées.
`;

fs.writeFileSync(learningFile, note);

console.log("OK - Premium vers historique synchronisé");
console.log(JSON.stringify({
  ajoutes: added,
  mis_a_jour: updated,
  ignores_en_attente: ignored,
  stats: picksData.stats,
  learning: learningFile
}, null, 2));
