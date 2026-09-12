'use strict';
const assert=require('assert'),Database=require('better-sqlite3'),guard=require('./ai_budget_guard');
const db=new Database(':memory:');guard.globalSchema(db);
const sat=Date.parse('2026-09-12T18:00:00Z'),fri=Date.parse('2026-09-11T18:00:00Z');
assert.equal(guard.parisBudget(sat).limit,6);assert.equal(guard.parisBudget(fri).limit,4);
assert.equal(guard.parisBudget(Date.parse('2026-09-11T22:00:00Z')).limit,6);
assert.equal(guard.parisBudget(Date.parse('2026-09-13T22:00:00Z')).limit,4);
for(const [at,hours] of [['2026-03-29T12:00:00Z',23],['2026-10-25T12:00:00Z',25]]){const p=guard.parisBudget(Date.parse(at));assert.equal((Date.parse(p.end)-Date.parse(p.start))/3600000,hours);}
db.prepare("INSERT INTO openrouter_global_opening VALUES ('2026-09-12',5.5,'preexisting expense')").run();
assert(guard.reserveGlobal(db,{model:'seat'},.3,sat));assert(!guard.reserveGlobal(db,{model:'other seat'},.3,sat));
assert.equal(db.prepare('SELECT eur FROM openrouter_global_opening').get().eur,5.5);
const id=guard.reserveGlobal(db,{model:'seat'},.1,sat);assert(id);assert.equal(db.prepare('SELECT count(*) n FROM openrouter_global_calls').get().n,2);
// Uncertain reservations persist and remain charged to the ceiling, including after restart.
db.prepare("UPDATE openrouter_global_calls SET status='uncertain' WHERE id=?").run(id);
assert(!guard.reserveGlobal(db,{model:'seat'},.2,sat));
assert(!guard.reserveGlobal(db,{model:'seat'},NaN,sat));
assert(guard.reserveGlobal(db,{model:'seat'},3.99,fri));assert(!guard.reserveGlobal(db,{model:'seat'},.02,fri));
console.log('PASS global pending reservations, retained expenses, Paris weekdays/weekend/DST and ceilings');
// Mock only the public price catalogue. No provider call and no client message.
const https=require('https'),{EventEmitter}=require('events');
const originalGet=https.get;
https.get=(_url,_opts,callback)=>{
 const request=new EventEmitter();request.destroy=()=>{};
 process.nextTick(()=>{const response=new EventEmitter();response.statusCode=200;callback(response);response.emit('data',JSON.stringify({data:[{id:'test-seat',pricing:{prompt:'0.000001',completion:'0.000002'}}]}));response.emit('end');});
 return request;
};
(async()=>{
 const isolated=new Database(':memory:');let calls=0;
 const body={model:'test-seat',messages:[{role:'user',content:'technical check'}],max_tokens:20};
 const send=async()=>{calls++;return {choices:[{message:{content:'OK'}}],usage:{cost:.001}};};
 assert.equal((await guard.withGlobalBudget(isolated,{...body,max_tokens:undefined},send))._httpStatus,429);assert.equal(calls,0);
 assert.equal((await guard.withGlobalBudget(isolated,{...body,model:'unknown'},send))._httpStatus,429);assert.equal(calls,0);
 await guard.withGlobalBudget(isolated,body,send);
 assert.equal(isolated.prepare('SELECT charged_eur FROM openrouter_global_calls').get().charged_eur,.001);
 await guard.withGlobalBudget(isolated,body,async()=>({_httpStatus:403,error:{message:'Key limit exceeded'}}));
 assert.equal(isolated.prepare("SELECT charged_eur FROM openrouter_global_calls WHERE status='rejected'").get().charged_eur,0);
 await assert.rejects(guard.withGlobalBudget(isolated,body,async()=>{throw Error('timeout');}),/timeout/);
 const uncertain=isolated.prepare("SELECT reserved_eur,charged_eur FROM openrouter_global_calls WHERE status='uncertain'").get();
 assert(uncertain.reserved_eur>0);assert.equal(uncertain.charged_eur,null);
 await guard.withGlobalBudget(isolated,body,async()=>({choices:[]}));
 assert.equal(isolated.prepare("SELECT count(*) n FROM openrouter_global_calls WHERE status='uncertain'").get().n,2);
 https.get=originalGet;console.log('PASS priced requests, actual usage, HTTP rejection, timeouts and missing usage');
})().catch(e=>{https.get=originalGet;console.error(e);process.exitCode=1;});
