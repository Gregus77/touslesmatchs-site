#!/bin/bash
set -e
echo "=== DEPLOIEMENT TousLesMatchs ==="
cd /opt/touslesmatchs

BRANCH="${DEPLOY_BRANCH:-claude/happy-bell-h9zj83}"

echo "[1/5] Pull derniere version (${BRANCH})..."
git fetch origin
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "[2/5] Installation dependances..."
npm install --silent

echo "[3/5] Build React..."
npm run build

echo "[4/5] Rebuild containers..."
docker compose build --no-cache site api hermes-admin
docker compose up -d site api hermes-admin

echo "[5/5] Verification..."
sleep 3
docker compose ps
echo ""
echo "=== TERMINE ==="
echo "Visite https://www.touslesmatchs.com pour verifier"
