'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const {DatabaseSync} = require('node:sqlite');
const source = fs.readFileSync(__dirname + '/api_server.js', 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE agent_market_predictions (
 id INTEGER PRIMARY KEY, match_key TEXT, home TEXT, away TEXT, agent_name TEXT,
 market_line TEXT, bet TEXT, confidence INTEGER, competition TEXT, outcome TEXT,
 created_at TEXT DEFAULT (datetime('now')), UNIQUE(match_key,agent_name,market_line));`);
const names = ['Perplexity-Web','DeepSeek-V3','Mistral-Large','Cohere-Command','OpenRouter-Qwen'];
const errors = [];
const ctx = vm.createContext({db, console: {log(){},error(...args){errors.push(args)}},
  storedOu25ConsensusCache: new Map(), getPredictionSnapshotKey: () => 'fixture_today_35_1-0',
  parseLiveMinuteValue: x => /^\d+$/.test(String(x)) ? Number(x) : null,
  CLIENT_OU25_CLIENT_MAX_MINUTE:40,CONCILE_AGENT_NAMES:names,
  sameLiveTeamName:(a,b)=>a===b});
vm.runInContext(section('function canonicalMarketBet(', 'function saveAgentMarketPredictions('),ctx);
vm.runInContext(section('function saveAgentMarketPredictions(', '// ── Routage par specialiste'),ctx);
vm.runInContext(section('function getLiveOu25VoteState(', '// ── Live matches'),ctx);
vm.runInContext(section('const SPECIAL_LATIN_MAP =', 'function resolveVerifiedLiveMatch('),ctx);
vm.runInContext(section('const NORM =', '/**'),ctx);
vm.runInContext(section('function canonicalLiveTeamName20260901(', '// Mots distinctifs'),ctx);
vm.runInContext(section('function finalMatchDay(', 'let staleResolveRunning'),ctx);
const match = {home:'Lyon',away:'Auxerre',minute:35};
for (let i=0;i<names.length;i++) {
  ctx.saveAgentMarketPredictions(match,[{name:names[i],marches:{buts:{p:i===4?'under':'over',c:80}}}]);
  assert.equal(ctx.getLiveOu25VoteState(match).vote_count,i+1,'partial results must be visible');
}
ctx.saveAgentMarketPredictions(match,[{name:names[0],marches:{buts:{p:'over',c:80}}}]);
assert.equal(db.prepare('SELECT COUNT(*) n FROM agent_market_predictions').get().n,5,'retry must not duplicate');
assert.equal(ctx.getLiveOu25VoteState(match).over_count,4);
assert.equal(ctx.getLiveOu25VoteState({...match,home:'Lens'}).vote_count,0,'other teams must not inherit votes');
assert.deepEqual(errors,[]);
const stale={home:'Lyon',away:'Auxerre',day:'2026-09-04',sport:'Football'};
const finished={...stale,utcDate:'2026-09-04T19:00:00Z',score_home:3,score_away:1};
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[{...finished,home:'Lens',utcDate:'2026-08-22'}]),null);
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[{...finished,utcDate:'2026-08-22'}]),null);
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[{...finished,sport:'Basketball'}]),null);
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[{...finished,score_home:null}]),null);
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[finished,{...finished,score_home:5}]),null);
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[finished,{...finished}]).match.score_home,3);
assert.equal(ctx.findUniqueFinishedMatchForStale(stale,[{...finished,home:'Auxerre',away:'Lyon'}]).reversed,true);
// Execute the complete downstream resolver with two dates for the same teams.
db.exec(`CREATE TABLE agent_predictions(id INTEGER PRIMARY KEY,home TEXT,away TEXT,bet TEXT,outcome TEXT,created_at TEXT);
 CREATE TABLE concile_analyses(id INTEGER PRIMARY KEY,home TEXT,away TEXT,best_bet TEXT,outcome TEXT,analysed_at TEXT,final_score_home INTEGER,final_score_away INTEGER,resolved_at TEXT,result_source TEXT,confidence INTEGER);
 CREATE TABLE shadow_evals(id INTEGER PRIMARY KEY,home TEXT,away TEXT,bet TEXT,outcome TEXT,created_at TEXT,final_score_home INTEGER,final_score_away INTEGER,resolved_at TEXT);
 CREATE TABLE routage_shadow(id INTEGER PRIMARY KEY,home TEXT,away TEXT,bet TEXT,outcome TEXT,created_at TEXT,resolved_at TEXT);`);
const today=new Date().toISOString().slice(0,10), yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
for (const day of [today,yesterday]) {
  for(const table of ['agent_predictions','shadow_evals','routage_shadow'])db.prepare(`INSERT INTO ${table}(home,away,bet,created_at) VALUES(?,?,?,?)`).run('Lyon','Auxerre','Over 2.5 buts',day);
  db.prepare('INSERT INTO concile_analyses(home,away,best_bet,analysed_at) VALUES(?,?,?,?)').run('Lyon','Auxerre','Over 2.5 buts',day);
}
ctx.getAdaptiveSignalThreshold=()=>77;ctx.TELEGRAM_BOT_TOKEN='';
ctx.resolveMarketBet=()=> 'win';
vm.runInContext(section('function getBetOutcomeForScore(', 'function getConcilePerformance('),ctx);
vm.runInContext(section('function resolveShadowOutcomes(', 'function bookmakerEmailHtml('),ctx);
vm.runInContext(section('function resolveAgentMarketPredictions(', 'function saveAgentPredictions('),ctx);
vm.runInContext(section('function autoResolvePredictions(', '// ── Rattrapage'),ctx);
ctx.autoResolvePredictions({home:'Lyon',away:'Auxerre',score_home:3,score_away:1,resolutionDay:today});
for(const table of ['agent_predictions','shadow_evals','routage_shadow','concile_analyses']){
 const col=table==='concile_analyses'?'analysed_at':'created_at';
 assert.equal(db.prepare(`SELECT outcome FROM ${table} WHERE ${col}=?`).get(today).outcome,'win',table);
 assert.equal(db.prepare(`SELECT outcome FROM ${table} WHERE ${col}=?`).get(yesterday).outcome,null,table+' must preserve other dates');
}
assert.deepEqual(errors,[]);
// Browser-side source parses; broad date-rewriting patches must be gone.
for(const file of ['index.html','performances.html']){
 const html=fs.readFileSync(__dirname+'/../public/'+file,'utf8');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(!/src=|ld\+json/i.test(m[1]))new vm.Script(m[2]);
 }
 if(file==='index.html'){
   assert(!html.includes('function replaceText(root, d)'));
   assert(!html.includes('function mountStats()'));
   assert(html.includes('dailyStats[day].analyses'));
 }
}
const repair=require('./repair_lyon_auxerre_20260904');
const fixture={fixture:{id:1,date:'2026-09-04T19:00:00Z',status:{short:'FT'}},teams:{home:{name:'Lyon'},away:{name:'Auxerre'}},league:{name:'Ligue 1',country:'France'},goals:{home:3,away:1}};
assert.equal(repair.officialResult({response:[fixture]}).home,3);
for(const bad of [{...fixture,goals:{home:null,away:1}},{...fixture,fixture:{...fixture.fixture,status:{short:'2H'}}},{...fixture,fixture:{...fixture.fixture,date:'2026-08-22'}},{...fixture,teams:{home:{name:'Lens'},away:{name:'Auxerre'}}}])assert.throws(()=>repair.officialResult({response:[bad]}));
assert.throws(()=>repair.officialResult({response:[fixture,fixture]}));
async function testDailyRenderer(){
 const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');
 const box={innerHTML:''};
 const daily=vm.createContext({console,document:{getElementById:()=>box},esc:String,
   fetchAllAnalysisHistory:async()=>({analyses:[{home:'A',away:'B',analysed_at:'2026-08-01',outcome:'win',cote:1.5,sent:{standard:true}}]}),
   fetch:async()=>({ok:true,json:async()=>({ok:true,daily_concile:[{jour:'2026-08-02',analyses:71,resolved:47},{jour:'2026-08-03',analyses:14,resolved:11}]})})});
 const start=html.indexOf('function fmtSignedEur('),end=html.indexOf('loadDailyAccordion();',start);
 vm.runInContext(html.slice(start,end),daily);
 await daily.loadDailyAccordion();
 assert.match(box.innerHTML,/data-history-day="2026-08-02"[\s\S]*?71 analyses · 47 résolues/);
 const row=box.innerHTML.split('data-history-day="2026-08-03"')[1].split('data-history-day=')[0];
 assert(row.includes('14 analyses · 11 résolues'));assert(!row.includes('71 analyses'));
 console.log('OK: SQLite votes, score/date isolation, official FT validation, per-day rendering and HTML syntax');
}
testDailyRenderer().catch(e=>{console.error(e);process.exitCode=1;});
