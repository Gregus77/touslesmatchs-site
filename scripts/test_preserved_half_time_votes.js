'use strict';
const assert = require('node:assert/strict');
const coherence = require('./live_state_coherence');
const votes = ['under','under','over','under','over'].map((direction,i)=>({agent:`IA${i+1}`,direction,status:'voted'}));
const state = {snapshot_minute:39,snapshot_score:'1-0',vote_count:5,consensus_count:3,votes,official:false};
for (const match of [
  {minute:45,status:'HT'}, {minute:56,status:'IN_PLAY'},
  {minute:65,status:'2H'}, {minute:90,status:'FINISHED'}
]) {
  const result=coherence.publicState({...match,score_home:2,score_away:1},state);
  assert.deepEqual(result.votes,votes,'Historical opinions must survive subsequent goals');
  assert.equal(result.vote_count,5);
  assert.equal(result.snapshot_minute,39);
  assert.equal(result.snapshot_score,'1-0');
  assert.equal(result.official,false,'A historical trend must not become a signal');
  assert.equal(result.window_status,'closed');
  assert.equal(result.analysis_state,'archived');
  assert.match(result.recommendation_status,/aucun signal officiel/);
}
assert.equal(coherence.publicState({minute:44,status:'1H',score_home:2,score_away:1},state).analysis_state,'stale');
assert.equal(coherence.publicState({minute:47,status:'1H',score_home:2,score_away:1},state).analysis_state,'stale','Confirmed first-half stoppage time is not half-time');
assert.equal(coherence.publicState({minute:56,status:'2H',score_home:2,score_away:1},{...state,snapshot_minute:30}).analysis_state,'stale','Do not present pre-window analysis as the requested final analysis');
const official={...state,official:true};
assert.equal(coherence.publicState({minute:70,score_home:4,score_away:1},official),official);
assert.equal(state.analysis_state,undefined,'No original snapshot mutation');
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.env.TLM_ROOT || path.join(__dirname,'..');
const source=fs.readFileSync(process.env.API_SOURCE || path.join(root,'scripts/api_server.js'),'utf8');
const a=source.indexOf('function getLiveOu25VoteState(match)'),b=source.indexOf('function clientOu25VisibilityEligibility(',a);
assert(a>=0&&b>a);
const sandbox={liveStateCoherence:coherence,parseLiveMinuteValue:Number,getPredictionSnapshotKey:()=> 'new_second_half_bucket',
  CLIENT_OU25_CLIENT_MAX_MINUTE:45,CONCILE_AGENT_NAMES:votes.map(v=>v.agent),console,
  db:{prepare:()=>({all:()=>[]})},
  officialSnapshots:{stateForMatch:()=>({kind:'trend',snapshot:{id:'original_39',minute:39,score_home:1,score_away:0,votes,seat_statuses:votes.map(v=>v.status),consensus_votes:3,created_at:'2026-09-20T00:10:00Z'}})}};
vm.createContext(sandbox);vm.runInContext(source.slice(a,b),sandbox);
sandbox.officialSnapshots.archivedStateForMatch=sandbox.officialSnapshots.stateForMatch;
const actual=sandbox.getLiveOu25VoteState({minute:65,status:'IN_PLAY',score_home:2,score_away:1});
assert.equal(actual.vote_count,5,'Actual API must select prior snapshot, not empty second-half bucket');
assert.equal(actual.snapshot_id,'original_39');
assert.equal(actual.analysis_state,'archived');
assert.equal(actual.official,false);
let Database;
try {Database=require('better-sqlite3');}catch{Database=require('node:sqlite').DatabaseSync;}
const db=new Database(':memory:');
const snapshots=require('./official_signal_snapshots');snapshots.init(db);
function capture(id,minute,at,observation){return snapshots.capture(db,{id,match:{fixtureId:123},analysisMatchKey:id,minute,scoreHome:1,scoreAway:0,votes,consensus:'under',consensusVotes:3,ruleVersion:'test',createdAt:at,observation});}
capture('late-night',39,'2026-09-19T23:55:00Z');
let stored=snapshots.archivedStateForMatch(db,{fixtureId:123},new Date('2026-09-20T00:20:00Z'));
assert.equal(stored.snapshot.id,'late-night','UTC midnight must not erase fixture history');
capture('second-half-unverified',47,'2026-09-20T00:01:00Z');
assert.equal(snapshots.archivedStateForMatch(db,{fixtureId:123},new Date('2026-09-20T00:20:00Z')).snapshot.id,'late-night');
capture('stoppage',48,'2026-09-20T00:02:00Z',{phase:'1H',score:'1-0',minute:48,verified_at:'2026-09-20T00:02:00Z'});
stored=snapshots.archivedStateForMatch(db,{fixtureId:123},new Date('2026-09-20T00:20:00Z'));
assert.equal(stored.snapshot.id,'stoppage');assert.equal(stored.snapshot.first_half_verified,true);
assert.equal(coherence.publicState({minute:60,status:'2H',score_home:2,score_away:0},{...state,snapshot_minute:48,first_half_verified:true}).vote_count,5);
assert.equal(snapshots.archivedStateForMatch(db,{fixtureId:999},new Date('2026-09-20T00:20:00Z')).snapshot,null);
assert.equal(snapshots.archivedStateForMatch(db,{fixtureId:123},new Date('2026-09-21T00:20:00Z')).snapshot,null);
db.close();
function extract(file,start,end){const s=fs.readFileSync(path.join(root,'public',file),'utf8');const i=s.indexOf(start),j=s.indexOf(end,i+start.length);assert(i>=0&&j>i);return s.slice(i,j);}
const front={document:{getElementById:()=>null},esc:String,escHtml:String,TLMMatchLifecycle:{phase:()=> 'closed'},liveHomeScore:m=>m.score_home,liveAwayScore:m=>m.score_away};
vm.createContext(front);
vm.runInContext(extract('index.html','function heroOu25(','function renderAnalyzedList('),front);
const match={minute:65,status:'2H',ou25:{...actual,locked:false}};
assert.match(front.tlmVoteSnapshotText(match),/39.*score 1-0/);
assert.equal((front.tlmVoteCirclesHtml(match).match(/>U<|>O</g)||[]).length,5);
vm.runInContext(extract('app.html','function appOu25(','function appLogo('),front);
const app=front.appMiniVotes(match);
assert.equal((app.match(/>U<|>O</g)||[]).length,5);assert.match(app,/39.*score 1-0/);
vm.runInContext(extract('live-ia.html','function liveOu25State(','// ── Render'),front);
assert.match(front.renderLiveOu25Details(match),/39.*score 1-0/);
assert.equal((front.tlmVoteCirclesHtml({...match,ou25:{...actual,locked:true}}).match(/>U<|>O</g)||[]).length,0,'Premium protection remains intact');
console.log('PRESERVED_HALF_TIME_VOTES_OK');
