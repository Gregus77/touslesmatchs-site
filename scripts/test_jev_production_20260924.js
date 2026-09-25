'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const jev = require('./jev_decision_engine');
const snapshots = require('./official_signal_snapshots');
const firstHalf = require('./first_half_delivery');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
function answer(choice='SEND',confidence=0.9) {
  return {model:'test-jev-version',answers:{production_decision:{type:'choice',choice,confidence,
    probabilities:Object.fromEntries(jev.CHOICES.map(k=>[k,k===choice?0.85:0.05]))}},usage:{input_tokens:100,output_tokens:5}};
}
function setup({choice='SEND',confidence=0.9,transport,traditional=false,env={}}={}) {
  const db = new Database(':memory:'); snapshots.init(db);
  const match = {fixtureId:42,sport:'Football',home:'Home',away:'Away',competition:'Test league',minute:38,status:'1H',score_home:0,score_away:0};
  const snapshot = snapshots.capture(db,{id:'new-natural-snapshot',match,analysisMatchKey:'new-natural-match',minute:38,
    scoreHome:0,scoreAway:0,votes:['under','under','over',null,null].map((direction,i)=>({agent:`seat${i}`,direction,status:direction?'voted':'unavailable'})),
    consensus:'under',consensusVotes:2,confidence:60,realOdd:2.8,realOddSource:'real bookmaker',ruleVersion:'test',
    observation:{phase:'1H',score:'0-0',minute:38,verified_at:new Date().toISOString()}});
  let calls=0;const logs=[];
  const engine = jev.createEngine({db,env:{TYPESAFE_API_KEY:'TEST_SECRET_MUST_NEVER_PERSIST',JEV_ENABLED:'1',JEV_PRODUCTION_MODE:'1',
    JEV_MODEL:'test-jev-version',JEV_TIMEOUT_MS:'500',...env},logger:x=>logs.push(x),transport:async(...args)=>{
      calls++;assert.equal(args[0],'https://api.typesafe.ai/v1/systemone');
      const payload=JSON.parse(args[1].body);assert.equal(payload.questions.production_decision.type,'choice');
      return transport ? transport(...args) : {ok:true,json:async()=>answer(choice,confidence)};
    }});
  const state = jev.buildState({match,snapshot,stats:{total_shots_home:0},standings:{rank_gap:3},recovery:{enabled:true,ok:false},
    integrity:{first_half_open:true,real_data:true,competition_allowed:true,stats_status:'available'},
    traditional:{eligible:traditional,block_reason:traditional?null:'quorum_confidence_ranking_recovery_odd',rules:{quorum:4,confidence:80}}});
  const input={match_key:'new-natural-match',snapshot_id:snapshot.id,fixture_id:'42',state,structural_allowed:true,first_half_open:true,
    traditional_eligible:traditional,traditional_block_reason:traditional?null:'quantitative_refusal',revalidate:async()=>true};
  return {db,match,snapshot,engine,input,logs,calls:()=>calls};
}
(async()=>{
  await test('1 SEND overrides quantitative refusals only with actual persisted authority',async()=>{
    const t=setup();assert.throws(()=>snapshots.registerOfficial(t.db,t.snapshot.id),/requires 4/);
    const result=await t.engine.evaluate(t.input);assert.equal(result.final_decision,'SEND');assert.equal(result.traditional_eligible,0);
    snapshots.registerOfficial(t.db,t.snapshot.id,{jevDecisionId:result.id});
    assert.equal(snapshots.stateForMatch(t.db,t.match).kind,'official');
    assert.equal(snapshots.stateForMatch(t.db,t.match).snapshot.consensus_votes,2);
    assert.equal(snapshots.stateForMatch(t.db,t.match).snapshot.confidence,60);
  });
  for (const [index,choice] of [[2,'WAIT'],[3,'REANALYZE'],[4,'REJECT']]) await test(`${index} ${choice} never registers a signal`,async()=>{
    const t=setup({choice});const r=await t.engine.evaluate(t.input);assert.equal(r.final_decision,choice);
    assert.throws(()=>snapshots.registerOfficial(t.db,t.snapshot.id,{jevDecisionId:r.id}),/authorization/);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM official_signal_registry').get().n,0);
  });
  await test('5 low confidence becomes WAIT, closed half becomes REJECT',async()=>{
    const t=setup({confidence:0.69});const r=await t.engine.evaluate(t.input);assert.equal(r.final_decision,'WAIT');
    assert.equal(jev.chooseFinal({answer:{choice:'SEND',confidence:0.69},traditional:true,open:false,minimum:0.7}).final_decision,'REJECT');
  });
  await test('6 strict timeout even for non-aborting mock transport',async()=>{
    const t=setup({transport:()=>new Promise(()=>{})});const started=Date.now();const r=await t.engine.evaluate(t.input);
    assert.equal(r.error_category,'timeout');assert.equal(r.decision,null);assert.ok(Date.now()-started<1500);assert.equal(t.calls(),1);
  });
  for (const [index,status,category] of [[7,401,'http_401'],[8,429,'http_429'],[9,500,'http_5xx'],[21,403,'http_403'],[22,422,'http_422']])
    await test(`${index} HTTP ${status} no POST retry`,async()=>{
      const t=setup({transport:async()=>({ok:false,status})});const r=await t.engine.evaluate(t.input);
      assert.equal(r.error_category,category);assert.equal(r.decision,null);assert.equal(r.final_decision,'REJECT');assert.equal(t.calls(),1);
    });
  await test('10 invalid JSON categorized without echoing provider body',async()=>{
    const t=setup({transport:async()=>({ok:true,json:async()=>{throw new Error('TEST_SECRET_MUST_NEVER_PERSIST');}})});
    assert.equal((await t.engine.evaluate(t.input)).error_category,'invalid_json');
  });
  await test('11 missing production_decision',async()=>{
    const t=setup({transport:async()=>({ok:true,json:async()=>({model:'test-jev-version',answers:{}})})});
    assert.equal((await t.engine.evaluate(t.input)).error_category,'missing_production_decision');
  });
  await test('12 duplicate snapshot concurrent and persisted across restart',async()=>{
    const t=setup();const [a,b]=await Promise.all([t.engine.evaluate(t.input),t.engine.evaluate(t.input)]);assert.equal(a.id,b.id);assert.equal(t.calls(),1);
    const next=jev.createEngine({db:t.db,env:{JEV_MODEL:'test-jev-version'},transport:()=>{throw new Error('Must not call');}});
    assert.equal((await next.evaluate(t.input)).id,a.id);assert.equal(t.calls(),1);
  });
  await test('13 structurally forbidden never calls Jev, even with traditional SEND',async()=>{
    const t=setup({traditional:true});t.input.structural_allowed=false;
    assert.equal((await t.engine.evaluate(t.input)).final_decision,'REJECT');assert.equal(t.calls(),0);
  });
  await test('14 first half closed never calls Jev; send-time validator rejects HT',async()=>{
    const t=setup();t.input.first_half_open=false;assert.equal((await t.engine.evaluate(t.input)).final_decision,'REJECT');assert.equal(t.calls(),0);
    assert.equal(firstHalf.evaluateFirstHalf({fixture:{id:42,status:{short:'HT',elapsed:45}},goals:{home:0,away:0}},t.snapshot).ok,false);
  });
  await test('15 score changes during Jev block SEND and registry override',async()=>{
    const t=setup();t.input.revalidate=async()=>false;const r=await t.engine.evaluate(t.input);
    assert.equal(r.decision,'SEND');assert.equal(r.final_decision,'REJECT');assert.equal(r.decision_source,'tlm_structural_guard');
    assert.throws(()=>snapshots.registerOfficial(t.db,t.snapshot.id,{jevDecisionId:r.id}),/authorization/);
    assert.equal(firstHalf.evaluateFirstHalf({fixture:{id:42,status:{short:'1H',elapsed:39}},goals:{home:1,away:0}},t.snapshot).reason,'score_changed');
  });
  await test('16 TLM fallback only for fully traditional eligible candidate',async()=>{
    const t=setup({traditional:true,transport:async()=>({ok:false,status:503})});const r=await t.engine.evaluate(t.input);
    assert.equal(r.final_decision,'SEND');assert.equal(r.decision,null);assert.equal(r.decision_source,'tlm_fallback_jev_unavailable');
    // Fallback never grants quantitative authority to the registry.
    assert.throws(()=>snapshots.registerOfficial(t.db,t.snapshot.id,{jevDecisionId:r.id}),/authorization/);
  });
  await test('17 no secrets in state, database, logs, status or errors',async()=>{
    const t=setup({transport:async()=>{throw new Error('Authorization: Bearer TEST_SECRET_MUST_NEVER_PERSIST');}});await t.engine.evaluate(t.input);
    const dump=JSON.stringify([t.db.prepare('SELECT * FROM jev_decisions').all(),t.logs,t.engine.status()]);
    assert.ok(!dump.includes('TEST_SECRET'));assert.ok(!dump.includes('Authorization'));
    assert.equal(t.input.state.live_stats.shots.home,0);assert.equal(t.input.state.live_stats.shots.away,null);
  });
  await test('18 no historical table mutation or fabricated result',async()=>{
    const t=setup();const before=JSON.stringify(t.db.prepare('SELECT * FROM official_vote_snapshots').all());await t.engine.evaluate(t.input);
    assert.equal(JSON.stringify(t.db.prepare('SELECT * FROM official_vote_snapshots').all()),before);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM official_signal_results').get().n,0);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM official_signal_registry').get().n,0);
  });
  await test('19 no Telegram transport in decision module; actual fixture revalidated at delivery',async()=>{
    const t=setup();await t.engine.evaluate(t.input);
    const validator=firstHalf.createValidator({db:t.db,fetchFixture:async()=>({fixture:{id:42,status:{short:'1H',elapsed:38}},goals:{home:0,away:0}})});
    assert.equal((await validator({official_signal_snapshot_id:t.snapshot.id})).ok,true);
    assert.ok(!fs.readFileSync(require.resolve('./jev_decision_engine'),'utf8').includes('api.telegram.org'));
  });
  await test('20 bounded reevaluation, same state never reanalyzes, two new analyses maximum',async()=>{
    const t=setup();let analyzes=0,polls=0;
    for(let i=0;i<30;i++) {const r=jev.reserveReobservation(t.db,'scope',t.snapshot.id,100000+i*1000,i<2?t.snapshot.id:`new-${i}`);analyzes+=r.analyze?1:0;polls+=r.poll?1:0;}
    assert.equal(analyzes,2);assert.ok(polls<=12);
    assert.equal(jev.reserveReobservation(t.db,'scope',t.snapshot.id,1000000,'another').analyze,false);
  });
  await test('23 wrong model, invalid probabilities and usage fail closed',async()=>{
    const good=answer();assert.throws(()=>jev.validateResponse({...good,model:'unapproved'},['test-jev-version']),/model_unavailable/);
    good.answers.production_decision.probabilities.SEND=4;assert.throws(()=>jev.validateResponse(good,['test-jev-version']),/invalid_probabilities/);
    const bad=answer();bad.usage.input_tokens='100';assert.throws(()=>jev.validateResponse(bad,['test-jev-version']),/invalid_usage/);
  });
  await test('24 circuit breaker stops fourth call and survives restart',async()=>{
    const t=setup({transport:async()=>({ok:false,status:500})});
    for(let i=0;i<4;i++) await t.engine.evaluate({...t.input,snapshot_id:`state-${i}`});
    assert.equal(t.calls(),3);assert.equal(t.engine.status().circuit_open,true);
    const next=jev.createEngine({db:t.db,env:{TYPESAFE_API_KEY:'test',JEV_ENABLED:'1',JEV_PRODUCTION_MODE:'1',JEV_MODEL:'test-jev-version'},transport:()=>{throw new Error('must not call');}});
    assert.equal((await next.evaluate({...t.input,snapshot_id:'state-after-restart'})).error_category,'circuit_open');
  });
  await test('25 missing key produces fallback without network',async()=>{
    const t=setup({traditional:true,env:{TYPESAFE_API_KEY:''}});const r=await t.engine.evaluate(t.input);
    assert.equal(r.error_category,'not_configured');assert.equal(r.final_decision,'SEND');assert.equal(t.calls(),0);
  });
  await test('26 statistical windows retain real votes and no performance claim',async()=>{
    const t=setup();await t.engine.evaluate(t.input);const status=t.engine.status();
    assert.equal(status.calls_today,1);assert.equal(status.input_tokens_today,100);
    for(const k of ['24h','7d','30d']) {assert.equal(status.windows[k].comparison[0].traditional_decision,'REJECT');assert.equal(status.windows[k].comparison[0].resolved_official,0);}
    assert.equal(status.performance_claim,null);
  });
  await test('27 cached SEND cannot authorize changed evidence or a closed half',async()=>{
    const t=setup();await t.engine.evaluate(t.input);
    const changed=structuredClone(t.input.state);changed.match.score_home=1;
    const r=await t.engine.evaluate({...t.input,state:changed});assert.equal(r.final_decision,'REJECT');assert.equal(t.calls(),1);
    assert.equal((await t.engine.evaluate({...t.input,first_half_open:false})).final_decision,'REJECT');
  });
  await test('28 old snapshots never call Jev or replay a cached SEND',async()=>{
    const t=setup();t.input.state.match.snapshot_created_at=new Date(Date.now()-130000).toISOString();
    const r=await t.engine.evaluate(t.input);assert.equal(r.final_decision,'REJECT');assert.equal(r.structural_block_reason,'stale_snapshot');assert.equal(t.calls(),0);
  });
  await test('29 null stats and unknown cards stay unknown; percentage possession is real',async()=>{
    const t=setup();const args={match:t.match,snapshot:t.snapshot,integrity:{},traditional:{},stats:null};
    assert.equal(jev.buildState(args).live_stats.shots.home,null);
    args.stats={possession_home:'58%',red_cards_home:0};
    const s=jev.buildState(args);assert.equal(s.live_stats.possession.home,58);assert.equal(s.live_stats.red_cards.home,null);
  });
  await test('30 interrupted request uses verified traditional fallback without a second POST',async()=>{
    const t=setup({traditional:true});const r=await t.engine.evaluate(t.input);
    t.db.prepare(`UPDATE jev_decisions SET decision=NULL,confidence=NULL,final_decision='REJECT',decision_source='pending_jev',
      error_category='interrupted_or_pending',created_at=? WHERE id=?`).run(new Date(Date.now()-10000).toISOString(),r.id);
    const recovered=await t.engine.evaluate(t.input);
    assert.equal(recovered.decision,null);assert.equal(recovered.final_decision,'SEND');
    assert.equal(recovered.decision_source,'tlm_fallback_jev_unavailable');assert.equal(t.calls(),1);
  });
  console.log(`${passed} Jev deterministic scenarios passed; isolated SQLite, mocked TypeSafe, zero real Telegram.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
