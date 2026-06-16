import urllib.request, json, time, os

token = None
with open('/opt/touslesmatchs/.env') as f:
    for line in f:
        if 'HERMES_ADMIN_TLM_BOT=8986544902' in line:
            token = line.strip().split('=', 1)[1]
            break

OFFSET_FILE = '/tmp/tg_offset.txt'
INBOX_FILE = '/tmp/tg_inbox.txt'
ADMIN_ID = '309921562'

print('Polling started...')
while True:
    try:
        offset = ''
        if os.path.exists(OFFSET_FILE):
            with open(OFFSET_FILE) as f:
                offset = '&offset=' + f.read().strip()
        
        url = f'https://api.telegram.org/bot{token}/getUpdates?limit=5&timeout=30{offset}'
        r = urllib.request.urlopen(url, timeout=35)
        data = json.loads(r.read())
        
        for upd in data.get('result', []):
            msg = upd.get('message', {})
            frm = msg.get('from', {})
            text = msg.get('text', '')
            
            if str(frm.get('id')) == ADMIN_ID and text:
                with open(INBOX_FILE, 'a') as f:
                    f.write(f"[{frm.get('first_name','?')}] {text}\n")
            
            with open(OFFSET_FILE, 'w') as f:
                f.write(str(upd.get('update_id', 0) + 1))
    except Exception as e:
        time.sleep(5)
