/**
 * Garde-fou budgétaire pour tout appel IA lié à l'analyse sportive.
 *
 * Module AUTONOME et sans état en mémoire : tout est écrit dans SQLite, donc
 * les compteurs survivent à un redémarrage de conteneur (contrairement aux
 * compteurs en mémoire déjà présents ailleurs dans le projet, comme les
 * plafonds journaliers de diffusion Telegram — ici un budget qui se réinitialise
 * silencieusement à chaque redéploiement serait précisément le genre de trou
 * qui a permis la surconsommation auditée le 28/07/2026).
 *
 * NE FAIT AUCUN APPEL IA lui-même. Il répond uniquement à la question :
 * "ce call est-il autorisé, et si non, pourquoi ?" — c'est à l'appelant de
 * décider quoi faire de la réponse.
 *
 * Utilisation :
 *   const guard = require("./ai_budget_guard");
 *   const check = guard.canProceed(db, {
 *     modelKey: "qwen", matchKey: "PSG_OM_2026-07-28", competition: "Ligue 1",
 *     market: "Over 2.5", promptVersion: "v1", estimatedTokensOut: 120,
 *   });
 *   if (!check.allowed) { console.log("[ai-guard] bloqué:", check.reason); return; }
 *   // ...appel réel...
 *   guard.recordCall(db, { ...mêmes champs..., status: "ok", tokensIn, tokensOut });
 */

const https = require("https");
const models = require("./ai_models.config");

// ── Configuration (jamais codée en dur — règle anti-gaspillage du prompt maître) ──
const CFG = {
  // Configuration historique; le calendrier Paris autorisé prime en production.
  // comptabilise les appels réellement tentés ; cette valeur n'est qu'une
  // réservation maximale et ne doit jamais être présentée comme une dépense.
  dailyBudgetEur: Number(process.env.OPENROUTER_DAILY_BUDGET_EUR || 0.90),
  hermesDailyBudgetEur: Number(process.env.OPENROUTER_HERMES_DAILY_BUDGET_EUR || 0.50),
  concileDailyBudgetEur: Number(process.env.OPENROUTER_CONCILE_DAILY_BUDGET_EUR || 3.00),
  maxRequestsPerDay: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_DAY || 100),
  maxMatchesPerDay: Number(process.env.OPENROUTER_MAX_MATCHES_PER_DAY || 30),
  maxRequestsPerModelPerDay: Number(process.env.OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY || 30),
  testModeEnabled: String(process.env.OPENROUTER_TEST_MODE_ENABLED ?? "true").toLowerCase() !== "false",
  // hardStop=true : une limite atteinte BLOQUE réellement l'appel.
  // hardStop=false : la limite est journalisée et alertée mais l'appel passe quand
  // même (mode observation, utile pour calibrer les seuils sans rien casser).
  hardStop: String(process.env.OPENROUTER_HARD_STOP ?? "true").toLowerCase() !== "false",
  // Détection de sursaut : au-delà de ce nombre d'appels sur 5 minutes, le
  // coupe-circuit se déclenche — signature d'une boucle, pas d'un usage normal.
  spikeWindowMinutes: 5,
  spikeThreshold: Number(process.env.AI_GUARD_SPIKE_THRESHOLD || 15),
  // Un soir chargé produit normalement 5 appels par match (un par siège). Le
  // volume brut ne devient un spike que s'il est concentré anormalement sur
  // trop peu de matchs, ou s'il atteint le plafond d'urgence absolu.
  spikeMaxCallsPerMatch: Number(process.env.AI_GUARD_SPIKE_MAX_CALLS_PER_MATCH || 8),
  spikeEmergencyThreshold: Number(process.env.AI_GUARD_SPIKE_EMERGENCY_THRESHOLD || 100),
  // Même modèle + même match rappelé plus de N fois en 10 minutes = worker qui boucle.
  duplicateBurstWindowMinutes: 10,
  duplicateBurstThreshold: Number(process.env.AI_GUARD_DUPLICATE_BURST_THRESHOLD || 8),
  // Estimation par défaut des tokens d'ENTRÉE quand l'appelant ne la fournit pas.
  // Les prompts d'analyse de match (statistiques, historique, forme, cotes) font
  // couramment plusieurs milliers de tokens — un défaut trop bas sous-estimerait
  // le coût réel et laisserait passer des appels que le budget ne couvre pas.
  // Volontairement pessimiste : mieux vaut bloquer un peu tôt que dépasser.
  defaultPromptTokensIn: Number(process.env.AI_GUARD_DEFAULT_PROMPT_TOKENS_IN || 3000),
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_call_budget_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_key TEXT NOT NULL,
      model_key TEXT NOT NULL,
      match_key TEXT,
      competition TEXT,
      market TEXT,
      purpose TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cost_estimate_eur REAL DEFAULT 0,
      status TEXT DEFAULT 'ok',
      block_reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_budget_request_key ON ai_call_budget_log(request_key);
    CREATE INDEX IF NOT EXISTS idx_ai_budget_created_at ON ai_call_budget_log(created_at);

    CREATE TABLE IF NOT EXISTS ai_circuit_breaker (
      breach_type TEXT PRIMARY KEY,
      tripped_at TEXT NOT NULL,
      alerted_at TEXT,
      detail TEXT
    );
    CREATE TABLE IF NOT EXISTS admin_incident_notifications (
      incident_key TEXT PRIMARY KEY, source TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'warning',
      status TEXT NOT NULL DEFAULT 'active', detail TEXT DEFAULT '', first_seen_ms INTEGER NOT NULL,
      last_seen_ms INTEGER NOT NULL, last_notified_ms INTEGER NOT NULL DEFAULT 0,
      resolved_at_ms INTEGER DEFAULT NULL
    );
  `);
}

// Clé d'anti-doublon exacte demandée : date + match + modèle + version_du_prompt.
function buildRequestKey({ matchKey, modelKey, promptVersion }) {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}__${matchKey}__${modelKey}__${promptVersion || "v1"}`;
}

function _todaySum(db, sql, params = []) {
  if (process.env.OPENROUTER_PARIS_SCHEDULE === "1") {
    const p=parisBudget();
    sql=sql.replaceAll("date(created_at) = date('now')", `datetime(created_at)>=datetime('${p.start}') AND datetime(created_at)<datetime('${p.end}')`);
  }
  const row = db.prepare(sql).get(...params);
  return row ? Object.values(row)[0] || 0 : 0;
}

// Le Concile ajoute au match_key l'etat live "_score-score-tranche" afin
// d'autoriser une nouvelle analyse lorsque le match evolue. Cette cle est
// correcte pour l'anti-doublon, mais elle ne doit pas transformer trois
// snapshots du meme match en trois matchs distincts dans le plafond journalier.
function dailyMatchIdentity(matchKey) {
  return String(matchKey || "").replace(/_[0-9x]+-[0-9x]+-[0-9]+$/i, "");
}

function _sendAdminAlert(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  const body = JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text, parse_mode: "HTML" });
  const req = https.request({
    hostname: "api.telegram.org",
    path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    timeout: 8000,
  }, (res) => res.on("data", () => {}));
  req.on("error", () => {}); // best-effort : une alerte qui échoue ne doit jamais bloquer le guard
  req.on("timeout", () => req.destroy());
  req.write(body);
  req.end();
}

// Déclenche le coupe-circuit UNE fois par type et par jour — jamais en boucle
// ("ne pas répéter l'alerte en boucle" — exigence explicite du prompt maître).
function tripBreaker(db, type, detail) {
  ensureSchema(db);
  const today = new Date().toISOString().slice(0, 10);
  const existing = db.prepare("SELECT alerted_at FROM ai_circuit_breaker WHERE breach_type = ?").get(type);
  const alreadyAlertedToday = existing && existing.alerted_at && existing.alerted_at.slice(0, 10) === today;

  db.prepare(`
    INSERT INTO ai_circuit_breaker (breach_type, tripped_at, alerted_at, detail)
    VALUES (?, datetime('now'), ?, ?)
    ON CONFLICT(breach_type) DO UPDATE SET tripped_at = excluded.tripped_at, detail = excluded.detail
      ${alreadyAlertedToday ? "" : ", alerted_at = datetime('now')"}
  `).run(type, alreadyAlertedToday ? existing.alerted_at : new Date().toISOString(), detail);

  const incidentKey = `ai-budget:${type}`;
  const incident = db.prepare("SELECT status,last_notified_ms FROM admin_incident_notifications WHERE incident_key=?").get(incidentKey);
  const nowMs = Date.now();
  const shouldNotify = !incident || incident.status !== "active" || nowMs - Number(incident.last_notified_ms || 0) >= 6 * 3600 * 1000;
  db.prepare(`INSERT INTO admin_incident_notifications
    (incident_key,source,severity,status,detail,first_seen_ms,last_seen_ms,last_notified_ms,resolved_at_ms)
    VALUES (?,'ai-budget','critical','active',?,?,?,?,NULL)
    ON CONFLICT(incident_key) DO UPDATE SET status='active',detail=excluded.detail,last_seen_ms=excluded.last_seen_ms,resolved_at_ms=NULL`)
    .run(incidentKey, detail, nowMs, nowMs, incident?.last_notified_ms || 0);
  if (shouldNotify) {
    console.error(`[ai-guard] 🔴 COUPE-CIRCUIT ${type} — ${detail}`);
    _sendAdminAlert(`🔴 <b>Coupe-circuit IA — ${type}</b>\n\n${detail}\n\n<i>Moteur d'analyse mis en pause pour ce motif. Une seule alerte envoyée aujourd'hui.</i>`);
    db.prepare("UPDATE admin_incident_notifications SET last_notified_ms=? WHERE incident_key=?").run(nowMs, incidentKey);
  } else {
    console.warn(`[ai-guard] ${type} toujours actif (notification dédupliquée) — ${detail}`);
  }
}

// Types dont le declenchement signale un vrai epuisement de quota JOURNALIER
// (montant en euros, nombre de requetes) : rester bloque jusqu'a minuit est
// correct, le quota ne se reconstitue pas avant.
const DAILY_SCOPED_BREAKERS = new Set([
  "daily_budget", "daily_budget_hermes", "daily_budget_concile", "daily_requests",
]);
// "spike"/"duplicate_burst" signalent un SURSAUT PONCTUEL (boucle probable,
// ou pic legitime type soiree europeenne a 8 matchs simultanes). Les laisser
// actifs jusqu'a minuit desactivait silencieusement des agents du Concile
// pendant des heures pour un pic qui n'a dure que quelques minutes — constate
// le 30/07/2026 : declenche a 17h47, encore actif a 20h30, zero signal envoye
// de la soiree alors que le budget/quota reel n'etait qu'a 15% de la limite.
const SPIKE_COOLDOWN_MINUTES = 30;

function isBreakerTripped(db, type) {
  ensureSchema(db);
  const row = db.prepare("SELECT tripped_at FROM ai_circuit_breaker WHERE breach_type = ?").get(type);
  if (!row || !row.tripped_at) return false;
  if (DAILY_SCOPED_BREAKERS.has(type)) {
    const today = new Date().toISOString().slice(0, 10);
    return row.tripped_at.slice(0, 10) === today;
  }
  // Cooldown glissant depuis le DERNIER declenchement, pas depuis minuit.
  const trippedMs = new Date(row.tripped_at.replace(" ", "T") + "Z").getTime();
  return Date.now() - trippedMs < SPIKE_COOLDOWN_MINUTES * 60 * 1000;
}

/**
 * Vérifie si un appel est autorisé. Ne fait AUCUNE écriture de compteur de
 * consommation — seul recordCall() écrit un appel effectivement tenté.
 * Retourne { allowed, reason, requestKey }.
 */
// allowDespiteSpike (07/08/2026) : autorise UNIQUEMENT a franchir le
// coupe-circuit "spike", jamais les autres. Motif : le spike detecte une boucle
// anormale, mais un agent dont le compte direct vient d'etre ecarte (401/402/
// 429) n'est pas une boucle — c'est un repli legitime, et le refuser laissait
// le Concile sans quorum. Le budget quotidien, l'anti-doublon et le
// duplicate_burst restent opposables : eux protegent l'argent et l'integrite,
// pas la cadence.
function canProceed(db, { modelKey, matchKey, competition, market, purpose, promptVersion, estimatedTokensIn, estimatedTokensOut, allowDespiteSpike }) {
  ensureSchema(db);

  if (!matchKey || !modelKey) {
    return { allowed: false, reason: "[DATA] matchKey/modelKey manquant — jamais d'appel sans identifiant complet" };
  }

  const requestKey = buildRequestKey({ matchKey, modelKey, promptVersion });

  // 1) Modèle autorisé (registre unique ai_models.config.js)
  if (!models.isModelAuthorized(modelKey)) {
    return { allowed: false, reason: `[IA] modèle "${modelKey}" désactivé dans ai_models.config.js`, requestKey };
  }
  const model = models.getModel(modelKey);

  // 2) Mode test requis pour les modèles en test à blanc
  if (model.mode === "test" && !CFG.testModeEnabled) {
    return { allowed: false, reason: `[IA] OPENROUTER_TEST_MODE_ENABLED=false — "${modelKey}" est un modèle de test`, requestKey };
  }

  // 3) Anti-doublon : date + match + modèle + version_du_prompt déjà traité ?
  const already = db.prepare("SELECT 1 FROM ai_call_budget_log WHERE request_key = ? AND status = 'ok'").get(requestKey);
  if (already) {
    return { allowed: false, reason: "[LIMIT] déjà traité aujourd'hui (clé anti-doublon) — aucun retraitement automatique", requestKey };
  }

  // 4) Coupe-circuit actif ?
  // Les coupe-circuits budgétaires ne sont pas relus aveuglément ici : les
  // montants sont recalculés juste dessous avec les plafonds runtime actuels.
  // Ainsi une hausse autorisée de plafond prend effet sans effacer l'audit DB.
  // Comme le budget en euros, le plafond de requêtes peut être relevé en
  // cours de journée par le propriétaire. Ne pas relire aveuglément l'ancien
  // breaker `daily_requests` : la valeur runtime est recalculée à l'étape 6.
  // L'audit du déclenchement reste en base, sans maintenir un faux blocage.
  for (const type of ["duplicate_burst"]) {
    if (!isBreakerTripped(db, type)) continue;
    if (type === "spike" && allowDespiteSpike) {
      console.warn(`[ai-guard] coupe-circuit "spike" franchi pour "${modelKey}" — repli autorise car fournisseur direct ecarte`);
      continue;
    }
    return { allowed: false, reason: `[LIMIT] coupe-circuit "${type}" actif aujourd'hui`, requestKey };
  }

  const dailyBudget = process.env.OPENROUTER_PARIS_SCHEDULE === "1" ? parisBudget().limit : CFG.dailyBudgetEur;

  // 5) Budget quotidien en euros (estimation)
  const estimatedCost = models.estimateCostEur(
    modelKey,
    estimatedTokensIn || CFG.defaultPromptTokensIn,
    estimatedTokensOut || model.maxTokensOut
  );
  const spentToday = _todaySum(db, `
    SELECT COALESCE(SUM(cost_estimate_eur),0) FROM ai_call_budget_log
    WHERE date(created_at) = date('now') AND status = 'ok'
  `);
  if (spentToday + estimatedCost > dailyBudget) {
    if (CFG.hardStop) {
      tripBreaker(db, "daily_budget", `Budget quotidien ${dailyBudget}€ atteint (${spentToday.toFixed(4)}€ dépensés). Appels IA suspendus jusqu'à demain.`);
      return { allowed: false, reason: "[LIMIT] budget quotidien dépassé", requestKey };
    }
    console.warn(`[ai-guard] budget dépassé (mode observation, HARD_STOP=false) : ${spentToday.toFixed(4)}€/${dailyBudget}€`);
  }

  // Hermès et le Concile ont chacun leur enveloppe : l'assistance ne peut plus
  // consommer le budget réservé aux votes sportifs, tout en restant incluse
  // dans le plafond global ci-dessus.
  const purposeLimit = purpose === "hermes" ? CFG.hermesDailyBudgetEur
    : purpose === "concile" ? (process.env.OPENROUTER_PARIS_SCHEDULE === "1" ? dailyBudget : CFG.concileDailyBudgetEur) : null;
  if (purposeLimit !== null) {
    const spentForPurpose = _todaySum(db, `
      SELECT COALESCE(SUM(cost_estimate_eur),0) FROM ai_call_budget_log
      WHERE date(created_at) = date('now') AND status = 'ok'
        AND purpose ${purpose === "hermes"
          ? "= 'customer_support'"
          : "IN ('provider_down_fallback','official_fallback')"}
    `);
    if (spentForPurpose + estimatedCost > purposeLimit && CFG.hardStop) {
      const breaker = purpose === "hermes" ? "daily_budget_hermes" : "daily_budget_concile";
      tripBreaker(db, breaker, `Budget ${purpose} ${purposeLimit}€ atteint (${spentForPurpose.toFixed(4)}€ estimés).`);
      return { allowed: false, reason: `[LIMIT] budget ${purpose} dépassé`, requestKey };
    }
  }

  // 6) Nombre total de requêtes / jour
  const requestsToday = _todaySum(db, `
    SELECT COUNT(*) FROM ai_call_budget_log WHERE date(created_at) = date('now') AND status = 'ok'
  `);
  if (requestsToday >= CFG.maxRequestsPerDay) {
    if (CFG.hardStop) {
      tripBreaker(db, "daily_requests", `${requestsToday} requêtes IA déjà effectuées aujourd'hui (limite ${CFG.maxRequestsPerDay}).`);
      return { allowed: false, reason: "[LIMIT] plafond de requêtes/jour atteint", requestKey };
    }
  }

  // 7) Nombre de matchs distincts / jour — un match déjà compté aujourd'hui
  //    (par un autre modèle) ne recompte pas contre ce plafond.
  const currentDailyMatch = dailyMatchIdentity(matchKey);
  const dailyMatches = new Set(db.prepare(`
    SELECT DISTINCT match_key FROM ai_call_budget_log
    WHERE date(created_at) = date('now') AND status = 'ok' AND match_key IS NOT NULL
  `).all().map((row) => dailyMatchIdentity(row.match_key)).filter(Boolean));
  if (!dailyMatches.has(currentDailyMatch)) {
    if (dailyMatches.size >= CFG.maxMatchesPerDay && CFG.hardStop) {
      return { allowed: false, reason: "[LIMIT] plafond de matchs analysés/jour atteint", requestKey };
    }
  }

  // 8) Nombre de requêtes / modèle / jour
  const modelRequestsToday = _todaySum(db, `
    SELECT COUNT(*) FROM ai_call_budget_log
    WHERE model_key = ? AND date(created_at) = date('now') AND status = 'ok'
  `, [modelKey]);
  if (modelRequestsToday >= (model.dailyLimit || CFG.maxRequestsPerModelPerDay) && CFG.hardStop) {
    return { allowed: false, reason: `[LIMIT] plafond quotidien du modèle "${modelKey}" atteint`, requestKey };
  }

  // 9) Détection de sursaut (boucle probable) — dernières N minutes.
  // Cinq sièges sur plusieurs matchs simultanés constituent un trafic normal :
  // on tient donc compte du nombre de matchs, pas seulement du volume brut.
  const recentSpike = db.prepare(`
    SELECT COUNT(*) AS calls, COUNT(DISTINCT match_key) AS matches
    FROM ai_call_budget_log
    WHERE created_at >= datetime('now', ?) AND status = 'ok'
  `).get(`-${CFG.spikeWindowMinutes} minutes`) || { calls: 0, matches: 0 };
  const recentCalls = Number(recentSpike.calls) || 0;
  const recentMatches = Number(recentSpike.matches) || 0;
  const callsPerMatch = recentCalls / Math.max(1, recentMatches);
  const concentratedSpike = recentCalls >= CFG.spikeThreshold
    && (recentMatches <= 1 || callsPerMatch > CFG.spikeMaxCallsPerMatch);
  const emergencySpike = recentCalls >= CFG.spikeEmergencyThreshold;
  if (concentratedSpike || emergencySpike) {
    tripBreaker(db, "spike", `${recentCalls} appels IA en ${CFG.spikeWindowMinutes} minutes sur ${recentMatches} match(s) (${callsPerMatch.toFixed(1)}/match) — concentration anormale, probable boucle.`);
    if (CFG.hardStop) return { allowed: false, reason: "[LIMIT] sursaut anormal détecté" };
  }

  // 10) Détection de rappels identiques en rafale (même modèle + même match)
  const duplicateBurst = _todaySum(db, `
    SELECT COUNT(*) FROM ai_call_budget_log
    WHERE model_key = ? AND match_key = ?
      AND created_at >= datetime('now', ?)
  `, [modelKey, matchKey, `-${CFG.duplicateBurstWindowMinutes} minutes`]);
  if (duplicateBurst >= CFG.duplicateBurstThreshold) {
    tripBreaker(db, "duplicate_burst", `${modelKey} rappelé ${duplicateBurst}× sur le même match "${matchKey}" en ${CFG.duplicateBurstWindowMinutes} min — worker probablement en boucle.`);
    if (CFG.hardStop) return { allowed: false, reason: "[LIMIT] rappels identiques en rafale détectés", requestKey };
  }

  return { allowed: true, reason: null, requestKey, estimatedCostEur: estimatedCost };
}

/**
 * Journalise un appel EFFECTIVEMENT tenté (réussi ou échoué). C'est cette
 * écriture, et elle seule, qui alimente les compteurs de canProceed().
 * Idempotent sur request_key : un second appel avec la même clé est ignoré
 * (ceinture-bretelles avec le contrôle anti-doublon de canProceed).
 */
function recordCall(db, {
  requestKey, modelKey, matchKey, competition, market, purpose,
  tokensIn, tokensOut, status, blockReason,
}) {
  ensureSchema(db);
  const costEstimateEur = status === "ok" ? models.estimateCostEur(modelKey, tokensIn, tokensOut) : 0;
  try {
    db.prepare(`
      INSERT OR IGNORE INTO ai_call_budget_log
        (request_key, model_key, match_key, competition, market, purpose,
         tokens_in, tokens_out, cost_estimate_eur, status, block_reason)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      requestKey, modelKey, matchKey || null, competition || null, market || null, purpose || null,
      Number(tokensIn) || 0, Number(tokensOut) || 0, costEstimateEur, status || "ok", blockReason || null
    );
  } catch (e) {
    console.error("[ai-guard] recordCall:", e.message);
  }
}

function getDailyStats(db) {
  ensureSchema(db);
  const p=parisBudget();
  const dayFilter=process.env.OPENROUTER_PARIS_SCHEDULE === "1"
    ? `datetime(created_at)>=datetime('${p.start}') AND datetime(created_at)<datetime('${p.end}')`
    : "date(created_at) = date('now')";
  const totals = db.prepare(`
    SELECT COUNT(*) AS requests, COALESCE(SUM(cost_estimate_eur),0) AS costEur,
           COUNT(DISTINCT match_key) AS matches
    FROM ai_call_budget_log WHERE ${dayFilter} AND status = 'ok'
  `).get();
  const byModel = db.prepare(`
    SELECT model_key, COUNT(*) AS requests, COALESCE(SUM(cost_estimate_eur),0) AS costEur
    FROM ai_call_budget_log WHERE ${dayFilter} AND status = 'ok'
    GROUP BY model_key
  `).all();
  return { ...totals, byModel, budget: process.env.OPENROUTER_PARIS_SCHEDULE === "1" ? {...CFG,dailyBudgetEur:parisBudget().limit,concileDailyBudgetEur:parisBudget().limit,calendar:"Europe/Paris"} : CFG };
}

module.exports = {
  ensureSchema, canProceed, recordCall, getDailyStats,
  tripBreaker, isBreakerTripped, buildRequestKey, CFG,
};

// Incident policy: Paris civil days, shared by every OpenRouter HTTP path.
const {parisParts,parisDayBounds}=require('./telegram_client');
const fs=require('fs'),crypto=require('crypto');
function parisBudget(at=Date.now()) {
 const day=parisParts(at).day,dow=new Date(day+'T12:00:00Z').getUTCDay();
 return {day,limit:dow===0||dow===6?6:4,...parisDayBounds(day)};
}
function backgroundPaused(){return fs.existsSync('/data/openrouter-background-paused');}
let catalogCache=null,catalogAt=0;
function readCatalog(){
 if(catalogCache&&Date.now()-catalogAt<3600000)return Promise.resolve(catalogCache);
 return new Promise((resolve,reject)=>{
  const req=https.get('https://openrouter.ai/api/v1/models',{timeout:15000},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>{try{const p=JSON.parse(text);if(res.statusCode!==200||!Array.isArray(p.data))throw Error('Pricing unavailable');catalogCache=new Map(p.data.map(x=>[x.id,x.pricing]));catalogAt=Date.now();resolve(catalogCache);}catch(e){reject(e);}});});
  req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Pricing timeout')));
 });
}
function globalSchema(db){
 ensureSchema(db);
 db.exec(`CREATE TABLE IF NOT EXISTS openrouter_global_calls (
   id TEXT PRIMARY KEY, day TEXT NOT NULL, model TEXT NOT NULL,
   reserved_eur REAL NOT NULL, charged_eur REAL, status TEXT NOT NULL,
   usage_usd REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
   CREATE TABLE IF NOT EXISTS openrouter_global_opening(day TEXT PRIMARY KEY,eur REAL NOT NULL,source TEXT NOT NULL);`);
}
function reserveGlobal(db,body,reserved,at=Date.now()){
 globalSchema(db);const p=parisBudget(at);
 return db.transaction(()=>{
  const opening=db.prepare('SELECT eur FROM openrouter_global_opening WHERE day=?').get(p.day)?.eur||0;
  const logged=db.prepare("SELECT coalesce(sum(cost_estimate_eur),0) n FROM ai_call_budget_log WHERE datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?) AND status='ok'").get(p.start,p.end).n;
  const used=db.prepare('SELECT coalesce(sum(coalesce(charged_eur,reserved_eur)),0) n FROM openrouter_global_calls WHERE day=?').get(p.day).n;
  // Old pre-call estimates remain untouched. Their sum is a conservative second floor.
  if(!Number.isFinite(reserved)||reserved<=0||Math.max(logged,opening+used)+reserved>p.limit)return null;
  const id=crypto.randomUUID();db.prepare("INSERT INTO openrouter_global_calls(id,day,model,reserved_eur,status) VALUES (?,?,?,?,'reserved')").run(id,p.day,body.model,reserved);return id;
 }).immediate();
}
async function withGlobalBudget(db,body,send){
 // FX is a deliberately conservative accounting rate, not a promised conversion.
 const fx=Number(process.env.OPENROUTER_USD_PER_EUR||1);
 if(!(fx>0)||!Number.isInteger(body.max_tokens)||body.max_tokens<=0||body.max_tokens>4096||body.stream||body.n>1||body.tools||body.plugins)
  return {_httpStatus:429,error:{message:'Global budget: unsupported or unbounded request'}};
 let pricing;try{pricing=(await readCatalog()).get(body.model);}catch(_){return {_httpStatus:503,error:{message:'Global budget: pricing unavailable'}};}
 if(!pricing)return {_httpStatus:429,error:{message:'Global budget: model pricing unavailable'}};
 const input=Buffer.byteLength(JSON.stringify(body.messages||[]))+512;
 const amount=(input*Number(pricing.prompt||0)+body.max_tokens*Number(pricing.completion||0)+Number(pricing.request||0)+Number(pricing.web_search||0)+0.01)/fx;
 const id=reserveGlobal(db,body,amount);
 if(!id)return {_httpStatus:429,error:{message:'Global OpenRouter Paris daily budget reached'}};
 let response;
 try {response=await send();}catch(e){db.prepare("UPDATE openrouter_global_calls SET status='uncertain' WHERE id=?").run(id);throw e;}
 const cost=response?.usage?.cost;
 const rejected=response?._httpStatus>=400;
 // Missing usage/timeouts keep their reservation; never silently refund an uncertain call.
 const charged=typeof cost==='number'&&Number.isFinite(cost)&&cost>=0?cost/fx:rejected?0:null;
 db.prepare('UPDATE openrouter_global_calls SET status=?,charged_eur=?,usage_usd=? WHERE id=?').run(rejected?'rejected':charged==null?'uncertain':'completed',charged,typeof cost==='number'?cost:null,id);
 return response;
}
module.exports.parisBudget=parisBudget;
module.exports.backgroundPaused=backgroundPaused;
module.exports.globalSchema=globalSchema;
module.exports.reserveGlobal=reserveGlobal;
module.exports.withGlobalBudget=withGlobalBudget;
