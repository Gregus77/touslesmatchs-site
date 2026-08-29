#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/touslesmatchs

STAMP="$(date +%Y%m%d-%H%M%S)"
GOLDEN="/opt/backups/TLM-GOLDEN-$STAMP"
mkdir -p "$GOLDEN/files" "$GOLDEN/data"

echo "[1/7] Sauvegarde des fichiers qui fonctionnent"
for f in public/index.html scripts/api_server.js docker-compose.yml Caddyfile Dockerfile Dockerfile.api; do
  [ -f "$f" ] && cp -a "$f" "$GOLDEN/files/$(basename "$f")"
done

# Configuration sensible : sauvegardee LOCALLEMENT uniquement, jamais poussee sur GitHub.
[ -f .env ] && cp -a .env "$GOLDEN/.env"
chmod 600 "$GOLDEN/.env" 2>/dev/null || true

echo "[2/7] Sauvegarde des bases"
for f in data/*.db; do
  [ -f "$f" ] || continue
  cp -a "$f" "$GOLDEN/data/"
done

echo "[3/7] Capture de l'etat Git et Docker"
git rev-parse HEAD > "$GOLDEN/git-head.txt"
git status --short > "$GOLDEN/git-status.txt"
git diff -- public/index.html scripts/api_server.js docker-compose.yml Caddyfile Dockerfile Dockerfile.api > "$GOLDEN/working-tree.patch" || true
docker compose ps > "$GOLDEN/docker-ps.txt" 2>&1 || true

# Ne stocker que la presence des variables Telegram, jamais leur valeur.
docker compose exec -T api node <<'NODE' > "$GOLDEN/telegram-config-check.txt"
const vars=['TELEGRAM_BOT_TOKEN','TELEGRAM_ADMIN_CHAT_ID','TELEGRAM_CHANNEL_ID','TELEGRAM_FREE_CHANNEL_ID','TELEGRAM_STANDARD_CHANNEL_ID','TELEGRAM_PREMIUM_CHANNEL_ID'];
for(const k of vars) console.log(`${k}=${process.env[k] ? 'CONFIGURE' : 'ABSENT'}`);
NODE

echo "[4/7] Verification accueil + flux"
curl -fsS http://127.0.0.1:3001/homepage-fixtures > "$GOLDEN/homepage-fixtures.json"
python3 - "$GOLDEN/homepage-fixtures.json" <<'PY'
import json,sys
p=sys.argv[1]
d=json.load(open(p,encoding='utf-8'))
print('LIVE=',len(d.get('live',[])),'A_VENIR=',len(d.get('upcoming',[])))
if not d.get('ok'): raise SystemExit('API homepage-fixtures KO')
PY
curl -fsS https://www.touslesmatchs.com/ | grep -q 'TLM-HOME-FIXTURES-UI-20260830'

echo "[5/7] Verification Telegram non destructive"
docker compose exec -T api node <<'NODE' > "$GOLDEN/telegram-health.txt"
const token=process.env.TELEGRAM_BOT_TOKEN||'';
const targets=[
 ['Hermes',process.env.TELEGRAM_ADMIN_CHAT_ID||''],
 ['Gratuit',process.env.TELEGRAM_CHANNEL_ID||process.env.TELEGRAM_FREE_CHANNEL_ID||''],
 ['Standard',process.env.TELEGRAM_STANDARD_CHANNEL_ID||''],
 ['Premium',process.env.TELEGRAM_PREMIUM_CHANNEL_ID||'']
];
(async()=>{
 if(!token){console.log('BOT=ABSENT');process.exit(1)}
 let bad=0;
 for(const [name,id] of targets){
   if(!id){console.log(`${name}=ABSENT`);bad++;continue}
   const r=await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(id)}`);
   const d=await r.json();
   console.log(`${name}=${d.ok?'OK':'FAIL'}`);
   if(!d.ok) bad++;
 }
 process.exit(bad?1:0)
})().catch(e=>{console.error(e.message);process.exit(1)});
NODE
cat "$GOLDEN/telegram-health.txt"

echo "[6/7] Archive locale chiffree par permissions root"
tar -C /opt/backups -czf "$GOLDEN.tar.gz" "$(basename "$GOLDEN")"
chmod 600 "$GOLDEN.tar.gz"
sha256sum "$GOLDEN.tar.gz" > "$GOLDEN.tar.gz.sha256"

# Marqueur stable local. Le tag Git ne pretend PAS contenir les fichiers non commits :
# le vrai snapshot complet est l'archive + working-tree.patch ci-dessus.
TAG="golden-working-20260830-$STAMP"
git tag "$TAG" "$(git rev-parse HEAD)" 2>/dev/null || true
git push origin "$TAG" >/dev/null 2>&1 || true

echo "[7/7] TERMINE"
echo "GOLDEN_DIR=$GOLDEN"
echo "GOLDEN_ARCHIVE=$GOLDEN.tar.gz"
echo "SHA256=$(cut -d' ' -f1 "$GOLDEN.tar.gz.sha256")"
echo "IMPORTANT: .env est sauvegarde uniquement sur le VPS, jamais envoye sur GitHub."
