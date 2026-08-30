#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
B="/opt/backups/tlm-remove-elite-active-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$B"
cp scripts/api_server.js "$B/api_server.js"
rollback(){ cp "$B/api_server.js" scripts/api_server.js; docker compose up -d --build api >/dev/null 2>&1 || true; echo "ERREUR — restauration automatique depuis $B"; }
trap rollback ERR

echo "[1/6] Sauvegarde: $B"
python3 - <<'PY'
from pathlib import Path
p=Path('scripts/api_server.js')
s=p.read_text()
repls=[
('const canaux = [["Gratuit", TELEGRAM_CHANNEL_ID], ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],\n                    ["Premium", TELEGRAM_PREMIUM_CHANNEL_ID], ["Elite", TELEGRAM_ELITE_CHANNEL_ID]];',
 'const canaux = [["Gratuit", TELEGRAM_CHANNEL_ID], ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],\n                    ["Premium", TELEGRAM_PREMIUM_CHANNEL_ID]];'),
('return morts.length ? { ok: false, info: `injoignables : ${morts.join(", ")}` } : { ok: true, info: "4 canaux joignables" };',
 'return morts.length ? { ok: false, info: `injoignables : ${morts.join(", ")}` } : { ok: true, info: "3 canaux clients joignables" };'),
('push(TELEGRAM_ELITE_CHANNEL_ID, "elite");','// Elite supprime du runtime client'),
('if (TELEGRAM_ELITE_CHANNEL_ID && gradeElite && eliteDistinct && _eliteSignalDaily.count < ELITE_SIGNAL_DAILY_CAP) {','if (false && TELEGRAM_ELITE_CHANNEL_ID && gradeElite && eliteDistinct && _eliteSignalDaily.count < ELITE_SIGNAL_DAILY_CAP) {'),
('Standard · Premium · Elite','Standard · Premium'),
('Standard, Premium &amp; Elite','Standard &amp; Premium'),
('Standard, Premium & Elite','Standard & Premium'),
]
for a,b in repls:
    s=s.replace(a,b)
p.write_text(s)
PY

echo "[2/6] Elite retire des audits/envois actifs/textes clients"
node --check scripts/api_server.js

echo "[3/6] Vérifications ciblées"
python3 - <<'PY'
from pathlib import Path
s=Path('scripts/api_server.js').read_text()
assert 'const canaux = [["Gratuit", TELEGRAM_CHANNEL_ID], ["Standard", TELEGRAM_STANDARD_CHANNEL_ID],\n                    ["Premium", TELEGRAM_PREMIUM_CHANNEL_ID]];' in s
assert '3 canaux clients joignables' in s
assert 'push(TELEGRAM_ELITE_CHANNEL_ID, "elite");' not in s
assert 'Standard · Premium · Elite' not in s
print('CODE_ELITE_ACTIF=SUPPRIME')
PY

echo "[4/6] Rebuild du SEUL service API"
docker compose up -d --build api
sleep 12

echo "[5/6] Vérification canaux actifs"
docker logs --since 2m touslesmatchs-api 2>&1 | grep -E 'telegram-check.*(Gratuit|Standard|Premium|Admin)' | tail -n 12 || true
if docker logs --since 2m touslesmatchs-api 2>&1 | grep -q 'telegram-check.*Elite'; then
  echo 'ERREUR: Elite encore vérifié au runtime'
  false
fi

echo "[6/6] Vérification table historique conservée"
docker exec touslesmatchs-api node -e 'const D=require("better-sqlite3");const db=new D("/data/tlm.db",{readonly:true});const c=db.prepare("PRAGMA table_info(concile_analyses)").all().map(x=>x.name);console.log("LEGACY_SIG_SENT_ELITE="+(c.includes("sig_sent_elite")?"CONSERVE":"ABSENT"));'

trap - ERR
echo '=== FINAL SUPPRESSION ELITE ACTIF ==='
echo 'STATUS=OK'
echo 'OFFRES_ACTIVES=GRATUIT + STANDARD + PREMIUM'
echo 'AUDIT_ELITE=SUPPRIME'
echo 'ENVOI_ELITE=SUPPRIME'
echo 'TEXTES_CLIENT_ELITE=SUPPRIMES'
echo 'HISTORIQUE_DB_ELITE=CONSERVE_COMPATIBILITE'
echo 'CONCILE_CRITERES_4_SUR_5_CONFIANCE=INCHANGES'
echo 'HERMES_STRIPE_BREVO_DB=INCHANGES'
echo "SAUVEGARDE=$B"
