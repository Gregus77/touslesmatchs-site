'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const coherence = require('./live_state_coherence');

async function main() {
  const match = {id: 101, fixtureId: 101, source: 'api-sports', sport: 'Football', score_home: 1, score_away: 0, minute: 43};
  const votes = ['over','over','under','over','over'].map((direction,i) => ({agent: 'IA'+i, direction, status: 'voted'}));
  const previous = {snapshot_score: {home: 1, away: 0}, vote_count: 5, consensus_count: 4, votes};
  assert.equal(coherence.publicState(match, previous), previous);
  const changed = {...match, score_home: 2, minute: 45};
  const stale = coherence.publicState(changed, previous);
  assert.equal(stale.analysis_state, 'stale');
  assert.equal(stale.consensus_count, 0);
  assert(stale.votes.every(v => v.direction === null && v.status === 'stale'));
  assert(stale.synchronization_reason.includes('1-0 → 2-0'));
  assert.equal(previous.votes[0].direction, 'over');
  const official = {...previous, official: true};
  assert.equal(coherence.publicState(changed, official), official);
  assert.equal(coherence.publicState(match, {...previous, snapshot_score:'2-0'}).analysis_state, 'stale'); // VAR reversal
  assert.equal(coherence.publicState(match, {...previous, snapshot_score:null}).analysis_state, 'stale');
  const newUnder = {...previous, snapshot_score:'2-0', votes:votes.map(v=>({...v,direction:'under'}))};
  assert.equal(coherence.publicState(changed, newUnder), newUnder); // Genuine new opinions remain intact.
  const fixture = (goals=1, phase='1H', minute=43) => ({fixture:{id:101,status:{short:phase,elapsed:minute}},goals:{home:goals,away:0},teams:{home:{id:10},away:{id:20}}});
  let now=Date.parse('2026-09-19T20:00:00Z'), current=fixture(), statCalls=0;
  const collector=coherence.createCollector({clock:()=>now, fetchFixture:async()=>current, fetchStats:async()=>{statCalls++;return {total_shots_home:8}}});
  const collected=await collector.collect(match,101);
  assert.equal(collected.observation.score,'1-0');
  await collector.revalidate(match,collected.observation);
  current=fixture(2);
  await assert.rejects(()=>collector.revalidate(match,collected.observation),{code:'LIVE_STATE_UNVERIFIED'});
  let calls=0;
  const goalDuringStats=coherence.createCollector({fetchFixture:async()=>fixture(++calls===1?1:2),fetchStats:async()=>({shots:1})});
  await assert.rejects(()=>goalDuringStats.collect(match,101),{code:'LIVE_STATE_UNVERIFIED'});
  current=fixture(1,'HT',45);
  await assert.rejects(()=>collector.collect(match,101),{code:'LIVE_STATE_UNVERIFIED'});
  current=fixture(); now+=120001;
  await assert.rejects(()=>collector.revalidate(match,collected.observation),{code:'LIVE_STATE_UNVERIFIED'});
  current=fixture(1,'1H',40);
  await assert.rejects(()=>collector.collect(match,101),{code:'LIVE_STATE_UNVERIFIED'});
  assert.equal(statCalls,1);

  // Execute the real patched API cache and parser without starting the API.
  const source=fs.readFileSync(process.env.API_SOURCE || require('node:path').join(__dirname,'api_server.js'),'utf8');
  function section(start,end) {const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert(i>=0&&j>i);return source.slice(i,j);}
  let requests=0;
  const sandbox={liveStateCoherence:coherence,API_SPORTS_KEY:'test',apiSportsBudgetOk:()=>true,matchStatsCache:new Map(),Date,console,
    httpGet:async()=>{requests++;return {response:[{team:{id:20},statistics:[{type:'Total Shots',value:2}]},{team:{id:10},statistics:[{type:'Total Shots',value:8}]}]}}};
  vm.createContext(sandbox);
  vm.runInContext(section('function parseMatchStats(data)', 'function buildStatsBlock')+'\n'+section('async function fetchMatchStats(fixtureId','const liveStateCollector')+'\nthis.get=fetchMatchStats;',sandbox);
  const state=coherence.fixtureState(fixture(),match,101);
  assert.equal((await sandbox.get(101,state)).total_shots_home,8);
  await sandbox.get(101,state);assert.equal(requests,1);
  await sandbox.get(101,{...state,score:'2-0'});assert.equal(requests,2);
  await sandbox.get(101,{...state,minute:44});assert.equal(requests,3);
  sandbox.httpGet=async()=>({response:[{team:{id:999},statistics:[]}]});
  await assert.rejects(()=>sandbox.get(101,{...state,minute:45}),{diagnostic_category:'teams_missing'});
  const expose={liveStateCoherence:coherence,getStoredLiveOu25VoteState:()=>previous,footballAttempts:{latest:()=>null},footballObserverExclusionReason:()=>null};
  vm.createContext(expose);
  vm.runInContext(section('function getLiveOu25VoteState(match)', 'function getStoredLiveOu25VoteState'),expose);
  assert.equal(expose.getLiveOu25VoteState(changed).vote_count,0);
  console.log('COHERENCE_BEHAVIOR_TESTS=true');
}
main().catch(()=>{console.log('COHERENCE_BEHAVIOR_TESTS=false');process.exitCode=1});
