'use strict';
const assert=require('node:assert/strict'),D=require('better-sqlite3'),shadow=require('./multisport_shadow'),ops=require('./tlm_operations');
const db=new D(':memory:');let calls=0,reads=0;const m={sport:'Basketball',source:'api-sports',sourceId:'42',leagueId:12,leagueSeason:'2026-2027',homeId:10,awayId:20,competition:'NBA · USA',home:'Home',away:'Away',utcDate:new Date().toISOString(),period:'Q2',score_home:40,score_away:30};
let final=false;const roster=[{team:{id:10},position:1,games:{played:20,win:{total:18}}},{team:{id:20},position:9,games:{played:20,win:{total:8}}}];
const engine=shadow.create({db,read:async(sport,url)=>{reads++;return url.startsWith('standings')?{response:[roster]}:{response:[{id:42,teams:{home:{id:10},away:{id:20}},status:{short:final?'FT':'Q2'},scores:{home:{total:110},away:{total:90}}}]};},fetchOdds:async()=>({bookmaker:'real-fixture',bets:[{name:'Home/Away',values:[{value:'Home',odd:'1.80'},{value:'Away',odd:'2.10'}]}]}),agent:()=>({name:'existing-shadow'}),call:async()=>{calls++;return{ok:true,text:JSON.stringify({selection:'home',confidence:76,reason:'Classement et forme fournis'})}},quota:()=>true,paused:()=>false});
(async()=>{
 assert(shadow.allowed(m));assert(!shadow.allowed({...m,sport:'Football'}));assert(!shadow.allowed({...m,competition:'NBA Preseason'}));
 engine.observe([m,m,{...m,sport:'Football'}]);assert.equal(db.prepare('select count(*) n from multisport_shadow').get().n,1);
 await engine.tick();assert.equal(calls,1);let row=db.prepare('select * from multisport_shadow').get();assert.equal(row.selection,'home');assert.equal(row.odd,1.8);assert.equal(row.status,'predicted');
 await engine.tick();assert.equal(calls,1);final=true;await engine.settle();row=db.prepare('select * from multisport_shadow').get();assert.equal(row.result,'win');assert.equal(row.profit_10,8);assert.equal(shadow.report(db)[0].roi,0.8);
 assert.equal(shadow.parseVote('{"selection":"over","confidence":90,"reason":"no"}'),null);assert.equal(shadow.standings({response:[roster[0]]},m),null);
 assert.equal(shadow.odds({bets:[{name:'Match Winner',values:[{value:'Home',odd:2},{value:'Draw',odd:3},{value:'Away',odd:4}]}]}),null);
 assert.equal(db.prepare("select count(*) n from sqlite_master where name='official_signal_registry' or name='client_telegram_outbox'").get().n,0);
 // Real owner evidence from SQLite, including the actual reason a natural signal waits.
 db.exec(`CREATE TABLE official_vote_snapshots(id TEXT,minute INTEGER,score_home INTEGER,score_away INTEGER,consensus TEXT,consensus_votes INTEGER,confidence REAL,real_odd REAL,votes_json TEXT);
 CREATE TABLE football_analysis_attempts(id INTEGER,fixture_key TEXT,reason TEXT,reason_category TEXT);
 CREATE TABLE jev_decisions(id INTEGER,snapshot_id TEXT,state_json TEXT,decision TEXT,final_decision TEXT,confidence REAL,returned_model TEXT,model TEXT,decision_source TEXT,traditional_block_reason TEXT,error_category TEXT);
 CREATE TABLE agent_calls(id INTEGER,match_key TEXT,agent_name TEXT,model TEXT,http_status INTEGER,issue TEXT,duree_ms INTEGER,debut_at TEXT,vote_produit INTEGER);
 CREATE TABLE telegram_signal_deliveries(official_signal_snapshot_id TEXT,channel TEXT,telegram_message_id INTEGER,ok INTEGER,created_at TEXT);`);
 db.prepare('INSERT INTO official_vote_snapshots VALUES(?,?,?,?,?,?,?,?,?)').run('snap',35,1,0,'over',4,68,null,JSON.stringify([{status:'voted',direction:'over'}]));
 db.prepare('INSERT INTO jev_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(1,'snap',JSON.stringify({integrity:{real_data:true}}),'REJECT','WAIT',0.69,'jev-1.13.0','jev-latest','jev_low_confidence','Recovery: 2/4',null);
 const e=ops.evidence(db,{fixtureId:42},{snapshot_id:'snap',official:false});assert.equal(e.selection,'OVER 2,5');assert.equal(e.stats_available,true);assert.equal(e.real_odd,null);assert.equal(e.jev.final_decision,'WAIT');assert.equal(e.telegram_receipts.length,0);
 // Failure guards exercise the real engine with transport mocks only.
 for(const mode of ['paused','quota','no_standings','wrong_team','missing_score','finished']){
  const isolated=new D(':memory:');let paid=0;
  const eng=shadow.create({db:isolated,clock:Date.now,paused:()=>mode==='paused',agent:()=>({name:'existing-shadow'}),quota:()=>mode!=='quota',
   read:async(_,url)=>url.startsWith('standings')?{response:mode==='no_standings'?[]:[roster]}:{response:[{id:42,teams:{home:{id:mode==='wrong_team'?99:10},away:{id:20}},status:{short:mode==='finished'?'FT':'Q2'},scores:{home:{total:mode==='missing_score'?null:40},away:{total:30}}}]},
   fetchOdds:async()=>null,call:async()=>{paid++;throw Error('Must never call IA');}});
  eng.observe([m]);await eng.tick();assert.equal(paid,0,mode+' must prevent IA');isolated.close();
 }
 assert.equal(ops.evidence(db,{fixtureId:42},{snapshot_id:'snap',official:false,analysis_state:'stale'}).selection,null);
 ops.init(db);ops.observe(db,[m],()=>({eligible:false,reason:'scope'}));ops.observe(db,[m],()=>({eligible:true,reason:''}));
 assert.equal(db.prepare('SELECT count(*) n FROM pipeline_observations').get().n,1);
 assert.equal(db.prepare('SELECT eligible FROM pipeline_observations').get().eligible,1);
 console.log('PASS owner evidence, natural WAIT, isolated winner shadow, deduplication, settlement and ROI; no publication or real transport');db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
