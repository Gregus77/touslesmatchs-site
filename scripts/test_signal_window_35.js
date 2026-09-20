'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const coherence=require('./live_state_coherence');
const delivery=require('./first_half_delivery');
let D;try{D=require('better-sqlite3');}catch{D=require('node:sqlite').DatabaseSync;}
const snapshots=require('./official_signal_snapshots');
// Regression: the old sender accepts 30', while post-45 official snapshots
// are rejected even when an independently observed fixture is still in 1H.
const fixture=(phase,minute)=>({fixture:{id:42,status:{short:phase,elapsed:minute}},goals:{home:1,away:1}});
const snapshot={fixture_id:'42',minute:35,score_home:1,score_away:1};
assert.equal(delivery.evaluateFirstHalf(fixture('1H',34),snapshot).ok,false,'No signal before 35');
for(const minute of [35,45,48])assert.equal(delivery.evaluateFirstHalf(fixture('1H',minute),snapshot).ok,true);
for(const phase of ['HT','2H','FT'])assert.equal(delivery.evaluateFirstHalf(fixture(phase,45),snapshot).ok,false);
for(const [match,want] of [[{minute:34,status:'1H'},false],[{minute:35,status:'1H'},true],
  [{minute:45,status:'HT'},false],[{minute:48,status:'IN_PLAY',period:'1H'},true],
  [{minute:'45+3',status:'IN_PLAY',period:'1H'},true],[{minute:48,status:'IN_PLAY'},false],
  [{minute:45,status:'2H',period:'1H'},false],[{minute:null,status:'1H'},false]]) {
  assert.equal(coherence.analysisWindow(match).open,want,JSON.stringify(match));
}
const db=new D(':memory:');snapshots.init(db);
const votes=Array.from({length:5},()=>({status:'voted',direction:'over'}));
function capture(id,minute,observation){return snapshots.capture(db,{id,match:{fixtureId:42},analysisMatchKey:id,
  minute,scoreHome:1,scoreAway:1,votes,consensus:'over',consensusVotes:5,ruleVersion:'fixture',createdAt:'2026-09-20T00:00:00Z',observation});}
capture('too_early',34);assert.throws(()=>snapshots.registerOfficial(db,'too_early'));
capture('unproven',48);assert.throws(()=>snapshots.registerOfficial(db,'unproven'));
capture('proven',48,{phase:'1H',score:'1-1',minute:48,verified_at:'2026-09-20T00:00:00Z'});
assert.equal(snapshots.registerOfficial(db,'proven').id,'proven');
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
const start=source.indexOf('function livePickBlockReason('),end=source.indexOf('\nfunction shouldAutoObserveMatch(',start);
const ctx={liveStateCoherence:coherence,parseLiveMinuteValue:v=>Number.isFinite(Number(v))?Number(v):null,
  AUTO_CONCILE_WINDOW_MIN:35,AUTO_CONCILE_WINDOW_MAX:45,isMatchDecided:()=>false};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
assert.equal(ctx.livePickBlockReason({minute:48,status:'IN_PLAY',period:'1H'}),null,'Runtime must accept proven stoppage time');
assert.ok(ctx.livePickBlockReason({minute:45,status:'HT'}),'Runtime must reject HT even at minute45');
const parserStart=source.indexOf('function parseLiveMinuteValue('),parserEnd=source.indexOf('// Codes de statut bruts',parserStart);
vm.runInContext(source.slice(parserStart,parserEnd),ctx);
assert.equal(ctx.parseLiveMinuteValue('45+3'),48,'Snapshot must retain stoppage minute instead of null');
const front={};vm.createContext(front);vm.runInContext(fs.readFileSync(__dirname+'/../public/js/match-lifecycle.js','utf8'),front);
assert.equal(front.TLMMatchLifecycle.phase({minute:48,status:'IN_PLAY',period:'1H'}),'open','UI must not close confirmed stoppage');
assert.equal(front.TLMMatchLifecycle.phase({minute:34,status:'IN_PLAY'}),'waiting');
const eligibilityStart=source.indexOf('function clientOu25VisibilityEligibility('),eligibilityEnd=source.indexOf('// ── Live matches',eligibilityStart);
ctx.CLIENT_OU25_CLIENT_MAX_MINUTE=45;ctx.isClientOu25MatchEligible=(m,check)=>!check||coherence.analysisWindow(m).open;
vm.runInContext(source.slice(eligibilityStart,eligibilityEnd),ctx);
assert.equal(ctx.clientOu25VisibilityEligibility({minute:60,status:'2H'},{snapshot_minute:39}).preserved,true,'Historical votes survive live phase closure');
const rawFixture={...fixture('1H',48),teams:{home:{id:1},away:{id:2}}};
assert.equal(coherence.fixtureState(rawFixture,{minute:'45+3',status:'IN_PLAY',period:'1H',score_home:1,score_away:1},42).minute,48,'Mandatory collection accepts verified stoppage string');
db.exec('CREATE TABLE concile_analyses(id INTEGER,match_key TEXT,home TEXT,away TEXT,analysed_at TEXT,outcome TEXT,sig_sent_free INTEGER,sig_sent_standard INTEGER,sig_sent_premium INTEGER,sig_sent_elite INTEGER)');
const current=new Date().toISOString();
snapshots.capture(db,{id:'monitor48',match:{fixtureId:99},analysisMatchKey:'monitor48',minute:48,scoreHome:1,scoreAway:1,votes,consensus:'over',consensusVotes:5,ruleVersion:'test',createdAt:current,observation:{phase:'1H',score:'1-1',minute:48,verified_at:current}});
snapshots.registerOfficial(db,'monitor48');
db.prepare('INSERT INTO concile_analyses VALUES(1,?,?,?,?,?,?,?,?,?)').run('monitor48','home','away',current,null,0,0,0,0);
for(const [name,variable] of [['runPersistentSignalProof','candidate'],['runReliabilityLoop','eligible']]){
  const fn=source.indexOf('function '+name+'('),a=source.indexOf('const '+variable+' = db.prepare(`',fn);
  assert(fn>=0&&a>fn);const end=source.indexOf('`).',a);
  const text=source.slice(a+'const '.length+variable.length+' = db.prepare('.length,end+1);
  const sql=vm.runInNewContext(text,{CLIENT_OU25_MIN_VOTES:4,officialSnapshots:snapshots});
  const rows=name==='runPersistentSignalProof'?db.prepare(sql).all(0):db.prepare(sql).all();
  assert(rows.some(x=>x.match_key==='monitor48'),name+' must audit registered stoppage signal');
}
(async()=>{let at=Date.parse('2026-09-20T00:00:00Z');const check=delivery.createValidator({db,now:()=>at,fetchFixture:async()=>fixture('1H',48)});
  assert.equal((await check({official_signal_snapshot_id:'proven'})).ok,true);
  assert.equal((await check({official_signal_snapshot_id:'unproven'})).ok,false);
  at+=120001;assert.equal((await check({official_signal_snapshot_id:'proven'})).ok,false,'Old queued signal expires');
  db.close();console.log('SIGNAL_WINDOW_35_OK');})().catch(e=>{console.error(e);process.exitCode=1;});
