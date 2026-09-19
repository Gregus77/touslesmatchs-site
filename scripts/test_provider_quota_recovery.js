const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
const body=source.slice(source.indexOf('let _providerQuotaProbeAt ='),source.indexOf('function marquerProvider('));
let now=Date.parse('2026-09-19T21:59:00Z'),remaining=0,requests=0,deletes=0;
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const row={last_status:403,last_error:'OpenRouter daily limit reached; retry after midnight UTC'};
const context={Date:Clock,Intl,process:{env:{OPENROUTER_API_KEY:'test'}},console:{log(){}},
  setInterval:()=>({unref(){}}),_providerHealthCache:{at:9},
  db:{prepare(sql){return {get:()=>row,run(...args){assert(sql.startsWith('DELETE'));assert.equal(args[0],403);assert.equal(args[1],row.last_error);deletes++;}};}},
  httpGet:async()=>{requests++;return {data:{limit_reset:'daily',limit_remaining:remaining}};}};
vm.createContext(context);
vm.runInContext(body,context);
(async()=>{
  await context.recoverProviderDailyQuota();assert.equal(requests,1);assert.equal(deletes,0);
  now+=30000;await context.recoverProviderDailyQuota();assert.equal(requests,1);
  now=Date.parse('2026-09-19T22:00:00Z');await context.recoverProviderDailyQuota();assert.equal(requests,2);assert.equal(deletes,0);
  remaining=6;now+=300000;await context.recoverProviderDailyQuota();assert.equal(deletes,1);assert.equal(context._providerHealthCache.at,0);
  console.log('PASS Paris midnight probe, exhausted quota preserved, natural recovery and throttling');
})().catch(e=>{console.error(e);process.exitCode=1;});
