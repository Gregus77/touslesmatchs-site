#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
TARGET="scripts/api_server.js"
BACKUP_DIR="/opt/backups/tlm-hermes-daily-only-$(date +%Y%m%d-%H%M%S)"

test -f "$TARGET" || { echo "BLOQUE: $TARGET absent"; exit 1; }
install -d -m 700 "$BACKUP_DIR"
cp -a "$TARGET" "$BACKUP_DIR/api_server.js"
BEFORE_SHA="$(sha256sum "$TARGET" | awk '{print $1}')"

rollback() {
  echo "ERREUR: restauration automatique de $TARGET"
  cp -a "$BACKUP_DIR/api_server.js" "$TARGET"
  docker compose build api
  docker compose up -d --no-deps api
}
trap rollback ERR

python3 - "$TARGET" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
source = path.read_text(encoding="utf-8")

gate_marker = 'console.log("[telegram-admin] bloque: digest quotidien uniquement");'
if gate_marker not in source:
    old = '''function sendTelegramMessage(chatId, text, deliveryMeta = null) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return Promise.resolve(false);
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });'''
    new = '''function sendTelegramMessage(chatId, text, deliveryMeta = null) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return Promise.resolve(false);
  // Hermes est un canal d'administration: un seul digest automatique par jour.
  // Les alertes horaires, signaux admin, rapports secondaires et relances apres
  // redemarrage restent dans les logs, sans polluer Telegram.
  if (String(chatId) === String(TELEGRAM_ADMIN_CHAT_ID)
      && deliveryMeta?.adminDailyDigest !== true) {
    console.log("[telegram-admin] bloque: digest quotidien uniquement");
    return Promise.resolve(false);
  }
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });'''
    if source.count(old) != 1:
        raise SystemExit("BLOQUE: point d'insertion sendTelegramMessage absent ou ambigu")
    source = source.replace(old, new, 1)

helper_marker = "async function sendHermesDailyDigest(text)"
if helper_marker not in source:
    old = '''}

// Génère un lien d'invitation Telegram à usage unique vers le canal premium.'''
    new = '''}

async function sendHermesDailyDigest(text) {
  const parisDay = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const marker = `/data/hermes-daily-digest-${parisDay}.sent`;
  if (fs.existsSync(marker)) {
    console.log(`[telegram-admin] digest quotidien deja envoye: ${parisDay}`);
    return false;
  }
  const ok = await sendTelegramMessage(
    TELEGRAM_ADMIN_CHAT_ID,
    text,
    { adminDailyDigest: true }
  );
  if (ok) {
    fs.writeFileSync(marker, new Date().toISOString() + "\\n", { mode: 0o600 });
  }
  return ok;
}

// Génère un lien d'invitation Telegram à usage unique vers le canal premium.'''
    if source.count(old) != 1:
        raise SystemExit("BLOQUE: fin de sendTelegramMessage absente ou ambigue")
    source = source.replace(old, new, 1)

old_audit = '''  const msg = [entete, "", ...lignes, "", "━━━━━━━━━━━━━━━━━━", "👑 Hermès — audit automatique du matin"].join("\\n");
  const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, msg);'''
new_audit = '''  const msg = [entete, "", ...lignes, "", "━━━━━━━━━━━━━━━━━━", "👑 Hermès — audit automatique du matin"].join("\\n");
  const ok = await sendHermesDailyDigest(msg);'''
if old_audit in source:
    source = source.replace(old_audit, new_audit, 1)
elif new_audit not in source:
    raise SystemExit("BLOQUE: appel audit matinal absent ou ambigu")

path.write_text(source, encoding="utf-8")
PY

node --check "$TARGET"
AFTER_SHA="$(sha256sum "$TARGET" | awk '{print $1}')"
test "$BEFORE_SHA" != "$AFTER_SHA" || { echo "BLOQUE: aucun changement applique"; exit 1; }

docker compose build api
docker compose up -d --no-deps api

# L'audit a deja ete recu aujourd'hui. Ce marqueur empeche un nouvel envoi
# provoque uniquement par le redemarrage necessaire au deploiement.
docker exec -i touslesmatchs-api node - <<'NODE'
const fs = require("fs");
const d = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
fs.writeFileSync(`/data/hermes-daily-digest-${d}.sent`, new Date().toISOString() + "\n", { mode: 0o600 });
console.log("MARQUEUR_DIGEST_AUJOURDHUI=OK");
NODE

sleep 5

docker exec touslesmatchs-api sh -lc '
  grep -q "digest quotidien uniquement" /app/server.js
  grep -q "sendHermesDailyDigest" /app/server.js
  grep -q "CLIENT_OU25_MIN_CONFIDENCE = 72" /app/server.js
'

docker exec touslesmatchs-api node -e '
  const fs=require("fs");
  const d=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Paris"});
  const p="/data/hermes-daily-digest-"+d+".sent";
  if(!fs.existsSync(p)) process.exit(1);
  console.log("MARQUEUR_PERSISTANT=OK");
'

docker logs touslesmatchs-api --since 2m 2>&1 | tail -n 180 > /tmp/tlm-hermes-daily-verify.log
! grep -qE "\\[telegram\\] echec|CRASH-GUARD|SyntaxError" /tmp/tlm-hermes-daily-verify.log

curl -fsS https://www.touslesmatchs.com/api/health |
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"]; assert d["integrations"]["telegram"]["ok"]; print("API=OK TELEGRAM=OK")'

trap - ERR
echo "HERMES_DIGEST=UNE_FOIS_PAR_JOUR"
echo "SIGNAUX_CLIENTS=INCHANGES"
echo "SEUIL_72=CONSERVE"
echo "SAUVEGARDE=$BACKUP_DIR"
