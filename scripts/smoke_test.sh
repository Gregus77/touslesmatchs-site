#!/bin/bash
# smoke_test.sh — Tests post-deploiement (Couche 3)
# Usage: bash scripts/smoke_test.sh
# Retourne 0 si PASS, 1 si FAIL
# Lancer APRES docker compose up -d --build + 10 secondes d'attente

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
FAILED=0
BASE="http://localhost:3001"

log() { echo -e "$1"; }

log "╔══════════════════════════════════════════════════╗"
log "║       SMOKE TEST POST-DEPLOY — TousLesMatchs    ║"
log "║       $(date '+%Y-%m-%d %H:%M:%S')                    ║"
log "╚══════════════════════════════════════════════════╝"
log ""

# ── Fonction test HTTP ────────────────────────────────────────────────────────
test_http() {
  local desc="$1" url="$2" expect_code="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
  if [ "$code" = "$expect_code" ]; then
    log "  ${GREEN}✓${NC} $desc (HTTP $code)"
  else
    log "  ${RED}✗${NC} $desc (HTTP $code, attendu $expect_code)"
    FAILED=$((FAILED + 1))
  fi
}

test_json_field() {
  local desc="$1" url="$2" field="$3"
  local resp
  resp=$(curl -s --max-time 10 "$url" 2>/dev/null)
  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); assert $field" 2>/dev/null; then
    log "  ${GREEN}✓${NC} $desc"
  else
    log "  ${RED}✗${NC} $desc"
    FAILED=$((FAILED + 1))
  fi
}

# ── 1. API accessible ────────────────────────────────────────────────────────
log "--- 1. API Health ---"
test_http "API /live-matches" "$BASE/live-matches"
test_http "API /current-pick" "$BASE/current-pick"
test_http "API /signal-fort-stats" "$BASE/signal-fort-stats"

# ── 2. Version et build ──────────────────────────────────────────────────────
log ""
log "--- 2. Version ---"
version=$(curl -s --max-time 5 "$BASE/admin/version" 2>/dev/null)
if [ -n "$version" ]; then
  hash=$(echo "$version" | python3 -c "import sys,json; print(json.load(sys.stdin)['version']['hash'])" 2>/dev/null)
  log "  ${GREEN}✓${NC} Build hash: $hash"
  # Verifier que TRUSTED >= 50
  trusted=$(echo "$version" | python3 -c "import sys,json; print(json.load(sys.stdin)['rules']['trusted_count'])" 2>/dev/null)
  if [ "$trusted" -ge 50 ] 2>/dev/null; then
    log "  ${GREEN}✓${NC} TRUSTED_COMPETITIONS: $trusted ligues"
  else
    log "  ${RED}✗${NC} TRUSTED_COMPETITIONS: $trusted (min 50!)"
    FAILED=$((FAILED + 1))
  fi
  # Verifier min_minute = 35
  min_min=$(echo "$version" | python3 -c "import sys,json; print(json.load(sys.stdin)['rules']['min_minute'])" 2>/dev/null)
  if [ "$min_min" -ge 35 ] 2>/dev/null; then
    log "  ${GREEN}✓${NC} MIN_MINUTE: $min_min"
  else
    log "  ${RED}✗${NC} MIN_MINUTE: $min_min (doit etre >= 35)"
    FAILED=$((FAILED + 1))
  fi
else
  log "  ${RED}✗${NC} /admin/version inaccessible"
  FAILED=$((FAILED + 1))
fi

# ── 3. Preflight systeme ─────────────────────────────────────────────────────
log ""
log "--- 3. Preflight ---"
preflight=$(curl -s --max-time 15 "$BASE/admin/preflight" 2>/dev/null)
if [ -n "$preflight" ]; then
  sys_status=$(echo "$preflight" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
  if [ "$sys_status" = "HEALTHY" ]; then
    log "  ${GREEN}✓${NC} Preflight: HEALTHY"
  else
    log "  ${YELLOW}!${NC} Preflight: $sys_status"
    echo "$preflight" | python3 -c "import sys,json; [print(f'    - {w}') for w in json.load(sys.stdin).get('warnings',[])]" 2>/dev/null
  fi
else
  log "  ${RED}✗${NC} /admin/preflight inaccessible"
  FAILED=$((FAILED + 1))
fi

# ── 4. Stripe ─────────────────────────────────────────────────────────────────
log ""
log "--- 4. Services externes ---"
if [ -f .env ] && grep -q "STRIPE_SECRET_KEY=sk_" .env 2>/dev/null; then
  log "  ${GREEN}✓${NC} Stripe: cle presente dans .env"
else
  log "  ${YELLOW}!${NC} Stripe: cle non trouvee dans .env (normal hors VPS)"
fi

# Brevo
if [ -f .env ] && grep -q "BREVO_API_KEY=" .env 2>/dev/null; then
  brevo_val=$(grep "^BREVO_API_KEY=" .env | cut -d= -f2-)
  if [ -n "$brevo_val" ] && [ "$brevo_val" != '""' ]; then
    log "  ${GREEN}✓${NC} Brevo: cle presente dans .env"
  else
    log "  ${YELLOW}!${NC} Brevo: cle vide"
  fi
else
  log "  ${YELLOW}!${NC} Brevo: non configure (normal hors VPS)"
fi

# Telegram
if [ -f .env ] && grep -q "TELEGRAM_BOT_TOKEN=" .env 2>/dev/null; then
  log "  ${GREEN}✓${NC} Telegram: token present dans .env"
else
  log "  ${YELLOW}!${NC} Telegram: non configure (normal hors VPS)"
fi

# ── 5. Heartbeat (si deja lance) ─────────────────────────────────────────────
log ""
log "--- 5. Heartbeat ---"
hb=$(curl -s --max-time 5 "$BASE/admin/heartbeat" 2>/dev/null)
hb_status=$(echo "$hb" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
if [ "$hb_status" = "HEALTHY" ]; then
  log "  ${GREEN}✓${NC} Heartbeat: HEALTHY"
elif [ "$hb_status" = "unknown" ]; then
  log "  ${YELLOW}!${NC} Heartbeat: pas encore lance (normal si < 15s apres boot)"
else
  log "  ${RED}✗${NC} Heartbeat: $hb_status"
  echo "$hb" | python3 -c "import sys,json; [print(f'    - {a}') for a in json.load(sys.stdin).get('alerts',[])]" 2>/dev/null
fi

# ── 6. Site web accessible ───────────────────────────────────────────────────
log ""
log "--- 6. Site web ---"
site_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://www.touslesmatchs.com" 2>/dev/null)
if [ "$site_code" = "200" ]; then
  log "  ${GREEN}✓${NC} Site HTTPS accessible"
else
  log "  ${YELLOW}!${NC} Site HTTPS: HTTP $site_code (normal si test local)"
fi

# ── 7. Docker containers ─────────────────────────────────────────────────────
log ""
log "--- 7. Docker ---"
for svc in touslesmatchs-site touslesmatchs-api touslesmatchs-council touslesmatchs-hermes-admin; do
  status=$(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null)
  if [ "$status" = "running" ]; then
    log "  ${GREEN}✓${NC} $svc: running"
  elif [ -z "$status" ]; then
    log "  ${YELLOW}!${NC} $svc: not found"
  else
    log "  ${RED}✗${NC} $svc: $status"
    FAILED=$((FAILED + 1))
  fi
done

# ── 8. Filtres (eligible > 0) ────────────────────────────────────────────────
log ""
log "--- 8. Filtres live ---"
live_resp=$(curl -s --max-time 10 "$BASE/live-matches" 2>/dev/null)
if [ -n "$live_resp" ]; then
  total=$(echo "$live_resp" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('matches',[])))" 2>/dev/null)
  log "  ${GREEN}✓${NC} Matchs apres filtre: $total"
  if [ "$total" = "0" ]; then
    log "  ${YELLOW}!${NC} 0 matchs — verifier si des matchs sont en cours"
  fi
fi

# ── Resume ────────────────────────────────────────────────────────────────────
log ""
log "╔══════════════════════════════════════════════════╗"
if [ "$FAILED" -eq 0 ]; then
  log "║  ${GREEN}SMOKE TEST PASS${NC} — Aucun probleme critique        ║"
  log "║  Deploiement OK.                                ║"
else
  log "║  ${RED}SMOKE TEST FAIL${NC} — $FAILED probleme(s) critique(s)    ║"
  log "║  CORRIGER AVANT de considerer le deploy reussi. ║"
fi
log "╚══════════════════════════════════════════════════╝"

exit $FAILED
