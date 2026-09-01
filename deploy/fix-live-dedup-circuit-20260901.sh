#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="/opt/touslesmatchs"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/tlm-live-dedup-circuit-${STAMP}"
API_FILE="$PROJECT/scripts/api_server.js"
DB_SNAPSHOT_HOST="$PROJECT/data/snapshots/tlm-pre-live-dedup-${STAMP}.db"
BREAKER_SNAPSHOT_HOST="$PROJECT/data/snapshots/tlm-breakers-${STAMP}.json"
SUCCESS=0

mkdir -p "$BACKUP" "$PROJECT/data/snapshots"
chmod 700 "$BACKUP"
cp -a "$API_FILE" "$BACKUP/api_server.js"

rollback() {
  local rc=$?
  if [ "$SUCCESS" -eq 1 ]; then return 0; fi
  echo "[rollback] echec detecte, restauration du code et des coupe-circuits"
  cp -a "$BACKUP/api_server.js" "$API_FILE"
  if [ -s "$BREAKER_SNAPSHOT_HOST" ]; then
    docker exec -i touslesmatchs-api node - "$BREAKER_SNAPSHOT_HOST" <<'NODE' || true
const fs = require('fs');
const Database = require('better-sqlite3');
const snapshotHost = process.argv[2];
const snapshotContainer = snapshotHost.replace('/opt/touslesmatchs/data/', '/data/');
const rows = JSON.parse(fs.readFileSync(snapshotContainer, 'utf8'));
const db = new Database('/data/tlm.db');
db.exec(`CREATE TABLE IF NOT EXISTS ai_circuit_breaker (
  breach_type TEXT PRIMARY KEY, tripped_at TEXT NOT NULL, alerted_at TEXT, detail TEXT
)`);
const restore = db.transaction(() => {
  db.prepare("DELETE FROM ai_circuit_breaker WHERE breach_type IN ('spike','duplicate_burst')").run();
  const put = db.prepare(`INSERT INTO ai_circuit_breaker
    (breach_type,tripped_at,alerted_at,detail) VALUES (?,?,?,?)`);
  for (const row of rows) put.run(row.breach_type, row.tripped_at, row.alerted_at, row.detail);
});
restore(); db.close();
NODE
  fi
  (cd "$PROJECT" && docker compose build api && docker compose up -d --no-deps api) || true
  echo "FAILED: correction annulee; sauvegarde=$BACKUP"
  exit "$rc"
}
trap rollback EXIT

echo "[baseline] sauvegarde en ligne de la base SQLite"
docker exec -i touslesmatchs-api node - "$STAMP" <<'NODE'
const fs = require('fs');
const Database = require('better-sqlite3');
const stamp = process.argv[2];
const db = new Database('/data/tlm.db');
Promise.resolve(db.backup(`/data/snapshots/tlm-pre-live-dedup-${stamp}.db`))
  .then(() => {
    const rows = db.prepare("SELECT breach_type,tripped_at,alerted_at,detail FROM ai_circuit_breaker WHERE breach_type IN ('spike','duplicate_burst')").all();
    fs.writeFileSync(`/data/snapshots/tlm-breakers-${stamp}.json`, JSON.stringify(rows, null, 2), { mode: 0o600 });
    db.close();
  })
  .catch((error) => { console.error(error); process.exit(1); });
NODE
cp -a "$DB_SNAPSHOT_HOST" "$BACKUP/tlm.db"
cp -a "$BREAKER_SNAPSHOT_HOST" "$BACKUP/ai_circuit_breaker.json"

python3 - "$API_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
marker = "TLM_LIVE_DEDUP_WOLVES_20260901"
needle = '    .replace(/\\b(united|utd)\\b/g, "utd")'
addition = '''
    // TLM_LIVE_DEDUP_WOLVES_20260901 — deux fournisseurs nomment le meme club
    // "Wolverhampton Wanderers" et "Wolves". Sans cet alias, le meme match
    // est analyse deux fois et peut declencher le coupe-circuit de sursaut.
    .replace(/\\bwolverhampton(?:\\s+wanderers)?\\b|\\bwolves\\b/g, "wolves")'''
if marker not in text:
    if text.count(needle) != 1:
        raise SystemExit("FAILED: ancre normalizeMatchName absente ou ambigue")
    text = text.replace(needle, needle + addition, 1)
    path.write_text(text, encoding="utf-8")
PY

node --check "$API_FILE"
grep -q 'TLM_LIVE_DEDUP_WOLVES_20260901' "$API_FILE"
node <<'NODE'
function normalize(value) {
  return String(value || '').toLowerCase()
    .replace(/\b(united|utd)\b/g, 'utd')
    .replace(/\bwolverhampton(?:\s+wanderers)?\b|\bwolves\b/g, 'wolves')
    .replace(/\s+/g, ' ').trim();
}
if (normalize('Wolverhampton Wanderers') !== normalize('Wolves')) {
  throw new Error('alias Wolves non fonctionnel');
}
console.log('PROOF_ALIAS=wolves_identity_ok');
NODE

echo "[deploy] construction de l'API corrigee sans couper le service courant"
cd "$PROJECT"
docker compose build api

echo "[rearm] suppression uniquement des coupe-circuits temporaires"
docker exec -i touslesmatchs-api node <<'NODE'
const Database = require('better-sqlite3');
const db = new Database('/data/tlm.db');
const result = db.prepare("DELETE FROM ai_circuit_breaker WHERE breach_type IN ('spike','duplicate_burst')").run();
console.log(`PROOF_BREAKERS_CLEARED=${result.changes}`);
db.close();
NODE

docker compose up -d --no-deps api

echo "[verify] attente de l'API"
ready=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/health > "/tmp/tlm-health-${STAMP}.json"; then
    ready=1
    break
  fi
  sleep 2
done
[ "$ready" -eq 1 ] || { echo "FAILED: API non disponible apres redeploiement"; exit 1; }

docker exec touslesmatchs-api grep -q 'TLM_LIVE_DEDUP_WOLVES_20260901' /app/server.js
curl -fsS --max-time 20 "https://www.touslesmatchs.com/api/live-matches?force=1&verify=${STAMP}" > "/tmp/tlm-live-${STAMP}.json"
curl -fsS --max-time 20 "https://www.touslesmatchs.com/api/health?verify=${STAMP}" > "/tmp/tlm-public-health-${STAMP}.json"

node - "/tmp/tlm-live-${STAMP}.json" "/tmp/tlm-public-health-${STAMP}.json" <<'NODE'
const fs = require('fs');
const live = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const health = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
if (!live.ok || !Array.isArray(live.matches)) throw new Error('live-matches invalide');
if (!health.ok || !health.integrations?.telegram?.ok) throw new Error('health/Telegram invalide');
const westHamWolves = live.matches.filter((m) => {
  const s = `${m.home || ''} ${m.away || ''}`.toLowerCase();
  return s.includes('west ham') && (s.includes('wolves') || s.includes('wolverhampton'));
});
if (westHamWolves.length > 1) throw new Error(`doublon West Ham-Wolves encore public (${westHamWolves.length})`);
console.log(`PROOF_PUBLIC_DUPLICATES=${westHamWolves.length}`);
console.log('PROOF_TELEGRAM=ok');
NODE

if docker logs --since=2m touslesmatchs-api 2>&1 | grep -Eqi 'SyntaxError|uncaughtException|MODULE_NOT_FOUND|Cannot find module'; then
  echo "FAILED: erreur critique dans les logs API"
  exit 1
fi

SUCCESS=1
trap - EXIT
echo "OK: deduplication inter-fournisseurs corrigee et coupe-circuit temporaire rearme"
echo "BACKUP=$BACKUP"
echo "DB_SNAPSHOT=$DB_SNAPSHOT_HOST"
echo "API_IMAGE=$(docker inspect -f '{{.Image}}' touslesmatchs-api)"
