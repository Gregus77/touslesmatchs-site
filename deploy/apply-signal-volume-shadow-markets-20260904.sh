#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/touslesmatchs
SOURCE_BRANCH=codex/increase-signals-shadow-markets-20260904
SOURCE_COMMIT=7406df769516c7096d3e5e02494660238afc8933
BACKUP="/opt/backups/tlm-signal-volume-shadow-$(date -u +%Y%m%dT%H%M%SZ)"
API="$ROOT/scripts/api_server.js"
COMPOSE="$ROOT/docker-compose.yml"
WORKER="$ROOT/scripts/shadow_tournament_worker.js"
ENV_FILE="$ROOT/.env"
RUNNER=/usr/local/sbin/tlm-shadow-tournament-run
SERVICE=/etc/systemd/system/tlm-shadow-tournament.service
TIMER=/etc/systemd/system/tlm-shadow-tournament.timer
CHANGED=0

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
  for target in "$API" "$COMPOSE" "$WORKER" "$ENV_FILE" "$RUNNER" "$SERVICE" "$TIMER"     "$ROOT/scripts/test_recovery_mode_20260902.js"     "$ROOT/scripts/verify_ou25_reliability_guard.js"     "$ROOT/scripts/test_signal_volume_shadow_markets_20260904.js"; do
    restore_one "$target"
  done
  systemctl daemon-reload >/dev/null 2>&1 || true
  docker compose up -d --build api >/dev/null 2>&1 || true
  echo "FAILED — correction annulée; sauvegarde=$BACKUP"
}
trap rollback EXIT

cd "$ROOT"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"

branch="$(git branch --show-current)"
upstream="$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || true)"
head="$(git rev-parse HEAD)"
remote="$(git remote get-url origin)"
echo "[baseline] branch=$branch head=$head upstream=$upstream remote=$remote"
git status --short --branch

[[ -n "$branch" && "$upstream" == "origin/agent/android-fcm-v107" ]]
[[ "$remote" == *"Gregus77/touslesmatchs-site"* ]]

for target in "$API" "$COMPOSE" "$WORKER" "$ENV_FILE" "$RUNNER" "$SERVICE" "$TIMER"   "$ROOT/scripts/test_recovery_mode_20260902.js"   "$ROOT/scripts/verify_ou25_reliability_guard.js"   "$ROOT/scripts/test_signal_volume_shadow_markets_20260904.js"; do
  name="$(printf '%s' "$target" | sed 's#/#__#g')"
  if [[ -f "$target" ]]; then
    cp -a "$target" "$BACKUP/$name.before"
  else
    : > "$BACKUP/$name.absent"
  fi
done
chmod 600 "$BACKUP"/* 2>/dev/null || true

git fetch origin "$SOURCE_BRANCH"
git cat-file -e "$SOURCE_COMMIT^{commit}"
tmpdir="$(mktemp -d /tmp/tlm-signal-volume.XXXXXX)"
trap 'rm -rf -- "$tmpdir"; rollback' EXIT

git show "$SOURCE_COMMIT:scripts/api_server.js" > "$tmpdir/target-api.js"
git show "$SOURCE_COMMIT:docker-compose.yml" > "$tmpdir/target-compose.yml"
for path in   scripts/shadow_tournament_worker.js   scripts/test_recovery_mode_20260902.js   scripts/verify_ou25_reliability_guard.js   scripts/test_signal_volume_shadow_markets_20260904.js; do
  git show "$SOURCE_COMMIT:$path" > "$tmpdir/$(basename "$path")"
done

node - "$API" "$tmpdir/target-api.js" <<'NODE'
const fs = require("fs");
const [currentPath, targetPath] = process.argv.slice(2);
let current = fs.readFileSync(currentPath, "utf8");
const target = fs.readFileSync(targetPath, "utf8");

function targetMatch(re, label) {
  const match = target.match(re);
  if (!match) throw new Error("cible absente: " + label);
  return match[0];
}
function replaceRequired(re, replacement, label) {
  if (!re.test(current)) throw new Error("ancre VPS absente: " + label);
  re.lastIndex = 0;
  current = current.replace(re, replacement);
}

const targetSeat = targetMatch(
  /  \/\/ Quatre réponses réelles suffisent[\s\S]*?const enoughOu25SeatsPresent = Number\(voteInfo\.vote_active \|\| 0\) >= CLIENT_OU25_MIN_VOTES;/,
  "quorum 4/5"
);
replaceRequired(
  /  (?:\/\/ Quatre réponses réelles suffisent[\s\S]*?)?const (?:five|enough)Ou25SeatsPresent = [^;]+;/,
  targetSeat,
  "présence sièges"
);
current = current.replaceAll("fiveOu25SeatsPresent", "enoughOu25SeatsPresent");

const targetRecoveryOk = targetMatch(
  /  \/\/ Le contrat Recovery est bien[\s\S]*?const ok = combinedAligned && liveAligned\n    && indicators\.length >= RECOVERY_MIN_CONVERGENT_INDICATORS;/,
  "Recovery 3 indicateurs"
);
replaceRequired(
  /  (?:\/\/ Le contrat Recovery est bien[\s\S]*?)?const ok = [\s\S]*?indicators\.length >= RECOVERY_MIN_CONVERGENT_INDICATORS;/,
  targetRecoveryOk,
  "condition Recovery"
);

const targetProfile = targetMatch(
  /async function fetchRecoveryRecentGoalProfile\(match, teamId, venue\) \{[\s\S]*?\n\}\n\n(?=async function evaluateRecoveryEvidence)/,
  "historique 6-8 multi-saison"
);
replaceRequired(
  /async function fetchRecoveryRecentGoalProfile\(match, teamId, venue\) \{[\s\S]*?\n\}\n\n(?=async function evaluateRecoveryEvidence)/,
  targetProfile,
  "historique Recovery"
);

const scalarPatterns = [
  [/const CLIENT_OU25_MIN_VOTES = \d+;/, /const CLIENT_OU25_MIN_VOTES = \d+;/, "votes"],
  [/const CLIENT_OU25_MIN_CONFIDENCE = [^;]+;/, /const CLIENT_OU25_MIN_CONFIDENCE = [^;]+;/, "confiance"],
  [/function getSignalFloor\(\) \{ return \d+; \}/, /function getSignalFloor\(\) \{ return \d+; \}/, "plancher"],
  [/const TIER_MIN_REAL_ODD = [^;]+;/, /const TIER_MIN_REAL_ODD = [^;]+;/, "cote mini"],
  [/const TIER_MAX_REAL_ODD = [^;]+;/, /const TIER_MAX_REAL_ODD = [^;]+;/, "cote maxi"],
  [/const MIN_PLAYABLE_ODD = [^;]+;/, /const MIN_PLAYABLE_ODD = [^;]+;/, "jouable mini"],
  [/const MAX_PLAYABLE_ODD = [^;]+;/, /const MAX_PLAYABLE_ODD = [^;]+;/, "jouable maxi"],
  [/const CLIENT_OU25_CLIENT_MAX_MINUTE = Math\.min\([\s\S]*?\n\);/, /const CLIENT_OU25_CLIENT_MAX_MINUTE = Math\.min\([\s\S]*?\n\);/, "fenêtre live"],
];
for (const [currentRe, targetRe, label] of scalarPatterns) {
  replaceRequired(currentRe, targetMatch(targetRe, label), label);
}

if (/fiveOu25SeatsPresent/.test(current)) throw new Error("ancien verrou 5 réponses encore présent");
if (!/CLIENT_OU25_MIN_CONFIDENCE = Math\.max\(77,/.test(current)) throw new Error("confiance 77 non appliquée");
if (!/TIER_MIN_REAL_ODD = Math\.max\(1\.30,/.test(current)) throw new Error("cote mini 1.30 non appliquée");
if (!/TIER_MAX_REAL_ODD = Math\.min\(2\.10,/.test(current)) throw new Error("cote maxi 2.10 non appliquée");
new Function(current);
fs.writeFileSync(currentPath, current);
NODE

node - "$COMPOSE" <<'NODE'
const fs = require("fs");
const path = process.argv[2];
let text = fs.readFileSync(path, "utf8");
const desired = {
  CLIENT_OU25_MIN_CONFIDENCE: "      - CLIENT_OU25_MIN_CONFIDENCE=${CLIENT_OU25_MIN_CONFIDENCE:-77}",
  CLIENT_OU25_CLIENT_MAX_MINUTE: "      - CLIENT_OU25_CLIENT_MAX_MINUTE=${CLIENT_OU25_CLIENT_MAX_MINUTE:-40}",
  OU25_RECOVERY_MODE: "      - OU25_RECOVERY_MODE=${OU25_RECOVERY_MODE:-1}",
  OU25_RECOVERY_MAX_DAILY_SIGNALS: "      - OU25_RECOVERY_MAX_DAILY_SIGNALS=${OU25_RECOVERY_MAX_DAILY_SIGNALS:-2}",
  TIER_MIN_REAL_ODD: "      - TIER_MIN_REAL_ODD=${TIER_MIN_REAL_ODD:-1.30}",
  TIER_MAX_REAL_ODD: "      - TIER_MAX_REAL_ODD=${TIER_MAX_REAL_ODD:-2.10}",
  MIN_PLAYABLE_ODD: "      - MIN_PLAYABLE_ODD=${MIN_PLAYABLE_ODD:-1.30}",
  MAX_PLAYABLE_ODD: "      - MAX_PLAYABLE_ODD=${MAX_PLAYABLE_ODD:-2.10}",
};
const early = ["CLIENT_OU25_MIN_CONFIDENCE","CLIENT_OU25_CLIENT_MAX_MINUTE","OU25_RECOVERY_MODE","OU25_RECOVERY_MAX_DAILY_SIGNALS"];
for (const key of Object.keys(desired)) {
  const re = new RegExp("^\\s*- " + key + "=.*$", "m");
  if (re.test(text)) text = text.replace(re, desired[key]);
}
const missingEarly = early.filter(key => !new RegExp("^\\s*- " + key + "=", "m").test(text));
if (missingEarly.length) {
  const anchor = /^\s*- SHADOW_DAILY_CAP=.*$/m;
  if (!anchor.test(text)) throw new Error("ancre compose SHADOW_DAILY_CAP absente");
  text = text.replace(anchor, m => m + "\n" + missingEarly.map(key => desired[key]).join("\n"));
}
for (const key of Object.keys(desired)) {
  if (!new RegExp("^\\s*- " + key + "=", "m").test(text)) throw new Error("variable compose absente: " + key);
}
fs.writeFileSync(path, text);
NODE

install -m 750 "$tmpdir/shadow_tournament_worker.js" "$WORKER"
install -m 750 "$tmpdir/test_recovery_mode_20260902.js" "$ROOT/scripts/test_recovery_mode_20260902.js"
install -m 750 "$tmpdir/verify_ou25_reliability_guard.js" "$ROOT/scripts/verify_ou25_reliability_guard.js"
install -m 750 "$tmpdir/test_signal_volume_shadow_markets_20260904.js" "$ROOT/scripts/test_signal_volume_shadow_markets_20260904.js"

if [[ -f "$ENV_FILE" ]]; then
  node - "$ENV_FILE" <<'NODE'
const fs = require("fs");
const path = process.argv[2];
let text = fs.readFileSync(path, "utf8");
const values = {
  CLIENT_OU25_MIN_CONFIDENCE: "77",
  CLIENT_OU25_CLIENT_MAX_MINUTE: "40",
  OU25_RECOVERY_MODE: "1",
  OU25_RECOVERY_MAX_DAILY_SIGNALS: "2",
  TIER_MIN_REAL_ODD: "1.30",
  TIER_MAX_REAL_ODD: "2.10",
  MIN_PLAYABLE_ODD: "1.30",
  MAX_PLAYABLE_ODD: "2.10",
};
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  const re = new RegExp("^" + key + "=.*$", "m");
  text = re.test(text) ? text.replace(re, line) : text.replace(/\s*$/, "\n" + line + "\n");
}
fs.writeFileSync(path, text, { mode: 0o600 });
NODE
fi

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
Description=TousLesMatchs tournoi IA et marchés à blanc
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
Description=Lance le tournoi IA et marchés à blanc toutes les dix minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=10min
Persistent=true
Unit=tlm-shadow-tournament.service

[Install]
WantedBy=timers.target
TIMER

CHANGED=1
node --check "$API"
node --check "$WORKER"
node scripts/test_recovery_mode_20260902.js
node scripts/verify_ou25_reliability_guard.js
node scripts/test_signal_volume_shadow_markets_20260904.js
docker compose config -q
docker compose up -d --build api

for _ in $(seq 1 30); do
  if docker inspect -f '{{.State.Running}}' touslesmatchs-api 2>/dev/null | grep -qx true     && curl -fsS http://127.0.0.1:3001/health >/dev/null; then
    break
  fi
  sleep 2
done

docker exec touslesmatchs-api node --check /app/server.js
docker exec touslesmatchs-api node - <<'NODE'
const fs = require("fs");
const s = fs.readFileSync("/app/server.js", "utf8");
const checks = [
  /CLIENT_OU25_MIN_VOTES = 4;/,
  /CLIENT_OU25_MIN_CONFIDENCE = Math\.max\(77,/,
  /TIER_MIN_REAL_ODD = Math\.max\(1\.30,/,
  /TIER_MAX_REAL_ODD = Math\.min\(2\.10,/,
  /enoughOu25SeatsPresent = Number\(voteInfo\.vote_active \|\| 0\) >= CLIENT_OU25_MIN_VOTES;/,
  /const ok = combinedAligned && liveAligned[\s\S]{0,100}RECOVERY_MIN_CONVERGENT_INDICATORS;/,
  /fetchSeasonRows\(numericSeason - 1\)/,
];
if (!checks.every(re => re.test(s)) || /fiveOu25SeatsPresent/.test(s)) process.exit(1);
console.log("RUNTIME_OK — 4/5 · 77% · cotes 1.30-2.10 · Recovery 3 indicateurs · historique multi-saison");
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

curl -fsS http://127.0.0.1:3001/health >/dev/null
curl -fsS https://www.touslesmatchs.com/api/health >/dev/null
if docker logs touslesmatchs-api --since 2m 2>&1 | grep -Eiq 'SyntaxError|ReferenceError|Cannot find module|Restarting'; then
  echo "Erreur récente détectée dans les logs API"
  exit 1
fi

rm -rf -- "$tmpdir"
CHANGED=0
trap - EXIT
echo "OK — volume O/U 2,5 corrigé et marchés shadow actifs sans Telegram"
echo "Règles: 4/5 · confiance 77% · cotes 1.30-2.10 · live 15-40 · maximum Recovery 2/jour"
echo "Shadow: 10 IA · O/U 1.5 · O/U 3.5 · BTTS · promotion automatique désactivée"
echo "Sauvegarde: $BACKUP"
