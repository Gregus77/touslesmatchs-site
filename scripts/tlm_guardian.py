"""Owner supervisor. Reads production; never changes sporting rules or sends client signals."""
import os,json,sqlite3,pathlib,datetime,time,urllib.request,urllib.parse,subprocess,re,hashlib,fcntl,sys
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(os.environ.get('TLM_ROOT','/opt/touslesmatchs'))
DATA=ROOT/'data'
def config():
 out={}
 for line in (ROOT/'.env').read_text().splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);out[k.strip()]=v.strip().strip('\"\'')
 return out
def clean(s):return re.sub(r'(sk-[A-Za-z0-9_-]+|\d{8,}:[A-Za-z0-9_-]+)','[secret masqué]',str(s))[:3900]
def api(path):
 with urllib.request.urlopen('http://127.0.0.1:3001'+path,timeout=8) as r:return json.load(r)
def report(db,live=None,rules=None,disk=None):
 db.row_factory=sqlite3.Row
 tables={r[0] for r in db.execute("select name from sqlite_master where type='table'")}
 def query(sql):return [dict(r) for r in db.execute(sql)]
 out={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observation_started':None,'incidents':[]}
 out['football']={}
 if 'pipeline_observations' in tables:
  out['football']=dict(db.execute("select count(*) detected,sum(eligible) eligible,sum(current_eligible AND datetime(last_seen)>datetime('now','-15 minutes')) live_eligible,min(first_seen) since from pipeline_observations where day=date('now') and sport='Football'").fetchone())
 out['analyses']=query("select count(*) n from concile_analyses where date(analysed_at)=date('now')")[0]['n']
 out['votes']={str(i):0 for i in range(6)}
 for row in query("select votes_json from official_vote_snapshots where date(created_at)=date('now')"):
  votes=json.loads(row['votes_json']);n=sum(v.get('status')=='voted' for v in votes);out['votes'][str(min(5,n))]+=1
 out['attempts']=query("select outcome,stage,reason_category,count(*) n from football_analysis_attempts where date(started_at)=date('now') group by outcome,stage,reason_category")
 out['jev']=query("select final_decision,count(*) n from jev_decisions where date(created_at)=date('now') group by final_decision")
 out['official']=query("select count(*) n from official_signal_registry where date(created_at)=date('now')")[0]['n']
 out['telegram']=query("select channel,count(*) receipts,count(distinct official_signal_snapshot_id) signals from telegram_signal_deliveries where date(created_at)=date('now') and ok=1 and typeof(telegram_message_id)='integer' and telegram_message_id>0 group by channel")
 out['results']=query("select outcome,count(*) n from official_signal_results where date(resolved_at)=date('now') group by outcome") if 'official_signal_results' in tables else []
 send_without_registry=query("select snapshot_id from jev_decisions j where final_decision='SEND' and datetime(created_at)>datetime('now','-1 day') and datetime(created_at)<datetime('now','-3 minutes') and not exists(select 1 from official_signal_registry r where r.official_signal_snapshot_id=j.snapshot_id)")
 if send_without_registry:out['incidents'].append({'type':'jev_send_without_registry','count':len(send_without_registry)})
 missing=query("select r.official_signal_snapshot_id from official_signal_registry r where datetime(r.created_at)>datetime('now','-1 day') and datetime(r.created_at)<datetime('now','-3 minutes') and not exists(select 1 from telegram_signal_deliveries d where d.official_signal_snapshot_id=r.official_signal_snapshot_id and d.ok=1 and typeof(d.telegram_message_id)='integer' and d.telegram_message_id>0 and d.channel='premium')")
 if missing:out['incidents'].append({'type':'official_without_premium_receipt','count':len(missing)})
 orphan=query("select count(*) n from telegram_signal_deliveries d where date(d.created_at)=date('now') and d.ok=1 and typeof(d.telegram_message_id)='integer' and d.telegram_message_id>0 and not exists(select 1 from official_signal_registry r where r.official_signal_snapshot_id=d.official_signal_snapshot_id)")[0]['n']
 if orphan:out['incidents'].append({'type':'receipt_without_registry','count':orphan})
 out['shadow']=query("select sport,count(*) detected,sum(date(analysed_at)=date('now')) analysed_today,sum(selection in ('home','away')) predictions,sum(result='win') won,sum(result='loss') lost,sum(status='predicted') pending,sum(profit_10) theoretical_profit from multisport_shadow group by sport") if 'multisport_shadow' in tables else None
 out['budget']=query("select day,sum(charged_eur) charged_eur,sum(case when charged_eur IS NULL then reserved_eur else 0 end) reserved_eur,count(*) calls from openrouter_global_calls where day=date('now') group by day")
 out['provider_blocks']=query("select host,last_status,disabled_until from provider_health where datetime(disabled_until)>datetime('now')")
 out['rules']=rules
 if rules and rules.get('min_votes')!=3:out['incidents'].append({'type':'protected_quorum_changed'})
 if live is not None:
  out['live_count']=len(live.get('matches',[]))
  unknown=[m for m in live.get('matches',[]) if m.get('client_product_eligible') and m.get('ou25',{}).get('vote_count')==0 and not m.get('analysis_exclusion_reason') and not m.get('block_reason')]
  out['unexplained_pending']=len(unknown)
  out['unexplained_fixture_ids']=[str(m.get('fixtureId',m.get('id'))) for m in unknown]
 if disk is not None:
  out['disk_percent']=disk
  if disk>=80:out['incidents'].append({'type':'disk_high','percent':disk})
 for f in ['public/index.html','public/live-ia.html','public/app.html']:
  if (ROOT/f).exists() and 'marketText' not in (ROOT/f).read_text():out['incidents'].append({'type':'protected_ou25_display_missing','file':f})
 return out

def summary(r):
 f=r['football'];lines=['TLM — rapport propriétaire',f"Football détectés {f.get('detected','non mesuré')} / éligibles {f.get('eligible','non mesuré')}",f"Analyses {r['analyses']} · votes "+' '.join(k+'/5:'+str(v) for k,v in r['votes'].items()),'Jev '+json.dumps(r['jev'],ensure_ascii=False),f"Signaux {r['official']} · Telegram "+json.dumps(r['telegram'],ensure_ascii=False),'Résultats '+json.dumps(r['results'],ensure_ascii=False),'Shadow '+json.dumps(r['shadow'],ensure_ascii=False),'Budget '+json.dumps(r['budget'],ensure_ascii=False),'API-Sports '+json.dumps(r.get('api_sports')),'Disque '+str(r.get('disk_percent','inconnu'))+'%','Incidents '+json.dumps(r['incidents'],ensure_ascii=False)]
 return clean('\n'.join(lines))
def send_owner(text,env):
 token=env.get('HERMES_ADMIN_TLM_BOT');chat=env.get('TELEGRAM_ADMIN_CHAT_ID')
 if not token or not chat:return False
 body=json.dumps({'chat_id':chat,'text':clean(text)}).encode()
 req=urllib.request.Request('https://api.telegram.org/bot'+token+'/sendMessage',data=body,headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=10) as response:d=json.load(response)
  mid=d.get('result',{}).get('message_id')
  return mid if d.get('ok') and type(mid) is int and mid>0 else False
 except Exception:return False

def capture():
 db=sqlite3.connect('file:'+str(DATA/'tlm.db')+'?mode=ro',uri=True)
 try:
  live=api('/live-matches?cache_only=1');rules=api('/public-signal-rules')
 except Exception:live=None;rules=None
 st=os.statvfs(ROOT);disk=round(100*(1-st.f_bavail/st.f_blocks),1);r=report(db,live,rules,disk);db.close()
 try:
  secret=config().get('HERMES_ADMIN_TLM_BOT','')
  if secret:
   operations=api('/admin/operations-status?secret='+urllib.parse.quote(secret,safe=''))
   r['api_sports']=operations.get('api_sports');r['jev_enabled']=operations.get('jev_enabled');r['shadow_background_paused']=operations.get('shadow_background_paused')
   if any(t>time.time()*1000 for t in (r['api_sports'] or {}).get('blocked_until',{}).values()):r['incidents'].append({'type':'sports_api_rate_limited'})
 except Exception:r['api_sports']=None
 try:
  raw=subprocess.check_output(['docker','inspect','--format','{{.Name}} {{.State.Running}}','touslesmatchs-api','touslesmatchs-site','touslesmatchs-council','touslesmatchs-hermes-admin'],stderr=subprocess.DEVNULL,text=True,timeout=8)
  r['services']={line.split()[0].lstrip('/'):line.split()[1]=='true' for line in raw.splitlines()}
  if not all(r['services'].values()):r['incidents'].append({'type':'service_down'})
 except Exception:r['services']=None
 # A pending match is anomalous only after repeated unexplained observations (15 minutes).
 previous={}
 statefile=DATA/'hermes_guardian_state.json'
 if statefile.exists():
  try:previous=json.loads(statefile.read_text())
  except Exception:pass
 now=time.time();since=previous.get('pending_since',{});r['pending_since']={k:since.get(k,now) for k in r.get('unexplained_fixture_ids',[])}
 delayed=[k for k,t in r['pending_since'].items() if now-t>=900]
 if delayed:r['incidents'].append({'type':'eligible_without_attempt_15min','fixtures':delayed})
 if rules is None:r['incidents'].append({'type':'api_unavailable'})
 temp=DATA/'hermes_guardian_state.next';temp.write_text(json.dumps(r,ensure_ascii=False,indent=2));temp.replace(statefile)
 return r

def main():
 DATA.mkdir(exist_ok=True);lock=open(DATA/'hermes_guardian.lock','a')
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:return
 env=config()
 while True:
  try:
   r=capture();print(json.dumps({'at':r['at'],'incidents':r['incidents']}),flush=True)
   today=datetime.datetime.now(ZoneInfo('Europe/Paris'));receipt=DATA/('hermes-owner-report-'+today.strftime('%Y-%m-%d')+'.json')
   if '--once' not in sys.argv and today.hour==20 and not receipt.exists():
    mid=send_owner(summary(r),env)
    if mid:receipt.write_text(json.dumps({'sent_at':r['at'],'kind':'owner_daily_report','telegram_message_id':mid}))
  except Exception as e:print(json.dumps({'guardian_error':type(e).__name__}),flush=True)
  if '--once' in sys.argv:break
  time.sleep(60)
if __name__=='__main__':main()
