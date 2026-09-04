#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/touslesmatchs
EXPECTED_FEATURE_COMMIT=8878d2457f73228131d79f9b2786dab5db5b4e02
BACKUP="/opt/backups/tlm-main-signal-volume-shadow-$(date -u +%Y%m%dT%H%M%SZ)"
ENV_FILE="$ROOT/.env"
RUNNER=/usr/local/sbin/tlm-shadow-tournament-run
SERVICE=/etc/systemd/system/tlm-shadow-tournament.service
TIMER=/etc/systemd/system/tlm-shadow-tournament.timer
OLD_HEAD=""
NEW_HEAD=""
CHANGED=0

TARGETS=(
  "$ROOT/scripts/api_server.js"
  "$ROOT/docker-compose.yml"
  "$ROOT/scripts/shadow_tournament_worker.js"
  "$ROOT/scripts/test_signal_volume_shadow_markets_20260904.js"
  "$ROOT/deploy/apply-main-signal-volume-shadow-20260904.sh"
  "$ENV_FILE"
  "$RUNNER"
  "$SERVICE"
  "$TIMER"
)

backup_one() {
  local target="$1" name
  name="$(printf '%s' "$target" | sed 's#/#__#g')"
  if [[ -e "$target" ]]; then cp -a "$target" "$BACKUP/$name.before"; else : > "$BACKUP/$name.absent"; fi
}

restore_one() {
  local target="$1" name
  name="$(printf '%s' "$target" | sed 's#/#__#g')"
  if [[ -f "$BACKUP/$name.before" ]]; then
    cp -a "$BACKUP/$name.before" "$target"
  elif [[ -f "$BACKUP/$name.absent" ]]; then
    rm -f -- "$target"
  fi
}

rollback() {
  local code=$?
  if [[ $code -eq 0 || $CHANGED -eq 0 ]]; then return; fi
  echo "[rollback] restauration depuis $BACKUP"
  for target in "${TARGETS[@]}"; do restore_one "$target"; done
  if [[ -n "$OLD_HEAD" && -n "$NEW_HEAD" ]] && [[ "$(git rev-parse HEAD 2>/dev/null || true)" == "$NEW_HEAD" ]]; then
    git update-ref refs/heads/main "$OLD_HEAD" "$NEW_HEAD" || true
  fi
  systemctl daemon-reload >/dev/null 2>&1 || true
  docker compose up -d --build api >/dev/null 2>&1 || true
  echo "FAILED — correction annulee; sauvegarde=$BACKUP"
}
trap rollback EXIT

cd "$ROOT"
branch="$(git branch --show-current)"
upstream="$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || true)"
remote="$(git remote get-url origin 2>/dev/null || true)"
tracked_dirty="$(git status --porcelain --untracked-files=no)"
printf '[baseline] branch=%s head=%s upstream=%s remote=%s\n' "$branch" "$(git rev-parse HEAD)" "$upstream" "$remote"
[[ "$branch" == "main" ]]
[[ "$upstream" == "origin/main" ]]
[[ "$remote" == *"Gregus77/touslesmatchs-site"* ]]
[[ -z "$tracked_dirty" ]]
[[ -f "$ENV_FILE" ]]

mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
for target in "${TARGETS[@]}"; do backup_one "$target"; done

OLD_HEAD="$(git rev-parse HEAD)"
git fetch origin main
git merge-base --is-ancestor "$OLD_HEAD" origin/main
git merge-base --is-ancestor "$EXPECTED_FEATURE_COMMIT" origin/main
git grep -q 'fetchSeasonRows(numericSeason - 1)' origin/main -- scripts/api_server.js
git grep -q 'over_under_3_5' origin/main -- scripts/shadow_tournament_worker.js

CHANGED=1
git merge --ff-only origin/main
NEW_HEAD="$(git rev-parse HEAD)"

node - "$ENV_FILE" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
let text = fs.readFileSync(path, 'utf8');
const values = {
  CLIENT_OU25_MIN_CONFIDENCE: '77',
  CLIENT_OU25_CLIENT_MAX_MINUTE: '40',
  OU25_RECOVERY_MODE: '1',
  OU25_RECOVERY_MAX_DAILY_SIGNALS: '2',
  TIER_MIN_REAL_ODD: '1.30',
  TIER_MAX_REAL_ODD: '2.10',
  SHADOW_MARKET_MIN_CONFIDENCE: '77',
};
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
}
fs.writeFileSync(path, text);
NODE

install -m 750 /dev/stdin "$RUNNER" <<'RUNNER'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
/usr/bin/docker inspect touslesmatchs-api >/dev/null
/usr/bin/docker cp /opt/touslesmatchs/scripts/shadow_tournament_worker.js touslesmatchs-api:/app/shadow_tournament_worker.js >/dev/null
/usr/bin/docker exec touslesmatchs-api node /app/shadow_tournament_worker.js "$@"
RUNNER

install -m 644 /dev/stdin "$SERVICE" <<'SERVICE'
[Unit]
Description=TousLesMatchs tournoi IA et marches a blanc
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/flock -n /run/tlm-shadow-tournament.lock /usr/local/sbin/tlm-shadow-tournament-run
TimeoutStartSec=900
Nice=10
SERVICE

install -m 644 /dev/stdin "$TIMER" <<'TIMER'
[Unit]
Description=Lance le tournoi IA et marches a blanc toutes les dix minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=10min
Persistent=true
Unit=tlm-shadow-tournament.service

[Install]
WantedBy=timers.target
TIMER

node --check scripts/api_server.js
node --check scripts/shadow_tournament_worker.js
node scripts/test_signal_volume_shadow_markets_20260904.js
docker compose config -q
docker compose up -d --build api

for _ in $(seq 1 30); do
  if docker inspect -f '{{.State.Running}}' touslesmatchs-api 2>/dev/null | grep -qx true \
    && curl -fsS http://127.0.0.1:3001/health >/dev/null; then break; fi
  sleep 2
done

docker inspect -f '{{.State.Running}}' touslesmatchs-api | grep -qx true
curl -fsS http://127.0.0.1:3001/health >/dev/null
docker exec touslesmatchs-api node --check /app/server.js
docker exec touslesmatchs-api node - <<'NODE'
const fs = require('fs');
const s = fs.readFileSync('/app/server.js', 'utf8');
const checks = [
  /CLIENT_OU25_MIN_VOTES\s*=\s*4/,
  /CLIENT_OU25_MIN_CONFIDENCE\s*=\s*Math\.max\(77,/,
  /CLIENT_OU25_CLIENT_MAX_MINUTE = Math\.min\([\s\S]{0,100}40/,
  /const ok = combinedAligned && liveAligned[\s\S]{0,100}RECOVERY_MIN_CONVERGENT_INDICATORS/,
  /fetchSeasonRows\(numericSeason - 1\)/,
];
if (!checks.every(re => re.test(s)) || /fiveOu25SeatsPresent/.test(s)) process.exit(1);
console.log('RUNTIME_OK — 4/5 · 77% · cotes 1.30-2.10 · live 15-40 · historique multi-saison');
NODE

systemctl daemon-reload
systemctl enable --now tlm-shadow-tournament.timer
systemctl is-enabled --quiet tlm-shadow-tournament.timer
systemctl is-active --quiet tlm-shadow-tournament.timer
"$RUNNER" --report > "$BACKUP/shadow-report.json"
grep -q '"models_tested": 10' "$BACKUP/shadow-report.json"
grep -q '"over_under_1_5"' "$BACKUP/shadow-report.json"
grep -q '"over_under_3_5"' "$BACKUP/shadow-report.json"
grep -q '"btts"' "$BACKUP/shadow-report.json"
grep -q '"influences_telegram": false' "$BACKUP/shadow-report.json"
grep -q '"automatic_promotion": false' "$BACKUP/shadow-report.json"
curl -fsS https://www.touslesmatchs.com/api/health >/dev/null
if docker logs touslesmatchs-api --since 2m 2>&1 | grep -Eiq 'SyntaxError|ReferenceError|Cannot find module|Restarting'; then
  echo 'Erreur recente detectee dans les logs API'
  exit 1
fi

CHANGED=0
trap - EXIT
echo 'OK — production main alignee; volume O/U 2,5 corrige et marches shadow actifs sans Telegram'
echo 'Regles clients: 4/5 · confiance 77% · cotes 1.30-2.10 · live 15-40 · maximum Recovery 2/jour'
echo 'Shadow: 10 IA · O/U 1.5 · O/U 3.5 · BTTS · aucune diffusion ni promotion automatique'
echo "Sauvegarde: $BACKUP"
