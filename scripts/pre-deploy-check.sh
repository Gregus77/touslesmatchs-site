#!/bin/bash
set -euo pipefail
ERRORS=0

echo "=== PRE-DEPLOY CHECK — TousLesMatchs ==="

# 1. Frontend moderne existe
if [ ! -f public/index.html ]; then
  echo "ERREUR: public/index.html manquant"
  ERRORS=$((ERRORS + 1))
fi

if [ ! -f public/live-ia.html ]; then
  echo "ERREUR: public/live-ia.html manquant"
  ERRORS=$((ERRORS + 1))
fi

# 2. Ancien volume mount absent
if grep -q '/opt/touslesmatchs/site:/srv' docker-compose.yml 2>/dev/null; then
  echo "ERREUR: docker-compose.yml monte encore site:/ — doit etre public:/"
  ERRORS=$((ERRORS + 1))
fi

# 3. Volume correct present
if ! grep -q '/opt/touslesmatchs/public:/srv' docker-compose.yml 2>/dev/null; then
  echo "ERREUR: docker-compose.yml ne monte pas public:/ dans /srv"
  ERRORS=$((ERRORS + 1))
fi

# 4. Variables critiques presentes dans docker-compose.yml
for var in STRIPE_SECRET_KEY BREVO_API_KEY TELEGRAM_BOT_TOKEN; do
  if ! grep -q "$var" docker-compose.yml; then
    echo "ERREUR: $var absent de docker-compose.yml"
    ERRORS=$((ERRORS + 1))
  fi
done

# 5. .env existe (sur VPS uniquement)
if [ -d /opt/touslesmatchs ] && [ ! -f .env ]; then
  echo "ERREUR: .env manquant"
  ERRORS=$((ERRORS + 1))
fi

# 6. Pas d'anciens Payment Links
if grep -rq 'buy\.stripe\.com' public/ 2>/dev/null; then
  echo "ERREUR: buy.stripe.com trouve dans public/"
  ERRORS=$((ERRORS + 1))
fi

# 7. Duplication frontend
if [ -d site ] && [ -f site/index.html ]; then
  echo "ATTENTION: site/index.html existe encore — ancien frontend"
fi

# 8. Template present pour council
if [ ! -f public/template.html ]; then
  echo "ATTENTION: public/template.html manquant — council html_generator ne fonctionnera pas"
fi

if [ $ERRORS -gt 0 ]; then
  echo "=== $ERRORS ERREUR(S) — DEPLOIEMENT BLOQUE ==="
  exit 1
fi

echo "=== PRE-DEPLOY OK ==="
exit 0
