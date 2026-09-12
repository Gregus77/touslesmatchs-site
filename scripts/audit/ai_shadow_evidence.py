#!/usr/bin/env python3
"""Read-only reproducible audit. No provider calls, mutations, or automatic promotions."""
import argparse, collections, csv, datetime as dt, hashlib, json, math, pathlib, re, sqlite3, statistics
ROSTER=['Perplexity-Web','DeepSeek-V3','Mistral-Large','Cohere-Command','OpenRouter-Qwen']
MARKETS={'buts':'ou25','ou05':'ou05','ou15':'ou15','over_under_1_5':'ou15','over_under_3_5':'ou35','btts':'btts'}
def stamp(x):
 try:return dt.datetime.fromisoformat(str(x).replace('Z','+00:00')).replace(tzinfo=dt.timezone.utc).timestamp()
 except (ValueError,TypeError):return None

def state_key(key):
 m=re.match(r'^(.*_\d{4}-\d{2}-\d{2})_(\d+)_(\d+)-(\d+)$',key or '')
 return (m[1],int(m[2]),int(m[3]),int(m[4])) if m else (key,None,None,None)

def result(selection,h,a):
 if h is None or a is None or h<0 or a<0:return None
 if selection in ('BTTS Oui','BTTS Non'):
  win=(h>0 and a>0);return 'win' if win==(selection=='BTTS Oui') else 'loss'
 m=re.match(r'^(Over|Under) ([0-9]+[.,]5)(?: buts| goals)?$',selection or '')
 if m:
  win=(h+a>float(m[2].replace(',','.')));return 'win' if win==(m[1]=='Over') else 'loss'
 return None

def determined(selection,h,a):
 if h is None or a is None:return None
 if selection in ('BTTS Oui','BTTS Non'):return h>0 and a>0
 m=re.match(r'^(?:Over|Under) ([0-9]+[.,]5)',selection or '')
 return h+a>float(m[1].replace(',','.')) if m else None

def rate(w,n):return round(100*w/n,2) if n else None

def summarize(rows):
 resolved=sorted((r for r in rows if r['outcome'] in ('win','loss')),key=lambda r:(r['created_at'],r['source_id']),reverse=True)
 w=sum(r['outcome']=='win' for r in resolved)
 eligible=[r for r in resolved if r['verified_predictive']]
 independent={}
 for row in sorted(eligible,key=lambda r:(r['created_at'],r['source_id'])):
  independent.setdefault((row.get('event',row['source_id']),row.get('actor',''),row.get('model',''),row.get('market','')),row)
 predictive=sorted(independent.values(),key=lambda r:(r['created_at'],r['source_id']),reverse=True)
 priced=[r for r in predictive if r['odd'] is not None]
 profit=sum(r['odd']-1 if r['outcome']=='win' else -1 for r in priced)
 return dict(observed_predictions=len(rows),abstentions=sum(r['selection']=='NO BET' for r in rows),stored_resolved=len(resolved),stored_wins=w,stored_losses=len(resolved)-w,stored_winrate=rate(w,len(resolved)),last20_n=len(resolved[:20]),last20_sequence="".join("W" if r["outcome"]=="win" else "L" for r in resolved[:20]),last20_wins=sum(r['outcome']=='win' for r in resolved[:20]),last20_rate=rate(sum(r['outcome']=='win' for r in resolved[:20]),len(resolved[:20])),last10_n=len(resolved[:10]),last10_sequence="".join("W" if r["outcome"]=="win" else "L" for r in resolved[:10]),last10_wins=sum(r['outcome']=='win' for r in resolved[:10]),last10_rate=rate(sum(r['outcome']=='win' for r in resolved[:10]),len(resolved[:10])),known_outcome_at_prediction=sum(r['known'] is True for r in resolved),unknown_snapshot=sum(r['known'] is None for r in resolved),outcome_mismatch=sum(r['outcome_mismatch'] for r in resolved),future_or_unproven_time=sum(not r['time_proven'] for r in resolved),verified_predictive=len(eligible),verified_wins=sum(r['outcome']=='win' for r in eligible),verified_winrate=rate(sum(r['outcome']=='win' for r in eligible),len(eligible)),predictive_independent_events=len(predictive),predictive_last20_n=len(predictive[:20]),predictive_last20_rate=rate(sum(r["outcome"]=="win" for r in predictive[:20]),len(predictive[:20])),predictive_last10_n=len(predictive[:10]),predictive_last10_rate=rate(sum(r["outcome"]=="win" for r in predictive[:10]),len(predictive[:10])),priced_n=len(priced),profit_units=round(profit,4) if priced else None,roi_pct=round(100*profit/len(priced),2) if priced else None,latest_prediction=max((r['created_at'] for r in rows),default=None))

def audit(db_path,outdir):
 outdir=pathlib.Path(outdir);outdir.mkdir(parents=True,exist_ok=True)
 c=sqlite3.connect('file:'+str(pathlib.Path(db_path).resolve())+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;c.execute('PRAGMA query_only=ON')
 def rows(table):return [dict(r) for r in c.execute('SELECT * FROM '+table)]
 ca=rows('concile_analyses');parents={r['match_key']:r for r in ca};calls=rows('agent_calls');legacy=rows('shadow_evals');official=rows('agent_market_predictions');tourney=rows('shadow_tournament_predictions');shadow=rows('shadow_market_predictions');tcalls=rows('shadow_tournament_calls')
 lookup=collections.defaultdict(list)
 for r in calls:lookup[(r['agent_name'],r['match_key'],r['created_at'][:10])].append(r)
 records=[];matched_models=0
 def add(source,r,actor,model,market,selection,parent=None,snapshot=None):
  parent=parent or {};base,minute,h,a=state_key(r['match_key'])
  if snapshot is not None:
   minute=snapshot.get('minute');h=snapshot.get('score_home');a=snapshot.get('score_away')
  elif minute is None and source=='official_market':
   # A mutable consensus row is not evidence of the model's original game state.
   h=a=minute=None
  final_h=r.get('final_score_home',parent.get('final_score_home'));final_a=r.get('final_score_away',parent.get('final_score_away'))
  resolved_at=r.get('resolved_at',parent.get('resolved_at'));created=stamp(r.get('created_at'));ended=stamp(resolved_at)
  known=determined(selection,h,a);settled=result(selection,final_h,final_a);outcome=r.get('outcome')
  time_proven=created is not None and ended is not None and created<ended
  mismatch=outcome in ('win','loss') and settled is not None and settled!=outcome
  confidence=r.get('confidence')
  valid_conf=isinstance(confidence,(int,float)) and 0<=confidence<=100
  verified=outcome in ('win','loss') and known is False and time_proven and settled==outcome and valid_conf and not r.get('error')
  odd=None;age=(created-stamp(parent.get('analysed_at'))) if created and stamp(parent.get('analysed_at')) else None
  # Never borrow O/U odds for BTTS or another selection. No synthetic odds/profits.
  if verified and parent.get('best_bet')==selection and isinstance(parent.get('real_odd'),(int,float)) and parent['real_odd']>1 and parent.get('real_odd_source') and 'estimat' not in parent['real_odd_source'].lower() and age is not None and 0<=age<=120:
   odd=parent['real_odd']
  records.append(dict(source=source,source_id=r['id'],actor=actor,model=model,market=MARKETS.get(market,market),match_key=r['match_key'],event=base,selection=selection,confidence=confidence,competition=r.get('competition') or (snapshot or {}).get('competition') or parent.get('competition') or 'unknown',minute=minute,score_home=h,score_away=a,created_at=r.get('created_at'),outcome=outcome,known=known,outcome_mismatch=mismatch,time_proven=time_proven,verified_predictive=verified,odd=odd,context_age_seconds=age))
 for r in official:
  base,minute,h,a=state_key(r['match_key']);model='model_id_not_proven';parent=parents.get(r['match_key']) or parents.get(base)
  if minute is not None:
   fallback=f"{r['home']}_{r['away']}_{h}-{a}-{minute//15}"
   candidates=[x for x in lookup[(r['agent_name'],fallback,r['created_at'][:10])] if x['vote_produit']==1 and -1 <= stamp(r['created_at'])-stamp(x['created_at']) <=5]
   ids={x['model'] for x in candidates}
   if len(candidates)==1 and len(ids)==1:model=next(iter(ids));matched_models+=1
  add('official_market',r,r['agent_name'],model,r['market_line'],r['bet'],parent)
 for r in legacy:
  market='btts' if r['bet'].startswith('BTTS') else 'ou25' if re.search(r'2[.,]5',r['bet']) else 'other'
  add('legacy_shadow',r,r['agent_name'],'model_id_not_recorded',market,r['bet'])
 tp={(r['match_key'],r['model_id']):r for r in tourney}
 for r in tourney:add('tournament',r,r['model_name'],r['model_id'],'ou25',r['prediction'],parents.get(r['match_key']),r)
 for r in shadow:add('tournament_market',r,r['model_name'],r['model_id'],r['market'],r['selection'],parents.get(r['match_key']),tp.get((r['match_key'],r['model_id'])))
 def write(name,items):
  items=list(items)
  if not items:return
  with (outdir/name).open('w',newline='') as f:
   writer=csv.DictWriter(f,fieldnames=list(items[0]),lineterminator="\n");writer.writeheader();writer.writerows(items)
 def grouped(fields,items=records):
  groups=collections.defaultdict(list)
  for r in items:groups[tuple(r[f] for f in fields)].append(r)
  return [dict(zip(fields,k),**summarize(v)) for k,v in sorted(groups.items(),key=lambda kv:str(kv[0]))]
 write('model_market_metrics.csv',grouped(['source','actor','model','market']))
 write('seat_market_metrics.csv',grouped(['source','actor','market']))
 for r in records:
  r['minute_band']='unknown' if r['minute'] is None else '0-14' if r['minute']<15 else '15-30' if r['minute']<=30 else '31-45' if r['minute']<=45 else '46+'
  r['confidence_band']='unknown' if r['confidence'] is None else '<77' if r['confidence']<77 else '77-84' if r['confidence']<85 else '85-89' if r['confidence']<90 else '90+'
 for dim in ['competition','minute_band','confidence_band']:write('segments_'+dim+'.csv',grouped(['source','actor','model','market',dim]))
 # Calls are batches, not one attempt per market. Keep their denominators separate.
 attempts=[]
 for source,raw,key,ok,lat in [('official',calls,('agent_name','model'),'issue','duree_ms'),('tournament',tcalls,('model_name','model_id'),'status','latency_ms')]:
  groups=collections.defaultdict(list)
  for r in raw:groups[tuple(r[x] for x in key)].append(r)
  for (actor,model),rr in groups.items():
   good=sum(x[ok]=='ok' for x in rr);ls=sorted(x[lat] for x in rr if x[lat] is not None)
   attempts.append(dict(source=source,actor=actor,model=model,batch_attempts=len(rr),successful_responses=good,errors=len(rr)-good,availability_pct=rate(good,len(rr)),produced_votes=sum(x.get('vote_produit')==1 for x in rr) if source=='official' else None,invalid_or_no_ballot=sum(x.get('vote_produit')==0 for x in rr) if source=='official' else None,unrecorded_ballot_validity=sum(x.get('vote_produit') is None for x in rr) if source=='official' else None,mean_latency_ms=round(statistics.mean(ls),2) if ls else None,p50_latency_ms=statistics.median(ls) if ls else None,p95_latency_ms=ls[max(0,math.ceil(.95*len(ls))-1)] if ls else None,errors_by_type=json.dumps(dict(collections.Counter(str(x.get('http_status') or x[ok]) for x in rr if x[ok]!='ok'))),first=min(x['created_at'] for x in rr),last=max(x['created_at'] for x in rr)))
 write('attempts_availability_latency.csv',attempts)
 # Strict comparable current challengers: same event, market, recorded score, <=120s, no known outcome.
 comparable=[];official_eligible=[x for x in records if x['source']=='official_market' and x['actor'] in ROSTER and x['verified_predictive']]
 by_event=collections.defaultdict(list)
 for r in official_eligible:by_event[(r['event'],r['market'])].append(r)
 challenger=collections.defaultdict(list)
 for r in records:
  if r['source'] in ('tournament','tournament_market'):challenger[(r['actor'],r['model'],r['market'])].append(r)
 for (actor,model,market),rr in challenger.items():
  for incumbent in ROSTER:
   paired=[]
   for r in rr:
    if not r['verified_predictive']:continue
    candidates=[o for o in by_event[(r['event'],market)] if o['actor']==incumbent and o['score_home']==r['score_home'] and o['score_away']==r['score_away'] and abs(stamp(o['created_at'])-stamp(r['created_at']))<=120]
    if len(candidates)==1:paired.append((r,candidates[0]))
   paired.sort(key=lambda x:x[0]['created_at'],reverse=True)
   # One independent event per pair, no repeated snapshots counted twice.
   seen=set();paired=[x for x in paired if x[0]['event'] not in seen and not seen.add(x[0]['event'])]
   n=len(paired);last20=paired[:20];last10=paired[:10]
   a=next((x['availability_pct'] for x in attempts if x['source']=='tournament' and x['model']==model),None)
   wr=rate(sum(x[0]['outcome']=='win' for x in last20),len(last20));basewr=rate(sum(x[1]['outcome']=='win' for x in last20),len(last20));last10wr=rate(sum(x[0]['outcome']=='win' for x in last10),len(last10))
   comparable.append(dict(challenger=actor,model=model,market=market,incumbent=incumbent,comparable_events=n,availability_pct=a,last20_rate=wr,last10_rate=last10wr,incumbent_last20_rate=basewr,advantage_pp=round(wr-basewr,2) if wr is not None and basewr is not None else None,cost_acceptable=None,promotion=False,decision='échantillon insuffisant' if n<20 else 'autres preuves requises'))
 write('comparable_promotions.csv',comparable)
 # Legacy shadow lacks timing/snapshot and complete failed-attempt telemetry: cannot promote on raw WR.
 legacy_summary=grouped(['actor','market'],[x for x in records if x['source']=='legacy_shadow'])
 write('legacy_shadow_metrics.csv',legacy_summary)
 markets=[]
 for market in ['ou25','ou05','ou15','ou35','btts']:
  rr=[x for x in records if x['source'] in ('tournament','tournament_market') and x['market']==market]
  row=dict(market=market,**summarize(rr));row['independent_events']=len({x['event'] for x in rr if x['outcome'] in ('win','loss')});row['decision']='échantillon insuffisant';markets.append(row)
 write('shadow_market_readiness.csv',markets)
 source_counts={t:c.execute('SELECT count(*) FROM '+t).fetchone()[0] for t in ['agent_calls','agent_market_predictions','shadow_evals','shadow_tournament_predictions','shadow_market_predictions','shadow_tournament_calls']}
 quality=dict(source_counts=source_counts,official_predictions_with_attributed_model=matched_models,official_predictions_total=len(official),exact_calls_prediction_key_join=c.execute('SELECT count(*) FROM agent_market_predictions p JOIN agent_calls a ON p.match_key=a.match_key AND p.agent_name=a.agent_name').fetchone()[0],duplicate_official_keys=c.execute('SELECT count(*) FROM (SELECT match_key,agent_name,market_line,count(*) n FROM agent_market_predictions GROUP BY 1,2,3 HAVING n>1)').fetchone()[0],duplicate_shadow_keys=c.execute('SELECT count(*) FROM (SELECT match_key,model_id,market,count(*) n FROM shadow_market_predictions GROUP BY 1,2,3 HAVING n>1)').fetchone()[0],tournament_snapshot_differs_from_current_consensus=sum((x.get('minute'),x.get('score_home'),x.get('score_away'))!=(parents.get(x['match_key'],{}).get('minute_at_analysis'),parents.get(x['match_key'],{}).get('score_home_at_analysis'),parents.get(x['match_key'],{}).get('score_away_at_analysis')) for x in tourney),source_sha256=hashlib.sha256(pathlib.Path(db_path).read_bytes()).hexdigest(),source_path=str(db_path),audit_asof='2026-09-11T21:31:25Z',period_start=min(r['created_at'] for r in records),period_end=max(r['created_at'] for r in records),schema_quick_check=c.execute('PRAGMA quick_check').fetchone()[0])
 # Estimated accounting cannot be treated as billed per-model cost.
 costs=[dict(x) for x in c.execute('SELECT model_key,purpose,count(*) recorded_entries,sum(cost_estimate_eur) estimated_eur FROM ai_call_budget_log GROUP BY model_key,purpose')];write('estimated_costs_not_invoices.csv',costs)
 payload=dict(quality=quality,roster=ROSTER,markets=markets,tournament_attempts=[x for x in attempts if x['source']=='tournament'],promotions=0,legacy_decision='échantillon insuffisant : conditions et tentatives non traçables')
 (outdir/'summary.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False));c.close()
 print(json.dumps(dict(markets=[{k:r[k] for k in ['market','stored_resolved','stored_wins','known_outcome_at_prediction','verified_predictive','independent_events','priced_n']} for r in markets],attributed_models=matched_models,promotions=0),ensure_ascii=False))
 return payload
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--db',required=True);ap.add_argument('--out',required=True);args=ap.parse_args();audit(args.db,args.out)
