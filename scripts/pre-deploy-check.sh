#!/bin/bash
set -uo pipefail
ERRORS=0
WARNINGS=0

echo "=== PRE-DEPLOY CHECK — TousLesMatchs ==="
echo "Date: $(date)"
echo ""

# ── 1. FRONTEND ──────────────────────────────────────────────
echo "--- Frontend ---"

if [ ! -f public/index.html ]; then
  echo "ERREUR: public/index.html manquant"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: public/index.html existe"
fi

if [ ! -f public/live-ia.html ]; then
  echo "ERREUR: public/live-ia.html manquant"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: public/live-ia.html existe"
fi

if [ ! -f public/template.html ]; then
  echo "ATTENTION: public/template.html manquant — council html_generator ne fonctionnera pas"
  WARNINGS=$((WARNINGS + 1))
else
  echo "OK: public/template.html existe"
fi

TITLE=$(grep -o '<title>[^<]*</title>' public/index.html 2>/dev/null | head -1)
if echo "$TITLE" | grep -qi "Hermes"; then
  echo "OK: Frontend moderne detecte ($TITLE)"
elif echo "$TITLE" | grep -qi "Le Concile analyse"; then
  echo "ERREUR: Ancien frontend detecte ($TITLE)"
  ERRORS=$((ERRORS + 1))
fi

if [ -d site ] && [ -f site/index.html ]; then
  echo "ERREUR: site/index.html existe — ancien frontend doit etre dans _deprecated/"
  ERRORS=$((ERRORS + 1))
fi

for LEGACY_DIR in src dist nginx; do
  if [ -d "$LEGACY_DIR" ] && [ "$(ls -A "$LEGACY_DIR" 2>/dev/null)" ]; then
    echo "ERREUR: $LEGACY_DIR/ non vide — doit etre dans _deprecated/"
    ERRORS=$((ERRORS + 1))
  fi
done

# ── 2. DOCKER-COMPOSE ────────────────────────────────────────
echo ""
echo "--- Docker Compose ---"

if grep -q '/opt/touslesmatchs/site:/srv' docker-compose.yml 2>/dev/null; then
  echo "ERREUR: docker-compose.yml monte site:/ — doit etre public:/"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Ancien volume site:/ absent"
fi

if grep -q '/opt/touslesmatchs/public:/srv' docker-compose.yml 2>/dev/null; then
  echo "OK: Volume public:/srv present"
else
  echo "ERREUR: Volume public:/srv manquant dans docker-compose.yml"
  ERRORS=$((ERRORS + 1))
fi

# ── 3. VARIABLES D'ENVIRONNEMENT ─────────────────────────────
echo ""
echo "--- Variables d'environnement ---"

for var in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID_CARTE BREVO_API_KEY BREVO_SENDER_EMAIL TELEGRAM_BOT_TOKEN TELEGRAM_CHANNEL_ID TELEGRAM_PREMIUM_CHANNEL_ID; do
  if grep -q "$var" docker-compose.yml 2>/dev/null; then
    echo "OK: $var dans docker-compose.yml"
  else
    echo "ERREUR: $var absent de docker-compose.yml"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ -d /opt/touslesmatchs ] && [ ! -f .env ]; then
  echo "ERREUR: .env manquant sur le VPS"
  ERRORS=$((ERRORS + 1))
fi

# ── 4. STRIPE ─────────────────────────────────────────────────
echo ""
echo "--- Stripe ---"

if grep -rq 'buy\.stripe\.com' public/ 2>/dev/null; then
  echo "ERREUR: buy.stripe.com trouve dans public/ (ancien Payment Link)"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Aucun buy.stripe.com dans public/"
fi

if grep -q 'startCheckout' public/index.html 2>/dev/null; then
  echo "OK: startCheckout() present dans index.html"
else
  echo "ERREUR: startCheckout() absent de index.html"
  ERRORS=$((ERRORS + 1))
fi

# ── 5. BREVO ──────────────────────────────────────────────────
echo ""
echo "--- Brevo ---"

if grep -q 'brevoSendEmail' scripts/api_server.js 2>/dev/null; then
  echo "OK: brevoSendEmail() present dans api_server.js"
else
  echo "ATTENTION: brevoSendEmail() absent de api_server.js"
  WARNINGS=$((WARNINGS + 1))
fi

# ── 6. TELEGRAM ───────────────────────────────────────────────
echo ""
echo "--- Telegram ---"

if grep -q 'InviteLinkManager' scripts/api_server.js 2>/dev/null; then
  echo "OK: InviteLinkManager present dans api_server.js"
else
  echo "ATTENTION: InviteLinkManager absent de api_server.js"
  WARNINGS=$((WARNINGS + 1))
fi

# ── 7. CADDY ──────────────────────────────────────────────────
echo ""
echo "--- Caddy ---"

if [ ! -f Caddyfile ]; then
  echo "ERREUR: Caddyfile manquant"
  ERRORS=$((ERRORS + 1))
else
  if grep -q 'root \* /srv' Caddyfile 2>/dev/null; then
    echo "OK: Caddyfile root = /srv"
  else
    echo "ERREUR: Caddyfile root != /srv"
    ERRORS=$((ERRORS + 1))
  fi
  if grep -q 'reverse_proxy api:3001' Caddyfile 2>/dev/null; then
    echo "OK: Caddyfile reverse_proxy api:3001"
  else
    echo "ERREUR: Caddyfile reverse_proxy manquant"
    ERRORS=$((ERRORS + 1))
  fi
fi

# ── 8. REGLES METIER ─────────────────────────────────────────
echo ""
echo "--- Regles metier ---"

PARI_COUNT=$(grep -owi '\bpari\b' public/index.html 2>/dev/null | wc -l)
if [ "$PARI_COUNT" -gt 0 ]; then
  echo "ATTENTION: Le mot 'pari' apparait $PARI_COUNT fois dans index.html (ANJ)"
  WARNINGS=$((WARNINGS + 1))
else
  echo "OK: Aucun mot 'pari' isole dans index.html (ANJ)"
fi

# ── 9. COUNCIL DOCKERFILE ────────────────────────────────────
echo ""
echo "--- Council ---"

if grep -q 'COPY public/template.html /app/site/template.html' council/Dockerfile 2>/dev/null; then
  echo "OK: Council Dockerfile copie template.html"
else
  echo "ATTENTION: Council Dockerfile ne copie pas template.html"
  WARNINGS=$((WARNINGS + 1))
fi

# ── 10. SIGNATURE FRONTEND ───────────────────────────────────
echo ""
echo "--- Signature ---"

if [ -f FRONTEND_SIGNATURE.json ]; then
  echo "OK: FRONTEND_SIGNATURE.json present"
else
  echo "ATTENTION: FRONTEND_SIGNATURE.json absent"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -f DEPLOYMENT_MANIFEST.json ]; then
  echo "OK: DEPLOYMENT_MANIFEST.json present"
else
  echo "ATTENTION: DEPLOYMENT_MANIFEST.json absent"
  WARNINGS=$((WARNINGS + 1))
fi

# ── RESULTAT ──────────────────────────────────────────────────
echo ""
echo "=== RESULTAT: $ERRORS erreur(s), $WARNINGS attention(s) ==="

if [ $ERRORS -gt 0 ]; then
  echo "=== DEPLOIEMENT BLOQUE ==="
  exit 1
fi

echo "=== PRE-DEPLOY OK ==="
exit 0
