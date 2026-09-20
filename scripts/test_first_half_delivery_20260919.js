'use strict';
const assert=require('assert'),{evaluateFirstHalf,createValidator}=require('./first_half_delivery'),{createPublisher}=require('./telegram_client');
let D;try{D=require('better-sqlite3');}catch{D=require('node:sqlite').DatabaseSync;}
const snap={fixture_id:'1',minute:45,score_home:0,score_away:0};
const fixture=(status,elapsed)=>({fixture:{id:1,status:{short:status,elapsed,extra:3}},goals:{home:0,away:0}});
for(const n of [35,45,48])assert(evaluateFirstHalf(fixture('1H',n),snap).ok);
for(const n of [0,15,29,30,34,null,'45+3'])assert(!evaluateFirstHalf(fixture('1H',n),snap).ok);
for(const s of ['HT','2H','FT','ET','NS','IN_PLAY',''])assert(!evaluateFirstHalf(fixture(s,45),snap).ok);
assert(!evaluateFirstHalf({...fixture('1H',40),goals:{home:1,away:0}},snap).ok);
async function scenario(phase,minute,failFirst=false){
 let now=Date.parse('2026-09-19T20:00:00Z'),sent=0;
 const db=new D(':memory:');
 db.exec("CREATE TABLE concile_analyses(match_key TEXT PRIMARY KEY,minute_at_analysis INTEGER,score_home_at_analysis INTEGER,score_away_at_analysis INTEGER,best_bet TEXT,real_odd REAL,real_odd_source TEXT,analysed_at TEXT,sig_sent_free INTEGER,sig_sent_premium INTEGER);CREATE TABLE telegram_signal_deliveries(match_key TEXT,channel TEXT,telegram_message_id INTEGER,market TEXT,vote_count INTEGER,ok INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE official_vote_snapshots(id TEXT,fixture_id TEXT,minute INTEGER,score_home INTEGER,score_away INTEGER,created_at TEXT);");
 db.prepare('INSERT INTO official_vote_snapshots VALUES(?,?,?,?,?,?)').run('s','1',Math.min(minute,45),0,0,new Date(now).toISOString());
 const validator=createValidator({db,now:()=>now,fetchFixture:async()=>fixture(phase,minute)});
 const pub=createPublisher({db,env:{TELEGRAM_BOT_TOKEN:'isolated',TELEGRAM_PREMIUM_CHANNEL_ID:'test'},now:()=>now,validateSignal:validator,transport:async()=>{sent++;return failFirst?{ok:false,retryAfter:30}:{ok:true,messageId:1};}});
 db.prepare("INSERT INTO client_telegram_outbox(delivery_key,kind,channel,chat_id,match_key,market,votes,payload,expires_at,created_at,official_signal_snapshot_id) VALUES('a','signal','premium','test','m','Over 2.5 buts',4,'{}',?,?,?)").run(now+120000,now,'s');
 await pub.flush();
 if(failFirst){assert.equal(sent,1);phase='HT';now+=31000;await pub.flush();assert.equal(sent,1);}
 const count=sent;
 // Result delivery remains permitted outside the first half.
 db.prepare("INSERT INTO client_telegram_outbox(delivery_key,kind,channel,chat_id,payload,expires_at,created_at) VALUES('result','result','premium','test','{}',?,?)").run(now+120000,now);
 await pub.flush();assert.equal(sent,count+1);
 db.close();return count;
}
(async()=>{
 for(const n of [35,45,48])assert.equal(await scenario('1H',n),1);
 for(const s of ['HT','2H','FT'])assert.equal(await scenario(s,45),0);
 assert.equal(await scenario('1H',29),0);
 assert.equal(await scenario('1H',34),0);
 await scenario('1H',45,true);
 console.log('FIRST_HALF_WINDOW_TESTS_PASSED=True');
})().catch(()=>{console.log('FIRST_HALF_WINDOW_TESTS_PASSED=False');process.exitCode=1});
