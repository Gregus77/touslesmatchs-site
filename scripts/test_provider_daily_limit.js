const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
const start=source.indexOf('async function providerFailureDetail(');
const end=source.indexOf('function marquerProvider(',start);
const classify=vm.runInNewContext(source.slice(start,end)+';providerFailureDetail');
(async()=>{
  const key=async()=>({data:{limit:6,limit_remaining:0,limit_reset:'daily'}});
  assert.match(await classify('openrouter.ai',403,'HTTP 403',key),/daily limit/);
  assert.equal(await classify('openrouter.ai',403,'HTTP 403',async()=>({data:{limit:6,limit_remaining:3,limit_reset:'daily'}})),'HTTP 403');
  assert.equal(await classify('openrouter.ai',403,'HTTP 403',async()=>({data:{limit:6,limit_remaining:0,limit_reset:null}})),'HTTP 403');
  assert.equal(await classify('openrouter.ai',403,'HTTP 403',async()=>{throw Error('network');}),'HTTP 403');
  assert.equal(await classify('other',403,'HTTP 403',key),'HTTP 403');
  assert.equal(await classify('openrouter.ai',401,'HTTP 401',key),'HTTP 401');
  console.log('PASS confirmed daily quota only; other errors preserved');
})().catch(e=>{console.error(e);process.exitCode=1;});
