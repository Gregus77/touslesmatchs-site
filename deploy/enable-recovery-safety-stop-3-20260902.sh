#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/touslesmatchs
TARGET=b48993c9d350d4dcd7555069127beaef1009f5aa
BASE="${TARGET}^"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/tlm-recovery-safety-3-${STAMP}"
TMP="$(mktemp -d /tmp/tlm-recovery-safety.XXXXXX)"
APPLIED=0

rollback() {
  rc=$?
  rm -rf "$TMP"
  if [ "$APPLIED" -eq 1 ]; then
    echo "[rollback] restauration de scripts/api_server.js"
    cp -a "$BACKUP/api_server.js.before" "$ROOT/scripts/api_server.js"
    (cd "$ROOT" && docker compose build api >/dev/null && docker compose up -d --no-deps api >/dev/null) || true
  fi
  echo "FAILED — coupe-circuit non active; sauvegarde=$BACKUP"
  exit "$rc"
}
trap rollback ERR

cd "$ROOT"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -a scripts/api_server.js "$BACKUP/api_server.js.before"

git fetch origin agent/android-fcm-v107
git cat-file -e "${TARGET}^{commit}"
git show "$BASE:scripts/api_server.js" > "$TMP/base.js"
git show "$TARGET:scripts/api_server.js" > "$TMP/target.js"

if grep -Fq 'const RECOVERY_SAFETY_STOP_AFTER = 3;' scripts/api_server.js; then
  cp -a scripts/api_server.js "$TMP/merged.js"
else
  set +e
  git merge-file -p scripts/api_server.js "$TMP/base.js" "$TMP/target.js" > "$TMP/merged.js"
  MERGE_RC=$?
  set -e
  if [ "$MERGE_RC" -ne 0 ] || grep -Eq '^(<<<<<<<|=======|>>>>>>>)' "$TMP/merged.js"; then
    echo "FAILED — conflit avec les modifications VPS; aucune ecriture effectuee"
    false
  fi
fi

for proof in \
  'const RECOVERY_SAFETY_STOP_AFTER = 3;' \
  'const RECOVERY_SAFETY_MAX_WINS = 1;' \
  'CREATE TABLE IF NOT EXISTS recovery_safety_state' \
  '&& !recoverySafety.paused;' \
  'mode Recovery: ${recoverySafety.reason}'
do
  grep -Fq "$proof" "$TMP/merged.js"
done

node --check "$TMP/merged.js"
install -m 640 "$TMP/merged.js" scripts/api_server.js
APPLIED=1

docker compose build api
docker compose up -d --no-deps api

READY=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/health > "$TMP/health-local.json" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 2
done
[ "$READY" -eq 1 ]

HOST_SHA="$(sha256sum scripts/api_server.js | awk '{print $1}')"
CONTAINER_SHA="$(docker compose exec -T api sha256sum /app/server.js | awk '{print $1}')"
[ "$HOST_SHA" = "$CONTAINER_SHA" ]

curl -fsS --max-time 20 https://www.touslesmatchs.com/api/health > "$TMP/health-public.json"
curl -fsS --max-time 20 https://www.touslesmatchs.com/api/live-matches > "$TMP/live.json"
curl -fsS --max-time 20 https://www.touslesmatchs.com/api/analysis-history > "$TMP/history.json"
node -e 'for (const p of process.argv.slice(1)) JSON.parse(require("fs").readFileSync(p,"utf8"))' \
  "$TMP/health-public.json" "$TMP/live.json" "$TMP/history.json"

docker compose exec -T api node - <<'NODE' | tee "$BACKUP/runtime-proof.json"
const fs = require("fs");
const Database = require("better-sqlite3");
const source = fs.readFileSync("/app/server.js", "utf8");
for (const marker of [
  "RECOVERY_SAFETY_STOP_AFTER = 3",
  "RECOVERY_SAFETY_MAX_WINS = 1",
  "recovery_safety_state",
  "&& !recoverySafety.paused"
]) {
  if (!source.includes(marker)) throw new Error("marqueur runtime absent: " + marker);
}
const db = new Database("/data/tlm.db");
const table = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='recovery_safety_state'"
).get();
const state = db.prepare(
  "SELECT activated_at, paused, paused_at, reason FROM recovery_safety_state WHERE id=1"
).get();
if (!table || !state) throw new Error("etat coupe-circuit absent");
console.log(JSON.stringify({
  ok: true,
  rule: "pause si 0 ou 1 victoire sur les 3 prochains signaux resolus",
  client_diffusion_paused: Boolean(state.paused),
  activated_at: state.activated_at,
  analyses_continue: true
}));
NODE

if docker compose logs --since 3m api | grep -Eiq 'SyntaxError|ReferenceError|Cannot find module|uncaughtException|unhandledRejection|fatal|crash'; then
  echo "FAILED — erreur grave detectee dans les logs API"
  false
fi

trap - ERR
APPLIED=0
rm -rf "$TMP"
echo "OK — coupe-circuit Recovery actif: pause clients si 0/3 ou 1/3; analyses a blanc maintenues"
echo "Sauvegarde: $BACKUP"
