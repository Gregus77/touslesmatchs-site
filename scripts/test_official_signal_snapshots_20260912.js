'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require(process.env.TEST_SQLITE_MODULE || 'better-sqlite3');
const model = require('./official_signal_snapshots');
const db = new Database(':memory:');
model.init(db);
const match = {fixtureId:42,home:'Home',away:'Away',score_home:0,score_away:0};
const seats = directions => directions.map((direction,index)=>({agent:`IA ${index+1}`,direction,confidence:80+index,status:direction?'voted':'pending',updated_at:'2026-09-12T20:00:00Z'}));
model.capture(db,{id:'42_day_15_0-0',match,analysisMatchKey:'42_day',minute:20,scoreHome:0,scoreAway:0,redCardsHome:0,redCardsAway:0,votes:seats(['under','under','over',null,'under']),consensus:'under',consensusVotes:3,confidence:81,realOdd:1.7,ruleVersion:'legacy-v1',createdAt:'2026-09-12T20:00:00Z'});
const goalMatch={...match,score_home:0,score_away:1};
const changed=model.reanalysisGate(db,goalMatch,0,0,1000000);
assert.equal(changed.allowed,false);assert.equal(changed.retryAfterMs,150000);
assert.equal(model.reanalysisGate(db,goalMatch,0,0,1149999).allowed,false);
assert.equal(model.reanalysisGate(db,goalMatch,0,0,1150000).allowed,true);
model.capture(db,{id:'42_day_30_0-1',match:goalMatch,analysisMatchKey:'42_day',minute:39,scoreHome:0,scoreAway:1,redCardsHome:0,redCardsAway:0,votes:seats(['over','over','over',null,'over']),consensus:'over',consensusVotes:4,confidence:82,realOdd:1.91,ruleVersion:'v2',createdAt:'2026-09-12T20:03:00Z'});
model.registerOfficial(db,'42_day_30_0-1');
assert.throws(()=>model.registerOfficial(db,'42_day_15_0-0'),/outside 35-45|already frozen/);
model.capture(db,{id:'42_day_45_1-1',match:{...match,score_home:1,score_away:1},analysisMatchKey:'42_day',minute:45,scoreHome:1,scoreAway:1,votes:seats(['under','under','under','under',null]),consensus:'under',consensusVotes:4,confidence:84,realOdd:1.8,ruleVersion:'v2',createdAt:'2026-09-12T20:09:00Z'});
model.recordResult(db,'42_day_30_0-1',1,2,'test');
const state=model.stateForMatch(db,{...match,minute:79,score_home:1,score_away:2,status:'FINISHED'},'2026-09-12');
assert.equal(state.kind,'official');
assert.equal(state.snapshot.id,'42_day_30_0-1');
assert.equal(state.snapshot.consensus,'over');
assert.equal(state.snapshot.minute,39);
assert.equal(state.snapshot.outcome,'win');
assert.deepEqual(state.snapshot.directions,['over','over','over',null,'over']);
assert.equal(db.prepare('SELECT COUNT(*) n FROM official_vote_snapshots').get().n,3);
assert.throws(()=>db.prepare("UPDATE official_vote_snapshots SET consensus='under' WHERE id='42_day_30_0-1'").run(),/immutable/);
const appSource=fs.readFileSync(path.join(__dirname,'../public/app.html'),'utf8');
assert.match(appSource,/appWasSent\(a\)\|\|!!a\.official_signal_snapshot_id/,
  'the app history must retain a finished match when it has an immutable official snapshot');
assert.match(appSource,/TLMMatchLifecycle\.phase\(m\)!=='finished'/,
  'a finished official signal must not remain presented as a live match');

// La preuve Telegram transporte exactement le même identifiant officiel.
db.exec(`CREATE TABLE concile_analyses(match_key TEXT PRIMARY KEY,minute_at_analysis INTEGER,
  score_home_at_analysis INTEGER,score_away_at_analysis INTEGER,best_bet TEXT,real_odd REAL,
  real_odd_source TEXT,analysed_at TEXT,sig_sent_premium INTEGER DEFAULT 0,sig_sent_free INTEGER DEFAULT 0);
  INSERT INTO concile_analyses VALUES('42_day',39,0,1,'Over 2.5 buts',1.91,'test','2026-09-12T20:03:00Z',0,0);
  CREATE TABLE telegram_signal_deliveries(id INTEGER PRIMARY KEY,match_key TEXT,channel TEXT,
    telegram_message_id INTEGER,market TEXT,vote_count INTEGER,ok INTEGER,error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const telegram=require('./telegram_client');
let now=2000000;
const publisher=telegram.createPublisher({db,env:{TELEGRAM_BOT_TOKEN:'test',TELEGRAM_PREMIUM_CHANNEL_ID:'-2'},now:()=>now,
  transport:async()=>({ok:true,messageId:987})});
publisher.enqueue('signal',{matchKey:'42_day',officialSignalSnapshotId:'42_day_30_0-1',home:'Home',away:'Away',competition:'Test',minute:39,scoreHome:0,scoreAway:1,market:'Over 2.5 buts',votes:4,confidence:82,odd:'1.91'},publisher.targets[0],'42');
assert.equal(db.prepare('SELECT official_signal_snapshot_id id FROM client_telegram_outbox').get().id,'42_day_30_0-1');
(async()=>{
  await publisher.flush();
  assert.equal(db.prepare('SELECT official_signal_snapshot_id id FROM telegram_signal_deliveries').get().id,'42_day_30_0-1');
  console.log('PASS immutable snapshots: Under 0-0 invalidated, Over 39\' frozen, final 1-2 won, stale Under never current; Telegram uses same id');
})().catch(error=>{console.error(error);process.exitCode=1;});
