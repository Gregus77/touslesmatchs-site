"use strict";

/* TousLesMatchs runtime policy — aucun secret ici. */
const fs = require("fs");

function force(name, value, reason) {
  const previous = process.env[name];
  process.env[name] = String(value);
  console.log(`[runtime-policy] ${name}=${value}${previous !== String(value) ? " (override)" : ""} · ${reason}`);
}
function alias(name, source, reason) {
  const value = process.env[source];
  if (!value) return;
  process.env[name] = value;
  console.log(`[runtime-policy] ${name} <- ${source} · ${reason}`);
}

// Règles produit actives.
force("AUTO_CONCILE_MULTISPORT", "0", "football uniquement");
force("AUTO_CONCILE_TIME_WINDOW", "1", "fenêtre live active");
force("AUTO_CONCILE_WINDOW_MIN", "15", "observer le match avant de décider");
force("AUTO_CONCILE_WINDOW_MAX", "40", "ne plus courir après les cotes tardives");

// API-Sports : ancien 90/j = garde-fou hérité d'un petit quota. Le forfait payé
// connu permet 7 500/j ; on garde volontairement 1 000 requêtes de réserve.
force("API_SPORTS_DAILY_BUDGET", "6500", "utiliser le forfait payé avec réserve");

// Garde-fou IA : on conserve le hard-stop et tous les anti-doublons, mais le
// plafond 100/j pouvait arrêter une soirée normale après ~20 matchs à 5 IA.
force("OPENROUTER_MAX_REQUESTS_PER_DAY", "400", "plafond journalier réaliste");
force("OPENROUTER_MAX_MATCHES_PER_DAY", "80", "volume football réaliste");
force("OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY", "100", "éviter un blocage modèle prématuré");
force("OPENROUTER_FALLBACK_DAILY_CAP", "120", "laisser les replis fournisseur fonctionner");
force("AI_GUARD_SPIKE_THRESHOLD", "60", "tolérer plusieurs matchs simultanés sans masquer les vraies boucles");
force("OPENROUTER_HARD_STOP", "true", "protection anti-gaspillage conservée");
// Le budget monétaire OPENROUTER_DAILY_BUDGET_EUR reste volontairement piloté
// par le .env : on ne relève jamais une limite d'argent sans décision explicite.

// Source unique du canal Gratuit.
alias("TELEGRAM_CHANNEL_ID", "TELEGRAM_FREE_CHANNEL_ID", "canal Gratuit unique");

// Offre commerciale actuelle : Standard + Premium uniquement. Les anciens
// comptes Elite/VIP restent compatibles, mais aucun canal Elite distinct ne
// doit recevoir un flux 3/5 plus permissif.
if (process.env.TELEGRAM_PREMIUM_CHANNEL_ID) {
  process.env.TELEGRAM_ELITE_CHANNEL_ID = process.env.TELEGRAM_PREMIUM_CHANNEL_ID;
  console.log("[runtime-policy] Elite/VIP historique redirigé vers Premium · aucun canal client Elite distinct");
}

// Réarme un ancien coupe-circuit daily_requests posé à 100 si, au moment du
// redémarrage, l'usage du jour est maintenant sous le nouveau plafond 400.
// Sans cela, relever la limite ne produirait aucun effet avant minuit.
try {
  const dbPath = process.env.TLM_DB_PATH || "/data/tlm.db";
  if (fs.existsSync(dbPath)) {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const hasLog = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ai_call_budget_log'").get();
    const hasBreaker = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ai_circuit_breaker'").get();
    if (hasLog && hasBreaker) {
      const used = Number(db.prepare("SELECT COUNT(*) n FROM ai_call_budget_log WHERE date(created_at)=date('now') AND status='ok'").get().n || 0);
      const limit = Number(process.env.OPENROUTER_MAX_REQUESTS_PER_DAY || 400);
      if (used < limit) {
        const row = db.prepare("SELECT detail,tripped_at FROM ai_circuit_breaker WHERE breach_type='daily_requests'").get();
        if (row && String(row.tripped_at || "").slice(0,10) === new Date().toISOString().slice(0,10)) {
          db.prepare("DELETE FROM ai_circuit_breaker WHERE breach_type='daily_requests'").run();
          console.log(`[runtime-policy] daily_requests réarmé · ${used}/${limit} appels aujourd'hui`);
        }
      }
    }
    db.close();
  }
} catch (e) {
  console.warn(`[runtime-policy] réarmement daily_requests non effectué: ${e.message}`);
}
