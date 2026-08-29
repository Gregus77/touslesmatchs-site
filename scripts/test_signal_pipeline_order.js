/**
 * Regression du 28/08/2026 : le filtre client doit rester avant le Concile et
 * les compteurs publics doivent reposer sur une preuve Telegram durable.
 * Aucun reseau ni aucune base de production ne sont utilises.
 */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "api_server.js"), "utf8");
let failed = 0;
function assert(condition, label) {
  if (condition) console.log(`  ✅ ${label}`);
  else { failed++; console.error(`  ❌ ${label}`); }
}

const observerStart = source.indexOf("async function runAutoConcileObserver()");
const observerEnd = source.indexOf("// ── Brevo helpers", observerStart);
const observer = source.slice(observerStart, observerEnd);

assert(observerStart >= 0 && observerEnd > observerStart, "bloc auto-observer trouvé");
assert(
  observer.indexOf(".filter(m => isClientOu25MatchEligible(m, true))") >= 0,
  "filtre football championnat minute 15-40 appliqué avant analyse"
);
assert(
  observer.indexOf(".filter(m => isClientOu25MatchEligible(m, true))") < observer.indexOf("await runConcileAnalysis(match)"),
  "filtre client exécuté avant les cinq appels IA"
);
assert(
  /const ARJEL_PREFILTER_MARKETS = \["Over 2\.5 buts", "Under 2\.5 buts"\]/.test(source),
  "préfiltre de cote limité au marché client O/U 2,5"
);

const activityStart = source.indexOf('app.get("/live-activity"');
const activityEnd = source.indexOf('app.post("/admin/set-pick"', activityStart);
const activity = source.slice(activityStart, activityEnd);
assert(activity.includes("FROM telegram_signal_deliveries"), "activité publique fondée sur les livraisons Telegram");
assert(activity.includes("telegram_message_id IS NOT NULL"), "message_id Telegram obligatoire");
assert(!activity.includes("confidence >= ?"), "la confiance seule n'est plus comptée comme un signal");
assert(
  activity.includes("COALESCE(source_type, 'live') = 'live'"),
  "le compteur d'analyses live exclut le prematch interne"
);

const prematchStart = source.indexOf("function savePrematchPickIfNew(pick)");
const prematchEnd = source.indexOf("// ── Matchs à venir", prematchStart);
const prematch = source.slice(prematchStart, prematchEnd);
assert(prematchStart >= 0 && prematchEnd > prematchStart, "bloc de sauvegarde prematch trouvé");
assert(
  prematch.includes("prematch interne: non diffuse aux clients"),
  "chaque nouveau pick prematch reçoit un blocage de diffusion explicite"
);
assert(
  source.includes("fixedPrematchTrace") && source.includes("source_type = 'prematch'"),
  "les anciennes lignes prematch non tracées sont corrigées au démarrage"
);

console.log(`\nRÉSULTAT : ${failed ? "ÉCHEC" : "OK"}`);
process.exit(failed ? 1 : 0);
