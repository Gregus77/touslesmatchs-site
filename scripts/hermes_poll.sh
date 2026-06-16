#!/bin/bash
TOKEN=ODk4NjU0NDkwMjpBQUZkNkdrUktHUlBVSnBOZkdDNk9jSWNhM2lYN19EcGoyUQo=
TOKEN=$(echo $TOKEN | base64 -d | tr -d '
')
CHAT_ID='-1003818884997'
OFFSET_FILE=/tmp/hpoff.txt
[ -f $OFFSET_FILE ] && OFF="&offset=$(cat $OFFSET_FILE)" || OFF=''
RESP=$(curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates?limit=5&timeout=5${OFF}")
echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for u in d.get('result',[]):
 m=u.get('message',{})
 c=m.get('chat',{})
 f=m.get('from',{})
 if str(c.get('id'))=='-1003818884997' and str(f.get('id'))=='309921562':
  open('/tmp/hermes_inbox.txt','w').write(m.get('text',''))
 open('/tmp/hpoff.txt','w').write(str(u.get('update_id',0)+1))
"
[ -f /tmp/hermes_inbox.txt ] && cat /tmp/hermes_inbox.txt && rm /tmp/hermes_inbox.txt
