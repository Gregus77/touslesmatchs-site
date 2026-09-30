"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB = process.env.DB_PATH || "/data/tlm.db";
const OUT = process.env.MARKETING_OUT || "/data/marketing";

const db = new Database(DB, { readonly: true });

function parisDay() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function euro(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(2).replace(".", ",") + " €";
}

const day = parisDay();

const rows = db.prepare(`
  SELECT
    home,away,competition,best_bet,confidence,real_odd,
    outcome,final_score_home,final_score_away,resolved_at
  FROM concile_analyses
  WHERE outcome IN ('win','loss')
    AND final_score_home IS NOT NULL
    AND final_score_away IS NOT NULL
    AND date(resolved_at)=date('now')
  ORDER BY datetime(resolved_at) DESC
`).all();

const wins = rows.filter(r => r.outcome === "win").length;
const losses = rows.filter(r => r.outcome === "loss").length;

let profit = 0;
let roiRows = 0;

for (const r of rows) {
  const odd = Number(r.real_odd);
  if (!Number.isFinite(odd) || odd <= 1) continue;
  roiRows++;
  profit += r.outcome === "win" ? (odd - 1) * 10 : -10;
}

const roi = roiRows ? (profit / (roiRows * 10)) * 100 : null;

const dir = path.join(OUT, day);
fs.mkdirSync(dir, { recursive: true });

const best = rows.find(r => r.outcome === "win") || rows[0] || null;

let signalText;
if (best) {
  signalText =
`⚽ TOUSLESMATCHS — ANALYSE IA

${best.home} vs ${best.away}
📊 Analyse : ${best.best_bet || "Analyse disponible"}
🧠 Confiance enregistrée : ${best.confidence ?? "—"}%
${best.real_odd ? "📈 Cote enregistrée : " + Number(best.real_odd).toFixed(2) : ""}
🏁 Score final : ${best.final_score_home}-${best.final_score_away}
${best.outcome === "win" ? "✅ Résultat : GAGNÉ" : "❌ Résultat : PERDU"}

5 IA confrontent leurs analyses.
Les résultats gagnés ET perdus restent consultables.

👉 TousLesMatchs.com
🔞 18+ · Aucun gain garanti.`;
} else {
  signalText =
`🤖 TOUSLESMATCHS — 5 IA, UNE ANALYSE

Aucun résultat officiel résolu aujourd'hui pour le moment.

Découvrez comment les 5 IA confrontent leurs analyses et consultez l'historique réel, gagnants comme perdants.

👉 TousLesMatchs.com
🔞 18+ · Aucun gain garanti.`;
}

const bilanText =
`📊 BILAN TOUSLESMATCHS — ${day}

Analyses résolues aujourd'hui : ${rows.length}
✅ Gagnées : ${wins}
❌ Perdues : ${losses}
${roiRows ? "💶 Simulation à mise fixe 10 € : " + euro(profit) : "💶 ROI : non calculable sans cote enregistrée"}
${roi !== null ? "📈 ROI théorique : " + roi.toFixed(1).replace(".", ",") + "%" : ""}

Historique transparent : les résultats gagnés et perdus sont conservés.

👉 TousLesMatchs.com
🔞 18+ · Résultats passés ≠ résultats futurs.`;

const educationalText =
`🧠 COMMENT FONCTIONNE TOUSLESMATCHS ?

1️⃣ Les matchs admissibles sont analysés.
2️⃣ 5 IA donnent leur avis indépendamment.
3️⃣ Le système mesure leur convergence.
4️⃣ Les résultats réels sont enregistrés après le match.
5️⃣ Les gagnés comme les perdus restent visibles.

👉 TousLesMatchs.com
🔞 18+ · Outil d'analyse, aucun gain garanti.`;

fs.writeFileSync(path.join(dir,"01-resultat-du-jour.txt"), signalText + "\n");
fs.writeFileSync(path.join(dir,"02-bilan-du-jour.txt"), bilanText + "\n");
fs.writeFileSync(path.join(dir,"03-comment-ca-marche.txt"), educationalText + "\n");

fs.writeFileSync(
  path.join(dir,"publication.json"),
  JSON.stringify({
    generated_at: new Date().toISOString(),
    day,
    source: "tlm_database",
    ai_generation: false,
    resolved: rows.length,
    wins,
    losses,
    theoretical_profit_10eur: roiRows ? Number(profit.toFixed(2)) : null,
    theoretical_roi_pct: roi !== null ? Number(roi.toFixed(2)) : null,
    contents: [
      "01-resultat-du-jour.txt",
      "02-bilan-du-jour.txt",
      "03-comment-ca-marche.txt"
    ]
  }, null, 2)
);

console.log("📣 CONTENUS MARKETING :", dir);
console.log("📊 Résolus =",rows.length,"| Gagnés =",wins,"| Perdus =",losses);
console.log("🟢 Aucun appel IA");
console.log("🟢 Aucune publication automatique");

db.close();
