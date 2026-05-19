#!/bin/bash
# ============================================================
# HERMES COUNCIL — Script de déploiement sur VPS Hostinger
# ============================================================
set -e

echo "================================================"
echo " HERMES COUNCIL - Déploiement"
echo "================================================"

# Vérifier que .env existe
if [ ! -f ".env" ]; then
  echo "❌ ERREUR: Fichier .env manquant!"
  echo "   Copie .env.example en .env et remplis tes clés API"
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

# Vérifier les clés essentielles
if grep -q "ANTHROPIC_API_KEY=sk-ant-XXXXXX" .env; then
  echo "⚠️  ATTENTION: La clé Anthropic n'est pas configurée dans .env"
fi

echo ""
echo "1. Arrêt des conteneurs existants..."
docker compose down --remove-orphans 2>/dev/null || true

echo "2. Build de l'image council..."
docker compose build --no-cache council

echo "3. Démarrage des services..."
docker compose up -d

echo ""
echo "4. Vérification du démarrage..."
sleep 5
docker compose ps

echo ""
echo "================================================"
echo " Déploiement terminé !"
echo " Site disponible sur http://$(hostname -I | awk '{print $1}')"
echo ""
echo " Commandes utiles :"
echo "  Voir les logs du conseil : docker compose logs -f council"
echo "  Tester le conseil manuellement : docker compose exec council python /app/council/hermes.py"
echo "  Forcer une mise à jour : docker compose exec council python /app/council/hermes.py"
echo "================================================"
