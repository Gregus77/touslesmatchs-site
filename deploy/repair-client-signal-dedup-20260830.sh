#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
TARGET="scripts/api_server.js"
BACKUP_DIR="/opt/backups/tlm-client-diffusion-$(date +%Y%m%d-%H%M%S)"

test -f "$TARGET" || { echo "BLOQUE: $TARGET absent"; exit 1; }
install -d -m 700 "$BACKUP_DIR"
cp -a "$TARGET" "$BACKUP_DIR/api_server.js"
sqlite3 data/tlm.db ".timeout 10000" ".backup '$BACKUP_DIR/tlm.db'"
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

# Le verrou historique se basait sur diffusion_block=NULL. Or ce champ est mis
# a NULL avant que Telegram confirme les envois asynchrones et peut donc etre
# NULL apres un envoi admin seul. Il ne constitue pas une preuve de livraison.
old_global = '    if (alreadySignaledToday(match)) return "signal deja envoye aujourd\'hui pour ce match";\n'
marker = "// Dedoublonnage par preuve Telegram et par canal client."
if marker not in source:
    if source.count(old_global) != 1:
        raise SystemExit("BLOQUE: verrou global absent ou ambigu")
    source = source.replace(old_global, "", 1)

    helper_anchor = "function alreadySignaledToday(match) {"
    helper = '''// Dedoublonnage par preuve Telegram et par canal client.
// Un passage dans Hermes ou un diffusion_block vide ne prouve jamais qu'un
// abonne a recu le signal. Seule une livraison Telegram client reussie compte.
function signalDeliveredToChannelToday(match, channel) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const key = canonicalMatchKey(match.home, match.away);
    const rows = db.prepare(`
      SELECT ca.home, ca.away
      FROM telegram_signal_deliveries td
      JOIN concile_analyses ca ON ca.match_key = td.match_key
      WHERE td.channel = ? AND td.ok = 1
        AND td.telegram_message_id IS NOT NULL
        AND date(td.created_at) = ?
    `).all(channel, todayStr);
    return rows.some((r) => canonicalMatchKey(r.home, r.away) === key);
  } catch (e) {
    console.error("[signal-fort] signalDeliveredToChannelToday:", e.message);
    return false;
  }
}

'''
    if source.count(helper_anchor) != 1:
        raise SystemExit("BLOQUE: insertion helper absente ou ambigue")
    source = source.replace(helper_anchor, helper + helper_anchor, 1)

replacements = [
    (
        "if (stdDistinct && gradeStandard && _standardSignalDaily.count < STANDARD_SIGNAL_DAILY_CAP) {",
        "if (stdDistinct && gradeStandard && _standardSignalDaily.count < STANDARD_SIGNAL_DAILY_CAP && !signalDeliveredToChannelToday(match, \"standard\")) {",
    ),
    (
        "if (TELEGRAM_PREMIUM_CHANNEL_ID && gradePremium && _premiumSignalDaily.count < PREMIUM_SIGNAL_DAILY_CAP) {",
        "if (TELEGRAM_PREMIUM_CHANNEL_ID && gradePremium && _premiumSignalDaily.count < PREMIUM_SIGNAL_DAILY_CAP && !signalDeliveredToChannelToday(match, \"premium\")) {",
    ),
    (
        "if (gradePremium && _freeSignalDailyDate.count < 1 && TELEGRAM_CHANNEL_ID) {",
        "if (gradePremium && _freeSignalDailyDate.count < 1 && TELEGRAM_CHANNEL_ID && !signalDeliveredToChannelToday(match, \"free\")) {",
    ),
]

for old, new in replacements:
    if new in source:
        continue
    if source.count(old) != 1:
        raise SystemExit(f"BLOQUE: condition absente ou ambigue: {old}")
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
PY

node --check "$TARGET"
AFTER_SHA="$(sha256sum "$TARGET" | awk '{print $1}')"
test "$BEFORE_SHA" != "$AFTER_SHA" || { echo "BLOQUE: aucun changement applique"; exit 1; }

docker compose build api
docker compose up -d --no-deps api
sleep 8

docker exec touslesmatchs-api sh -lc '
  grep -q "Dedoublonnage par preuve Telegram" /app/server.js
  grep -q "signalDeliveredToChannelToday(match, \"standard\")" /app/server.js
  grep -q "signalDeliveredToChannelToday(match, \"premium\")" /app/server.js
  grep -q "signalDeliveredToChannelToday(match, \"free\")" /app/server.js
  ! grep -q "if (alreadySignaledToday(match)) return" /app/server.js
  grep -q "CLIENT_OU25_MIN_CONFIDENCE = 72" /app/server.js
'

docker logs touslesmatchs-api --since 2m 2>&1 | tail -n 200 > /tmp/tlm-client-diffusion-verify.log
! grep -qE "SyntaxError|CRASH-GUARD|Cannot find module" /tmp/tlm-client-diffusion-verify.log

curl -fsS https://www.touslesmatchs.com/api/health |
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"]; assert d["integrations"]["telegram"]["ok"]; print("API=OK TELEGRAM=OK")'

docker exec touslesmatchs-api node -e '
  const D=require("better-sqlite3");
  const db=new D("/data/tlm.db",{readonly:true});
  const rows=db.prepare("SELECT channel, SUM(CASE WHEN ok=1 THEN 1 ELSE 0 END) ok, SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) ko FROM telegram_signal_deliveries WHERE date(created_at)=date(?) GROUP BY channel ORDER BY channel").all("now");
  console.log("LIVRAISONS_CLIENTS_AUJOURDHUI=",rows);
'

trap - ERR
echo "VERROU_ADMIN_VERS_CLIENT=CORRIGE"
echo "DEDOUBLONNAGE=PAR_CANAL_ET_PREUVE_TELEGRAM"
echo "SEUIL_72=CONSERVE"
echo "HERMES_DIGEST=CONSERVE"
echo "SAUVEGARDE=$BACKUP_DIR"
