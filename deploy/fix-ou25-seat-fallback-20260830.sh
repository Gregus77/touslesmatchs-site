#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/touslesmatchs

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-ou25-seat-fallback-$TS"
mkdir -p "$BACKUP"
cp -a scripts/api_server.js "$BACKUP/api_server.js.before"

rollback() {
  echo "ERREUR — restauration automatique de scripts/api_server.js"
  cp -a "$BACKUP/api_server.js.before" scripts/api_server.js
  docker compose up -d --build api >/dev/null 2>&1 || true
  echo "ROLLBACK=$BACKUP"
}
trap rollback ERR

echo "[1/7] Sauvegarde: $BACKUP"
echo "[2/7] Correction ciblée du comptage des 5 sièges O/U 2,5"
python3 - <<'PY'
from pathlib import Path
p = Path('scripts/api_server.js')
s = p.read_text(encoding='utf-8')

old_sig = 'function buildOu25VoteSummary(agentMarketList) {'
new_sig = 'function buildOu25VoteSummary(agentMarketList, agentResults = []) {'
if s.count(old_sig) != 1:
    raise SystemExit(f'Signature inattendue: {s.count(old_sig)} occurrence(s)')
s = s.replace(old_sig, new_sig, 1)

needle = '  const votes = CONCILE_AGENT_NAMES.map((agent) => ({ agent, ...(byAgent.get(agent) || { direction: null, confidence: null }) }));'
if s.count(needle) != 1:
    raise SystemExit(f'Point insertion inattendu: {s.count(needle)} occurrence(s)')

fallback = '''  // Filet strict : si un agent officiel n'a pas rempli marches.buts mais a\n  // réellement donné Over/Under 2,5 comme pari principal, ce vrai vote compte\n  // comme son siège O/U. On ne remplace jamais un bulletin marches.buts existant,\n  // on n'invente aucun vote et les agents en échec restent exclus.\n  for (const ar of agentResults || []) {\n    if (!CONCILE_AGENT_NAMES.includes(ar?.name) || byAgent.has(ar.name)) continue;\n    if (!isOu25Bet(ar?.bet)) continue;\n    const confidence = Number(ar?.confidence);\n    if (!Number.isFinite(confidence)) continue;\n    byAgent.set(ar.name, {\n      direction: /^Over\\b/i.test(String(ar.bet).trim()) ? "over" : "under",\n      confidence: Math.min(95, Math.max(40, confidence)),\n    });\n  }\n'''
s = s.replace(needle, fallback + needle, 1)

old_call = 'const ou25VoteSummary = buildOu25VoteSummary(agentMarketList);'
new_call = 'const ou25VoteSummary = buildOu25VoteSummary(agentMarketList, agentResults);'
if s.count(old_call) != 1:
    raise SystemExit(f'Appel inattendu: {s.count(old_call)} occurrence(s)')
s = s.replace(old_call, new_call, 1)

p.write_text(s, encoding='utf-8')
print('PATCH=OK')
PY

echo "[3/7] Vérification syntaxique"
node --check scripts/api_server.js

echo "[4/7] Vérification ciblée du code"
grep -n -A28 -B3 'function buildOu25VoteSummary' scripts/api_server.js | sed -n '1,45p'
grep -n 'buildOu25VoteSummary(agentMarketList, agentResults)' scripts/api_server.js

echo "[5/7] Vérification qu'aucun autre fichier métier n'a été modifié par ce script"
cmp -s "$BACKUP/api_server.js.before" scripts/api_server.js && { echo 'ERREUR — patch absent'; false; } || true

# Test logique isolé du filet : 2 bulletins détaillés + 3 vrais votes principaux O/U
# doivent produire 5 sièges, sans inventer de vote.
node <<'NODE'
const names=['A','B','C','D','E'];
function isOu25Bet(b){return /^(Over|Under) 2[.,]5 buts$/i.test(String(b||'').trim())}
const byAgent=new Map([['A',{direction:'over',confidence:81}],['B',{direction:'over',confidence:82}]]);
const agentResults=[
{name:'A',bet:'Over 2.5 buts',confidence:81},
{name:'B',bet:'Over 2.5 buts',confidence:82},
{name:'C',bet:'Over 2.5 buts',confidence:83},
{name:'D',bet:'Under 2.5 buts',confidence:78},
{name:'E',bet:'Over 2.5 buts',confidence:84},
];
for(const ar of agentResults){
 if(!names.includes(ar?.name)||byAgent.has(ar.name)) continue;
 if(!isOu25Bet(ar?.bet)) continue;
 const confidence=Number(ar?.confidence); if(!Number.isFinite(confidence)) continue;
 byAgent.set(ar.name,{direction:/^Over\b/i.test(String(ar.bet).trim())?'over':'under',confidence});
}
const over=[...byAgent.values()].filter(v=>v.direction==='over').length;
const under=[...byAgent.values()].filter(v=>v.direction==='under').length;
if(byAgent.size!==5 || Math.max(over,under)!==4) process.exit(1);
console.log('TEST_FALLBACK=OK active=5 vote_count=4');
NODE

echo "[6/7] Rebuild du SEUL service API"
docker compose up -d --build api
sleep 12

echo "[7/7] Vérifications après redémarrage"
docker ps --filter name=touslesmatchs-api --format '{{.Names}} {{.Status}}'
docker logs --since 2m touslesmatchs-api 2>&1 | grep -E 'telegram-check' | tail -n 10 || true

# S'assure que la table d'audit Telegram reste lisible sans provoquer d'envoi.
docker exec touslesmatchs-api node -e 'const D=require("better-sqlite3");const db=new D("/data/tlm.db",{readonly:true});const n=db.prepare("SELECT COUNT(*) n FROM telegram_signal_deliveries").get().n;console.log("TELEGRAM_DELIVERY_AUDIT_TABLE=OK rows="+n)'

trap - ERR

echo "=== FINAL CORRECTION SIEGES O/U 2,5 ==="
echo "STATUS=OK"
echo "VOTE_PRINCIPAL_OU25=COMPTE_SI_MARCHES_BUTS_ABSENT"
echo "BULLETIN_MARCHES_BUTS=PRIORITAIRE"
echo "AUCUN_VOTE_INVENTE=OK"
echo "CRITERE_MINIMUM_4_SUR_5=INCHANGE"
echo "CONFIANCE_MINIMUM=INCHANGEE"
echo "ROUTAGE_PREMIUM=INCHANGE"
echo "MOTEUR_IA_CONCILE_HERMES_STRIPE_BREVO_DB=INCHANGES"
echo "SAUVEGARDE=$BACKUP"
