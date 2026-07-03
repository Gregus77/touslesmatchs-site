#!/bin/bash
TOKEN="${HERMES_ADMIN_TLM_BOT}"
if [ -z "$TOKEN" ]; then echo "HERMES_ADMIN_TLM_BOT not set"; exit 1; fi
CHAT_ID="${TELEGRAM_ADMIN_CHAT_ID:--1003818884997}"
ADMIN_ID="${TELEGRAM_ADMIN_USER_ID:-309921562}"
OFFSET_FILE=/tmp/hpoff.txt
[ -f $OFFSET_FILE ] && OFF="&offset=$(cat $OFFSET_FILE)" || OFF=''
RESP=$(curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates?limit=5&timeout=5${OFF}")
echo "$RESP" | python3 -c "
import sys,json,os
d=json.load(sys.stdin)
chat_id=os.environ.get('TELEGRAM_ADMIN_CHAT_ID','-1003818884997')
admin_id=os.environ.get('TELEGRAM_ADMIN_USER_ID','309921562')
for u in d.get('result',[]):
 m=u.get('message',{})
 c=m.get('chat',{})
 f=m.get('from',{})
 if str(c.get('id'))==chat_id and str(f.get('id'))==admin_id:
  open('/tmp/hermes_inbox.txt','w').write(m.get('text',''))
 open('/tmp/hpoff.txt','w').write(str(u.get('update_id',0)+1))
"
[ -f /tmp/hermes_inbox.txt ] && cat /tmp/hermes_inbox.txt && rm /tmp/hermes_inbox.txt
