'use strict';
// Offline only: disposable SQLite, no server import, providers or Telegram.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Database = require('better-sqlite3');
process.env.OPENROUTER_PARIS_SCHEDULE = '1';
process.env.TELEGRAM_BOT_TOKEN = '';
require('node:https').get = () => { throw new Error('Network forbidden in audit test'); };
const guard = require('./ai_budget_guard');
const db = new Database(':memory:');
guard.globalSchema(db);
const p = guard.parisBudget();
const call = db.prepare(`INSERT INTO openrouter_global_calls
  (id,day,model,reserved_eur,charged_eur,status) VALUES (?,?,?,?,?,?)`);
call.run('python',p.day,'python-model',0.2,0.04,'completed');
call.run('uncertain',p.day,'uncertain-model',0.1,null,'uncertain');
call.run('reserved',p.day,'reserved-model',0.2,null,'reserved');
call.run('rejected',p.day,'rejected-model',0.5,0,'rejected');
call.run('old','2000-01-01','old-model',9,9,'completed');
db.prepare('INSERT INTO openrouter_global_opening VALUES (?,?,?)').run(p.day,0.05,'test');
const before = db.prepare('SELECT total_changes() n').get().n;
let stats = guard.getDailyStats(db);
assert.equal(stats.requests,0);
assert.equal(stats.costEur,0);
assert.equal(stats.global.requests,4);
assert.equal(stats.global.completed,1);
assert.equal(stats.global.rejected,1);
assert.equal(stats.global.uncertain,1);
assert.equal(stats.global.reserved,1);
assert.equal(stats.global.chargedEur,0.04);
assert(Math.abs(stats.global.reservedEur-0.3)<1e-9);
assert(Math.abs(stats.global.usedEur-0.39)<1e-9);
assert(Math.abs(stats.global.remainingEur-(p.limit-0.39))<1e-9);
assert.equal(db.prepare('SELECT total_changes() n').get().n,before);
db.prepare(`INSERT INTO ai_call_budget_log
  (request_key,model_key,cost_estimate_eur,status,created_at) VALUES ('local','local',0.6,'ok',?)`)
  .run(p.start);
stats=guard.getDailyStats(db);
assert.equal(stats.global.usedEur,0.6); // Max, not sum: no double accounting.
const legacy=new Database(':memory:');
assert.equal(guard.getDailyStats(legacy).global.available,false);
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
const route=source.slice(source.indexOf('app.get("/concile-roster"'),source.indexOf('app.get("/admin/audit-matinal"'));
let handler, payload;
vm.runInNewContext(route,{
  app:{get:(_path,fn)=>{handler=fn;}},process:{env:{}},
  resolveModel:id=>id==='mistralai/mistral-small-2603'?'moonshotai/kimi-k2':id,
});
handler({}, {set:()=>{},json:value=>{payload=value;}});
assert.deepEqual(Array.from(payload.names),['Perplexity','DeepSeek','Kimi','Luna','Qwen']);
assert.equal(payload.count,5);
assert(source.includes('football_ou25_5_seats_min_4_votes_from_35_until_verified_first_half_end'));
db.close();legacy.close();
console.log('PASS audit observability: Python costs, reservations, rejected calls, Paris day, no double count, no writes, real roster');
