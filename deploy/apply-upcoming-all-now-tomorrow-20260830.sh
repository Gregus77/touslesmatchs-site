#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
PATCH="deploy/upcoming-all-now-tomorrow-20260830.patch"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-upcoming-$STAMP"

mkdir -p "$BACKUP"
cp -a public/index.html scripts/api_server.js "$BACKUP/"

echo "[1/5] Vérification du correctif"
git apply --check "$PATCH"

echo "[2/5] Application"
git apply "$PATCH"

echo "[3/5] Vérification syntaxe API"
node --check scripts/api_server.js

echo "[4/5] Reconstruction API"
docker compose up -d --build api

echo "[5/5] Contrôle"
sleep 3
curl -fsS http://127.0.0.1:3001/upcoming-picks | python3 -c 'import json,sys; d=json.load(sys.stdin); print("OK", len(d.get("fixtures",[])), "matchs à venir", len(d.get("picks",[])), "picks")'
curl -fsS https://www.touslesmatchs.com/ >/dev/null

echo "TERMINÉ — sauvegarde : $BACKUP"
