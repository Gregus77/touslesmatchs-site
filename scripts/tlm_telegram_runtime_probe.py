#!/usr/bin/env python3
"""Read-only runtime audit, or explicitly requested TEST messages. Never logs secrets."""
import argparse, json, os, sqlite3, subprocess, urllib.request, urllib.error
from pathlib import Path

def config(root):
    values={}
    for line in (root/'.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);values[k.strip()]=v.strip().strip('"').strip("'")
    return values

def http(url,payload=None,headers=None):
    try:
        body=json.dumps(payload).encode() if payload is not None else None
        req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json',**(headers or {})})
        with urllib.request.urlopen(req,timeout=20) as response:
            return {'http':response.status,'body':json.load(response)}
    except urllib.error.HTTPError as exc:
        return {'http':exc.code,'body':{},'error':'http_error'}
    except Exception:
        return {'http':None,'body':{},'error':'network_or_invalid_response'}

def telegram(token,method,payload=None):
    if not token:return {'http':None,'body':{},'error':'missing_token'}
    return http('https://api.telegram.org/bot'+token+'/'+method,payload)

def targets(env):
    return [
      ('hermes',env.get('HERMES_ADMIN_TLM_BOT'),env.get('TELEGRAM_ADMIN_CHAT_ID')),
      ('gratuit',env.get('TELEGRAM_BOT_TOKEN'),env.get('TELEGRAM_CHANNEL_ID') or env.get('TELEGRAM_FREE_CHANNEL_ID') or env.get('TELEGRAM_CHAT_ID')),
      ('premium',env.get('TELEGRAM_BOT_TOKEN'),env.get('TELEGRAM_PREMIUM_CHANNEL_ID'))]

def verify_target(token,chat):
    me=telegram(token,'getMe');bot=me['body'].get('result',{})
    if not me['body'].get('ok') or not chat:return {'ok':False,'stage':'bot_or_chat','http':me['http']}
    member=telegram(token,'getChatMember',{'chat_id':chat,'user_id':bot.get('id')})
    result=member['body'].get('result',{});status=result.get('status')
    ok=member['body'].get('ok') is True and status in ['administrator','creator'] and result.get('can_post_messages',True) is not False
    return {'ok':ok,'http':member['http'],'membership':status,'bot_id':bot.get('id')}

def send_test(db,role,token,chat,transport=telegram):
    key='tlm-telegram-test-20261009:'+role
    db.execute('CREATE TABLE IF NOT EXISTS probes (key TEXT PRIMARY KEY, chat TEXT NOT NULL, state TEXT NOT NULL, message_id INTEGER)')
    db.commit()
    db.execute('BEGIN IMMEDIATE')
    old=db.execute('SELECT chat,state,message_id FROM probes WHERE key=?',(key,)).fetchone()
    if old:
        db.commit();return {'state':old[1],'message_id':old[2],'reused':True,'destination_matches':old[0]==str(chat)}
    db.execute('INSERT INTO probes VALUES (?,?,?,NULL)',(key,str(chat),'sending'));db.commit()
    text='TEST — TousLesMatchs\nVérification technique des envois automatiques. Aucun signal sportif, aucune sélection à jouer.\nRéférence : tlm-telegram-test-20261009\n18+ — Jeu responsable. Aucun gain garanti. joueurs-info-service.fr'
    result=transport(token,'sendMessage',{'chat_id':chat,'text':text,'disable_notification':True})
    body=result['body'];item=body.get('result',{});mid=item.get('message_id')
    ok=result['http']==200 and body.get('ok') is True and type(mid) is int and mid>0 and str(item.get('chat',{}).get('id'))==str(chat)
    state='delivered' if ok else 'uncertain' if result['http'] is None or body.get('ok') else 'failed'
    db.execute('UPDATE probes SET state=?,message_id=? WHERE key=?',(state,mid if ok else None,key));db.commit()
    return {'state':state,'message_id':mid if ok else None,'http':result['http'],'reused':False}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['audit','test'],default='audit');args=parser.parse_args()
    root=Path('/opt/touslesmatchs');env=config(root)
    out={'mode':args.mode,'services':{},'telegram':{},'openrouter':{}}
    for name in ['tlm-hermes-guardian','tlm-owner-remote','tlm-owner-mission-runner']:
        r=subprocess.run(['systemctl','is-active',name],capture_output=True,text=True)
        out['services'][name]=r.stdout.strip()
    keys=['GOAL05_ENABLED','GOAL05_PUSH_ENABLED','TLM_LAUNCH_ALL_ACCESS','TLM_FREE_OFFER_CONFIRMED','TLM_FREE_OFFER_ENDS_AT','OPENROUTER_API_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHANNEL_ID','TELEGRAM_FREE_CHANNEL_ID','TELEGRAM_CHAT_ID','TELEGRAM_PREMIUM_CHANNEL_ID','OPENROUTER_DAILY_BUDGET_EUR','OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY']
    script='console.log(JSON.stringify(Object.fromEntries('+json.dumps(keys)+'.map(k=>[k,process.env[k]||""]))))'
    runtime=subprocess.run(['docker','exec','touslesmatchs-api','node','-e',script],capture_output=True,text=True)
    if runtime.returncode==0:
        values=json.loads(runtime.stdout);env.update(values)
        out['api_runtime']={k:values[k] for k in keys if not any(x in k for x in ['KEY','TOKEN','CHANNEL','CHAT'])}
    else:out['api_runtime']={'error':'container_unavailable','exit_code':runtime.returncode}
    rows=targets(env)
    ids=[str(chat) for _,_,chat in rows if chat]
    out['distinct_destinations']=len(ids)==3 and len(set(ids))==3
    for role,token,chat in rows:out['telegram'][role]=verify_target(token,chat)
    key=env.get('OPENROUTER_API_KEY')
    if key:
        for endpoint in ['credits','key']:
            res=http('https://openrouter.ai/api/v1/'+endpoint,headers={'Authorization':'Bearer '+key})
            data=res['body'].get('data',{})
            fields=['total_credits','total_usage'] if endpoint=='credits' else ['limit','limit_remaining','usage','usage_daily','usage_weekly','usage_monthly','is_free_tier','rate_limit']
            out['openrouter'][endpoint]={'http':res['http'],**{k:data.get(k) for k in fields}}
    else:out['openrouter']={'error':'missing_key'}
    out['automatic_topup_performed']=False
    dbpath=root/'data/tlm.db'
    if dbpath.exists():
        db=sqlite3.connect(dbpath.as_uri()+'?mode=ro',uri=True)
        try:
            tables={x[0] for x in db.execute('SELECT name FROM sqlite_master WHERE type="table"')}
            if 'client_telegram_outbox' in tables:
                out['outbox']=[dict(zip(['kind','channel','state','count'],r)) for r in db.execute('SELECT kind,channel,state,count(*) FROM client_telegram_outbox GROUP BY kind,channel,state')]
            if 'telegram_signal_deliveries' in tables:
                out['recent_delivery_ids']=[dict(zip(['channel','message_id','created_at'],r)) for r in db.execute('SELECT channel,telegram_message_id,created_at FROM telegram_signal_deliveries WHERE ok=1 ORDER BY created_at DESC LIMIT 8')]
        finally:db.close()
    if args.mode=='test':
        if not out['distinct_destinations'] or not all(v['ok'] for v in out['telegram'].values()):
            out['test_blocked']='bot_permissions_or_destinations'
        else:
            db=sqlite3.connect(root/'data/tlm_telegram_probe.sqlite')
            os.chmod(root/'data/tlm_telegram_probe.sqlite',0o600)
            out['tests']={role:send_test(db,role,token,chat) for role,token,chat in rows};db.close()
    print(json.dumps(out,ensure_ascii=False))

if __name__=='__main__':main()
