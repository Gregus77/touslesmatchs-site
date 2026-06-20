#!/bin/bash
# Diagnostic complet TousLesMatchs - à exécuter depuis Hermès

echo "======================================================"
echo "  DIAGNOSTIC COMPLET TOUSLESMATCHS - $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

# ─── 1. Variables d'environnement ───────────────────────────────────────────
echo ""
echo "── 1. VARIABLES D'ENVIRONNEMENT ──"
check_var() {
  local name=$1
  local val="${!name}"
  if [ -z "$val" ]; then
    echo "  ❌ $name = (manquant)"
  else
    local masked="${val:0:6}****${val: -3}"
    echo "  ✅ $name = $masked"
  fi
}

check_var GROQ_API_KEY
check_var DEEPSEEK_API_KEY
check_var FOOTBALL_DATA_KEY
check_var FOOTBALL_DATA_API_KEY
check_var API_SPORTS_KEY
check_var STRIPE_SECRET_KEY
check_var STRIPE_PRICE_ID_PREMIUM
check_var STRIPE_PRICE_ID_VIP
check_var STRIPE_PRICE_ID_ELITE
check_var STRIPE_WEBHOOK_SECRET
check_var JWT_SECRET
check_var TELEGRAM_BOT_TOKEN
check_var HERMES_ADMIN_TLM_BOT
check_var TELEGRAM_ADMIN_CHAT_ID
check_var BREVO_API_KEY

# ─── 2. Fichiers clés ───────────────────────────────────────────────────────
echo ""
echo "── 2. FICHIERS CLÉS ──"
check_file() {
  local path=$1
  if [ -f "$path" ]; then
    local size=$(wc -c < "$path")
    local mtime=$(stat -c '%y' "$path" 2>/dev/null | cut -d'.' -f1)
    echo "  ✅ $path ($size octets, modifié: $mtime)"
  else
    echo "  ❌ $path (introuvable)"
  fi
}

check_file /opt/touslesmatchs/public/data/picks.json
check_file /var/touslesmatchs/live_score.json
check_file /var/touslesmatchs/current_pick.json
check_file /opt/touslesmatchs/.env

# ─── 3. Contenu picks.json ──────────────────────────────────────────────────
echo ""
echo "── 3. CONTENU picks.json ──"
PICKS_FILE="/opt/touslesmatchs/public/data/picks.json"
if [ -f "$PICKS_FILE" ]; then
  # Vérifie JSON valide
  if python3 -c "import json,sys; json.load(open('$PICKS_FILE'))" 2>/dev/null; then
    echo "  ✅ JSON valide"
    python3 - <<'PYEOF'
import json
with open("/opt/touslesmatchs/public/data/picks.json") as f:
    d = json.load(f)
p = d.get("currentPick", {})
print(f"  📅 Date    : {p.get('date','?')}")
print(f"  ⚽ Match   : {p.get('home','?')} vs {p.get('away','?')}")
print(f"  🏆 Ligue   : {p.get('league') or p.get('sport','?')}")
print(f"  🕐 Heure   : {p.get('time','?')}")
print(f"  🎯 Prono   : {p.get('prono','?')}")
print(f"  💰 Cote    : {p.get('cote','?')}")
print(f"  📊 Statut  : {p.get('status','?')}")
print(f"  🔢 Score   : {p.get('score','?')}")
hist = d.get("history", [])
print(f"  📚 Historique : {len(hist)} entrée(s)")
PYEOF
  else
    echo "  ❌ JSON invalide !"
    head -5 "$PICKS_FILE"
  fi
else
  echo "  ❌ Fichier introuvable"
fi

# ─── 4. Contenu live_score.json ────────────────────────────────────────────
echo ""
echo "── 4. SCORE MANUEL (live_score.json) ──"
LS_FILE="/var/touslesmatchs/live_score.json"
if [ -f "$LS_FILE" ]; then
  echo "  Contenu: $(cat $LS_FILE)"
else
  echo "  (aucun score manuel défini)"
fi

# ─── 5. Conteneurs Docker ───────────────────────────────────────────────────
echo ""
echo "── 5. CONTENEURS DOCKER ──"
if command -v docker &>/dev/null; then
  for name in touslesmatchs-site touslesmatchs-api touslesmatchs-bot touslesmatchs-hermes-admin; do
    status=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null)
    if [ -z "$status" ]; then
      echo "  ❌ $name = introuvable"
    elif [ "$status" = "running" ]; then
      uptime=$(docker inspect --format '{{.State.StartedAt}}' "$name" 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ' | cut -d'.' -f1)
      echo "  ✅ $name = running (depuis $uptime)"
    else
      echo "  ⚠️  $name = $status"
    fi
  done
else
  echo "  ⚠️  Docker non accessible depuis ce contexte"
fi

# ─── 6. API football-data.org ───────────────────────────────────────────────
echo ""
echo "── 6. API FOOTBALL-DATA.ORG ──"
FD_KEY="${FOOTBALL_DATA_KEY:-$FOOTBALL_DATA_API_KEY}"
if [ -z "$FD_KEY" ]; then
  echo "  ❌ Clé manquante (FOOTBALL_DATA_KEY)"
else
  TODAY=$(date +%Y-%m-%d)
  YESTERDAY=$(date -d 'yesterday' +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null)

  # Test live
  LIVE_RESP=$(curl -s -w "\nHTTP:%{http_code}" \
    -H "X-Auth-Token: $FD_KEY" \
    "https://api.football-data.org/v4/matches?status=LIVE" 2>/dev/null)
  LIVE_CODE=$(echo "$LIVE_RESP" | grep 'HTTP:' | cut -d: -f2)
  LIVE_BODY=$(echo "$LIVE_RESP" | grep -v 'HTTP:')

  if [ "$LIVE_CODE" = "200" ]; then
    LIVE_COUNT=$(echo "$LIVE_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('matches',[])))" 2>/dev/null)
    echo "  ✅ LIVE → HTTP 200, $LIVE_COUNT match(s) en direct"
    if [ "$LIVE_COUNT" -gt 0 ] 2>/dev/null; then
      echo "$LIVE_BODY" | python3 - <<'PYEOF'
import json,sys
d = json.load(sys.stdin)
for m in d.get("matches", [])[:5]:
    home = m["homeTeam"]["name"]
    away = m["awayTeam"]["name"]
    fh = m.get("score",{}).get("fullTime",{})
    sh = m.get("score",{}).get("halfTime",{})
    print(f"    {home} {fh.get('home','?')}-{fh.get('away','?')} {away} [{m.get('status')}]")
PYEOF
    fi
  elif [ "$LIVE_CODE" = "429" ]; then
    echo "  ⚠️  LIVE → HTTP 429 (quota dépassé)"
  else
    echo "  ❌ LIVE → HTTP $LIVE_CODE"
  fi

  # Test finished hier+aujourd'hui
  FINISHED_RESP=$(curl -s -w "\nHTTP:%{http_code}" \
    -H "X-Auth-Token: $FD_KEY" \
    "https://api.football-data.org/v4/matches?status=FINISHED&dateFrom=${YESTERDAY}&dateTo=${TODAY}" 2>/dev/null)
  FINISHED_CODE=$(echo "$FINISHED_RESP" | grep 'HTTP:' | cut -d: -f2)
  FINISHED_BODY=$(echo "$FINISHED_RESP" | grep -v 'HTTP:')

  if [ "$FINISHED_CODE" = "200" ]; then
    FIN_COUNT=$(echo "$FINISHED_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('matches',[])))" 2>/dev/null)
    echo "  ✅ FINISHED ($YESTERDAY→$TODAY) → HTTP 200, $FIN_COUNT match(s)"
    if [ "$FIN_COUNT" -gt 0 ] 2>/dev/null; then
      echo "$FINISHED_BODY" | python3 - <<'PYEOF'
import json,sys
d = json.load(sys.stdin)
for m in d.get("matches", [])[:10]:
    home = m["homeTeam"]["name"]
    away = m["awayTeam"]["name"]
    fh = m.get("score",{}).get("fullTime",{})
    comp = m.get("competition",{}).get("name","?")
    print(f"    [{comp}] {home} {fh.get('home','?')}-{fh.get('away','?')} {away}")
PYEOF
    fi
  elif [ "$FINISHED_CODE" = "429" ]; then
    echo "  ⚠️  FINISHED → HTTP 429 (quota dépassé)"
  else
    echo "  ❌ FINISHED → HTTP $FINISHED_CODE"
  fi
fi

# ─── 7. API API-Sports ──────────────────────────────────────────────────────
echo ""
echo "── 7. API API-SPORTS ──"
if [ -z "$API_SPORTS_KEY" ]; then
  echo "  ❌ Clé manquante (API_SPORTS_KEY)"
else
  SPORTS_RESP=$(curl -s -w "\nHTTP:%{http_code}" \
    -H "x-apisports-key: $API_SPORTS_KEY" \
    "https://v3.football.api-sports.io/fixtures?live=all" 2>/dev/null)
  SPORTS_CODE=$(echo "$SPORTS_RESP" | grep 'HTTP:' | cut -d: -f2)
  SPORTS_BODY=$(echo "$SPORTS_RESP" | grep -v 'HTTP:')

  if [ "$SPORTS_CODE" = "200" ]; then
    SPORTS_COUNT=$(echo "$SPORTS_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('response',[])))" 2>/dev/null)
    REMAINING=$(echo "$SPORTS_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('results',0))" 2>/dev/null)
    echo "  ✅ HTTP 200, $SPORTS_COUNT match(s) live"
  elif [ "$SPORTS_CODE" = "429" ]; then
    echo "  ⚠️  HTTP 429 (quota dépassé)"
  else
    echo "  ❌ HTTP $SPORTS_CODE"
    echo "  Réponse: $(echo $SPORTS_BODY | head -c 200)"
  fi
fi

# ─── 8. Test endpoint API interne ───────────────────────────────────────────
echo ""
echo "── 8. API INTERNE (touslesmatchs-api:3001) ──"
if command -v docker &>/dev/null && docker inspect touslesmatchs-api &>/dev/null; then
  # Test depuis le réseau docker
  API_CURRENT=$(docker exec touslesmatchs-api wget -qO- http://localhost:3001/current-pick 2>/dev/null)
  if [ -n "$API_CURRENT" ]; then
    echo "  ✅ /current-pick répond"
    echo "$API_CURRENT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
p=d.get('pick',{})
ta=p.get('teamA',{})
tb=p.get('teamB',{})
print(f\"  Match: {ta.get('name','?')} vs {tb.get('name','?')}\")
print(f\"  Statut: {p.get('status','?')} | Score: {p.get('scoreA','?')}-{p.get('scoreB','?')}\")
" 2>/dev/null || echo "  (impossible de parser la réponse)"
  else
    echo "  ❌ /current-pick ne répond pas"
  fi

  API_LIVE=$(docker exec touslesmatchs-api wget -qO- http://localhost:3001/live-matches 2>/dev/null)
  if [ -n "$API_LIVE" ]; then
    COUNT=$(echo "$API_LIVE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('matches',[])))" 2>/dev/null)
    echo "  ✅ /live-matches répond ($COUNT match(s))"
  else
    echo "  ❌ /live-matches ne répond pas"
  fi
else
  echo "  ⚠️  Docker non accessible — test des endpoints ignoré"
fi

# ─── 9. Volumes montés ──────────────────────────────────────────────────────
echo ""
echo "── 9. VOLUMES / ACCÈS FICHIERS ──"
check_access() {
  local label=$1; local path=$2
  if [ -e "$path" ]; then
    echo "  ✅ $label → $path"
  else
    echo "  ❌ $label → $path (introuvable)"
  fi
}
check_access "picks (caddy vol)" "/opt/touslesmatchs/public/data/picks.json"
check_access "picks (api vol)" "/opt/touslesmatchs/public/data/picks.json"
check_access "/var/touslesmatchs" "/var/touslesmatchs"
check_access "preuves.json" "/var/touslesmatchs/preuves.json"

# ─── 10. Git status ─────────────────────────────────────────────────────────
echo ""
echo "── 10. GIT STATUS (VPS) ──"
GIT_DIR="/opt/touslesmatchs"
if [ -d "$GIT_DIR/.git" ]; then
  cd "$GIT_DIR"
  echo "  Branche: $(git branch --show-current)"
  echo "  Dernier commit: $(git log -1 --format='%h %s (%ar)')"
  DIRTY=$(git status --porcelain | wc -l)
  echo "  Fichiers modifiés: $DIRTY"
  if [ "$DIRTY" -gt 0 ]; then
    git status --short | head -10
  fi
else
  echo "  ❌ $GIT_DIR n'est pas un dépôt git"
fi

# ─── 11. Logs récents API ────────────────────────────────────────────────────
echo ""
echo "── 11. LOGS RÉCENTS touslesmatchs-api (30 dernières lignes) ──"
if command -v docker &>/dev/null; then
  docker logs --tail 30 touslesmatchs-api 2>&1 | grep -E "(ERROR|WARN|score|pick|football|api|❌|✅)" | tail -20 || docker logs --tail 15 touslesmatchs-api 2>&1 | tail -15
else
  echo "  ⚠️  Docker non accessible"
fi

# ─── 12. Résumé ─────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  FIN DU DIAGNOSTIC"
echo "======================================================"
