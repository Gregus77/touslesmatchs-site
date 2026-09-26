'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const lifecycle=require('../public/js/match-lifecycle');
const source=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
const projection=source.match(/function homepageLiveMatch\([^]*?\n}/)[0];
const api=vm.createContext({db:{},tlmOperations:{evidence:()=>({})}});vm.runInContext(projection,api);
const ctx=vm.createContext({TLMMatchLifecycle:lifecycle,esc:String,escHtml:String,isFinite,liveHomeScore:m=>m.score_home,liveAwayScore:m=>m.score_away});
function inject(file,names){const s=fs.readFileSync(path.join(__dirname,'../public',file),'utf8');for(const [name,next] of names){const start=s.indexOf('function '+name+'(');assert(start>=0);const end=s.indexOf('function '+next+'(',start);assert(end>start);vm.runInContext(s.slice(start,end),ctx);}}
inject('index.html',[['heroOu25','heroResponseCount'],['heroResponseCount','heroTerminalCaption'],['tlmVotesAreOld','tlmVoteCirclesHtml'],['tlmVoteCirclesHtml','renderAnalyzedList']]);
// These helpers are followed by DOM setup: isolate only the function itself.
for(const [file,name] of [['index.html','heroTerminalCaption'],['app.html','appTerminalCaption']]){const s=fs.readFileSync(path.join(__dirname,'../public',file),'utf8');const start=s.indexOf('function '+name+'(');const end=s.indexOf('\nvar ',start)>0&&file==='index.html'?s.indexOf('\nvar ',start):s.indexOf('\n  var ',start);vm.runInContext(s.slice(start,end),ctx);}
inject('app.html',[['appOu25','appVoteTime'],['appVoteTime','appResponseCount'],['appResponseCount','appTerminalCaption'],['appMiniVotes','appLogo']]);
const live=fs.readFileSync(path.join(__dirname,'../public/live-ia.html'),'utf8');vm.runInContext(live.slice(live.indexOf('function liveOu25State('),live.indexOf('// ── Render',live.indexOf('function liveOu25State('))),ctx);
const base={fixtureId:42,sport:'Football',minute:35,period:'1H',status:'IN_PLAY',score_home:0,score_away:0};
function raw(n,official=false){return{snapshot_id:'same-snapshot',snapshot_minute:35,snapshot_score:'0-0',window_status:'open',vote_count:n,consensus_count:n,official,confidence:91,consensus_direction:official?'under':null,votes:Array.from({length:5},(_,i)=>({agent:'Seat '+(i+1),status:i<n?'voted':'unavailable',direction:i<n?'under':null,confidence:i<n?91:null}))};}
let checks=0;function check(name,f){f();checks++;console.log('PASS '+name);}
for(const minute of [9,34])check(minute+' minutes: neutral seats, no fabricated vote',()=>{const m={...base,minute,ou25:{vote_count:0,votes:Array.from({length:5},()=>({status:'pending'}))}};assert.match(lifecycle.statusText(m),/35e minute/);assert.doesNotMatch(ctx.tlmVoteCirclesHtml(m),/class="tlm-row-vote voted/);});
for(const n of [4,5])for(const reveal of [false,true])check(n+' actual seats consistent on all surfaces, reveal='+reveal,()=>{const m=api.homepageLiveMatch({...base,ou25:raw(n)},reveal);const home=ctx.tlmVoteCirclesHtml(m),app=ctx.appMiniVotes(m),details=ctx.renderLiveOu25Details(m);assert.equal((home.match(/tlm-row-vote voted/g)||[]).length,n);assert.equal((app.match(/tlm-app-live-mini-vote voted/g)||[]).length,n);assert.equal((details.match(/<small>(?:Vote enregistré · direction Premium|Under 2,5)/g)||[]).length,n);assert.equal(ctx.heroOu25(m).voteCount,ctx.liveOu25State(m).voteCount);assert.equal(ctx.appOu25(m).voteCount,n);assert.equal(m.fixtureId,42);assert.equal(m.ou25.snapshot_id,'same-snapshot');});
for(const period of ['HT','2H'])for(const official of [false,true])check(period+' keeps votes and only actual official signal',()=>{const m=api.homepageLiveMatch({...base,minute:period==='HT'?45:60,period,ou25:raw(5,official)},true);assert.doesNotMatch(lifecycle.entryNoticeHtml(m),/ENTRÉE FERMÉE|#ff8495/);assert.match(lifecycle.statusText(m),official?/Signal validé/:/aucun signal validé/);assert.equal(ctx.heroOu25(m).voteCount,5);assert.equal(ctx.appOu25(m).voteCount,5);assert.equal(ctx.liveOu25State(m).voteCount,5);if(official){assert.equal(m.ou25.consensus_direction,'under');assert.equal(m.ou25.official_confidence,91);}});
for(const state of ['excluded','failed_before_providers'])check(state+' sanitized for client, retained for owner',()=>{const r={...raw(0),analysis_state:state,attempt:{minute:35,reason:'mapping technique'},recommendation_status:'mapping technique',votes:raw(0).votes.map(v=>({...v,status:state==='excluded'?'excluded':'not_called',reason:'mapping technique'}))};const m={...base,period:'HT',analysis_exclusion_reason:'mapping technique',ou25:r};const client=api.homepageLiveMatch(m,true),owner=api.homepageLiveMatch(m,true,true);assert(!JSON.stringify(client).includes('mapping technique'));assert.equal(owner.ou25.attempt.minute,35);assert(!client.ou25.votes.some(v=>v.status==='pending'));assert.match(ctx.renderLiveOu25Details(owner),/mapping technique/);assert.doesNotMatch(lifecycle.entryNoticeHtml(client),/ENTRÉE FERMÉE/);});
check('mixed home section accurately named',()=>assert(fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8').includes('Matchs suivis en direct')));
console.log('LIVE_SURFACES_CHECKS_PASSED='+checks);
// Real SQLite snapshots through the actual API getter, then all three renderers.
const Database=require('better-sqlite3'),model=require('./official_signal_snapshots'),coherence=require('./live_state_coherence');
for(const n of [4,5]){
 const db=new Database(':memory:');model.init(db);db.exec('CREATE TABLE agent_calls(id INTEGER,match_key TEXT,agent_name TEXT,http_status INTEGER,issue TEXT,created_at TEXT)');
 const m={...base,home:'Home',away:'Away'},id='snapshot-'+n;
 model.capture(db,{id,match:m,analysisMatchKey:id,minute:35,scoreHome:0,scoreAway:0,redCardsHome:0,redCardsAway:0,votes:raw(n).votes,consensus:'under',consensusVotes:n,confidence:91,realOdd:1.8,ruleVersion:'test',createdAt:new Date().toISOString()});
 const reader=vm.createContext({db,officialSnapshots:model,liveStateCoherence:coherence,parseLiveMinuteValue:Number,getPredictionSnapshotKey:()=>id,CLIENT_OU25_CLIENT_MAX_MINUTE:45,CONCILE_AGENT_NAMES:raw(n).votes.map(v=>v.agent),ou25TerminalReason:()=> 'Avis indisponible',console});
 vm.runInContext(source.match(/function getStoredLiveOu25VoteState\([^]*?\n}/)[0],reader);
 check(n+' SQLite votes reach actual API getter and all surfaces',()=>{const state=reader.getStoredLiveOu25VoteState(m);assert.equal(state.vote_count,n);const projected=api.homepageLiveMatch({...m,ou25:state},true);assert.equal(ctx.heroOu25(projected).voteCount,n);assert.equal(ctx.appOu25(projected).voteCount,n);assert.equal(ctx.liveOu25State(projected).voteCount,n);});
 model.registerOfficial(db,id);
 check(n+' SQLite official snapshot survives 2H',()=>{const second={...m,minute:67,period:'2H',score_home:1};const state=reader.getStoredLiveOu25VoteState(second);assert.equal(state.official,true);assert.equal(state.vote_count,n);assert.equal(state.consensus_direction,'under');assert.equal(state.snapshot_id,id);});
 db.close();
}
console.log('LIVE_SURFACES_WITH_SQLITE_CHECKS_PASSED='+checks);
