#!/bin/bash
# Sauvegarde RAPIDE de la base tlm.db, à lancer AVANT et APRÈS chaque correctif.
# (Le code est déjà versionné dans git ; ici on protège la donnée.)
# Usage :  ./backup-db.sh avant-fix-doublons
#          ./backup-db.sh apres-fix-doublons
# Copie dans /opt/backups ET /root/backups (double sécurité).

set -e
TS=$(date +%Y%m%d_%H%M%S)
LABEL="${1:-manuel}"
NAME="tlm-${TS}-${LABEL}.db"

mkdir -p /opt/backups /root/backups
docker cp touslesmatchs-api:/data/tlm.db "/opt/backups/${NAME}"
cp "/opt/backups/${NAME}" "/root/backups/${NAME}"

echo "✅ Sauvegarde OK : ${NAME}"
echo "   → /opt/backups/${NAME}"
echo "   → /root/backups/${NAME}"
ls -lh "/opt/backups/${NAME}"

# Rotation : garder les 30 dernières sauvegardes .db pour ne pas saturer le disque
ls -1t /opt/backups/tlm-*-*.db 2>/dev/null | tail -n +31 | xargs -r rm -f
ls -1t /root/backups/tlm-*-*.db 2>/dev/null | tail -n +31 | xargs -r rm -f
