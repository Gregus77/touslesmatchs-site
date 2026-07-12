#!/bin/bash
# ── Déploiement TousLesMatchs en une commande ─────────────────────────────────
# Fait TOUT dans le bon ordre pour éviter les oublis (notamment la synchro
# public/ → site/ qui sinon laisse le frontend en retard).
#
# Usage sur le VPS :  bash /opt/touslesmatchs/scripts/deploy.sh
set -e

REPO="/opt/touslesmatchs"
BRANCH="claude/touslesmatchs-smoke-test-7hlgum"
cd "$REPO"

echo "▶ 1/5 — Récupération du code (branche $BRANCH)…"
git pull origin "$BRANCH"

echo "▶ 2/5 — Reconstruction des images…"
docker compose up -d --build

echo "▶ 3/5 — Synchronisation du frontend (public/ → site/)…"
cp -a "$REPO/public/." "$REPO/site/"

echo "▶ 4/5 — Redémarrage du serveur web…"
docker restart touslesmatchs-site >/dev/null

echo "▶ 5/5 — Vérifications…"
sleep 4
echo -n "   API   : "; docker logs touslesmatchs-api --tail 40 2>&1 | grep -q "running on" && echo "OK" || echo "⚠️ vérifier les logs"
echo -n "   Accueil (octets) : "; curl -sk https://www.touslesmatchs.com | wc -c
echo -n "   Bankroll (octets) : "; curl -sk https://www.touslesmatchs.com/bankroll.html | wc -c

echo "✅ Déploiement terminé — $(date '+%H:%M')"
