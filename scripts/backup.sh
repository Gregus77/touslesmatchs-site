#!/bin/bash
# ── Sauvegarde automatique TousLesMatchs (code + bases de données) ─────────────
# Lancé 3x/jour par cron. Sauvegarde :
#   1) un tag git de l'état du code déployé, poussé sur GitHub
#   2) les bases SQLite (tlm.db = analyses, codes.db = clients) en local, avec rotation
# Rien n'est écrasé : chaque backup est horodaté.

set -u
REPO="/opt/touslesmatchs"
BACKUP_DIR="$REPO/backups"
KEEP=21   # 21 backups = 7 jours x 3/jour
TS="$(date +%Y-%m-%d-%Hh%M)"

cd "$REPO" || { echo "[backup] repo introuvable"; exit 1; }
mkdir -p "$BACKUP_DIR"

# 1) Snapshot du code (tag git de l'état actuel)
git tag "auto-save-$TS" >/dev/null 2>&1 && \
  git push origin "auto-save-$TS" >/dev/null 2>&1 && \
  echo "[backup] tag git auto-save-$TS poussé"

# 2) Sauvegarde des bases de données
# La base est bind-montée sur l'hôte (/opt/touslesmatchs/data) ; on copie directement
# depuis le disque hôte. Fallback docker cp si le bind-mount n'existe pas encore.
DATA_DIR="$REPO/data"
for name in tlm codes; do
  if [ -f "$DATA_DIR/$name.db" ]; then
    cp "$DATA_DIR/$name.db" "$BACKUP_DIR/$name-$TS.db" && echo "[backup] $name.db sauvegardé (hôte)"
  else
    docker cp "touslesmatchs-api:/data/$name.db" "$BACKUP_DIR/$name-$TS.db" >/dev/null 2>&1 && echo "[backup] $name.db sauvegardé (docker cp)"
  fi
done

# 3) Rotation : ne garder que les KEEP plus récents de chaque type
for prefix in tlm codes; do
  ls -1t "$BACKUP_DIR/$prefix-"*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
done
# Purge des vieux tags auto-save locaux (>7 jours) pour ne pas encombrer
git tag --list 'auto-save-*' | head -n -$KEEP | xargs -r -n1 git tag -d >/dev/null 2>&1

echo "[backup] $TS terminé — $(ls -1 "$BACKUP_DIR"/tlm-*.db 2>/dev/null | wc -l) snapshots DB conservés"
