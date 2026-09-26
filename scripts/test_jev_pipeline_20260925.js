'use strict';
// Execute the actual production decision/registration/queue block, never the
// server startup or schedulers. All transports are mocks and SQLite is in RAM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Database = require('better-sqlite3');
const jev = require('./jev_decision_engine');
const official = require('./official_signal_snapshots');
const delivery = require('./first_half_delivery');
const telegram = require('./telegram_client');
const source = fs.readFileSync(require.resolve('./api_server'),'utf8');
const start = source.indexOf('  // The historical decision stays complete,');
const end = source.indexOf('\n  appendSignalDecisionEvent(match, "evaluation",',start);
assert.ok(start>0 && end>start);
const code = `(async()=>{${source.slice(start,end)}\nreturn {criteriaSnapshot,_blockReason,_tierBlock,_journalDecision};})()`;
async function scenario({choice='SEND',traditional=false,closed=false,changeScore=false,error=false}={}) {
  const db = new Database(':memory:');official.init(db);
  db.exec(`CREATE TABLE concile_analyses(match_key TEXT PRIMARY KEY,minute_at_analysis INTEGER,score_home_at_analysis INTEGER,
    score_away_at_analysis INTEGER,best_bet TEXT,real_odd REAL,real_odd_source TEXT,analysed_at TEXT,
    sig_sent_premium INTEGER DEFAULT 0,sig_sent_free INTEGER DEFAULT 0);
    CREATE TABLE telegram_signal_deliveries(id INTEGER PRIMARY KEY,match_key TEXT,channel TEXT,telegram_message_id INTEGER,
    market TEXT,vote_count INTEGER,ok INTEGER,error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE signal_delivery_expectations(match_key TEXT,channel TEXT,UNIQUE(match_key,channel));`);
  const match={fixtureId:42,id:42,home:'Home',away:'Away',sport:'Football',competition:'Allowed league',minute:38,score_home:0,score_away:0};
  const confidence=traditional?85:60,odd=1.7,votes=traditional?4:2;
  const snapshot=official.capture(db,{id:'new-snapshot',match,analysisMatchKey:'new-match',minute:38,scoreHome:0,scoreAway:0,
    votes:Array.from({length:5},(_,i)=>({agent:`seat${i}`,direction:i<votes?'under':i===4?'over':null,status:i<votes||i===4?'voted':'unavailable'})),
    consensus:'under',consensusVotes:votes,confidence,realOdd:odd,realOddSource:'real bookmaker',ruleVersion:'test',
    observation:{phase:'1H',score:'0-0',minute:38,verified_at:new Date().toISOString()}});
  db.prepare('INSERT INTO concile_analyses VALUES (?,?,?,?,?,?,?,?,0,0)').run('new-match',38,0,0,'Under 2.5 buts',odd,'real bookmaker',snapshot.created_at);
  let calls=0,sends=0,reevaluations=0;
  const engine=jev.createEngine({db,env:{JEV_ENABLED:'1',JEV_PRODUCTION_MODE:'1',JEV_MODEL:'mock-model',TYPESAFE_API_KEY:'test-only'},
    transport:async()=>{calls++;return error?{ok:false,status:500}:{ok:true,json:async()=>({model:'mock-model',answers:{production_decision:{type:'choice',choice,confidence:0.9,
      probabilities:Object.fromEntries(jev.CHOICES.map(k=>[k,k===choice?0.85:0.05]))}},usage:{input_tokens:100,output_tokens:5}})};}});
  const fixture=()=>({fixture:{id:42,status:{short:closed?'HT':'1H',elapsed:38}},goals:{home:changeScore?1:0,away:0}});
  const publisher=telegram.createPublisher({db,env:{TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_CHANNEL_ID:'-1',TELEGRAM_PREMIUM_CHANNEL_ID:'-2',TELEGRAM_RU_FREE_CHANNEL_ID:'-3',TELEGRAM_RU_PREMIUM_CHANNEL_ID:'-4'},
    validateSignal:delivery.createValidator({db,fetchFixture:async()=>fixture()}),
    transport:async()=>({ok:true,messageId:1000+(++sends)})});
  const flushes=[];
  const context={console:{log(){},error(){}},Date,Set,Number,String,Math,Boolean,
    traditionalCriteriaBlock:traditional?null:'traditional_quantitative_rejection',_coteReelle:true,recordedOdd:odd,
    TIER_MIN_REAL_ODD:1.5,TIER_MAX_REAL_ODD:2.1,clientOu25MatchEligible:!closed,ou25Only:true,isWomen:false,lowTrust:false,match,
    liveStateCoherence:{analysisWindow:()=>({open:!closed})},statsStatus:{observation:{phase:closed?'HT':'1H'}},
    capturedVoteSnapshot:snapshot,voteCountForSignal:votes,analysisResult:{match_key:'new-match',confidence,best_bet:'Under 2.5 buts',
      cote:odd,cote_source:'real bookmaker',raison:'Real test evidence',vote_summary:{vote_active:votes+1,vote_label:`${votes}/5`}},
    voteInfo:{vote_active:votes+1,vote_label:`${votes}/5`},enoughOu25SeatsPresent:traditional,requiredVotesForSignal:4,
    jevEngine:engine,jevDecisionEngine:jev,liveStats:{},standingsEvidence:{ok:traditional,rank_gap:traditional?5:3},
    recoveryEvidence:{ok:traditional,indicators:[]},RECOVERY_MODE_ENABLED:true,hasRealData:true,
    CLIENT_OU25_MIN_VOTES:4,CLIENT_OU25_MIN_CONFIDENCE:80,
    isClientOu25MatchEligible:()=>!closed,liveStateCollector:{revalidate:async()=>{if(closed||changeScore)throw new Error('state changed');return true;}},
    scheduleJevReobservation:()=>{reevaluations++;},criteriaSnapshot:{},_signalSentCache:new Set(),
    maskAiNames:String,escTgHtml:String,confidenceEmoji:()=>'',_freeSignalDailyDate:{date:'',count:0},signalsSentToday:()=>0,
    bestBetGrade:()=>({}),parseLiveMinuteValue:Number,computeSignalTier:()=> 'premium',
    persistedAnalysisMatchKey:'new-match',getPredictionSnapshotKey:()=>snapshot.id,officialSnapshots:official,db,
    canonicalMatchKey:()=> 'home-away',signalDeliveredToChannelToday:()=>false,
    clientTelegramPublisher:{targets:publisher.targets,enqueue:publisher.enqueue,flush:()=>{const p=publisher.flush();flushes.push(p);return p;}},
    shadowWorthy:false,_tierBlock:null,_journalDecision:'blocked',
  };
  const result=await vm.runInNewContext(code,context);await Promise.all(flushes);
  return {db,result,calls,sends,reevaluations,official:official.stateForMatch(db,match)};
}
(async()=>{
  const sent=await scenario();assert.equal(sent.calls,1);assert.equal(sent.sends,4);assert.equal(sent.official.kind,'official');
  assert.equal(sent.official.snapshot.consensus_votes,2);assert.equal(sent.result._blockReason,null);
  assert.equal(sent.db.prepare('SELECT COUNT(*) n FROM telegram_signal_deliveries WHERE vote_count=2 AND ok=1 AND telegram_message_id>0').get().n,4);
  for(const choice of ['WAIT','REANALYZE','REJECT']) {
    const t=await scenario({choice});assert.equal(t.sends,0);assert.equal(t.official.kind,'trend');
    assert.equal(t.reevaluations,choice==='REJECT'?0:1);
  }
  const closed=await scenario({closed:true});assert.equal(closed.calls,0);assert.equal(closed.sends,0);
  const changed=await scenario({changeScore:true});assert.equal(changed.calls,1);assert.equal(changed.sends,0);
  const fallback=await scenario({traditional:true,error:true});assert.equal(fallback.sends,4);
  assert.equal(fallback.result.criteriaSnapshot.jev.decision_source,'tlm_fallback_jev_unavailable');
  assert.equal((await scenario({error:true})).sends,0);
  // Public history uses the registry, not a reconstructed quantitative quorum.
  const fnStart=source.indexOf('function isVerifiedClientOu25Row(row) {');
  const fnEnd=source.indexOf('\nfunction displayDeliveryChannels',fnStart);
  const visible=vm.runInNewContext(source.slice(fnStart,fnEnd)+'\nisVerifiedClientOu25Row({match_key:"new-match",analysed_at:new Date().toISOString()})',
    {db:sent.db,hasConsistentScoreProgression:()=>true,Date});assert.equal(visible,true);
  assert.match(source,/homepageDisplayEligible = clientProductEligible && \(ou25\.official === true \|\| alignedVotes >= CLIENT_OU25_MIN_VOTES\)/);
  assert.match(source,/"\/admin\/ai-budget-stats", "\/admin\/jev-status"/);
  console.log('PASS production pipeline: native decision → exact immutable registry → 4 mocked Telegram receipts; quantitative override, WAIT, REANALYZE, REJECT, closed half, score change, fallback and public history. No real network.');
})().catch(e=>{console.error(e);process.exitCode=1;});
