#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/touslesmatchs
BRANCH=codex/shadow-tournament-10-20260901
SOURCE_COMMIT=4db5df17cea314d559154071d65932821bc261e1
BACKUP=/opt/backups/tlm-shadow-tournament-$(date -u +%Y%m%dT%H%M%SZ)
WORKER="$ROOT/scripts/shadow_tournament_worker.js"
RUNNER=/usr/local/sbin/tlm-shadow-tournament-run
SERVICE=/etc/systemd/system/tlm-shadow-tournament.service
TIMER=/etc/systemd/system/tlm-shadow-tournament.timer
INSTALLED=0

rollback() {
  local code=$?
  if [[ $code -eq 0 || $INSTALLED -eq 0 ]]; then
    return
  fi
  echo "[rollback] restauration de $BACKUP"
  systemctl disable --now tlm-shadow-tournament.timer >/dev/null 2>&1 || true
  for target in "$WORKER" "$RUNNER" "$SERVICE" "$TIMER"; do
    local saved="$BACKUP/$(basename "$target").before"
    if [[ -f "$saved" ]]; then
      cp -a "$saved" "$target"
    else
      rm -f "$target"
    fi
  done
  systemctl daemon-reload >/dev/null 2>&1 || true
  echo "FAILED — installation annulee; sauvegarde=$BACKUP"
}
trap rollback EXIT

cd "$ROOT"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"

for target in "$WORKER" "$RUNNER" "$SERVICE" "$TIMER"; do
  if [[ -f "$target" ]]; then
    cp -a "$target" "$BACKUP/$(basename "$target").before"
  fi
done

git fetch origin "$BRANCH"
git cat-file -e "$SOURCE_COMMIT^{commit}"
git show "$SOURCE_COMMIT:scripts/shadow_tournament_worker.js" > "$WORKER.tmp"

docker inspect touslesmatchs-api >/dev/null
docker exec touslesmatchs-api sh -lc 'test -n "${OPENROUTER_API_KEY:-}"'
docker cp "$WORKER.tmp" touslesmatchs-api:/tmp/shadow_tournament_worker.js
docker exec touslesmatchs-api node --check /tmp/shadow_tournament_worker.js
mv "$WORKER.tmp" "$WORKER"
chmod 750 "$WORKER"

install -m 750 /dev/stdin "$RUNNER" <<'RUNNER'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
/usr/bin/docker inspect touslesmatchs-api >/dev/null
/usr/bin/docker cp /opt/touslesmatchs/scripts/shadow_tournament_worker.js touslesmatchs-api:/app/shadow_tournament_worker.js
/usr/bin/docker exec touslesmatchs-api node /app/shadow_tournament_worker.js "$@"
RUNNER

install -m 644 /dev/stdin "$SERVICE" <<'SERVICE'
[Unit]
Description=TousLesMatchs tournoi de dix IA a blanc
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
Description=Lance le tournoi IA a blanc toutes les dix minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=10min
Persistent=true
Unit=tlm-shadow-tournament.service

[Install]
WantedBy=timers.target
TIMER

INSTALLED=1
"$RUNNER" --report | tee "$BACKUP/initial-report.json"
grep -q '"models_tested": 10' "$BACKUP/initial-report.json"
grep -q '"influences_telegram": false' "$BACKUP/initial-report.json"
grep -q '"automatic_promotion": false' "$BACKUP/initial-report.json"

systemctl daemon-reload
systemctl enable --now tlm-shadow-tournament.timer
systemctl is-enabled --quiet tlm-shadow-tournament.timer
systemctl is-active --quiet tlm-shadow-tournament.timer

INSTALLED=0
trap - EXIT
echo "OK — tournoi shadow installe; aucun impact sur le Concile ou Telegram"
echo "Sauvegarde: $BACKUP"
