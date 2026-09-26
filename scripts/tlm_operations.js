'use strict';
// Read-only evidence: no inference, no signal creation and no transport.
function parse(value){try{return JSON.parse(value||'null');}catch(_){return null;}}
function safe(value){return String(value||'').replace(/(?:sk-[A-Za-z0-9_-]+|\d{8,}:[A-Za-z0-9_-]+)/g,'[secret masqué]').slice(0,350);}
function evidence(db,match,raw){
 const snapshot=raw.snapshot_id?db.prepare('SELECT * FROM official_vote_snapshots WHERE id=?').get(raw.snapshot_id):null;
 const attempt=db.prepare('SELECT * FROM football_analysis_attempts WHERE fixture_key=? ORDER BY id DESC LIMIT 1').get(String(match.fixtureId||match.fixture_id||match.id||''));
 if(!snapshot)return {snapshot_id:null,selection:null,votes:[],stats_available:false,stats_reason:attempt?.reason_category||null,reason:safe(attempt?.reason||match.analysis_exclusion_reason||match.block_reason||'Analyse non commencée'),jev:null};
 const jev=db.prepare('SELECT * FROM jev_decisions WHERE snapshot_id=? ORDER BY id DESC LIMIT 1').get(snapshot.id);
 const state=parse(jev?.state_json);
 const calls=db.prepare('SELECT agent_name,model,http_status,issue,duree_ms,debut_at,vote_produit FROM agent_calls WHERE match_key=? ORDER BY id DESC').all(snapshot.id);
 const receipts=db.prepare('SELECT channel,telegram_message_id,created_at FROM telegram_signal_deliveries WHERE official_signal_snapshot_id=? AND ok=1 AND telegram_message_id>0').all(snapshot.id);
 const stale=raw.analysis_state==='stale'||(!raw.official&&raw.analysis_state==='failed_before_providers');
 const direction=!stale&&['over','under'].includes(snapshot.consensus)?snapshot.consensus:null;
 const reason=stale?'Ancien scrutin — nouvelle analyse non validée':raw.official?'Signal validé':jev?'Jev '+safe(jev.final_decision)+' — '+safe(jev.decision_source):'Analyse terminée — décision non validée';
 return {snapshot_id:snapshot.id,minute:snapshot.minute,score:snapshot.score_home+'-'+snapshot.score_away,
  selection:direction?direction.toUpperCase()+' 2,5':null,consensus:snapshot.consensus_votes,confidence:snapshot.confidence,
  real_odd:snapshot.real_odd??null,stats_available:state?.integrity?.real_data===true,stats_reason:state?.integrity?.real_data===true?null:attempt?.reason_category||'non_documenté',
  votes:parse(snapshot.votes_json)||[],calls:calls.map(c=>({...c,issue:safe(c.issue)})),reason,
  jev:jev?{decision:jev.decision,final_decision:jev.final_decision,confidence:jev.confidence,model:jev.returned_model||jev.model,
   reason:safe(jev.decision_source),traditional_reason:safe(jev.traditional_block_reason),error:jev.error_category}:null,
  official:raw.official===true,telegram_receipts:receipts};
}
module.exports={evidence};
function init(db){db.exec(`CREATE TABLE IF NOT EXISTS pipeline_observations(day TEXT NOT NULL,sport TEXT NOT NULL,fixture_id TEXT NOT NULL,home TEXT,away TEXT,competition TEXT,
 first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,minute TEXT,score_home INTEGER,score_away INTEGER,status TEXT,eligible INTEGER DEFAULT 0,current_eligible INTEGER DEFAULT 0,reason TEXT,
 PRIMARY KEY(day,sport,fixture_id));`);}
function observe(db,matches,classify){
 const now=new Date().toISOString();const stmt=db.prepare(`INSERT INTO pipeline_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(day,sport,fixture_id) DO UPDATE SET last_seen=excluded.last_seen,minute=excluded.minute,score_home=excluded.score_home,score_away=excluded.score_away,status=excluded.status,
 eligible=max(pipeline_observations.eligible,excluded.eligible),current_eligible=excluded.current_eligible,reason=excluded.reason`);
 db.transaction(()=>{for(const m of matches){const c=classify(m);stmt.run(now.slice(0,10),m.sport||'Football',String(m.fixtureId||m.id||m.sourceId||m.home+'_'+m.away),m.home||'',m.away||'',m.competition||'',now,now,String(m.minute??''),m.score_home??null,m.score_away??null,String(m.period||m.status||''),c.eligible?1:0,c.eligible?1:0,safe(c.reason));}})();
}
module.exports.init=init;module.exports.observe=observe;
