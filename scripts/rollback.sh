#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: bash scripts/rollback.sh <timestamp>"
  echo ""
  echo "Backups disponibles:"
  ls -1 /opt/touslesmatchs/.deploy-backups/ 2>/dev/null || echo "  Aucun backup trouve"
  echo ""
  echo "Ou rollback Git vers un tag:"
  git tag -l 'deploy-backup-*' --sort=-creatordate | head -5
  exit 1
fi

TIMESTAMP="$1"
BACKUP_DIR="/opt/touslesmatchs/.deploy-backups/$TIMESTAMP"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERREUR: Backup $BACKUP_DIR introuvable"
  exit 1
fi

echo "=== ROLLBACK vers $TIMESTAMP ==="

cd /opt/touslesmatchs

# Restaurer frontend
if [ -d "$BACKUP_DIR/public-backup" ]; then
  cp -r "$BACKUP_DIR/public-backup/"* public/
  echo "OK: Frontend restaure"
fi

# Restaurer docker-compose
if [ -f "$BACKUP_DIR/docker-compose.yml.backup" ]; then
  cp "$BACKUP_DIR/docker-compose.yml.backup" docker-compose.yml
  echo "OK: docker-compose.yml restaure"
fi

# Restaurer Caddyfile
if [ -f "$BACKUP_DIR/Caddyfile.backup" ]; then
  cp "$BACKUP_DIR/Caddyfile.backup" Caddyfile
  echo "OK: Caddyfile restaure"
fi

# Rollback Git
TAG="deploy-backup-$TIMESTAMP"
if git tag -l "$TAG" | grep -q "$TAG"; then
  git checkout "$TAG"
  echo "OK: Git checkout $TAG"
fi

# Rebuild
echo "Rebuild des services..."
docker compose up -d --build
sleep 15

# Verification
bash scripts/post-deploy-check.sh && echo "=== ROLLBACK TERMINE ===" || echo "=== ROLLBACK APPLIQUE — verifier manuellement ==="
