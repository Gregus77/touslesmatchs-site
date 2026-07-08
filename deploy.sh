#!/bin/bash
# ============================================================
# TOUSLESMATCHS — Script de deploiement complet avec garde-fous
# ============================================================
set -euo pipefail

cd /opt/touslesmatchs

BRANCH=$(git branch --show-current)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/opt/touslesmatchs/.deploy-backups/$TIMESTAMP"

echo "================================================"
echo " TOUSLESMATCHS - Deploiement securise (LOCKDOWN V1.1)"
echo " Date: $(date)"
echo " Branche: $BRANCH"
echo "================================================"

# ── Phase -1: Installation garde-fous Git ───────────────────
if [ -f scripts/git-pre-commit-hook.sh ]; then
  cp scripts/git-pre-commit-hook.sh .git/hooks/pre-commit 2>/dev/null || true
  chmod +x .git/hooks/pre-commit 2>/dev/null || true
  echo "OK: Pre-commit hook installe"
fi

# ── Phase 0: Sauvegardes automatiques ────────────────────────
echo ""
echo "=== Phase 0: Sauvegardes ==="

mkdir -p "$BACKUP_DIR"

# Sauvegarde Git
git tag -f "deploy-backup-$TIMESTAMP" HEAD 2>/dev/null || true
echo "OK: Tag Git deploy-backup-$TIMESTAMP"

# Sauvegarde frontend
cp -r public/ "$BACKUP_DIR/public-backup/"
echo "OK: public/ sauvegarde"

# Sauvegarde docker-compose
cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.backup"
echo "OK: docker-compose.yml sauvegarde"

# Sauvegarde Caddyfile
cp Caddyfile "$BACKUP_DIR/Caddyfile.backup"
echo "OK: Caddyfile sauvegarde"

# Sauvegarde bases SQLite (si accessibles)
for DB_VOLUME in $(docker volume ls -q 2>/dev/null | grep -E "api_data|council_data" || true); do
  MOUNT=$(docker volume inspect "$DB_VOLUME" --format '{{.Mountpoint}}' 2>/dev/null || true)
  if [ -n "$MOUNT" ] && [ -d "$MOUNT" ]; then
    mkdir -p "$BACKUP_DIR/db/"
    cp "$MOUNT"/*.db "$BACKUP_DIR/db/" 2>/dev/null || true
    echo "OK: Bases SQLite sauvegardees depuis $DB_VOLUME"
  fi
done

echo "Sauvegardes dans: $BACKUP_DIR"

# ── Phase 1: Verifications pre-deploiement ───────────────────
echo ""
echo "=== Phase 1: Pre-deploy checks ==="
bash scripts/pre-deploy-check.sh || { echo "DEPLOIEMENT ANNULE"; exit 1; }

# ── Phase 1b: Signature frontend ─────────────────────────────
if [ -f scripts/verify-frontend-signature.sh ]; then
  echo ""
  echo "=== Phase 1b: Verification signature frontend ==="
  bash scripts/verify-frontend-signature.sh || { echo "DEPLOIEMENT ANNULE — signature invalide"; exit 1; }
fi

# ── Phase 2: Mise a jour du code ─────────────────────────────
echo ""
echo "=== Phase 2: Git pull ==="
git pull origin "$BRANCH"

# ── Phase 3: Build et redemarrage ────────────────────────────
echo ""
echo "=== Phase 3: Build et redemarrage ==="
docker compose up -d --build

echo ""
echo "Attente du demarrage des services (15s)..."
sleep 15

# ── Phase 4: Verifications post-deploiement ──────────────────
echo ""
echo "=== Phase 4: Post-deploy checks ==="
bash scripts/post-deploy-check.sh || {
  echo ""
  echo "=== DEPLOIEMENT SUSPECT — ROLLBACK AUTOMATIQUE ==="
  echo "Rollback vers backup: $TIMESTAMP"
  bash scripts/rollback.sh "$TIMESTAMP"
  exit 1
}

# ── Phase 5: Hermes Guardian ────────────────────────────────
echo ""
echo "=== Phase 5: Hermes Guardian ==="
if [ -f scripts/hermes-guardian.sh ]; then
  bash scripts/hermes-guardian.sh || {
    echo "=== GUARDIAN: ANOMALIES DETECTEES ==="
    echo "Rollback disponible: bash scripts/rollback.sh $TIMESTAMP"
    exit 1
  }
fi

echo ""
echo "================================================"
echo " Deploiement securise termine avec succes !"
echo " Site: https://touslesmatchs.com"
echo " Backup: $BACKUP_DIR"
echo " Lockdown: V1.1"
echo "================================================"
