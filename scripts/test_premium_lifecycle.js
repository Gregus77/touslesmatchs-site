'use strict';
const assert=require('node:assert/strict');
let Database;try{Database=require('better-sqlite3');}catch{Database=require('node:sqlite').DatabaseSync;}
const {reminderDay,memberStats,renderReminder,createReminderQueue}=require('./premium_lifecycle');
async function main(){
  const account={email:'member@example.test',active:true,marketingConsent:true,language:'fr',
    startsAt:'2026-09-01T00:00:00Z',expiresAt:'2026-10-01T00:30:00Z'};
  assert.equal(reminderDay(account.expiresAt,'2026-09-26T08:00:00Z'),5);
  assert.equal(reminderDay(account.expiresAt,'2026-10-01T00:00:00Z'),null);
  assert.equal(reminderDay('2026-10-27T10:00:00Z','2026-10-25T10:00:00Z'),2,'Paris DST date difference');
  const row={id:'snapshot1',outcome:'win',odd:2,deliveredAt:'2026-09-04T00:00:00Z',deliveryOk:true,messageId:12};
  const stats=memberStats([row,{...row,id:'outside',deliveredAt:'2026-08-31T23:59:59Z'},
    {...row,id:'unproven',deliveryOk:false},{...row,id:'pending',outcome:'pending'},
    {...row,id:'lost',outcome:'loss',odd:null}],account,'2026-09-26T08:00:00Z');
  assert.equal(stats.wins,1);assert.equal(stats.losses,1);assert.equal(stats.excluded,1);
  assert.equal(stats.netCents,1000);
  const links={checkout:'https://www.touslesmatchs.com/api/premium-checkout',unsubscribe:'https://www.touslesmatchs.com/preferences?token=fixture'};
  const messages=[1,2,3,4,5].map(day=>renderReminder({day,account,stats,links}));
  assert.equal(new Set(messages.map(x=>x.subject)).size,5);
  assert.equal(new Set(messages.map(x=>x.text)).size,5);
  for(const msg of messages){assert.match(msg.text,/théorique/);assert.match(msg.text,/perdu/);assert.match(msg.text,/sans renouvellement automatique/);assert.match(msg.html,/Désinscription/);}
  assert.throws(()=>renderReminder({day:0,account,stats,links}));
  assert.throws(()=>renderReminder({day:5,account,stats,links:{...links,checkout:'javascript:alert(1)'}}));
  const ru=renderReminder({day:2,account:{...account,language:'ru'},stats,links});
  assert.match(ru.text,/14,90/);assert.doesNotMatch(ru.text,/perdu|gagné|abonnement/);
  const db=new Database(':memory:');const queue=createReminderQueue(db);
  const now='2026-09-26T08:00:00Z';
  assert.equal(queue.enqueue(account,now),true);assert.equal(queue.enqueue(account,now),false);
  assert.equal(queue.enqueue({...account,email:'no@example.test',marketingConsent:false},now),false);
  let sends=0;const deliver=async()=>{sends++;return {accepted:true,id:'fixture-message'};};
  await queue.dispatch({now,lookup:()=>account,build:()=>messages[4],deliver});
  assert.equal(sends,1);await queue.dispatch({now,lookup:()=>account,build:()=>messages[4],deliver});assert.equal(sends,1);
  const tomorrow='2026-09-27T08:00:00Z';queue.enqueue(account,tomorrow);
  await queue.dispatch({now:tomorrow,lookup:()=>({...account,expiresAt:'2026-11-01T00:30:00Z'}),build:()=>messages[3],deliver});
  assert.equal(sends,1,'renewal cancels old reminder');
  const next='2026-09-28T08:00:00Z';queue.enqueue(account,next);
  await queue.dispatch({now:next,lookup:()=>({...account,marketingConsent:false}),build:()=>messages[2],deliver});
  assert.equal(sends,1,'unsubscribe checked at send');
  const last='2026-09-29T08:00:00Z';queue.enqueue(account,last);
  await queue.dispatch({now:last,lookup:()=>account,build:()=>messages[1],deliver:async()=>{sends++;throw new Error('timeout after acceptance');}});
  await queue.dispatch({now:last,lookup:()=>account,build:()=>messages[1],deliver});assert.equal(sends,2,'uncertain delivery must not blindly retry');
  assert.equal(db.prepare("SELECT count(*) n FROM premium_reminders WHERE state='uncertain'").get().n,1);
  db.close();console.log('PASS lifecycle: five distinct FR/RU reminders, date/DST, cohort, consent, renewal, deduplication, uncertain delivery');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
