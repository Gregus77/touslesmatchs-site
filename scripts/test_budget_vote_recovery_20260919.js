const assert=require('assert'),D=require('better-sqlite3'),g=require('./ai_budget_guard'),models=require('./ai_models.config');
assert.equal(g.parisBudget(Date.parse('2026-09-18T20:00:00Z')).limit,2);
assert.equal(g.parisBudget(Date.parse('2026-09-18T22:00:00Z')).limit,10);
assert.equal(g.parisBudget(Date.parse('2026-09-20T21:59:00Z')).limit,10);
assert.equal(g.parisBudget(Date.parse('2026-09-20T22:00:00Z')).limit,2);
for(const [at,cap] of [['2026-09-19T12:00:00Z',10],['2026-09-21T12:00:00Z',2]]){
 const db=new D(':memory:');assert(g.reserveGlobal(db,{model:'isolated-a'},cap-.01,Date.parse(at)));assert(!g.reserveGlobal(db,{model:'isolated-b'},.02,Date.parse(at)));assert.equal(db.prepare('select count(*) n from openrouter_global_calls').get().n,1);db.close();
}
assert.equal(g.CFG.maxRequestsPerDay,2000);
for(const key of ['perplexity','deepseek','mistral','luna','qwen'])assert.equal(models.getModel(key).dailyLimit,400);
const db=new D(':memory:');g.ensureSchema(db);
const day=g.parisBudget().day;
const add=db.prepare("insert into ai_call_budget_log(request_key,model_key,match_key,cost_estimate_eur,status,created_at) values(?,?,?,0,'ok',?)");
for(let i=0;i<180;i++)add.run('seed'+i,'mistral','one_historical_match',day+' 00:00:00');
assert(g.canProceed(db,{modelKey:'mistral',matchKey:'new_test_snapshot',purpose:'concile',promptVersion:'test'}).allowed);
for(let i=180;i<400;i++)add.run('seed'+i,'mistral','one_historical_match',day+' 00:00:00');
assert(!g.canProceed(db,{modelKey:'mistral',matchKey:'new_test_snapshot',purpose:'concile',promptVersion:'test'}).allowed);
assert.equal(db.prepare('select count(*) n from ai_call_budget_log').get().n,400);
db.close();console.log('BUDGET_AND_QUOTA_BEHAVIOR_TESTS=True');