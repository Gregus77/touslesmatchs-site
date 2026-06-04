// ============================================================
// ANTITHÈSE — DÉTECTION AUTOMATIQUE DES BUGS DU SITE
// Rôle : trouver TOUS les problèmes avant le déploiement
// Lancement : node scripts/antithese_audit.js
// ============================================================

const fs = require("fs");
const path = require("path");

const errors = [];
const warnings = [];
const successes = [];

function log(type, msg) {
  if (type === "error") { errors.push(msg); console.log(`❌ ${msg}`); }
  else if (type === "warn") { warnings.push(msg); console.log(`⚠️  ${msg}`); }
  else { successes.push(msg); console.log(`✅ ${msg}`); }
}

// ============================================================
// 1. VÉRIFICATION TABLEAU PICKS — DOUBLONS
// ============================================================
console.log("\n🔍 [1/6] Vérification doublons picks...");
const appJs = fs.readFileSync("./src/App.js", "utf8");
const picksMatch = appJs.match(/var picks = \[([\s\S]*?)\];/);
if (!picksMatch) {
  log("error", "Tableau picks introuvable dans App.js");
} else {
  const lines = picksMatch[1].split("\n").filter(l => l.trim().startsWith("["));
  const dates = {};
  lines.forEach(line => {
    const dateMatch = line.match(/"(\d{2}\/\d{2})"/);
    if (dateMatch) {
      const date = dateMatch[1];
      dates[date] = (dates[date] || 0) + 1;
    }
  });
  let duplicates = 0;
  // Doublons historiques tolérés (avant juin 2026)
  const HISTORIC_DUPS = new Set(["19/05", "13/05"]);
  Object.entries(dates).forEach(([date, count]) => {
    if (count > 1 && !HISTORIC_DUPS.has(date)) {
      log("error", `DOUBLON: ${count} picks pour ${date}`);
      duplicates++;
    }
  });
  if (!duplicates) log("ok", `Aucun doublon récent (${lines.length} picks)`);
}

// ============================================================
// 2. VÉRIFICATION DATES — UN SEUL PICK PAR JOUR FUTUR
// ============================================================
console.log("\n🔍 [2/6] Vérification dates futures...");
const today = new Date();
const futureDates = [];
const enAttente = appJs.match(/\["(\d{2}\/\d{2})"[^\]]*EN ATTENTE[^\]]*\]/g) || [];
enAttente.forEach(line => {
  const date = line.match(/"(\d{2}\/\d{2})"/)?.[1];
  if (date) futureDates.push(date);
});
if (futureDates.length === 0) {
  log("warn", "Aucun pick en attente — workflow doit générer");
} else if (futureDates.length > 3) {
  log("error", `Trop de picks en attente (${futureDates.length}) — max 3 jours`);
} else {
  log("ok", `${futureDates.length} picks futurs: ${futureDates.join(", ")}`);
}

// ============================================================
// 3. VÉRIFICATION COTES VALIDES
// ============================================================
console.log("\n🔍 [3/6] Vérification cotes...");
const cotes = appJs.match(/"(\d+\.?\d*)","—","EN ATTENTE"/g) || [];
let bad = 0;
cotes.forEach(c => {
  const cote = parseFloat(c.match(/"(\d+\.?\d*)"/)?.[1] || 0);
  if (cote < 1.4 || cote > 2.2) {
    log("warn", `Cote hors plage 1.40-2.20: ${cote}`);
    bad++;
  }
});
if (!bad && cotes.length) log("ok", `${cotes.length} cotes valides`);

// ============================================================
// 4. VÉRIFICATION STATS (winrate)
// ============================================================
console.log("\n🔍 [4/6] Vérification statistiques...");
const gagnes = (appJs.match(/"GAGNE"/g) || []).length;
const perdus = (appJs.match(/"PERDU"/g) || []).length;
const total = gagnes + perdus;
const winrate = total > 0 ? Math.round((gagnes / total) * 100) : 0;
log("ok", `Stats: ${gagnes} GAGNÉS / ${perdus} PERDUS = ${winrate}% (${total} paris)`);
if (winrate < 50) log("warn", "Taux de réussite < 50% — vérifier qualité picks");

// ============================================================
// 5. VÉRIFICATION 6 IAs AFFICHÉES
// ============================================================
console.log("\n🔍 [5/6] Vérification affichage 6 IAs...");
const ias = ["Groq", "Gemini", "DeepSeek", "Mistral", "Qwen", "Claude"];
ias.forEach(ia => {
  if (appJs.includes(ia)) {
    log("ok", `IA affichée: ${ia}`);
  } else {
    log("warn", `IA manquante dans UI: ${ia}`);
  }
});

// ============================================================
// 6. VÉRIFICATION BUILD
// ============================================================
console.log("\n🔍 [6/6] Vérification build...");
if (fs.existsSync("./build/index.html")) {
  const buildAge = (Date.now() - fs.statSync("./build/index.html").mtimeMs) / 1000 / 60;
  log("ok", `Build présent (mis à jour il y a ${Math.round(buildAge)} min)`);
} else {
  log("warn", "Pas de build/ — exécuter npm run build");
}

// ============================================================
// RAPPORT FINAL
// ============================================================
console.log("\n\n═══════════════ RAPPORT ANTITHÈSE ═══════════════");
console.log(`✅ Succès: ${successes.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Erreurs: ${errors.length}`);
if (errors.length) {
  console.log("\n🚨 ERREURS BLOQUANTES:");
  errors.forEach(e => console.log("  • " + e));
  process.exit(1);
} else if (warnings.length) {
  console.log("\n⚠️  À VÉRIFIER:");
  warnings.forEach(w => console.log("  • " + w));
}
console.log("\n✨ Site prêt pour déploiement\n");
