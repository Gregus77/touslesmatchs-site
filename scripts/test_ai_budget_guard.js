/**
 * Test de démonstration pour ai_budget_guard.js — Étape 3 du prompt maître.
 *
 * Ce n'est PAS un test réseau : aucun modèle IA n'est appelé. On vérifie
 * uniquement que le garde-fou bloque/autorise correctement selon les règles.
 * Base SQLite jetable, recréée à chaque exécution.
 *
 *   node scripts/test_ai_budget_guard.js
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_FILE = path.join(__dirname, "..", ".tmp_test_ai_guard.db");
let pass = 0, fail = 0;

function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

function freshDb() {
  try { fs.unlinkSync(DB_FILE); } catch {}
  return new Database(DB_FILE);
}

// CFG et MODELS sont calculés au chargement du module à partir de process.env :
// pour tester plusieurs configurations, on vide le cache require entre scénarios.
function loadGuard() {
  delete require.cache[require.resolve("./ai_budget_guard")];
  delete require.cache[require.resolve("./ai_models.config")];
  return require("./ai_budget_guard");
}

console.log("═══ Scénario 1 — anti-doublon : un match ne peut pas être retraité ═══");
{
  process.env.OPENROUTER_HARD_STOP = "true";
  process.env.OPENROUTER_DAILY_BUDGET_EUR = "2";
  process.env.OPENROUTER_MAX_REQUESTS_PER_DAY = "100";
  process.env.OPENROUTER_MAX_MATCHES_PER_DAY = "30";
  process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY = "30";
  const guard = loadGuard();
  const db = freshDb();
  const req = { modelKey: "qwen", matchKey: "PSG_OM_2026-07-28", competition: "Ligue 1", market: "Over 2.5", promptVersion: "v1", estimatedTokensOut: 100 };

  const first = guard.canProceed(db, req);
  assert(first.allowed === true, "premier appel autorisé");
  guard.recordCall(db, { ...req, requestKey: first.requestKey, tokensIn: 800, tokensOut: 100, status: "ok" });

  const second = guard.canProceed(db, req);
  assert(second.allowed === false, "deuxième appel sur le MÊME match+modèle bloqué");
  assert(second.reason.startsWith("[LIMIT]"), "raison correctement codée [LIMIT]");

  const differentModel = guard.canProceed(db, { ...req, modelKey: "kimi" });
  assert(differentModel.allowed === true, "un AUTRE modèle sur le même match reste autorisé (clé = match+modèle+prompt)");

  db.close();
}

console.log("\n═══ Scénario 2 — le budget quotidien ne peut jamais être dépassé ═══");
{
  process.env.OPENROUTER_DAILY_BUDGET_EUR = "0.0005"; // volontairement minuscule
  process.env.OPENROUTER_HARD_STOP = "true";
  process.env.TELEGRAM_BOT_TOKEN = ""; // pas d'alerte réseau pendant le test
  const guard = loadGuard();
  const db = freshDb();

  let blockedAt = null;
  for (let i = 0; i < 10; i++) {
    // estimatedTokensIn/Out réalistes ET cohérents avec ce qui sera réellement
    // enregistré : c'est cette cohérence que ce scénario vérifie.
    const req = { modelKey: "qwen", matchKey: `M${i}`, promptVersion: "v1", estimatedTokensIn: 800, estimatedTokensOut: 100 };
    const check = guard.canProceed(db, req);
    if (!check.allowed) { blockedAt = i; break; }
    guard.recordCall(db, { ...req, requestKey: check.requestKey, tokensIn: 800, tokensOut: 100, status: "ok" });
  }
  assert(blockedAt === 0, `budget minuscule bloque dès le PREMIER appel (bloqué au ${blockedAt}ᵉ) — l'estimation tient compte des tokens d'entrée`);

  const stats = guard.getDailyStats(db);
  assert(stats.costEur === 0, `aucune dépense réelle enregistrée (${stats.costEur}€) — le tout premier appel a été bloqué avant tout coût`);
  assert(guard.isBreakerTripped(db, "daily_budget"), "coupe-circuit 'daily_budget' déclenché");

  // Une alerte ne doit jamais boucler : re-vérifier ne doit pas changer alerted_at.
  const before = db.prepare("SELECT alerted_at FROM ai_circuit_breaker WHERE breach_type='daily_budget'").get();
  guard.canProceed(db, { modelKey: "qwen", matchKey: "MX", promptVersion: "v1" });
  const after = db.prepare("SELECT alerted_at FROM ai_circuit_breaker WHERE breach_type='daily_budget'").get();
  assert(before.alerted_at === after.alerted_at, "l'alerte n'est envoyée qu'une seule fois par jour (pas de boucle)");

  db.close();
}

console.log("\n═══ Scénario 3 — un modèle désactivé ne peut jamais être appelé ═══");
{
  process.env.OPENROUTER_DAILY_BUDGET_EUR = "2";
  process.env.AI_MODEL_GPT_ENABLED = "false";
  const guard = loadGuard();
  const db = freshDb();
  const check = guard.canProceed(db, { modelKey: "gpt", matchKey: "M1", promptVersion: "v1" });
  assert(check.allowed === false, "modèle GPT désactivé par défaut : appel refusé");
  assert(check.reason.startsWith("[IA]"), "raison correctement codée [IA]");
  db.close();
}

console.log("\n═══ Scénario 4 — plafond de requêtes par modèle et par jour ═══");
{
  process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY = "3";
  process.env.OPENROUTER_DAILY_BUDGET_EUR = "2";
  const guard = loadGuard();
  const db = freshDb();
  let blocked = false;
  for (let i = 0; i < 5; i++) {
    const req = { modelKey: "qwen", matchKey: `M${i}`, promptVersion: "v1" };
    const check = guard.canProceed(db, req);
    if (!check.allowed) { blocked = true; break; }
    guard.recordCall(db, { ...req, requestKey: check.requestKey, tokensIn: 500, tokensOut: 80, status: "ok" });
  }
  assert(blocked === true, "le plafond par modèle (3/jour) finit par bloquer un appel");
  db.close();
}

console.log("\n═══ Scénario 5 — sursaut anormal (boucle) détecté et stoppé ═══");
{
  process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY = "100";
  process.env.OPENROUTER_DAILY_BUDGET_EUR = "2";
  process.env.AI_GUARD_SPIKE_THRESHOLD = "5";
  const guard = loadGuard();
  const db = freshDb();
  let tripped = false;
  for (let i = 0; i < 8; i++) {
    const req = { modelKey: "qwen", matchKey: `SPIKE${i}`, promptVersion: "v1" };
    const check = guard.canProceed(db, req);
    if (!check.allowed && check.reason.includes("sursaut")) { tripped = true; break; }
    if (check.allowed) guard.recordCall(db, { ...req, requestKey: check.requestKey, tokensIn: 500, tokensOut: 80, status: "ok" });
  }
  assert(tripped === true, "un sursaut de requêtes déclenche le coupe-circuit avant la limite de budget");
  db.close();
}

console.log("\n═══ Scénario 6 — rappels identiques en rafale (worker qui boucle) ═══");
{
  process.env.AI_GUARD_SPIKE_THRESHOLD = "50"; // désactivé pour isoler ce test
  process.env.AI_GUARD_DUPLICATE_BURST_THRESHOLD = "3";
  const guard = loadGuard();
  const db = freshDb();
  // Simule un worker qui boucle : même match, même modèle, prompt_version qui
  // change à chaque fois (donc l'anti-doublon simple ne suffit pas à l'arrêter).
  let tripped = false;
  for (let i = 0; i < 6; i++) {
    const req = { modelKey: "qwen", matchKey: "LOOP_MATCH", promptVersion: `v${i}` };
    const check = guard.canProceed(db, req);
    if (!check.allowed && check.reason.includes("rafale")) { tripped = true; break; }
    if (check.allowed) guard.recordCall(db, { ...req, requestKey: check.requestKey, tokensIn: 500, tokensOut: 80, status: "ok" });
  }
  assert(tripped === true, "un worker qui boucle sur le même match est détecté même en changeant la version du prompt");
  db.close();
}

console.log("\n═══ Scénario 7 — mode observation (HARD_STOP=false) n'arrête pas les appels ═══");
{
  process.env.OPENROUTER_HARD_STOP = "false";
  process.env.OPENROUTER_DAILY_BUDGET_EUR = "0.0001";
  process.env.AI_GUARD_SPIKE_THRESHOLD = "50";
  process.env.AI_GUARD_DUPLICATE_BURST_THRESHOLD = "50";
  process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY = "50";
  const guard = loadGuard();
  const db = freshDb();
  const req = { modelKey: "qwen", matchKey: "OBS1", promptVersion: "v1" };
  const check = guard.canProceed(db, req);
  assert(check.allowed === true, "budget dépassé mais HARD_STOP=false → appel laissé passer (mode calibration)");
  db.close();
}

try { fs.unlinkSync(DB_FILE); } catch {}

console.log(`\n${"─".repeat(50)}`);
console.log(`RÉSULTAT : ${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
