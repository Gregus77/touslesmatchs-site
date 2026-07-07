#!/bin/bash
# ============================================================
# TOUSLESMATCHS — Script de deploiement complet
# ============================================================
set -euo pipefail

cd /opt/touslesmatchs

echo "================================================"
echo " TOUSLESMATCHS - Deploiement"
echo " Date: $(date)"
echo " Branche: $(git branch --show-current)"
echo "================================================"

# Pre-deploy check
echo ""
echo "=== Phase 1: Verifications pre-deploiement ==="
bash scripts/pre-deploy-check.sh || { echo "DEPLOIEMENT ANNULE"; exit 1; }

# Pull latest code
echo ""
echo "=== Phase 2: Mise a jour du code ==="
git pull origin "$(git branch --show-current)"

# Build + restart all services
echo ""
echo "=== Phase 3: Build et redemarrage ==="
docker compose up -d --build

# Wait for services
echo ""
echo "Attente du demarrage des services (15s)..."
sleep 15

# Post-deploy check
echo ""
echo "=== Phase 4: Verifications post-deploiement ==="
bash scripts/post-deploy-check.sh || {
  echo ""
  echo "DEPLOIEMENT SUSPECT — verifier manuellement"
  echo "Rollback: git checkout backup-pre-mission-001 && docker compose up -d --build"
  exit 1
}

echo ""
echo "================================================"
echo " Deploiement termine avec succes !"
echo " Site: https://touslesmatchs.com"
echo "================================================"
