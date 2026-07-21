#!/bin/bash
# Sauvegarde automatique de TousLesMatchs — data (bases SQLite), site, code.
# Rotation : conserve les 7 dernières sauvegardes. Lancé chaque nuit par cron.
set -e
BACKUP_DIR="/opt/backups"
STAMP="$(date +%Y%m%d_%H%M)"
mkdir -p "$BACKUP_DIR"

# Archive complète (hors node_modules, trop lourd et régénérable)
tar czf "$BACKUP_DIR/tlm-$STAMP.tar.gz" \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  -C /opt touslesmatchs

# Rotation : ne garder que les 7 archives les plus récentes
ls -1t "$BACKUP_DIR"/tlm-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "✅ Sauvegarde $STAMP terminée :"
ls -lh "$BACKUP_DIR"/tlm-*.tar.gz | tail -3
