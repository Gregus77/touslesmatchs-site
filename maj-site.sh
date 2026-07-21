#!/usr/bin/env bash
# Mise à jour du site TousLesMatchs — tout en une commande.
# Usage : bash maj-site.sh
# Fait : déverrouille (chattr) -> pull de la branche -> copie public/->site/
#        -> rebuild containers -> régénère le pick -> re-verrouille.

BRANCH="claude/tiktok-arjel-automation-hgp1tv"
ROOT="/opt/touslesmatchs"
cd "$ROOT" || exit 1

echo "🔓 Déverrouillage des fichiers du site..."
chattr -i "$ROOT/Caddyfile" 2>/dev/null
find "$ROOT/site" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) -exec chattr -i {} \; 2>/dev/null

echo "⬇️  Récupération de la dernière version..."
git fetch origin "$BRANCH"
git checkout FETCH_HEAD -- public scripts Caddyfile docker-compose.yml council 2>/dev/null
git checkout FETCH_HEAD -- public scripts 2>/dev/null

echo "📄 Copie public -> site..."
cp -r "$ROOT/public/." "$ROOT/site/"

echo "🐳 Rebuild des containers..."
docker compose up -d --build

echo "⏳ Démarrage (20s)..."
sleep 20

echo "🔄 Régénération du pick du jour..."
docker exec touslesmatchs-api sh -c 'rm -f /picks/picks.json' 2>/dev/null
curl -s http://localhost:3001/current-pick >/dev/null 2>&1

echo "🔒 Re-verrouillage contre Hermes..."
chattr +i "$ROOT/Caddyfile" 2>/dev/null
find "$ROOT/site" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) -exec chattr +i {} \; 2>/dev/null

echo ""
echo "✅ Mise à jour terminée. Pick du jour :"
curl -s http://localhost:3001/current-pick | head -c 200
echo ""
