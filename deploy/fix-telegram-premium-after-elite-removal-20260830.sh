#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-telegram-premium-route-${TS}"
mkdir -p "$BACKUP"
cp -a scripts/api_server.js "$BACKUP/api_server.js"

rollback() {
  echo "ERREUR — restauration automatique de scripts/api_server.js"
  cp -a "$BACKUP/api_server.js" scripts/api_server.js
  docker compose up -d --build api >/dev/null 2>&1 || true
  exit 1
}
trap rollback ERR

echo "[1/6] Sauvegarde: $BACKUP"

echo "[2/6] Alignement Premium sur l'ancien vivier Elite quand Elite n'existe plus"
python3 - <<'PY'
from pathlib import Path
p=Path('scripts/api_server.js')
s=p.read_text(encoding='utf-8')

old1='const fallback = { standard: STANDARD_MIN_CONF, premium: PREMIUM_MIN_CONF, elite: getEliteMinConf(), source: "fixe" };'
new1='const fallback = { standard: STANDARD_MIN_CONF, premium: PREMIUM_MIN_CONF, elite: getEliteMinConf(), source: "fixe" };\n  // Elite n’est plus une offre client : si son canal est absent, Premium devient\n  // le palier supérieur et hérite du vivier diffusable de l’ancien Elite.\n  if (!TELEGRAM_ELITE_CHANNEL_ID) fallback.premium = fallback.elite;'
if old1 not in s:
    raise SystemExit('PATTERN_FALLBACK_ABSENT')
s=s.replace(old1,new1,1)

old2='t.elite   = Math.min(t.elite, t.premium);'
new2='t.elite   = Math.min(t.elite, t.premium);\n    // Offre Elite supprimée côté client : Premium doit recevoir les signaux qui\n    // auraient auparavant été classés Elite, sinon ils tombent dans un canal vide.\n    if (!TELEGRAM_ELITE_CHANNEL_ID) t.premium = t.elite;'
if old2 not in s:
    raise SystemExit('PATTERN_THRESHOLDS_ABSENT')
s=s.replace(old2,new2,1)

old3='    ["Elite",    TELEGRAM_ELITE_CHANNEL_ID],'
new3='    ...(TELEGRAM_ELITE_CHANNEL_ID ? [["Elite", TELEGRAM_ELITE_CHANNEL_ID]] : []),'
if old3 not in s:
    raise SystemExit('PATTERN_CHANNEL_CHECK_ABSENT')
s=s.replace(old3,new3,1)

p.write_text(s,encoding='utf-8')
print('PATCH=OK')
PY

echo "[3/6] Vérification syntaxique"
node --check scripts/api_server.js

echo "[4/6] Vérification ciblée du code"
grep -nE 'fallback\.premium = fallback\.elite|t\.premium = t\.elite|TELEGRAM_ELITE_CHANNEL_ID \? \[\["Elite"' scripts/api_server.js

echo "[5/6] Rebuild du SEUL service API"
docker compose up -d --build api
sleep 12

echo "[6/6] Vérifications après redémarrage"
docker ps --filter name=touslesmatchs-api --format '{{.Names}} {{.Status}}'
LOGS="$(docker logs --since 2m touslesmatchs-api 2>&1 || true)"
printf '%s\n' "$LOGS" | grep -E 'telegram-check' | tail -n 20 || true
if printf '%s\n' "$LOGS" | grep -q 'Elite : NON CONFIGURÉ'; then
  echo "ERREUR — Elite est encore considéré comme canal requis"
  false
fi
for name in 'Gratuit' 'Standard' 'Premium' 'Admin'; do
  if ! printf '%s\n' "$LOGS" | grep -q "✅ ${name}"; then
    echo "ERREUR — canal ${name} non confirmé après redémarrage"
    false
  fi
done

echo "=== FINAL ROUTAGE TELEGRAM APRES SUPPRESSION ELITE ==="
echo "STATUS=OK"
echo "GRATUIT=OK STANDARD=OK PREMIUM=OK ADMIN=OK"
echo "ELITE_CLIENT=ABSENT"
echo "ANCIEN_VIVIER_ELITE=ROUTE_VERS_PREMIUM"
echo "CRITERE_4_SUR_5=INCHANGE"
echo "MOTEUR_IA_CONCILE_HERMES_STRIPE_BREVO_DB=INCHANGES"
echo "SAUVEGARDE=$BACKUP"
trap - ERR
