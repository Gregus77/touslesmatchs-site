'use strict';
// Real production functions, isolated SQLite, injected sports responses; no API startup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const Database = require('better-sqlite3');
const coherence = require('./live_state_coherence');
const snapshots = require('./official_signal_snapshots');
const source = fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
let checks=0;
function check(label,fn) { fn();checks++;console.log('PASS '+label); }
function fn(name) {
 const hit=source.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}'));
 assert(hit,name);return hit[0];
}
const harness=fs.readFileSync(path.join(__dirname,'test_filter_false_positives_20260925.js'),'utf8').split('let passed = 0;')[0];
const filters=new Function('require','__dirname',harness+'\nreturn ctx;')(require,__dirname);
const match=(country,league,extra={})=>({fixtureId:42,id:42,source:'api-sports',sport:'Football',country,
 competition:league+' · '+country,home:'Home',away:'Away',status:'IN_PLAY',period:'1H',minute:35,score_home:0,score_away:0,...extra});
for (const league of ['NB I','NB1','OTP Bank Liga']) check(league+' retains existing permission',()=>{
 const m=match('Hungary',league);assert.equal(filters.isPublicFootballScopeMatch(m),true);assert.equal(filters.isClientOu25MatchEligible(m),true);
});
for(const league of ['NB II','NB III','NB III - Northwest','NB III - Southeast','NB IV','Hungarian NB III'])check(league+' cannot inherit NB I',()=>{
 const m=match('Hungary',league);assert.equal(filters.isPublicFootballScopeMatch(m),false);assert.equal(filters.isLowTrustCompetition(m),true);assert.equal(filters.leagueTier(m),null);
});
for(const league of ['Segunda División','Segunda Division','LaLiga2','La Liga 2'])check(league+' maps to existing Spanish D2',()=>{
 const m=match('Spain',league);assert.equal(filters.isPublicFootballScopeMatch(m),true);assert.equal(filters.isClientOu25MatchEligible(m),true);
});
for(const league of ['Segunda División RFEF - Group 1','Primera División RFEF','Tercera División','Segunda División Women','Segunda División U19','Segunda División Play-offs'])check(league+' not opened',()=>{
 assert.equal(filters.isClientOu25MatchEligible(match('Spain',league)),false);
});
check('Scottish Premiership stays outside the scope',()=>assert.equal(filters.isPublicFootballScopeMatch(match('Scotland','Premiership')),false));
check('Spanish alias cannot authorize another country',()=>assert.equal(filters.isPublicFootballScopeMatch(match('Unknown','Segunda División')),false));
const base=match('France','Ligue 1');
const empty={vote_count:0,consensus_count:0,votes:Array.from({length:5},(_,i)=>({agent:'Seat'+i,status:'pending',direction:null})),window_status:'closed'};
check('dynamic exclusion has no pending seats',()=>{
 const state=coherence.attemptState(base,empty,null,'Championnat écarté : résultats historiques insuffisants.');
 assert.equal(state.analysis_state,'excluded');assert.match(state.recommendation_status,/^Exclu avant Concile :/);
 assert(state.votes.every(v=>v.status==='excluded'&&v.direction===null));assert.equal(state.vote_count,0);
});
let now=Date.parse('2026-09-26T14:35:00Z');
const tmp=fs.mkdtempSync(path.join(process.env.TEST_TMP_DIR||os.tmpdir(),'tlm-football-attempt-'));
const dbfile=path.join(tmp,'isolated.db');let db=new Database(dbfile),store=coherence.createAttemptStore(db,()=>now);
const id=store.start(base);store.fail(id,coherence.statsFailure('empty_response'));db.close();
now+=25*60000;db=new Database(dbfile);store=coherence.createAttemptStore(db,()=>now);
check('failure at 35 survives restart and HT beyond 12 minutes',()=>{
 const latest=store.latest(base);assert.equal(latest.minute,35);assert.equal(latest.match_status,'IN_PLAY');assert.equal(latest.period,'1H');
 const state=coherence.attemptState({...base,period:'HT',minute:45},empty,latest,null);
 assert.equal(state.analysis_state,'failed_before_providers');assert.equal(state.attempt.started_at,'2026-09-26T14:35:00.000Z');
 assert.match(state.recommendation_status,/Réponse statistique vide/);assert.doesNotMatch(state.recommendation_status,/trop tard|terminée/);
 assert(state.votes.every(v=>v.status==='not_called'));assert.equal(state.vote_count,0);
});
check('official snapshot never overwritten by a failure',()=>{
 const official={...empty,official:true};assert.equal(coherence.attemptState(base,official,store.latest(base),'blocked'),official);
});
check('new genuine votes supersede an older failure',()=>{
 const state={...empty,vote_count:5,consensus_at:new Date(now).toISOString()};assert.equal(coherence.attemptState(base,state,store.latest(base),null),state);
});
check('failed attempt is not a snapshot or retry ban',()=>{
 snapshots.init(db);assert.equal(snapshots.reanalysisGate(db,base).allowed,true);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM official_vote_snapshots').get().n,0);
});
check('score change preserves reanalysis in real first-half stoppage time',()=>{
 const initial={...base,minute:35};
 snapshots.capture(db,{id:'old',match:initial,analysisMatchKey:'match',minute:35,scoreHome:0,scoreAway:0,
 votes:[],consensus:null,consensusVotes:0,confidence:0,ruleVersion:'test',observation:{phase:'1H',score:'0-0',minute:35}});
 const changed={...base,minute:'45+3',score_home:1};assert.equal(coherence.analysisWindow(changed).open,true);
 const gate=snapshots.reanalysisGate(db,changed,0,0,now);assert.equal(gate.reason,'state_change_delay');
 assert.equal(snapshots.reanalysisGate(db,changed,0,0,now+snapshots.REANALYSIS_DELAY_MS).allowed,true);
 assert.equal(coherence.analysisWindow({...changed,period:'HT'}).open,false);
 assert.equal(coherence.analysisWindow({...changed,minute:34}).open,false);
});
check('raw error secrets never enter attempt storage',()=>{
 const failed=store.start(base);store.fail(failed,new Error('SECRET_FAKE_TOKEN https://provider/?key=SECRET_FAKE_TOKEN'));
 assert(!JSON.stringify(store.latest(base)).includes('SECRET_FAKE_TOKEN'));assert.equal(store.latest(base).reason_category,'other');
});
const interrupted=store.start(base);store.providers(interrupted);db.close();db=new Database(dbfile);store=coherence.createAttemptStore(db,()=>now);
check('restart marks an interrupted call without claiming five uncalled seats',()=>{
 const state=coherence.attemptState(base,empty,store.latest(base),null);assert.equal(state.analysis_state,'failed');
 assert.doesNotMatch(state.recommendation_status,/cinq IA n’ont pas été appelées/);
});
const fixture={fixture:{id:42,status:{short:'1H',elapsed:35}},goals:{home:0,away:0},teams:{home:{id:10},away:{id:20}}};
const stats=(homeId=10,awayId=20)=>({response:[homeId,awayId].map(id=>({team:{id},statistics:[{type:'Total Shots',value:0}]}))});
const cases=[
 ['empty_response',{response:[]}],['teams_missing',{response:[{statistics:[]}]}],
 ['mapping',stats(99,20)],['mapping',stats(10,10)],
 ['incomplete_data',{response:[10,20].map(id=>({team:{id},statistics:[]}))}],
 ['incomplete_data',{response:[10,20].map(id=>({team:{id},statistics:[{type:'Total Shots',value:null}]}))}],
 ['provider_error',{errors:{requests:'SECRET_FAKE_TOKEN'},response:[]}],
 ['timeout',new Error('HTTP GET timeout SECRET_FAKE_TOKEN')],
 ['other',new Error('SECRET_FAKE_TOKEN')],
 ['fixture_unknown',null],
];
async function main(){
 for(const [category,payload] of cases){
  let calls=0;const logs=[];const localDb=new Database(':memory:');const localStore=coherence.createAttemptStore(localDb,()=>now);
  const ctx=vm.createContext({liveStateCoherence:coherence,footballAttempts:localStore,Date,console:{error:(...x)=>logs.push(x),log(){}},
   API_SPORTS_KEY:'test-only',matchStatsCache:new Map(),apiSportsBudgetOk:()=>true,
   apiSportsErrors:data=>!!(data?.errors&&Object.keys(data.errors).length),setLiveAnalysisNotice(){},
   isNeutralComp:()=>false,computeLiveConstraints:()=>({}),
   AGENT_INDEXES:[0,1,2,3,4],collectAgentsUntilOu25Quorum:async()=>{calls+=5;throw new Error('forbidden');},
   httpPost:async()=>{calls++;throw new Error('forbidden');},
   httpGet:async url=>{
    if(url.includes('fixtures?id='))return {response:payload===null?[]:[fixture]};
    if(payload instanceof Error)throw payload;
    return payload;
   }});
  const begin=source.indexOf('const liveStateCollector =');const end=source.indexOf('// ── H2H',begin);
  vm.runInContext([fn('getVerifiedFixtureId'),fn('buildStatsStatus'),fn('parseMatchStats'),fn('fetchMatchStats'),
   source.slice(begin,end),fn('runConcileAnalysis'),source.slice(source.indexOf('async function runConcileAnalysisCore('),source.indexOf('function getMockAgentAnalysis('))].join('\n'),ctx);
  await assert.rejects(()=>ctx.runConcileAnalysis(base),{diagnostic_category:category});
  assert.equal(calls,0);const attempt=localStore.latest(base);assert.equal(attempt.outcome,'failed');assert.equal(attempt.stage,'collecting');
  assert.equal(attempt.reason_category,category);assert(!JSON.stringify(logs).includes('SECRET_FAKE_TOKEN'));
  assert(!JSON.stringify(attempt).includes('SECRET_FAKE_TOKEN'));localDb.close();checks++;console.log('PASS '+category+': actual Concile stopped before five providers');
 }
 check('real zero statistics remain valid, reordered by team identity',()=>{
  assert.equal(coherence.verifiedStatsRows(stats(20,10),{home:10,away:20})[0].team.id,10);
 });
 // Render the actual browser functions without DOM, network or authentication.
 const html=fs.readFileSync(path.join(__dirname,'../public/live-ia.html'),'utf8');
 const a=html.indexOf('function liveOu25State('),b=html.indexOf('// ── Render',a);
 const ui=vm.createContext({TLMMatchLifecycle:{statusText:()=> 'Non retenu',entryClosed:()=>true,entryNoticeHtml:()=>''},
  escHtml:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'),isFinite});
 vm.runInContext(html.slice(a,b),ui);
 check('Live IA renders exclusion and failure as uncalled, never pending',()=>{
  const excluded=coherence.attemptState(base,empty,null,'Résultats historiques insuffisants.');
  const rendered=ui.renderLiveOu25Details({...base,ou25:excluded});assert.match(rendered,/Exclu avant Concile/);assert.doesNotMatch(rendered,/En attente/);
  const failed=coherence.attemptState(base,empty,{started_at:new Date(now).toISOString(),minute:35,stage:'collecting',outcome:'failed',reason:'Réponse statistique vide.'},null);
  const output=ui.renderLiveOu25Details({...base,period:'HT',ou25:failed});assert.match(output,/IA non appelée/);assert.match(output,/Réponse statistique vide/);assert.doesNotMatch(output,/En attente/);
 });
 check('public API projection preserves diagnosis without exposing vote directions',()=>{
  const projected=vm.createContext({});vm.runInContext(fn('homepageLiveMatch'),projected);
  const raw=coherence.attemptState(base,empty,{started_at:new Date(now).toISOString(),minute:35,stage:'collecting',outcome:'failed',reason:'Réponse statistique vide.'},null);
  const result=projected.homepageLiveMatch({...base,ou25:raw},false,true);assert.equal(result.ou25.attempt.minute,35);
  assert.equal(result.ou25.analysis_state,'failed_before_providers');assert(result.ou25.votes.every(v=>v.direction===null&&v.status==='not_called'));
 });
 db.close();console.log('FOOTBALL_PIPELINE_CHECKS_PASSED='+checks);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
