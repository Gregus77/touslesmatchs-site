#!/bin/bash
set -e
echo "=== DEPLOIEMENT TousLesMatchs ==="
cd /opt/touslesmatchs

echo "[1/5] Pull derniere version..."
git fetch origin
git checkout claude/busy-bardeen-793p0k
git pull origin claude/busy-bardeen-793p0k

echo "[2/5] Installation dependances..."
npm install --silent

echo "[3/5] Build React..."
npm run build

echo "[4/5] Rebuild containers..."
docker compose build --no-cache site api
docker compose up -d

echo "[5/5] Verification..."
sleep 3
docker compose ps
echo ""
echo "=== TERMINE ==="
echo "Visite https://www.touslesmatchs.com pour verifier"
