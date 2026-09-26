"""Owner Telegram console: explicit sender AND chat, read-only commands, mission inbox only."""
import json,pathlib,os,time,datetime,urllib.request,fcntl,sys
from tlm_guardian import ROOT,DATA,config,clean,summary
COMMANDS={'/status','/live','/analyses','/signaux','/shadow','/telegram','/budget','/disk','/audit','/mission'}
def authorized(message,env):
 user=env.get('TELEGRAM_ADMIN_USER_ID','');chat=env.get('TELEGRAM_ADMIN_CHAT_ID','')
 return bool(user and chat and str(message.get('from',{}).get('id'))==user and str(message.get('chat',{}).get('id'))==chat and not message.get('from',{}).get('is_bot') and not message.get('forward_origin') and not message.get('sender_chat'))
def handle(message,env,state,inbox):
 if not authorized(message,env):return None
 text=message.get('text','').strip();parts=text.split(None,1);cmd=parts[0].split('@')[0] if parts else ''
 if cmd not in COMMANDS:return 'Commande refusée. Lecture seule : /status /live /analyses /signaux /shadow /telegram /budget /disk /audit. Mission : /mission texte.'
 if cmd=='/mission':
  if len(parts)<2:return 'Utilise /mission suivi de la demande. Aucune commande système ne sera exécutée directement.'
  inbox.mkdir(mode=0o700,parents=True,exist_ok=True);p=inbox/(str(message.get('message_id'))+'.json')
  if not p.exists():p.write_text(json.dumps({'received_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'task':clean(parts[1]),'status':'pending_review','automatic_execution':False},ensure_ascii=False))
  return 'Mission enregistrée pour Codex. Aucune action système lancée ; les modifications sensibles restent soumises à validation.'
 if cmd in ['/status','/audit']:return summary(state)
 fields={'/live':('football','live_count','unexplained_pending'),'/analyses':('analyses','votes','attempts','jev'),'/signaux':('official','results'),'/shadow':('shadow',),'/telegram':('telegram','incidents'),'/budget':('budget','provider_blocks'),'/disk':('disk_percent',)}
 return clean(json.dumps({k:state.get(k) for k in fields[cmd]},ensure_ascii=False,indent=2))
def request(token,method,payload):
 req=urllib.request.Request('https://api.telegram.org/bot'+token+'/'+method,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
def main():
 env=config();token=env.get('HERMES_ADMIN_TLM_BOT')
 if not token or not env.get('TELEGRAM_ADMIN_USER_ID') or not env.get('TELEGRAM_ADMIN_CHAT_ID'):raise SystemExit('Activation refusée : token, utilisateur ET chat explicitement autorisés requis.')
 lock=open(DATA/'owner_remote.lock','a')
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:return
 offsetfile=DATA/'owner_remote_offset.json';offset=json.loads(offsetfile.read_text()).get('offset',0) if offsetfile.exists() else 0
 started=int(time.time());audit=DATA/'owner_remote_commands.jsonl'
 while True:
  try:
   result=request(token,'getUpdates',{'offset':offset,'timeout':25,'allowed_updates':['message']})
   if not result.get('ok'):time.sleep(10);continue
   for update in result.get('result',[]):
    message=update.get('message',{});ok=authorized(message,env);cmd=message.get('text','').split(' ',1)[0].split('@')[0]
    with audit.open('a') as f:f.write(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'update_id':update['update_id'],'authorized':ok,'command':cmd if cmd in COMMANDS else 'unknown'})+'\n')
    # Old queued messages cannot become new VPS missions after activation.
    if ok and message.get('date',0)>=started:
     state=json.loads((DATA/'hermes_guardian_state.json').read_text());answer=handle(message,env,state,DATA/'owner_missions')
     if answer:request(token,'sendMessage',{'chat_id':env['TELEGRAM_ADMIN_CHAT_ID'],'text':answer})
    offset=update['update_id']+1;offsetfile.write_text(json.dumps({'offset':offset}))
  except Exception:time.sleep(10)
if __name__=='__main__':main()
