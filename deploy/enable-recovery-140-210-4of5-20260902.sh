#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/touslesmatchs"
BASE_LEGACY_SHA="7f0876f94238ca5488e5a3a32091354b4145740f"
BASE_RECOVERY_SHA="103a07578465940f2953dc9e7aa13ca8176e413c"
TARGET_SHA="5283228db36856a0668455869ad75a544e476a4c"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/opt/backups/tlm-recovery-140-210-4of5-${STAMP}"
TMP_DIR="$(mktemp -d /tmp/tlm-recovery.XXXXXX)"
APPLIED=0

cd "$ROOT"
mkdir -p "$BACKUP_DIR"
cp -a scripts/api_server.js "$BACKUP_DIR/api_server.js"

rollback() {
  local rc=$?
  if [ "$APPLIED" -eq 1 ]; then
    echo "[rollback] echec detecte, restauration de scripts/api_server.js"
    cp -a "$BACKUP_DIR/api_server.js" scripts/api_server.js
    docker compose build api >/dev/null
    docker compose up -d --no-deps api >/dev/null
  fi
  echo "FAILED — Mode Recovery non active; sauvegarde=$BACKUP_DIR"
  rm -rf "$TMP_DIR"
  exit "$rc"
}
trap rollback ERR

git fetch origin agent/android-fcm-v107
if grep -Fq 'const RECOVERY_MODE_ENABLED' scripts/api_server.js; then
  BASE_SHA="$BASE_RECOVERY_SHA"
else
  BASE_SHA="$BASE_LEGACY_SHA"
fi
git cat-file -e "${BASE_SHA}^{commit}"
git cat-file -e "${TARGET_SHA}^{commit}"
git show "${BASE_SHA}:scripts/api_server.js" > "$TMP_DIR/base.js"
git show "${TARGET_SHA}:scripts/api_server.js" > "$TMP_DIR/target.js"

set +e
git merge-file -p scripts/api_server.js "$TMP_DIR/base.js" "$TMP_DIR/target.js" > "$TMP_DIR/merged.js"
MERGE_RC=$?
set -e
if [ "$MERGE_RC" -ge 128 ]; then
  echo "FAILED — erreur technique git merge-file ($MERGE_RC)"
  false
fi
if [ "$MERGE_RC" -gt 0 ] || grep -Eq '^(<<<<<<<|=======|>>>>>>>)' "$TMP_DIR/merged.js"; then
  echo "FAILED — conflit avec des modifications VPS; aucune ecriture effectuee"
  false
fi

for proof in   'const RECOVERY_MODE_ENABLED = process.env.OU25_RECOVERY_MODE !== "0";'   'const RECOVERY_OVER_MIN_AVG = 2.80;'   'const RECOVERY_UNDER_MAX_AVG = 2.20;'   'const RECOVERY_MIN_CONVERGENT_INDICATORS = 3;'   'return CLIENT_OU25_MIN_VOTES;'   'const TIER_MIN_REAL_ODD = Math.max(1.40'   'const TIER_MAX_REAL_ODD = Math.min(2.10'   'const gradePremium = RECOVERY_MODE_ENABLED'   'reason: "donnees absences indisponibles"'   '&& recoveryEvidence.ok && recoveryCapacityAvailable'
do
  grep -Fq "$proof" "$TMP_DIR/merged.js"
done
grep -Fq 'Number(process.env.CLIENT_OU25_CLIENT_MAX_MINUTE || 40)' "$TMP_DIR/merged.js"
grep -Fq 'Math.min(2, Math.max(1, Number(process.env.OU25_RECOVERY_MAX_DAILY_SIGNALS || 2)))' "$TMP_DIR/merged.js"

node --check "$TMP_DIR/merged.js"
cp -a "$TMP_DIR/merged.js" scripts/api_server.js
APPLIED=1

docker compose build api
docker compose up -d --no-deps api

READY=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/health > "$TMP_DIR/health-local.json"; then
    READY=1
    break
  fi
  sleep 2
done
[ "$READY" -eq 1 ]

HOST_SHA="$(sha256sum scripts/api_server.js | awk '{print $1}')"
CONTAINER_SHA="$(docker compose exec -T api sha256sum /app/server.js | awk '{print $1}')"
[ "$HOST_SHA" = "$CONTAINER_SHA" ]

curl -fsS --max-time 15 https://www.touslesmatchs.com/api/health > "$TMP_DIR/health-public.json"
curl -fsS --max-time 15 https://www.touslesmatchs.com/api/live-matches > "$TMP_DIR/live.json"
curl -fsS --max-time 15 https://www.touslesmatchs.com/api/analysis-history > "$TMP_DIR/history.json"

node - "$TMP_DIR/health-public.json" "$TMP_DIR/live.json" "$TMP_DIR/history.json" <<'NODE'
const fs = require("fs");
const [healthPath, livePath, historyPath] = process.argv.slice(2);
const health = JSON.parse(fs.readFileSync(healthPath, "utf8"));
JSON.parse(fs.readFileSync(livePath, "utf8"));
JSON.parse(fs.readFileSync(historyPath, "utf8"));
const telegram = health?.integrations?.telegram ?? health?.telegram ?? health?.services?.telegram;
if (telegram === false || telegram?.configured === false || telegram?.ok === false) {
  throw new Error("Telegram indisponible apres deploiement");
}
if (telegram && typeof telegram === "object" && telegram.channels) {
  for (const name of ["standard", "premium", "elite"]) {
    const channel = telegram.channels[name];
    if (channel?.configured && channel?.ok === false) {
      throw new Error("Canal Telegram payant inaccessible: " + name);
    }
  }
}
NODE

if docker compose logs --since 3m api | grep -E 'SyntaxError|ReferenceError|Cannot find module|uncaughtException|unhandledRejection'; then
  echo "FAILED — erreur grave detectee dans les logs API"
  false
fi

docker compose exec -T api node -e '
const fs=require("fs");
const s=fs.readFileSync("/app/server.js","utf8");
const required=[
  "RECOVERY_MODE_ENABLED",
  "RECOVERY_OVER_MIN_AVG = 2.80",
  "RECOVERY_UNDER_MAX_AVG = 2.20",
  "RECOVERY_MIN_CONVERGENT_INDICATORS = 3",
  "recoveryEvidence.ok && recoveryCapacityAvailable"
];
if(required.some(x=>!s.includes(x))) process.exit(1);
console.log(JSON.stringify({ok:true,mode:"Recovery",daily_max:2,confidence_min:78,votes:"4/5",real_odds:"1.40-2.10",live_window:"15-40",fail_closed:true}));
'

trap - ERR
rm -rf "$TMP_DIR"
echo "OK — Recovery 1.40-2.10 et 4/5 actif et verifie; sauvegarde=$BACKUP_DIR"
