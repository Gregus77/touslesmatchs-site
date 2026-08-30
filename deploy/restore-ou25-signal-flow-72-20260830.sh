#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
TARGET="scripts/api_server.js"
DB="data/tlm.db"
BACKUP="/opt/backups/tlm-ou25-flow72-$(date +%Y%m%d-%H%M%S)"

[ -f "$TARGET" ] || { echo "BLOQUE: $TARGET absent"; exit 1; }
[ -f "$DB" ] || { echo "BLOQUE: $DB absent"; exit 1; }
install -d -m 700 "$BACKUP"
cp -a "$TARGET" "$BACKUP/api_server.js"
sqlite3 "$DB" ".timeout 10000" ".backup '$BACKUP/tlm.db'"

rollback() {
  echo "ERREUR — restauration automatique"
  cp -a "$BACKUP/api_server.js" "$TARGET"
  docker compose build api >/dev/null
  docker compose up -d --no-deps --force-recreate api >/dev/null
}
trap rollback ERR

python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys

p=Path(sys.argv[1])
s=p.read_text(encoding="utf-8")

# 1) Plancher produit O/U 2,5 : 72%, comme decide par le fondateur.
old="const CLIENT_OU25_MIN_CONFIDENCE = Math.max(80, Number(process.env.CLIENT_OU25_MIN_CONFIDENCE || 80));"
new="const CLIENT_OU25_MIN_CONFIDENCE = 72; // fondateur 30/08/2026: 4/5 IA + confiance >=72"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit("BLOQUE: CLIENT_OU25_MIN_CONFIDENCE introuvable ou deja modifie autrement")

# 2) Le plancher de publication/tier ne doit pas remonter automatiquement a 75/82.
old2='function getEliteMinConf() { return Date.now() < ELITE_TIER_RAMP_UP_DATE ? 75 : 82; }'
new2='function getEliteMinConf() { return 72; } // fondateur 30/08/2026: seuil O/U 2,5 fixe a 72'
if old2 in s:
    s=s.replace(old2,new2,1)
elif new2 not in s:
    raise SystemExit("BLOQUE: getEliteMinConf introuvable ou deja modifie autrement")

# 3) Le seuil adaptatif global avait remonte a 85 et bloquait TOUT le portail O/U.
# Pour O/U 2,5, on applique le plancher produit 72 ; les seuils Standard/Premium
# continuent ensuite a trier les volumes (3/j et 10/j) via getTierThresholds().
old3='''function getSignalThresholdForBet(bet) {
  const overrideForBet = MARKET_SIGNAL_FLOORS[bet];
  if (overrideForBet !== undefined) return overrideForBet;
  return getAdaptiveSignalThreshold();
}'''
new3='''function getSignalThresholdForBet(bet) {
  if (isOu25Bet(bet)) return CLIENT_OU25_MIN_CONFIDENCE;
  const overrideForBet = MARKET_SIGNAL_FLOORS[bet];
  if (overrideForBet !== undefined) return overrideForBet;
  return getAdaptiveSignalThreshold();
}'''
if old3 in s:
    s=s.replace(old3,new3,1)
elif new3 not in s:
    raise SystemExit("BLOQUE: getSignalThresholdForBet introuvable ou deja modifie autrement")

p.write_text(s,encoding="utf-8")
PY

node --check "$TARGET"

docker compose build api
docker compose up -d --no-deps --force-recreate api
sleep 12

# Verifications code et integrations.
docker exec touslesmatchs-api node --check /app/server.js
docker exec touslesmatchs-api grep -q "CLIENT_OU25_MIN_CONFIDENCE = 72" /app/server.js
docker exec touslesmatchs-api grep -q "if (isOu25Bet(bet)) return CLIENT_OU25_MIN_CONFIDENCE" /app/server.js
docker exec touslesmatchs-api grep -q "function getEliteMinConf() { return 72; }" /app/server.js

curl -fsS https://www.touslesmatchs.com/api/health | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d.get("ok") is True,d
assert d.get("integrations",{}).get("telegram",{}).get("ok") is True,d
print("API=OK TELEGRAM=OK")
'

# Controle : historique immuable toujours present apres la correction.
curl -fsS "https://www.touslesmatchs.com/api/analysis-history?limit=100&t=$(date +%s)" | python3 -c '
import json,sys
d=json.load(sys.stdin)
r=[x for x in d.get("analyses",[]) if "atletico paranaense" in str(x.get("home","")).lower() and "fluminense" in str(x.get("away","")).lower()]
assert r and r[0].get("outcome")=="win" and r[0].get("final_score")=="3-3",r
print("HISTORIQUE_IMMUABLE=OK")
'

# Affiche les thresholds reels au demarrage si disponibles.
docker logs touslesmatchs-api --since 2m 2>&1 | grep -E "tier-thresholds|adaptive-threshold|telegram-check|auto-concile" | tail -n 80 || true

trap - ERR
echo "VERDICT=OK"
echo "OU25_SEUIL_GLOBAL=72"
echo "OU25_PLANCHER_CLIENT=72"
echo "VOTES_MINIMUM=4_SUR_5_INCHANGE"
echo "STANDARD_CAP=3_INCHANGE"
echo "PREMIUM_CAP=10_INCHANGE"
echo "COTES_ET_BARRIERE_QUALITE=INCHANGEES"
echo "BUDGET_5_EUR_ET_HARD_STOP=INCHANGES"
echo "HISTORIQUE_TELEGRAM=INCHANGE"
echo "SAUVEGARDE=$BACKUP"
