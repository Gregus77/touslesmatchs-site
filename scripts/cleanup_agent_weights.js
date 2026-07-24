#!/usr/bin/env node
/**
 * Nettoyage des agents fantômes dans agent_weights.
 *
 * POURQUOI — agent_weights est une table d'AGRÉGAT (rapport), reconstruite par
 * refreshAgentWeights() en UPSERT depuis agent_predictions. Un UPSERT ne supprime
 * jamais : les agents de l'ancien Concile (GROQ-Llama, GPT Analysis, GeminiFlash,
 * Mistral-7B...) gardent donc leur ligne figée pour toujours et polluent
 * /admin/agents ainsi que les alertes "agent en baisse".
 *
 * SÛRETÉ — les décisions du Concile lisent agent_predictions via
 * getAgentPerformance(), PAS agent_weights. Supprimer une ligne ici ne peut donc
 * modifier aucun pick. On ne touche JAMAIS à agent_predictions : c'est
 * l'historique brut, le supprimer falsifierait les statistiques.
 *
 * USAGE (depuis le VPS) :
 *   docker exec touslesmatchs-api node /data/cleanup_agent_weights.js          # dry-run
 *   docker exec touslesmatchs-api node /data/cleanup_agent_weights.js --apply  # applique
 */

const path = require("path");
const fs = require("fs");

// Le script est exécuté depuis /data (volume monté), or better-sqlite3 vit dans
// /app/node_modules : Node résout les modules depuis le dossier du SCRIPT, pas le cwd.
// On tente donc la résolution normale puis les emplacements connus du conteneur.
let Database;
for (const candidate of ["better-sqlite3", "/app/node_modules/better-sqlite3", "/usr/src/app/node_modules/better-sqlite3"]) {
  try { Database = require(candidate); break; } catch { /* essai suivant */ }
}
if (!Database) {
  console.error("\nModule better-sqlite3 introuvable.");
  console.error("Relance en indiquant le chemin des modules du conteneur, par ex. :");
  console.error("  docker exec -e NODE_PATH=/app/node_modules touslesmatchs-api node /data/cleanup_agent_weights.js\n");
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || "/data/tlm.db";
const APPLY = process.argv.includes("--apply");

// Doit rester identique à CONCILE_AGENT_NAMES dans api_server.js — sinon le script
// conserverait une ligne que refreshAgentWeights() purgerait au redémarrage suivant.
// Les agents shadow n'entrent jamais ici : ils écrivent dans shadow_evals.
const ACTIVE_AGENTS = ["Perplexity-Web", "DeepSeek-V3", "Mistral-Large", "Cohere-Command", "Claude Chief"];

let db;
try {
  db = new Database(DB_PATH);
} catch (e) {
  console.error(`\nImpossible d'ouvrir la base ${DB_PATH} : ${e.message}\n`);
  process.exit(1);
}

if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_weights'").get()) {
  console.error(`\nLa table agent_weights n'existe pas dans ${DB_PATH}.`);
  console.error(`Vérifie le chemin de la base (variable DB_PATH).\n`);
  db.close();
  process.exit(1);
}

const rows = db.prepare("SELECT agent_name, total_predictions, wins, losses, winrate, roi, last_updated FROM agent_weights ORDER BY agent_name").all();
const ghosts = rows.filter(r => !ACTIVE_AGENTS.includes(r.agent_name));
const keep = rows.filter(r => ACTIVE_AGENTS.includes(r.agent_name));

const pad = (s, n) => String(s == null ? "" : s).padEnd(n);
console.log(`\nBase : ${DB_PATH}`);
console.log(`Mode : ${APPLY ? "APPLICATION (suppression réelle)" : "DRY-RUN (aucune écriture)"}\n`);

console.log(`── CONSERVÉS (${keep.length}) ───────────────────────────────────`);
if (!keep.length) console.log("  (aucun)");
for (const r of keep) {
  console.log(`  ${pad(r.agent_name, 18)} ${pad(r.total_predictions, 6)} préd.  WR ${pad(r.winrate, 7)} ROI ${r.roi}`);
}

console.log(`\n── FANTÔMES À SUPPRIMER (${ghosts.length}) ──────────────────────`);
if (!ghosts.length) console.log("  (aucun — rien à nettoyer)");
for (const r of ghosts) {
  console.log(`  ${pad(r.agent_name, 18)} ${pad(r.total_predictions, 6)} préd.  WR ${pad(r.winrate, 7)} ROI ${r.roi}   (maj: ${r.last_updated})`);
}

// Les prédictions brutes restent intactes : on affiche seulement ce qui est conservé.
for (const r of ghosts) {
  try {
    const n = db.prepare("SELECT COUNT(*) c FROM agent_predictions WHERE agent_name = ?").get(r.agent_name).c;
    if (n > 0) console.log(`     ↳ ${n} ligne(s) dans agent_predictions — CONSERVÉES (historique intact)`);
  } catch { /* table absente : ignorer */ }
}

if (!ghosts.length) { db.close(); process.exit(0); }

if (!APPLY) {
  console.log(`\nDry-run terminé. Pour appliquer :`);
  console.log(`  docker exec touslesmatchs-api node /data/cleanup_agent_weights.js --apply\n`);
  db.close();
  process.exit(0);
}

// ── Sauvegarde avant toute écriture ──
const backup = path.join(path.dirname(DB_PATH), `tlm-before-agentcleanup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.db`);
db.backup(backup)
  .then(() => {
    console.log(`\nSauvegarde : ${backup} (${(fs.statSync(backup).size / 1048576).toFixed(1)} Mo)`);

    const delW = db.prepare("DELETE FROM agent_weights WHERE agent_name = ?");
    const delA = db.prepare("DELETE FROM system_alerts WHERE type = 'agent_decline' AND affected_entity = ?");
    let nW = 0, nA = 0;
    const tx = db.transaction((list) => {
      for (const r of list) {
        nW += delW.run(r.agent_name).changes;
        try { nA += delA.run(r.agent_name).changes; } catch { /* table absente */ }
      }
    });
    tx(ghosts);

    console.log(`\nSupprimé : ${nW} ligne(s) agent_weights, ${nA} alerte(s) 'agent en baisse'.`);
    console.log(`agent_predictions : INTACTE (historique préservé).`);
    console.log(`\nVérifier : curl -s http://localhost:3001/admin/agents\n`);
    db.close();
  })
  .catch((e) => {
    console.error(`\nÉCHEC de la sauvegarde — aucune suppression effectuée : ${e.message}\n`);
    db.close();
    process.exit(1);
  });
