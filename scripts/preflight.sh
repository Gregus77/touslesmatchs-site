#!/bin/bash
# preflight.sh — Verification de securite avant toute modification
# Usage: bash scripts/preflight.sh
# Retourne 0 si tout est OK, 1 si des problemes critiques sont detectes

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ERRORS=0

echo "========================================"
echo "  PREFLIGHT CHECK — TousLesMatchs"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# 1. Docker services
echo "--- Docker Services ---"
for svc in touslesmatchs-site touslesmatchs-api touslesmatchs-council touslesmatchs-hermes-admin; do
  status=$(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null)
  if [ "$status" = "running" ]; then
    echo -e "  ${GREEN}OK${NC} $svc: running"
  elif [ -z "$status" ]; then
    echo -e "  ${YELLOW}WARN${NC} $svc: not found (pas sur le VPS ?)"
  else
    echo -e "  ${RED}FAIL${NC} $svc: $status"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# 2. API health
echo "--- API Health ---"
api_resp=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/live-matches 2>/dev/null)
if [ "$api_resp" = "200" ]; then
  echo -e "  ${GREEN}OK${NC} API /live-matches: 200"
else
  echo -e "  ${YELLOW}WARN${NC} API /live-matches: HTTP $api_resp (API pas accessible localement)"
fi

pick_resp=$(curl -s --max-time 5 http://localhost:3001/current-pick 2>/dev/null)
if echo "$pick_resp" | grep -q '"ok"'; then
  echo -e "  ${GREEN}OK${NC} API /current-pick: repond"
else
  echo -e "  ${YELLOW}WARN${NC} API /current-pick: pas de reponse"
fi
echo ""

# 3. Preflight endpoint (etat complet)
echo "--- Preflight System Status ---"
preflight=$(curl -s --max-time 10 http://localhost:3001/admin/preflight 2>/dev/null)
if echo "$preflight" | grep -q '"status"'; then
  sys_status=$(echo "$preflight" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
  if [ "$sys_status" = "HEALTHY" ]; then
    echo -e "  ${GREEN}OK${NC} System status: HEALTHY"
  else
    echo -e "  ${RED}FAIL${NC} System status: $sys_status"
    warnings=$(echo "$preflight" | python3 -c "import sys,json; [print(f'    - {w}') for w in json.load(sys.stdin).get('warnings',[])]" 2>/dev/null)
    [ -n "$warnings" ] && echo "$warnings"
    ERRORS=$((ERRORS + 1))
  fi

  # Extraire stats cles
  echo "$preflight" | python3 -c "
import sys, json
d = json.load(sys.stdin)
h = d.get('checks',{}).get('history',{})
if h.get('ok'):
    print(f\"  Analyses: {h.get('total',0)} total, {h.get('wins',0)}W/{h.get('losses',0)}L, {h.get('pending',0)} pending, WR={h.get('winrate','?')}%\")
l = d.get('checks',{}).get('live',{})
if l.get('ok') is not None:
    print(f\"  Live: {l.get('total_from_api',0)} matchs API, {l.get('after_filter',0)} apres filtre, {l.get('blocked',0)} bloques\")
f = d.get('checks',{}).get('filters',{})
print(f\"  Filtres: {f.get('trusted_count','?')} TRUSTED, {f.get('low_trust_count','?')} LOW_TRUST\")
le = d.get('checks',{}).get('learning_engine',{})
if le.get('ok') is False:
    print(f\"  ${RED}ALERTE LEARNING ENGINE: dependance circulaire${NC}\")
" 2>/dev/null
else
  echo -e "  ${YELLOW}WARN${NC} Endpoint /admin/preflight pas accessible"
fi
echo ""

# 4. Git state
echo "--- Git State ---"
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
echo "  Branch: $branch"
last_commit=$(git log --oneline -1 2>/dev/null)
echo "  Last commit: $last_commit"
uncommitted=$(git status --porcelain 2>/dev/null | wc -l)
if [ "$uncommitted" -gt 0 ]; then
  echo -e "  ${YELLOW}WARN${NC} $uncommitted fichiers non commites"
else
  echo -e "  ${GREEN}OK${NC} Working tree clean"
fi
echo ""

# 5. Fichiers critiques existent
echo "--- Critical Files ---"
for f in scripts/api_server.js docker-compose.yml Caddyfile council/hermes.py council/scheduler.py council/tools/telegram_bot.py council/tools/history_db.py council/tools/sports_api.py public/index.html public/live-ia.html; do
  if [ -f "$f" ]; then
    echo -e "  ${GREEN}OK${NC} $f"
  else
    echo -e "  ${RED}FAIL${NC} $f MANQUANT"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# 6. Env vars (presence, pas les valeurs)
echo "--- Env Vars (presence) ---"
if [ -f .env ]; then
  for var in API_FOOTBALL_KEY DEEPSEEK_API_KEY GROQ_API_KEY GOOGLE_API_KEY MISTRAL_API_KEY STRIPE_SECRET_KEY TELEGRAM_BOT_TOKEN TELEGRAM_CHANNEL_ID TELEGRAM_ADMIN_CHAT_ID; do
    if grep -q "^${var}=" .env 2>/dev/null; then
      val=$(grep "^${var}=" .env | cut -d= -f2-)
      if [ -n "$val" ] && [ "$val" != '""' ] && [ "$val" != "''" ]; then
        echo -e "  ${GREEN}OK${NC} $var: set"
      else
        echo -e "  ${RED}FAIL${NC} $var: empty"
        ERRORS=$((ERRORS + 1))
      fi
    else
      echo -e "  ${YELLOW}WARN${NC} $var: absent du .env"
    fi
  done
else
  echo -e "  ${YELLOW}WARN${NC} .env non trouve (normal hors VPS)"
fi
echo ""

# Resume
echo "========================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "  ${GREEN}PREFLIGHT OK${NC} — Aucun probleme critique"
  echo "  Modifications autorisees."
else
  echo -e "  ${RED}PREFLIGHT FAIL${NC} — $ERRORS probleme(s) critique(s)"
  echo "  Corriger avant de modifier le code."
fi
echo "========================================"

exit $ERRORS
