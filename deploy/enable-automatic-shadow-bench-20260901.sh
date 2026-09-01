#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/touslesmatchs
SRC="$ROOT/scripts/api_server.js"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/tlm-automatic-shadow-bench-$STAMP"
RESTARTED=0

rollback() {
  local rc=$?
  trap - ERR
  echo "[rollback] echec detecte (code $rc)"
  if [[ -f "$BACKUP/api_server.js" ]]; then
    cp -a "$BACKUP/api_server.js" "$SRC"
  fi
  if [[ "$RESTARTED" == "1" ]]; then
    cd "$ROOT"
    docker compose build api >/dev/null
    docker compose up -d --no-deps api >/dev/null
  fi
  echo "FAILED: correction annulee; sauvegarde=$BACKUP"
  exit "$rc"
}
trap rollback ERR

cd "$ROOT"
test -f "$SRC"
mkdir -p "$BACKUP"
cp -a "$SRC" "$BACKUP/api_server.js"
git status --short > "$BACKUP/git-status-before.txt"

# Snapshot SQLite coherent avant la migration additive.
docker exec touslesmatchs-api node -e '
const Database=require("better-sqlite3");
require("fs").mkdirSync("/data/snapshots",{recursive:true});
const db=new Database("/data/tlm.db");
db.pragma("wal_checkpoint(TRUNCATE)");
db.backup("/data/snapshots/tlm-before-shadow-bench-'"$STAMP"'.db")
  .then(()=>{db.close(); console.log("snapshot_ok")})
  .catch(e=>{console.error(e); process.exit(1)});
'

python3 - "$SRC" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
s = path.read_text(encoding="utf-8")
marker = "TLM_SHADOW_BENCH_V1"
if marker in s:
    print("[patch] deja applique")
    raise SystemExit(0)

schema_anchor = "// ── Migration V2: League ratings + ANJ markets + Decision journal ──"
if schema_anchor not in s:
    raise SystemExit("ancre schema introuvable")

schema = r'''
// TLM_SHADOW_BENCH_V1
// Banc d'essai automatique des fournisseurs statistiques. Cette table ne
// participe ni aux cinq votes, ni au score de confiance, ni a Telegram.
db.exec(`
  CREATE TABLE IF NOT EXISTS shadow_provider_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    fixture_id TEXT NOT NULL,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    competition TEXT DEFAULT '',
    minute INTEGER DEFAULT NULL,
    status TEXT NOT NULL,
    raw_market TEXT DEFAULT '',
    selected_bet TEXT DEFAULT NULL,
    confidence INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT NULL,
    attempts INTEGER DEFAULT 1,
    error TEXT DEFAULT NULL,
    payload TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_attempt_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, fixture_id)
  );
`);
const API_FOOTBALL_SHADOW_PROVIDER = "API-Football-Predictions";
const API_FOOTBALL_SHADOW_ENABLED =
  String(process.env.API_FOOTBALL_SHADOW_ENABLED ?? "1") !== "0";
const API_FOOTBALL_SHADOW_MAX_DAILY = Math.max(
  1, Math.min(12, Number(process.env.API_FOOTBALL_SHADOW_MAX_DAILY || 8))
);
const SHADOW_PROMOTION_MIN_RESOLVED = 200;
const SHADOW_PROMOTION_MIN_DAYS = 30;
const SHADOW_PROMOTION_MIN_OVER25 = 75;
const SHADOW_PROMOTION_MIN_UNDER25 = 75;

'''
s = s.replace(schema_anchor, schema + schema_anchor, 1)

fn_anchor = "async function runShadowEvaluation(match) {"
if fn_anchor not in s:
    raise SystemExit("ancre runShadowEvaluation introuvable")

functions = r'''
function apiFootballShadowMatchKey(match) {
  const date = String(match?.utcDate || match?.date || new Date().toISOString()).slice(0, 10);
  return `${String(match?.home || '').replace(/\s+/g, '_')}_${String(match?.away || '').replace(/\s+/g, '_')}_${date}`;
}

function parseApiFootballOu25(predictions) {
  const raw = String(predictions?.under_over || "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  let bet = null;
  if (/^(\+|over\s*)2[.,]5$/.test(normalized) || /over\s*2[.,]5/.test(normalized)) {
    bet = "Over 2.5 buts";
  } else if (/^(-|under\s*)2[.,]5$/.test(normalized) || /under\s*2[.,]5/.test(normalized)) {
    bet = "Under 2.5 buts";
  }
  return { raw, bet };
}

async function runApiFootballShadowEvaluation(match) {
  if (!API_FOOTBALL_SHADOW_ENABLED || !API_SPORTS_KEY) return;
  const fixtureId = String(match?.fixtureId || "").trim();
  if (!/^\d+$/.test(fixtureId)) return;

  const previous = db.prepare(
    "SELECT status, attempts, last_attempt_at FROM shadow_provider_calls WHERE provider=? AND fixture_id=?"
  ).get(API_FOOTBALL_SHADOW_PROVIDER, fixtureId);
  if (previous && previous.status !== "error") return;
  if (previous && Number(previous.attempts || 0) >= 2) return;
  if (previous?.last_attempt_at && Date.now() - Date.parse(previous.last_attempt_at + "Z") < 30 * 60 * 1000) return;

  const todayCalls = db.prepare(
    "SELECT COUNT(*) n FROM shadow_provider_calls WHERE provider=? AND date(created_at)=date('now')"
  ).get(API_FOOTBALL_SHADOW_PROVIDER)?.n || 0;
  if (todayCalls >= API_FOOTBALL_SHADOW_MAX_DAILY) return;
  if (!apiSportsBudgetOk()) {
    console.log("[shadow-api-football] budget API-Sports reserve au produit; essai differe");
    return;
  }

  const matchKey = apiFootballShadowMatchKey(match);
  const started = Date.now();
  const saveCall = (status, rawMarket, selectedBet, error, payload) => {
    db.prepare(`
      INSERT INTO shadow_provider_calls
        (provider,fixture_id,match_key,home,away,competition,minute,status,
         raw_market,selected_bet,confidence,latency_ms,error,payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provider,fixture_id) DO UPDATE SET
        match_key=excluded.match_key, home=excluded.home, away=excluded.away,
        competition=excluded.competition, minute=excluded.minute,
        status=excluded.status, raw_market=excluded.raw_market,
        selected_bet=excluded.selected_bet, confidence=excluded.confidence,
        latency_ms=excluded.latency_ms, error=excluded.error,
        payload=excluded.payload, attempts=shadow_provider_calls.attempts+1,
        last_attempt_at=datetime('now')
    `).run(
      API_FOOTBALL_SHADOW_PROVIDER, fixtureId, matchKey,
      match.home || "", match.away || "", match.competition || "",
      parseLiveMinuteValue(match.minute), status, rawMarket || "",
      selectedBet, 0, Date.now() - started, error || null,
      payload ? String(payload).slice(0, 3000) : null
    );
  };

  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/predictions?fixture=${encodeURIComponent(fixtureId)}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const apiErrors = data?.errors && (Array.isArray(data.errors)
      ? data.errors.length
      : Object.keys(data.errors).length);
    if (apiErrors) throw new Error("API-Football: " + JSON.stringify(data.errors).slice(0, 300));
    const predictions = data?.response?.[0]?.predictions;
    if (!predictions) throw new Error("API-Football: prediction absente");

    const parsed = parseApiFootballOu25(predictions);
    const payload = JSON.stringify({
      under_over: predictions.under_over ?? null,
      advice: predictions.advice ?? null,
      winner: predictions.winner ?? null,
      win_or_draw: predictions.win_or_draw ?? null,
      goals: predictions.goals ?? null,
      percent: predictions.percent ?? null,
    });
    saveCall(parsed.bet ? "compatible" : "market_not_ou25", parsed.raw, parsed.bet, null, payload);

    if (parsed.bet) {
      db.prepare(`
        INSERT OR IGNORE INTO shadow_evals
          (match_key,home,away,competition,sport,agent_name,bet,confidence,raison)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        matchKey, match.home || "", match.away || "",
        match.competition || "", "Football", API_FOOTBALL_SHADOW_PROVIDER,
        parsed.bet, 0,
        `Prediction statistique API-Football: ${parsed.raw}; confiance O/U non fournie`
      );
    }
    console.log(`[shadow-api-football] ${match.home} vs ${match.away}: ${parsed.bet || 'marche O/U 2.5 absent'}`);
  } catch (e) {
    saveCall("error", "", null, String(e.message).slice(0, 500), null);
    console.error("[shadow-api-football]", e.message);
  }
}

'''
s = s.replace(fn_anchor, functions + fn_anchor, 1)

old_empty = "  if (activeAgents.length === 0) return;\n"
if old_empty not in s:
    raise SystemExit("garde activeAgents introuvable")
s = s.replace(old_empty, "  // API-Football peut tourner meme si aucun challenger LLM n'est configure.\n", 1)

tail = "  }\n}\n\nfunction resolveShadowOutcomes(home, away, scoreHome, scoreAway) {"
if tail not in s:
    raise SystemExit("fin runShadowEvaluation introuvable")
s = s.replace(
    tail,
    "  }\n  await runApiFootballShadowEvaluation(match);\n}\n\nfunction resolveShadowOutcomes(home, away, scoreHome, scoreAway) {",
    1,
)

old_policy = '''const PROMO_MIN_RESOLUS = Math.max(20, Number(process.env.PROMO_MIN_RESOLUS || 50));
const PROMO_MARGE_MINI = Math.max(1, Number(process.env.PROMO_MARGE_MINI || 5));'''
new_policy = '''const PROMO_MIN_RESOLUS = Math.max(SHADOW_PROMOTION_MIN_RESOLVED, Number(process.env.PROMO_MIN_RESOLUS || SHADOW_PROMOTION_MIN_RESOLVED));
const PROMO_MIN_DAYS = Math.max(SHADOW_PROMOTION_MIN_DAYS, Number(process.env.PROMO_MIN_DAYS || SHADOW_PROMOTION_MIN_DAYS));
const PROMO_MIN_OVER25 = Math.max(SHADOW_PROMOTION_MIN_OVER25, Number(process.env.PROMO_MIN_OVER25 || SHADOW_PROMOTION_MIN_OVER25));
const PROMO_MIN_UNDER25 = Math.max(SHADOW_PROMOTION_MIN_UNDER25, Number(process.env.PROMO_MIN_UNDER25 || SHADOW_PROMOTION_MIN_UNDER25));
const PROMO_MARGE_MINI = Math.max(1, Number(process.env.PROMO_MARGE_MINI || 5));'''
if old_policy not in s:
    raise SystemExit("politique de promotion introuvable")
s = s.replace(old_policy, new_policy, 1)

old_stats = '''      SELECT agent_name,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM ${table} WHERE outcome IN ('win','loss') GROUP BY agent_name
    `).all().map(r => {
      const resolus = (r.wins || 0) + (r.losses || 0);
      return { nom: r.agent_name, resolus, winrate: resolus ? Math.round(r.wins / resolus * 100) : null };
    }).filter(r => r.resolus >= PROMO_MIN_RESOLUS)
      .sort((a, b) => b.winrate - a.winrate);'''
new_stats = '''      SELECT agent_name,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
             SUM(CASE WHEN lower(bet) LIKE '%over 2.5%' OR lower(bet) LIKE '%plus de 2.5%' THEN 1 ELSE 0 END) over25,
             SUM(CASE WHEN lower(bet) LIKE '%under 2.5%' OR lower(bet) LIKE '%moins de 2.5%' THEN 1 ELSE 0 END) under25,
             MIN(created_at) first_eval
      FROM ${table} WHERE outcome IN ('win','loss') GROUP BY agent_name
    `).all().map(r => {
      const resolus = (r.wins || 0) + (r.losses || 0);
      const daysActive = r.first_eval
        ? Math.floor((Date.now() - new Date(String(r.first_eval).replace(' ', 'T') + 'Z').getTime()) / 86400000)
        : 0;
      return {
        nom: r.agent_name, resolus,
        winrate: resolus ? Math.round(r.wins / resolus * 100) : null,
        over25: Number(r.over25 || 0), under25: Number(r.under25 || 0), daysActive
      };
    }).filter(r =>
      r.resolus >= PROMO_MIN_RESOLUS &&
      r.daysActive >= PROMO_MIN_DAYS &&
      r.over25 >= PROMO_MIN_OVER25 &&
      r.under25 >= PROMO_MIN_UNDER25
    ).sort((a, b) => b.winrate - a.winrate);'''
if old_stats not in s:
    raise SystemExit("requete de classement introuvable")
s = s.replace(old_stats, new_stats, 1)

old_msg = "lignes.push(`ℹ️ Classement IA — echantillon insuffisant (${PROMO_MIN_RESOLUS} pronostics resolus requis par IA)`);"
new_msg = "lignes.push(`ℹ️ Classement IA — echantillon insuffisant (${PROMO_MIN_RESOLUS} resolus, ${PROMO_MIN_DAYS} jours, ${PROMO_MIN_OVER25} Over et ${PROMO_MIN_UNDER25} Under requis)`);"
if old_msg not in s:
    raise SystemExit("message echantillon introuvable")
s = s.replace(old_msg, new_msg, 1)

route_anchor = 'app.get("/admin/shadow-perf", (req, res) => {'
if route_anchor not in s:
    raise SystemExit("route shadow-perf introuvable")
route = r'''
app.get("/shadow-bench/status", (_req, res) => {
  try {
    const calls = db.prepare(`
      SELECT COUNT(*) total,
             SUM(CASE WHEN status='compatible' THEN 1 ELSE 0 END) compatible,
             SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) errors,
             MAX(last_attempt_at) last_attempt_at
      FROM shadow_provider_calls WHERE provider=?
    `).get(API_FOOTBALL_SHADOW_PROVIDER) || {};
    const evals = db.prepare(`
      SELECT COUNT(*) total,
             SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
             SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM shadow_evals WHERE agent_name=?
    `).get(API_FOOTBALL_SHADOW_PROVIDER) || {};
    const resolved = Number(evals.wins || 0) + Number(evals.losses || 0);
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      mode: "shadow_only",
      provider: API_FOOTBALL_SHADOW_PROVIDER,
      enabled: API_FOOTBALL_SHADOW_ENABLED && !!API_SPORTS_KEY,
      daily_cap: API_FOOTBALL_SHADOW_MAX_DAILY,
      calls,
      evaluations: { ...evals, resolved },
      promotion_policy: {
        min_resolved: PROMO_MIN_RESOLUS,
        min_days: PROMO_MIN_DAYS,
        min_over25: PROMO_MIN_OVER25,
        min_under25: PROMO_MIN_UNDER25,
        automatic_model_promotion_only: true
      },
      invariants: {
        official_voters: CONCILE_AGENT_NAMES.length,
        rule: "4/5",
        confidence_threshold_unchanged: true,
        telegram_unchanged: true,
        api_provider_is_not_a_vote: true
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

'''
s = s.replace(route_anchor, route + route_anchor, 1)

path.write_text(s, encoding="utf-8")
print("[patch] banc d'essai automatique ajoute")
PY

node --check "$SRC"
grep -q 'TLM_SHADOW_BENCH_V1' "$SRC"
grep -q 'Math.max(SHADOW_PROMOTION_MIN_RESOLVED' "$SRC"

docker compose build api
docker compose up -d --no-deps api
RESTARTED=1

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:3001/health >/dev/null
docker exec touslesmatchs-api grep -q 'TLM_SHADOW_BENCH_V1' /app/server.js
docker exec touslesmatchs-api node -e '
const Database=require("better-sqlite3");
const db=new Database("/data/tlm.db",{readonly:true});
const row=db.prepare("SELECT name FROM sqlite_master WHERE type=? AND name=?").get("table","shadow_provider_calls");
if(!row) process.exit(1);
console.log("PROOF_TABLE="+row.name);
db.close();
'

PUBLIC_JSON="$(curl -fsS https://www.touslesmatchs.com/api/shadow-bench/status)"
printf '%s' "$PUBLIC_JSON" | grep -q '"mode":"shadow_only"'
printf '%s' "$PUBLIC_JSON" | grep -q '"enabled":true'
printf '%s' "$PUBLIC_JSON" | grep -q '"official_voters":5'
printf '%s' "$PUBLIC_JSON" | grep -q '"api_provider_is_not_a_vote":true'
curl -fsS https://www.touslesmatchs.com/api/health >/dev/null

docker logs --since 3m touslesmatchs-api 2>&1 | tail -n 120 > "$BACKUP/api-logs-after.txt"
if grep -Eiq 'SyntaxError|ReferenceError|uncaughtException|MODULE_NOT_FOUND' "$BACKUP/api-logs-after.txt"; then
  echo "FAILED: erreur critique detectee dans les logs"
  exit 1
fi

trap - ERR
echo "PROOF_SOURCE=TLM_SHADOW_BENCH_V1"
echo "PROOF_PUBLIC=$PUBLIC_JSON"
echo "PROOF_FIVE_VOTES=5"
echo "PROOF_THRESHOLD=unchanged"
echo "PROOF_TELEGRAM=unchanged"
echo "OK: banc d'essai API-Football actif; promotion verrouillee a 200 resultats / 30 jours / 75 Over / 75 Under"
echo "BACKUP=$BACKUP"
