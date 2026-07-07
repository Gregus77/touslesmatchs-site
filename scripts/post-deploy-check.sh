#!/bin/bash
ERRORS=0

echo "=== POST-DEPLOY CHECK — TousLesMatchs ==="

# 1. Les 4 conteneurs running
for svc in site api council hermes-admin; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "touslesmatchs-$svc" 2>/dev/null || echo "absent")
  if [ "$STATUS" != "running" ]; then
    echo "ERREUR: touslesmatchs-$svc status=$STATUS"
    ERRORS=$((ERRORS + 1))
  else
    echo "OK: touslesmatchs-$svc running"
  fi
done

# 2. API health
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
  echo "OK: API /health repond"
else
  echo "ERREUR: API /health ne repond pas"
  ERRORS=$((ERRORS + 1))
fi

# 3. Current pick
if curl -sf http://localhost:3001/current-pick > /dev/null 2>&1; then
  echo "OK: /current-pick repond"
else
  echo "ERREUR: /current-pick ne repond pas"
  ERRORS=$((ERRORS + 1))
fi

# 4. Frontend correct (titre moderne)
TITLE=$(curl -sf http://localhost 2>/dev/null | grep -o '<title>[^<]*</title>' | head -1)
if echo "$TITLE" | grep -qi "Hermes"; then
  echo "OK: Frontend moderne detecte ($TITLE)"
elif echo "$TITLE" | grep -qi "Concile"; then
  echo "ERREUR: Ancien frontend detecte ($TITLE)"
  ERRORS=$((ERRORS + 1))
else
  echo "ATTENTION: Titre non reconnu: $TITLE"
fi

# 5. live-ia accessible
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/live-ia.html 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "OK: live-ia.html accessible (200)"
else
  echo "ERREUR: live-ia.html retourne $HTTP_CODE"
  ERRORS=$((ERRORS + 1))
fi

# 6. Variables dans le conteneur API
for var in BREVO_API_KEY STRIPE_SECRET_KEY TELEGRAM_BOT_TOKEN; do
  if docker exec touslesmatchs-api env 2>/dev/null | grep -q "^$var="; then
    echo "OK: $var present dans conteneur api"
  else
    echo "ERREUR: $var absent du conteneur api"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo "=== $ERRORS ERREUR(S) POST-DEPLOIEMENT ==="
  exit 1
fi

echo "=== POST-DEPLOY OK ==="
exit 0
