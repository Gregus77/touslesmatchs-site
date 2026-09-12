'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const Database=require(process.env.TEST_SQLITE_MODULE||'better-sqlite3');
const c=require('./telegram_client');
const env={TELEGRAM_BOT_TOKEN:'mock',TELEGRAM_CHANNEL_ID:'-1',TELEGRAM_PREMIUM_CHANNEL_ID:'-2',TELEGRAM_RU_FREE_CHANNEL_ID:'-3',TELEGRAM_RU_PREMIUM_CHANNEL_ID:'-4'};
const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'recap-test-')),'test.db');
const db=new Database(file);db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE concile_analyses(match_key TEXT PRIMARY KEY,home TEXT,away TEXT,competition TEXT,minute_at_analysis INTEGER,score_home_at_analysis INTEGER,score_away_at_analysis INTEGER,best_bet TEXT,real_odd REAL,real_odd_source TEXT,analysed_at TEXT,outcome TEXT,final_score_home INTEGER,final_score_away INTEGER,sig_sent_free INTEGER DEFAULT 0,sig_sent_premium INTEGER DEFAULT 0);
CREATE TABLE telegram_signal_deliveries(match_key TEXT,channel TEXT,telegram_message_id INTEGER,market TEXT,vote_count INTEGER,ok INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
let time=Date.parse('2026-09-11T21:45:00Z'),calls=0,failRu=true;
const transport=async(token,payload)=>payload.chat_id==='-4'&&failRu?{ok:false,retryAfter:30}:{ok:true,messageId:++calls};
const pub=c.createPublisher({db,env,transport,now:()=>time});
assert.equal(c.sqliteUtcMs('2026-09-11 22:00:00'),Date.parse('2026-09-11T22:00:00Z'));
assert.equal(c.parisParts(c.sqliteUtcMs('2026-09-11 22:00:00')).day,'2026-09-12');
for(const [day,hours] of [['2026-09-11',24],['2026-03-29',23],['2026-10-25',25]]) {
 const {start,end}=c.parisDayBounds(day);assert.equal((Date.parse(end)-Date.parse(start))/3600000,hours);
 assert.equal(c.parisParts(Date.parse(start)).day,day);assert.notEqual(c.parisParts(Date.parse(end)).day,day);
}
assert(!c.recapDue(Date.parse('2026-09-11T20:00:00Z'))); // 22h not client recap
assert(!c.recapDue(time-60000));assert(c.recapDue(time));assert(c.recapDue(time+60000));
assert(!c.recapDue(Date.parse('2026-09-11T22:00:00Z')));
function analysis(key) {db.prepare("INSERT INTO concile_analyses(match_key,home,away,competition,minute_at_analysis,score_home_at_analysis,score_away_at_analysis,best_bet,real_odd,real_odd_source,analysed_at,outcome,final_score_home,final_score_away) VALUES (?, 'Home','Away','League',21,1,1,'Over 2.5 buts',1.5,'real','2026-09-11 16:53:00','win',2,1)").run(key);}
analysis('match');
const signal={matchKey:'match',home:'Home',away:'Away',competition:'League',minute:21,scoreHome:1,scoreAway:1,market:'Over 2.5 buts',odd:'1.50',votes:3,confidence:82};
assert(pub.enqueue('signal',signal,pub.targets[1],'match'));
db.prepare("UPDATE concile_analyses SET minute_at_analysis=45,score_home_at_analysis=2,best_bet='Under 2.5 buts',real_odd=1.9,analysed_at='2026-09-12 01:00:00' WHERE match_key='match'").run();
const frozen=db.prepare("SELECT * FROM concile_analyses WHERE match_key='match'").get();
assert.equal(frozen.minute_at_analysis,21);assert.equal(frozen.score_home_at_analysis,1);assert.equal(frozen.best_bet,signal.market);assert.equal(frozen.real_odd,1.5);
assert.throws(()=>db.prepare("UPDATE client_signal_snapshots SET minute_at_analysis=45").run());
assert(pub.enqueue('signal',{...signal,minute:45,odd:'1.90'},pub.targets[3],'match'));
const ru=db.prepare("SELECT payload FROM client_telegram_outbox WHERE channel='ru_premium'").get();assert(JSON.parse(ru.payload).text.includes('21'));assert(JSON.parse(ru.payload).text.includes('1.50'));
assert(!pub.enqueue('signal',signal,pub.targets[1],'match'));
for(const [key,at,id,ch] of [['start','2026-09-10 22:00:00',1,'premium'],['before','2026-09-10 21:59:59',2,'premium'],['last','2026-09-11T21:59:59Z',3,'premium'],['after','2026-09-11 22:00:00',4,'premium'],['bad','2026-09-11 10:00:00',0,'premium'],['negative','2026-09-11 10:00:00',-1,'premium'],['legacy','2026-09-11 10:00:00',8,'standard']]) {
 analysis(key);db.prepare('INSERT INTO telegram_signal_deliveries VALUES (?,?,?,?,3,1,?)').run(key,ch,id,'Under 2.5 buts',at);
}
const list=c.recapRows(db,'2026-09-11','premium');assert.deepEqual(list.map(r=>r.match_key),['start','last']);assert(list.every(r=>r.outcome==='loss'));assert.equal(c.recapRows(db,'2026-09-11','ru_premium').length,0);
assert(pub.queueDailyRecap('2026-09-11'));assert(!pub.queueDailyRecap('2026-09-11'));
const second=new Database(file),other=c.createPublisher({db:second,env,transport,now:()=>time});assert(!other.queueDailyRecap('2026-09-11'));
assert.equal(db.prepare("SELECT count(*) n FROM client_telegram_outbox WHERE kind='recap'").get().n,4);
analysis('invalid-recap');db.prepare("INSERT INTO telegram_signal_deliveries VALUES ('invalid-recap','ru_premium',99,'unsupported',3,1,'2026-09-12 10:00:00')").run();
assert.throws(()=>pub.queueDailyRecap('2026-09-12'));
assert(!db.prepare("SELECT 1 FROM client_recap_runs WHERE day='2026-09-12'").get());
assert.equal(db.prepare("SELECT count(*) n FROM client_telegram_outbox WHERE kind='recap'").get().n,4);
const pending=c.render('recap',{day:'2026-09-11',rows:[{home:'H',away:'A',outcome:'pending',best_bet:'Over 2.5 buts'}]},pub.targets[0]);assert(pending.text.includes('En attente'));assert(!pending.text.includes('Over 2.5'));
(async()=>{await Promise.all([pub.flush(),other.flush()]);assert.equal(db.prepare("SELECT count(*) n FROM telegram_signal_deliveries WHERE match_key='match'").get().n,1);failRu=false;time+=31000;await other.flush();assert.equal(db.prepare("SELECT count(*) n FROM telegram_signal_deliveries WHERE match_key='match'").get().n,2);assert.equal(db.prepare("SELECT count(*) n FROM client_telegram_outbox WHERE state='delivered'").get().n,6);second.close();db.close();console.log('PASS timezone/DST/boundaries, immutable queued snapshot, separate FR/RU proof, pending results, persistent lock, duplicate execution and retry');})().catch(e=>{console.error(e);process.exitCode=1;});
