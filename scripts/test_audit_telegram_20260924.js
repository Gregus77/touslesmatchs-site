'use strict';
// Current delivery contract, isolated SQLite and injected transport only.
const assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {createPublisher}=require('./telegram_client');
const db=new Database(':memory:');
db.exec(`CREATE TABLE concile_analyses(match_key TEXT PRIMARY KEY,
 minute_at_analysis INTEGER,score_home_at_analysis INTEGER,score_away_at_analysis INTEGER,
 best_bet TEXT,real_odd REAL,real_odd_source TEXT,analysed_at TEXT,
 sig_sent_free INTEGER DEFAULT 0,sig_sent_premium INTEGER DEFAULT 0);
 CREATE TABLE telegram_signal_deliveries(match_key TEXT,channel TEXT,
 telegram_message_id INTEGER,market TEXT,vote_count INTEGER,ok INTEGER,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const env={TELEGRAM_BOT_TOKEN:'isolated',TELEGRAM_CHANNEL_ID:'-1',
 TELEGRAM_PREMIUM_CHANNEL_ID:'-2',TELEGRAM_RU_FREE_CHANNEL_ID:'-3',TELEGRAM_RU_PREMIUM_CHANNEL_ID:'-4'};
let now=Date.parse('2026-09-24T12:00:00Z'),failRu=true,firstHalf=true;
const calls=[];
const options={db,env,now:()=>now,validateSignal:async()=>({ok:firstHalf,terminal:!firstHalf}),
 transport:async(_token,payload)=>{calls.push(payload.chat_id);return failRu&&payload.chat_id==='-4'
  ?{ok:false,retryAfter:30}:{ok:true,messageId:calls.length};}};
function input(key){
 db.prepare(`INSERT INTO concile_analyses VALUES (?,39,0,0,'Under 2.5 buts',1.7,'isolated',?,0,0)`).run(key,new Date(now).toISOString());
 return {matchKey:key,home:'Test Home',away:'Test Away',competition:'Isolated test',minute:39,
  scoreHome:0,scoreAway:0,market:'Under 2.5 buts',votes:4,confidence:81,odd:'1.70'};
}
(async()=>{
 let pub=createPublisher(options);const data=input('isolated');
 for(const dest of pub.targets)assert(pub.enqueue('signal',data,dest,'isolated',now+120000));
 await Promise.all([pub.flush(),pub.flush()]);assert.equal(calls.length,4);
 assert.equal(db.prepare('SELECT count(*) n FROM telegram_signal_deliveries WHERE ok=1 AND telegram_message_id>0').get().n,3);
 pub=createPublisher(options);failRu=false;now+=31000;
 await pub.flush();assert.deepEqual(calls,['-1','-2','-3','-4','-4']);
 assert.equal(db.prepare('SELECT count(*) n FROM telegram_signal_deliveries WHERE ok=1 AND telegram_message_id>0').get().n,4);
 await pub.flush();assert.equal(calls.length,5);
 const closed=input('closed');
 pub.enqueue('signal',closed,pub.targets[1],'closed',now+120000);firstHalf=false;
 await pub.flush();assert.equal(calls.length,5);
 assert.equal(db.prepare("SELECT state FROM client_telegram_outbox WHERE match_key='closed'").get().state,'expired');
 const count=db.prepare('SELECT count(*) n FROM telegram_signal_deliveries').get().n;
 pub.enqueue('result',{...data,outcome:'win'},pub.targets[1],'isolated-result');
 await pub.flush();assert.equal(db.prepare('SELECT count(*) n FROM telegram_signal_deliveries').get().n,count);
 db.close();console.log('PASS current Telegram: four channels, positive IDs, independent RU retry, publisher restart, dedup, HT expiry, no result-as-signal proof');
})().catch(error=>{console.error(error);process.exitCode=1;});
