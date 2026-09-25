#!/usr/bin/env bash

cd /opt/touslesmatchs
mkdir -p logs

LOCK="/tmp/tlm-hermes-phase21.lock"
exec 9>"$LOCK"
flock -n 9 || exit 0

REPORT=$(
docker run --rm \
 --env-file /opt/touslesmatchs/.env \
 -v /opt/touslesmatchs:/repo:ro \
 -v touslesmatchs_data:/data \
 -w /repo touslesmatchs-api:latest \
 sh -lc 'NODE_PATH=/app/node_modules node scripts/hermes_phase21_director.js' 2>&1
)

printf '%s\n' "$REPORT" >> logs/hermes-phase21.log

HASH=$(printf '%s' "$REPORT" | sha256sum | cut -d' ' -f1)
STATE="/opt/touslesmatchs/logs/hermes-phase21-last-hash"

if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$HASH" ]; then
 echo "Hermes: rapport identique — Telegram non renvoye."
 exit 0
fi

printf '%s' "$HASH" > "$STATE"

set -a
. /opt/touslesmatchs/.env
set +a

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT="${TELEGRAM_ADMIN_CHAT_ID:-${TELEGRAM_ADMIN_CHAT_ID_ELITE:-}}"

if [ -z "$TOKEN" ] || [ -z "$CHAT" ]; then
 echo "Hermes: Telegram admin non configure."
 exit 1
fi

TEXT="🤖 HERMÈS — RAPPORT AUTONOME

${REPORT}"

curl -fsS --max-time 20 \
 --data-urlencode "chat_id=$CHAT" \
 --data-urlencode "text=$TEXT" \
 "https://api.telegram.org/bot${TOKEN}/sendMessage" \
 >/dev/null

echo "Hermes: rapport admin Telegram envoye."
