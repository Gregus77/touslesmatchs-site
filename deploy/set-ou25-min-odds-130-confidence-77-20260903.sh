#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/touslesmatchs

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/tlm-ou25-130-77-${STAMP}"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"

cp scripts/api_server.js "$BACKUP/api_server.js"
ENV_EXISTED=0
if [ -f .env ]; then
  ENV_EXISTED=1
  cp .env "$BACKUP/.env"
  chmod 600 "$BACKUP/.env"
else
  : > .env
  chmod 600 .env
fi

rollback() {
  local status=$?
  echo "[rollback] echec detecte, restauration..."
  cp "$BACKUP/api_server.js" scripts/api_server.js
  if [ "$ENV_EXISTED" = "1" ]; then
    cp "$BACKUP/.env" .env
    chmod 600 .env
  else
    rm -f .env
  fi
  docker compose up -d --build --force-recreate api >/dev/null 2>&1 || true
  echo "FAILED — restauration terminee; sauvegarde=$BACKUP"
  exit "$status"
}
trap rollback ERR

python3 - <<'PY'
from pathlib import Path

path = Path("scripts/api_server.js")
text = path.read_text(encoding="utf-8")

changes = [
    (
        "const TIER_MIN_REAL_ODD = Math.max(1.40, Number(process.env.TIER_MIN_REAL_ODD || 1.40));",
        "const TIER_MIN_REAL_ODD = Math.max(1.30, Number(process.env.TIER_MIN_REAL_ODD || 1.30));",
    ),
    (
        "function getSignalFloor() { return 78; }",
        "function getSignalFloor() { return 77; }",
    ),
    (
        "const CLIENT_OU25_MIN_CONFIDENCE = Math.max(78, Number(process.env.CLIENT_OU25_MIN_CONFIDENCE || 78));",
        "const CLIENT_OU25_MIN_CONFIDENCE = Math.max(77, Number(process.env.CLIENT_OU25_MIN_CONFIDENCE || 77));",
    ),
]

for old, new in changes:
    old_count = text.count(old)
    new_count = text.count(new)
    if old_count == 1 and new_count == 0:
        text = text.replace(old, new)
    elif old_count == 0 and new_count == 1:
        pass
    else:
        raise SystemExit(f"preuve source ambigue: old={old_count}, new={new_count}, cible={old}")

path.write_text(text, encoding="utf-8")

env_path = Path(".env")
lines = env_path.read_text(encoding="utf-8").splitlines()
wanted = {
    "TIER_MIN_REAL_ODD": "1.30",
    "CLIENT_OU25_MIN_CONFIDENCE": "77",
}
seen = set()
out = []
for line in lines:
    stripped = line.lstrip()
    if stripped.startswith("#") or "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in wanted:
        if key not in seen:
            out.append(f"{key}={wanted[key]}")
            seen.add(key)
    else:
        out.append(line)
for key, value in wanted.items():
    if key not in seen:
        out.append(f"{key}={value}")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

chmod 600 .env
node --check scripts/api_server.js

docker compose up -d --build --force-recreate api

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -fsS http://127.0.0.1:3001/health >/dev/null
curl -fsS "https://www.touslesmatchs.com/api/health?verify=${STAMP}" >/dev/null

docker compose exec -T api node <<'NODE'
const fs = require("fs");
const src = fs.readFileSync("/app/server.js", "utf8");
const checks = {
  cote_minimale: src.includes("const TIER_MIN_REAL_ODD = Math.max(1.30, Number(process.env.TIER_MIN_REAL_ODD || 1.30));"),
  confiance_globale: src.includes("function getSignalFloor() { return 77; }"),
  confiance_ou25: src.includes("const CLIENT_OU25_MIN_CONFIDENCE = Math.max(77, Number(process.env.CLIENT_OU25_MIN_CONFIDENCE || 77));"),
  env_cote: process.env.TIER_MIN_REAL_ODD === "1.30",
  env_confiance: process.env.CLIENT_OU25_MIN_CONFIDENCE === "77",
};
console.log(JSON.stringify(checks, null, 2));
if (Object.values(checks).some(v => !v)) process.exit(1);
NODE

if docker compose logs --since 3m api 2>&1 | grep -Eiq 'SyntaxError|ReferenceError|uncaughtException|CRASH-GUARD'; then
  echo "FAILED — erreur recente detectee dans les logs API"
  exit 1
fi

trap - ERR
echo "OK — cote minimale 1.30 et confiance minimale 77/100 actives"
echo "Consensus, Mode Recovery, ligues, fenetre live et cote maximale inchanges"
echo "Sauvegarde: $BACKUP"
