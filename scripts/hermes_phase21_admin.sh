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
 -v /opt/touslesmatchs/data:/data \
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

RESPONSE=$(curl -fsS --max-time 20 \
 --data-urlencode "chat_id=$CHAT" \
 --data-urlencode "text=$TEXT" \
 "https://api.telegram.org/bot${TOKEN}/sendMessage") || exit 1
PROOF=$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); m=d.get("result",{}).get("message_id"); sys.exit(1) if d.get("ok") is not True or not isinstance(m,int) else print("telegram_message_id="+str(m))') || exit 1
printf '%s' "$HASH" > "$STATE"
echo "Hermes: rapport admin Telegram confirme — $PROOF"
