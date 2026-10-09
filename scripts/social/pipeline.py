#!/usr/bin/env python3
"""Publication only. No sports decisions, no writes to the official database."""
import argparse
import base64
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

PARIS=ZoneInfo('Europe/Paris')
CTA='https://www.touslesmatchs.com/api/premium-checkout?lang=fr'
ROOT=Path(__file__).resolve().parents[2]
PNG=b'\x89PNG\r\n\x1a\n'

def stamp(value):
    if not isinstance(value,str) or not re.search(r'(Z|[+-]\d\d:\d\d)$',value):raise ValueError('timestamp_required')
    return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()

def iso(now=None):return datetime.fromtimestamp(time.time() if now is None else now,timezone.utc).isoformat()

def atomic(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.'+path.name,dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(data if isinstance(data,bytes) else data.encode());f.flush();os.fsync(f.fileno())
        os.chmod(tmp,0o644);os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def candidate(row,now):
    f={k:row.get(k) for k in ['fixtureId','home','away','targetTeam','targetSide','targetRank','opponentRank','total','country','countryCode','competition','kickoff','verifiedAt','whitelist','source']}
    if not isinstance(f['fixtureId'],str) or not re.fullmatch(r'\d+',f['fixtureId']):raise ValueError('fixture_id')
    for k in ['home','away','targetTeam','country','competition']:
        if not isinstance(f[k],str) or not 0<len(f[k])<=120:raise ValueError('missing_'+k)
    if f['source']!='canonical_scanner' or f['whitelist'] is not True:raise ValueError('source_or_whitelist')
    if not isinstance(f['countryCode'],str) or not re.fullmatch('[A-Z]{2}',f['countryCode']):raise ValueError('country_code')
    if f['targetSide'] not in ['home','away'] or f[f['targetSide']]!=f['targetTeam']:raise ValueError('target')
    if any(type(f[k]) is not int for k in ['targetRank','opponentRank','total']):raise ValueError('rank_unknown')
    if not (f['total']>=10 and 1<=f['targetRank']<=5 and f['total']-4<=f['opponentRank']<=f['total']):raise ValueError('top_bottom')
    if not (0<=now-stamp(f['verifiedAt'])<=4*3600 and now<stamp(f['kickoff'])):raise ValueError('stale_or_started')
    return f

def after(f,result,before,now):
    if not before or before['createdAt']>=stamp(f['kickoff']):raise ValueError('before_required')
    if result.get('source')!='api-sports' or str(result.get('fixtureId'))!=f['fixtureId'] or result.get('status') not in ['FT','AET','PEN']:raise ValueError('final_provider_required')
    if any(type(result.get(k)) is not int or result[k]<0 for k in ['home','away']):raise ValueError('score_unknown')
    if not stamp(f['kickoff'])<stamp(result['verifiedAt'])<=now:raise ValueError('result_time')
    goals=result[f['targetSide']]
    return {**f,'result':result,'classification':'observation_positive' if goals>=1 else 'observation_negative'}

def content(f,phase,lang,test=False):
    if phase not in ['before','after'] or lang not in ['fr','en']:raise ValueError('content_type')
    fr=lang=='fr';flag=''.join(chr(127397+ord(c)) for c in f['countryCode'])
    at=datetime.fromtimestamp(stamp(f['kickoff']),PARIS).strftime('%d/%m/%Y %H:%M')
    title=('SURVEILLANCE' if fr else 'WATCHLIST') if phase=='before' else ('BILAN' if fr else 'REVIEW')
    label=('Observation positive' if fr else 'Positive observation') if f.get('classification')=='observation_positive' else ('Observation négative' if fr else 'Negative observation')
    if f.get('classification') in ['WIN','LOSS']:label=f['classification']+' · '+('signal officiel diffusé' if fr else 'delivered official signal')
    lines=[title,f['targetTeam'],f['home']+' — '+f['away'],flag+' '+f['country']+' · '+f['competition'],at+' Paris',
           ('Cible : +0,5 but — au moins 1 but' if fr else 'Target: +0.5 team goals — at least 1 goal'),
           f"Top {f['targetRank']} / {f['total']} · {f['opponentRank']} / {f['total']}"]
    if phase=='before':lines+=['Surveillance uniquement — aucun signal jouable.' if fr else 'Watchlist only — no playable signal.',
                                'Validation live requise, dont cote réelle fraîche ≥ 1,60.' if fr else 'Live validation required, including fresh real odds ≥ 1.60.']
    else:lines+=[label,f"{f['result']['home']} — {f['result']['away']}",
                (('Résultat officiel, sans calcul de profit.' if fr else 'Official result, no profit calculation.') if f.get('classification') in ['WIN','LOSS'] else ('Aucun gain déduit de cette observation.' if fr else 'No profit inferred from this observation.'))]
    lines+=['Carte reconstituée · TousLesMatchs' if fr else 'Reconstructed card · TousLesMatchs',
            'Premium · 14,90 EUR/mois' if fr else 'Premium · 14.90 EUR/month',
            '18+ · joueurs-info-service.fr',
            'Aucun gain garanti.' if fr else 'No guaranteed returns.']
    if test:lines.insert(0,'TEST NE PAS DIFFUSER')
    return {'fixtureId':f['fixtureId'],'phase':phase,'lang':lang,'facts':f,'test':test,'layout':'tlm-mobile-v1',
            'lines':lines,'caption':'\n\n'.join(lines),'cta':CTA}

class Store:
    def __init__(self,path):
        Path(path).parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(path,timeout=30,isolation_level=None);self.db.row_factory=sqlite3.Row
        self.db.executescript('''PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS delivery(key TEXT PRIMARY KEY,state TEXT NOT NULL,proof TEXT NOT NULL,updated REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS cards(key TEXT PRIMARY KEY,body TEXT NOT NULL,created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS images(key TEXT PRIMARY KEY,day TEXT NOT NULL,cents INTEGER NOT NULL,state TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS site_history(key TEXT PRIMARY KEY,published REAL NOT NULL);''')
    def claim(self,key):
        return self.db.execute("INSERT OR IGNORE INTO delivery VALUES(?,'uncertain','{}',?)",(key,time.time())).rowcount==1
    def finish(self,key,state,proof):
        self.db.execute('UPDATE delivery SET state=?,proof=?,updated=? WHERE key=?',(state,json.dumps(proof),time.time(),key))
    def breaker(self,status):self.db.execute("INSERT OR REPLACE INTO settings VALUES('image_breaker',?)",(str(status),))
    def reserve_image(self,key,day,cents,cap):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            used=self.db.execute('SELECT COALESCE(SUM(cents),0) FROM images WHERE day=?',(day,)).fetchone()[0]
            if cents<=0 or cap<=0 or used+cents>cap or self.db.execute("SELECT 1 FROM settings WHERE key='image_breaker'").fetchone():return False
            return self.db.execute("INSERT OR IGNORE INTO images VALUES(?,?,?,'reserved')",(key,day,cents)).rowcount==1
        finally:self.db.execute('COMMIT')
    def save_card(self,c,now):
        key=f"{c['fixtureId']}:{c['phase']}:{c['lang']}"
        self.db.execute('INSERT OR IGNORE INTO cards VALUES(?,?,?)',(key,json.dumps(c,ensure_ascii=False),now))
    def before(self,fixture):
        row=self.db.execute("SELECT body,created FROM cards WHERE key=?",(fixture+':before:fr',)).fetchone()
        return {'facts':json.loads(row['body'])['facts'],'createdAt':row['created']} if row else None

def receipt(dest,r):
    if dest.startswith('telegram_'):
        mid=r.get('result',{}).get('message_id')
        if r.get('ok') is True and type(mid) is int and mid>0:return 'published',{'message_id':mid}
        return 'uncertain',{}
    if r.get('status')=='PUBLISHED' and r.get('id') and isinstance(r.get('url'),str) and r['url'].startswith('https://'):
        return 'published',{'id':r['id'],'url':r['url']}
    if r.get('status')=='PENDING' and r.get('id'):return 'pending',{'id':r['id']}
    return 'uncertain',{}

def deliver(store,c,dest,transport,now=None,dry_run=False):
    now=time.time() if now is None else now
    if dry_run:return 'dry_run'
    if c['test']:raise ValueError('test_not_publishable')
    if dest not in ['telegram_free','telegram_premium','instagram','facebook']:raise ValueError('destination_not_allowed')
    if c['phase']=='before' and now>=stamp(c['facts']['kickoff']):return 'expired'
    key=f"{c['fixtureId']}:{c['phase']}:{c['lang']}:{dest}"
    if c['phase']=='after' and not store.db.execute("SELECT 1 FROM delivery WHERE key=? AND state='published'",(f"{c['fixtureId']}:before:{c['lang']}:{dest}",)).fetchone():return 'before_unpublished'
    if not store.claim(key):return 'already_claimed'
    try:state,proof=receipt(dest,transport())
    except Exception:state,proof='uncertain',{} # never persist exception URLs/credentials
    store.finish(key,state,proof);return state

def seed_october9(store):
    # Owner-supplied receipts, not newly verified fixtures. FR only. No EN receipt.
    for fid,home,away,country,code,league,rank,opprank,kickoff in [
        ('1549031','Nordsjaelland','Odense','Danemark','DK','Superliga',4,9,'2026-10-09T17:00:00Z'),
        ('1622650','Kazma','Al Arabi','Koweït','KW','Premier League',1,10,'2026-10-09T17:05:00Z')]:
        facts={'fixtureId':fid,'home':home,'away':away,'targetTeam':home,'targetSide':'home','targetRank':rank,
               'opponentRank':opprank,'total':12,'country':country,'countryCode':code,'competition':league,
               'kickoff':kickoff,'verifiedAt':'2026-10-09T01:45:00Z','source':'owner_handoff_2026-10-09',
               'whitelist':None}
        # Archive supplied facts only. Never use this handoff as a fresh scanner verification.
        store.save_card(content(facts,'before','fr'),stamp('2026-10-09T01:45:00Z'))
    for fixture in ['1549031','1622650']:
        for dest,proof in [('telegram_free',{'message_id':623}),('telegram_premium',{'message_id':210}),
                           ('instagram',{'id':391683938,'url':'https://www.instagram.com/p/DeQXlLFjTAQ/'}),
                           ('facebook',{'id':391683938,'url':'https://facebook.com/122103473883500089/posts/122103525045500089'})]:
            key=f'{fixture}:before:fr:{dest}'
            if store.claim(key):store.finish(key,'published',{**proof,'provenance':'owner_handoff_2026-10-09','scope':'shared_FR_card'})

class HttpFailure(Exception):
    def __init__(self,status):self.status=status

def request(url,body=None,headers=None,timeout=90):
    # No redirects: never forward Authorization to another origin.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args):return None
    req=urllib.request.Request(url,data=body,headers=headers or {})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=timeout) as r:return json.loads(r.read())
    except urllib.error.HTTPError as e:raise HttpFailure(e.code) from None

def background(store,c,cfg,folder):
    key=c['fixtureId']+':'+c['phase'];tag=hashlib.sha256(key.encode()).hexdigest()[:24]
    path=folder/(tag+'-openai.png')
    if path.exists():return path
    model=cfg.get('imageModel');cents=cfg.get('imageReservationCents',0);cap=cfg.get('imageDailyCapCents',0)
    if not isinstance(model,str) or not model or type(cents) is not int or type(cap) is not int or not os.environ.get('OPENAI_API_KEY'):raise ValueError('openai_runtime_configuration_missing')
    day=datetime.now(PARIS).strftime('%Y-%m-%d')
    if not store.reserve_image(key,day,cents,cap):raise ValueError('image_budget_breaker_or_previous_attempt')
    prompt='Create a subtle dark navy football stadium background, portrait, generous empty center and margins, sober gold accent. No text, no numbers, no logos, no people, no betting slips. This background will support a factual reconstructed TousLesMatchs editorial card.'
    atomic(folder/(tag+'-prompt.json'),json.dumps({'prompt':prompt,'model':model,'createdAt':iso(),'source':'OpenAI Images API','factsHash':hashlib.sha256(json.dumps(c['facts'],sort_keys=True).encode()).hexdigest()}))
    try:
        r=request('https://api.openai.com/v1/images/generations',json.dumps({'model':model,'prompt':prompt,'n':1,'size':'1024x1536','quality':'low','output_format':'png'}).encode(),{'Authorization':'Bearer '+os.environ['OPENAI_API_KEY'],'Content-Type':'application/json'})
        data=base64.b64decode(r['data'][0]['b64_json'],validate=True)
        if not data.startswith(PNG):raise ValueError('not_png')
        atomic(path,data)
        atomic(folder/(tag+'-response.json'),json.dumps({'created':r.get('created'),'usage':r.get('usage'),'model':model,'receivedAt':iso(),'sha256':hashlib.sha256(data).hexdigest()}))
        store.db.execute("UPDATE images SET state='complete' WHERE key=?",(key,));return path
    except HttpFailure as e:
        if e.status in [401,402,403,429]:store.breaker(e.status)
        raise ValueError('image_http_'+str(e.status)) from None

def render_card(c,path,bg=None):
    from PIL import Image,ImageDraw,ImageFont
    im=Image.open(bg).convert('RGB').resize((1080,1620)) if bg else Image.new('RGB',(1080,1620),'#0b1426')
    draw=ImageDraw.Draw(im,'RGBA');draw.rectangle((25,25,1055,1595),fill=(7,15,29,235))
    font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    code=c['facts']['countryCode']
    if code=='FR':
        for i,color in enumerate(['#002395','#ffffff','#ed2939']):draw.rectangle((930+i*30,55,959+i*30,115),fill=color)
    elif code=='DK':
        draw.rectangle((930,55,1020,115),fill='#c8102e');draw.rectangle((955,55,965,115),fill='white');draw.rectangle((930,80,1020,90),fill='white')
    elif code=='KW':
        for i,color in enumerate(['#007a3d','#ffffff','#ce1126']):draw.rectangle((930,55+i*20,1020,74+i*20),fill=color)
        draw.polygon([(930,55),(950,75),(950,95),(930,115)],fill='black')
    else:raise ValueError('flag_asset_missing')
    y=135
    for index,line in enumerate(c['lines']):
        # Flags are drawn separately with the country code to avoid missing glyphs.
        line=re.sub('[\U0001F1E6-\U0001F1FF]','',line).strip()
        size=48 if line==c['facts']['targetTeam'] else 30
        ft=ImageFont.truetype(bold if index<2 or line==c['facts']['targetTeam'] else font,size)
        words=line.split();wrapped=[];current=''
        for word in words:
            nxt=(current+' '+word).strip()
            if draw.textlength(nxt,font=ft)>945 and current:wrapped.append(current);current=word
            else:current=nxt
        wrapped.append(current)
        if len(wrapped)*(size+11)>95:raise ValueError('card_slot_overflow')
        slot_y=y
        for chunk in wrapped:
            draw.text((65,slot_y),chunk,font=ft,fill='#f5f7fa');slot_y+=size+11
        y+=95  # Identical semantic positions in both languages, regardless of wrapping.
    if y>1580:raise ValueError('card_overflow')
    import io
    output=io.BytesIO();im.save(output,format='PNG');atomic(path,output.getvalue())

def runtime_routes():
    # Reuse exact JS routing and bookmaker configuration; never read an env file.
    code="const t=require('./scripts/telegram_client');const b=require('./scripts/bookmakers.config');process.stdout.write(JSON.stringify({targets:t.destinations(process.env).filter(x=>x.lang==='fr'),buttons:b.bookmakerButtons}));"
    result=subprocess.run(['node','-e',code],cwd=ROOT,capture_output=True,text=True,check=True)
    return json.loads(result.stdout)

def telegram(c,png,target,buttons):
    token=os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:raise ValueError('telegram_runtime_missing')
    caption=html.escape(c['caption']).replace(html.escape(c['facts']['targetTeam']),'<b>'+html.escape(c['facts']['targetTeam'])+'</b>',1)
    if len(caption)>1024:raise ValueError('telegram_caption_limit')
    keyboard=[[{'text':'Premium · 14,90 EUR/mois','url':CTA}]]
    keyboard+=[[{'text':'Bilans / Reviews','url':'https://www.touslesmatchs.com/social/'}]]
    keyboard+=[[{'text':'Sponsored · '+b['text'],'url':b['url']} for b in buttons[i:i+2]] for i in range(0,len(buttons),2)]
    boundary='tlm-'+os.urandom(12).hex();parts=[]
    for key,value in {'chat_id':target['id'],'caption':caption,'parse_mode':'HTML','reply_markup':json.dumps({'inline_keyboard':keyboard})}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="card.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+png.read_bytes()+b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return request('https://api.telegram.org/bot'+token+'/sendPhoto',b''.join(parts),{'Content-Type':'multipart/form-data; boundary='+boundary},30)

def site(store,webroot,test=False):
    cards=[json.loads(r[0]) for r in store.db.execute('SELECT body FROM cards ORDER BY created DESC')]
    visible_before=[]
    if not test:
        candidates=[c for c in cards if not c['test']];cards=[]
        for c in candidates:
            before_key=f"{c['fixtureId']}:before:{c['lang']}"
            known=store.db.execute('SELECT 1 FROM site_history WHERE key=?',(before_key,)).fetchone()
            proofs=store.db.execute("SELECT proof,updated FROM delivery WHERE key LIKE ? AND state='published'",(before_key+':%',)).fetchall()
            published=known or any(p['updated']<stamp(c['facts']['kickoff']) or json.loads(p['proof']).get('provenance')=='owner_handoff_2026-10-09' for p in proofs)
            if not published and time.time()+30>=stamp(c['facts']['kickoff']):continue
            if c['phase']=='before':visible_before.append(before_key)
            cards.append(c)
    root=Path(webroot)/'social';root.mkdir(parents=True,exist_ok=True)
    # One complete version contains source JSON and both languages; pointer replacement is atomic.
    version='v-'+str(time.time_ns());out=root/version;out.mkdir()
    atomic(out/'content.json',json.dumps({'updatedAt':iso(),'cards':cards},ensure_ascii=False))
    for lang in ['fr','en']:
        title='Surveillances et bilans +0,5 équipe' if lang=='fr' else 'Team +0.5 watchlist and reviews'
        articles=[]
        for c in cards:
            if c['lang']!=lang:continue
            archive='<p>Archive pré-match / Pre-match archive</p>' if c['phase']=='before' and time.time()>=stamp(c['facts']['kickoff']) else ''
            articles.append(archive+'<article id="'+c['fixtureId']+'-'+c['phase']+'"><h2>'+html.escape(c['facts']['targetTeam'])+'</h2>'+''.join('<p>'+html.escape(x)+'</p>' for x in c['lines'])+'</article>')
        page='<!doctype html><html lang="'+lang+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | TousLesMatchs</title><meta name="description" content="'+title+' — observations datées, séparées des résultats officiels."><link rel="alternate" hreflang="fr" href="https://www.touslesmatchs.com/social/current/fr.html"><link rel="alternate" hreflang="en" href="https://www.touslesmatchs.com/social/current/en.html"><style>body{font:18px/1.6 system-ui;background:#0b1426;color:#f5f7fa;max-width:720px;margin:auto;padding:20px}article{border:1px solid #506080;border-radius:16px;padding:20px;margin:24px 0}a{color:#ffdc80}</style><nav><a href="fr.html">Français</a> · <a href="en.html">English</a> · <a href="/app">App</a></nav><h1>'+title+'</h1><p>'+iso()+'</p>'+(''.join(articles) or '<p>Aucune publication vérifiée / No verified publication.</p>')+'<a href="'+CTA+'">Premium · 14,90 EUR/mois</a><p>18+ · joueurs-info-service.fr</p></html>'
        atomic(out/(lang+'.html'),page)
    tmp=root/('.current-'+version);tmp.symlink_to(version,target_is_directory=True);os.replace(tmp,root/'current')
    for key in visible_before:store.db.execute('INSERT OR IGNORE INTO site_history VALUES(?,?)',(key,time.time()))
    atomic(root/'index.html','<!doctype html><meta charset="utf-8"><title>Bilans | TousLesMatchs</title><a href="current/fr.html">Surveillances et bilans — Français</a> · <a href="current/en.html">Watchlist and reviews — English</a>')

def official_result(db_path,f):
    """Read only known public evidence tables. Never query scanner KPIs or personal tables."""
    from urllib.parse import quote
    db=sqlite3.connect('file:'+quote(str(Path(db_path).resolve()))+'?mode=ro',uri=True)
    db.row_factory=sqlite3.Row
    try:
        rows=db.execute('''SELECT g.*,r.outcome,r.final_score_home,r.final_score_away,r.resolved_at,
          d.telegram_message_id,d.created_at AS delivered_at
          FROM goal05_signal_registry g JOIN goal05_signal_results r USING(signal_key)
          JOIN telegram_signal_deliveries d ON d.match_key=g.signal_key
          WHERE g.fixture_id=? AND g.team=? AND d.ok=1 AND d.telegram_message_id>0''',(f['fixtureId'],f['targetTeam'])).fetchall()
        for r in rows:
            c=json.loads(r['criteria_json']);decision=stamp(r['created_at'])
            delivered=datetime.fromisoformat(r['delivered_at'].replace('Z','+00:00'))
            if delivered.tzinfo is None:delivered=delivered.replace(tzinfo=timezone.utc)
            checks=['eligible','play','historicalVerified','formVerified','opponentConcedes','liveStatsVerified','motivationVerified','qualityVerified','oddFreshVerified','aiConsensusVerified']
            if not all(c.get(k) is True for k in checks):continue
            if c.get('policyVersion')!='goal05_v2_20261006' or c.get('color')!='green':continue
            if not (30<=r['minute']<=85 and r['odd']>=1.60 and 4<=r['votes']<=5 and c.get('rating',0)>=8 and c.get('coveragePct',0)>=75):continue
            if not (0<=decision-stamp(c['oddFetchedAt'])<=120 and decision<=delivered.timestamp()<stamp(r['resolved_at'])):continue
            if r['score_home' if f['targetSide']=='home' else 'score_away']!=0:continue
            if r['final_score_home']!=f['result']['home'] or r['final_score_away']!=f['result']['away']:continue
            expected='win' if f['result'][f['targetSide']]>=1 else 'loss'
            if r['outcome']!=expected:continue
            return {'classification':expected.upper(),'signalEvidence':{'signalKey':r['signal_key'],'decisionAt':r['created_at'],'message_id':r['telegram_message_id'],'deliveredAt':iso(delivered.timestamp()),'resolvedAt':r['resolved_at']}}
        return None
    finally:db.close()

def metricool_request(path,body=None):
    from urllib.parse import urlencode
    token=os.environ.get('METRICOOL_API_TOKEN');user=os.environ.get('METRICOOL_USER_ID');brand=os.environ.get('METRICOOL_BLOG_ID')
    if not token or not user or brand!='7314226':raise ValueError('metricool_server_configuration_missing')
    query=urlencode({'userId':user,'blogId':brand})
    return request('https://app.metricool.com/api'+path+'?'+query,
                   None if body is None else json.dumps(body).encode(),
                   {'X-Mc-Auth':token,'Content-Type':'application/json'},30)

def metricool_receipt(response,dest):
    data=response.get('data',{});provider=next((p for p in data.get('providers',[]) if p.get('network')==dest),{})
    return {'id':data.get('id'),'status':provider.get('status'),'url':provider.get('publicUrl')}

def metricool(c,dest,url,cfg):
    # Scheduling has no documented hard publish-before deadline. Fail closed for before cards.
    if c['phase']=='before':raise ValueError('metricool_prematch_deadline_unsupported')
    if cfg.get('metricoolVerifiedNetworks',{}).get(dest) is not True:raise ValueError('metricool_connection_unverified')
    if not url.startswith('https://www.touslesmatchs.com/media/social/'):raise ValueError('media_origin')
    text=c['caption']+'\n\n'+CTA
    if dest=='instagram':
        text=c['caption']+'\n\nTousLesMatchs.com'
        if cfg.get('instagramBioVerified') is True:text+='\n'+('Lien en bio.' if c['lang']=='fr' else 'Link in bio.')
    body={'text':text,'providers':[{'network':dest}],
          'publicationDate':{'dateTime':datetime.now(PARIS).strftime('%Y-%m-%dT%H:%M:%S'),'timezone':'Europe/Paris'},
          'media':[url],'autoPublish':True,'saveExternalMediaFiles':True,'draft':False}
    return metricool_receipt(metricool_request('/v2/scheduler/posts',body),dest)

def reconcile_metricool(store):
    for row in store.db.execute("SELECT * FROM delivery WHERE state='pending'").fetchall():
        dest=row['key'].split(':')[-1];proof=json.loads(row['proof'])
        if dest not in ['instagram','facebook'] or not str(proof.get('id','')).isdigit():continue
        try:
            result=metricool_receipt(metricool_request('/v2/scheduler/posts/'+str(proof['id'])),dest)
            state,newproof=receipt(dest,result)
            store.finish(row['key'],state,newproof or proof)
        except Exception:pass # no POST retry; admin sees persisted pending

def process(source,store,cfg,output,now,dry_run=True,offline=False,review=True):
    cards=[];report={'createdAt':iso(),'mode':'TEST NE PAS DIFFUSER' if dry_run else 'production','blocked':[],'deliveries':[]}
    if source.get('schema')!=1:raise ValueError('source_schema')
    for raw in source.get('matches',{}).values():
        fid=str(raw.get('fixtureId',''));prior=store.before(fid)
        try:
            if not dry_run and raw.get('test') is True:raise ValueError('test_source_forbidden')
            if raw.get('result'):
                if not prior:raise ValueError('no_before_archive')
                f=after(prior['facts'],raw['result'],prior,now);phase='after'
                if not offline and cfg.get('officialDb'):
                    evidence=official_result(cfg['officialDb'],f)
                    if evidence:f.update(evidence)
            else:
                if not review:continue
                f=candidate({**raw,'countryCode':cfg.get('countryCodes',{}).get(raw.get('country'))},now);phase='before'
            for lang in ['fr','en']:
                if phase=='after' and not store.db.execute('SELECT 1 FROM cards WHERE key=?',(fid+':before:'+lang,)).fetchone():
                    report['blocked'].append({'fixtureId':fid,'stage':'missing_before_translation','lang':lang});continue
                key=f'{fid}:{phase}:{lang}'
                old=store.db.execute('SELECT body FROM cards WHERE key=?',(key,)).fetchone()
                c=json.loads(old[0]) if old else content(f,phase,lang,dry_run)
                # A frozen pre-match record cannot be rewritten later using new facts.
                if not old:store.save_card(c,now)
                cards.append(c)
        except (ValueError,KeyError,TypeError,sqlite3.Error):report['blocked'].append({'fixtureId':fid,'stage':'source_validation'})
    routes={'targets':[],'buttons':[]}
    if not dry_run:
        try:routes=runtime_routes()
        except Exception:report['blocked'].append({'stage':'telegram_runtime_routes'})
        if cfg.get('metricoolEnabled'):reconcile_metricool(store)
    for c in cards:
        png=output/(c['fixtureId']+'-'+c['phase']+'-'+c['lang']+'.png')
        try:
            bg=None if dry_run else background(store,c,cfg,output)
            render_card(c,png,bg)
        except Exception:
            report['blocked'].append({'fixtureId':c['fixtureId'],'stage':'image'});continue
        if dry_run:continue
        atomic(Path(cfg['webroot'])/'media/social'/png.name,png.read_bytes())
        for target in routes['targets']:
            if not os.environ.get('TELEGRAM_BOT_TOKEN'):
                report['blocked'].append({'stage':'telegram_runtime_missing'});continue
            dest='telegram_'+target['channel']
            state=deliver(store,c,dest,lambda:telegram(c,png,target,routes['buttons']))
            report['deliveries'].append({'fixtureId':c['fixtureId'],'lang':c['lang'],'destination':dest,'state':state})
        if cfg.get('metricoolEnabled'):
            if not os.environ.get('METRICOOL_API_TOKEN') or not os.environ.get('METRICOOL_USER_ID') or os.environ.get('METRICOOL_BLOG_ID')!='7314226':
                report['blocked'].append({'stage':'metricool_server_configuration_missing'});continue
            for dest in ['instagram','facebook']:
                if c['phase']=='before':
                    report['blocked'].append({'fixtureId':c['fixtureId'],'stage':'metricool_prematch_deadline'});continue
                if cfg.get('metricoolVerifiedNetworks',{}).get(dest) is not True:
                    report['blocked'].append({'stage':'metricool_connection','destination':dest});continue
                media=Path(cfg['webroot'])/'media/social'/png.name
                atomic(media,png.read_bytes())
                state=deliver(store,c,dest,lambda:metricool(c,dest,'https://www.touslesmatchs.com/media/social/'+png.name,cfg))
                report['deliveries'].append({'fixtureId':c['fixtureId'],'lang':c['lang'],'destination':dest,'state':state})
    site(store,output/'web' if dry_run else cfg['webroot'],test=dry_run)
    report['attention']=[dict(r) for r in store.db.execute("SELECT key,state FROM delivery WHERE state IN ('uncertain','pending')")]
    atomic(output/'report.json',json.dumps(report,ensure_ascii=False,indent=2))
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['once','offline','status'])
    parser.add_argument('--config',default=str(ROOT/'config/social-publication.json'))
    parser.add_argument('--output',default=str(ROOT/'reports/social-offline'))
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args();cfg=json.loads(Path(args.config).read_text())
    if args.command=='offline' and args.publish:raise ValueError('offline_publish_forbidden')
    live=args.publish and args.command=='once'
    if live and cfg.get('enabled') is not True:raise ValueError('publication_disabled')
    output=Path(cfg['stateDir'] if live or args.command=='status' else args.output)
    if not live and args.command!='status' and (ROOT/'public').resolve() in [output.resolve(),*output.resolve().parents]:raise ValueError('test_public_path_forbidden')
    output.mkdir(parents=True,exist_ok=True)
    import fcntl
    with open(output/'worker.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        store=Store(output/'state.db')
        if args.command=='status':
            print(json.dumps({'deliveryStates':[dict(r) for r in store.db.execute('SELECT state,count(*) count FROM delivery GROUP BY state')],
                              'imageBreaker':bool(store.db.execute("SELECT 1 FROM settings WHERE key='image_breaker'").fetchone())}));return
        if live:seed_october9(store)
        now=time.time()
        if args.command=='offline':
            now=datetime(2030,1,1,12,tzinfo=timezone.utc).timestamp()
            source=json.loads((ROOT/'tests/social/offline.json').read_text())
        else:source=json.loads(Path(cfg['sourceFile']).read_text())
        p=datetime.fromtimestamp(now,PARIS);slot=p.strftime('%Y-%m-%d')+':'+str(p.hour//4)
        last=store.db.execute("SELECT value FROM settings WHERE key='review_slot'").fetchone()
        review=not last or last[0]!=slot
        report=process(source,store,cfg,output,now,dry_run=not live,offline=args.command=='offline',review=review)
        if review and not any(b['stage']=='source_validation' for b in report['blocked']):
            store.db.execute("INSERT OR REPLACE INTO settings VALUES('review_slot',?)",(slot,))
        if args.command=='offline':
            for row in source['matches'].values():row['result']={'fixtureId':row['fixtureId'],'source':'api-sports','status':'FT','home':0,'away':1,'verifiedAt':'2030-01-01T17:00:00Z'}
            report=process(source,store,cfg,output,now+18000,dry_run=True,offline=True)
        print(json.dumps({'mode':report['mode'],'blocked':len(report['blocked']),'deliveries':len(report['deliveries']),'report':str(output/'report.json')}))
if __name__=='__main__':
    try:main()
    except Exception as e:
        # Exception class only, never remote error text/body/credential URLs.
        print(json.dumps({'ok':False,'errorType':type(e).__name__}));raise SystemExit(1)
