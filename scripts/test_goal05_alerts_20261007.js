'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {test}=require('node:test');
const vm=require('node:vm');
const file=path.join(__dirname,'../public/js/signal-alerts.js');
const alerts=fs.existsSync(file)?require(file):{prepare:()=>null,claim:()=>false};
const now=Date.parse('2026-10-07T16:00:00Z');
function payload(){return {ok:true,locked:false,signal:{id:'match-42-goal05',type:'goal05_team_over_0_5',status:'active',sentAt:'2026-10-07T15:59:30Z',team:'Club A',home:'Club A',away:'Club B',odd:1.8}};}
test('authorized fresh official signal names the team and real odd',()=>{
  const signal=alerts.prepare(payload(),now);
  assert.ok(signal,'A fresh authorized signal must be available to the popup');
  assert.equal(signal.id,'match-42-goal05');assert.equal(signal.team,'Club A');assert.equal(signal.odd,'1,80');
});
test('locked response cannot reveal a popup even if it contains a signal',()=>{
  const p=payload();p.locked=true;assert.equal(alerts.prepare(p,now),null);
});
test('scanner observations and malformed signals never become official alerts',()=>{
  const p=payload();p.signal.type='scanner';assert.equal(alerts.prepare(p,now),null);
  const q=payload();delete q.signal.team;assert.equal(alerts.prepare(q,now),null);
});
test('old, future and settled signals never trigger a live alert',()=>{
  for(const change of [{sentAt:'2026-10-07T15:57:00Z'},{sentAt:'2026-10-08T15:59:30Z'},{status:'win'}]){
    const p=payload();Object.assign(p.signal,change);assert.equal(alerts.prepare(p,now),null);
  }
});
test('duplicate official signal is claimed once across pages, separately per account',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  assert.equal(alerts.claim(storage,'member-a','match-42-goal05'),true);
  assert.equal(alerts.claim(storage,'member-a','match-42-goal05'),false);
  assert.equal(alerts.claim(storage,'member-b','match-42-goal05'),true);
  assert.equal(alerts.claim(storage,'member-a','match-43-goal05'),true);
});
test('blocked storage fails closed rather than repeating alerts',()=>{
  assert.equal(alerts.claim({getItem(){throw new Error('blocked');}},'a','b'),false);
});
test('a stalled network request is aborted and the next check can retry',async()=>{
  const window={addEventListener(){}},timers=[],requests=[];
  const localStorage={getItem:k=>({tlm_signal_alerts:'1',tlm_session_token:'fixture-token',tlm_email:'a@example.invalid'})[k]||null};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{window,localStorage,AbortController,navigator:{},document:{hidden:false,addEventListener(){},getElementById(){return null;}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval(){},fetch:(url,options)=>{
    requests.push({url,options});
    if(requests.length===1)return new Promise((resolve,reject)=>{if(options.signal)options.signal.addEventListener('abort',()=>reject(new Error('aborted')));});
    return Promise.resolve({ok:true,json:async()=>({ok:true,locked:true,signal:null})});
  }});
  const first=window.TLMSignalAlerts.check();
  assert.equal(timers.length,1,'A stalled request must have an abort deadline');
  timers[0]();await first;await window.TLMSignalAlerts.check();
  assert.equal(requests.length,2,'A stalled request must not permanently block retries');
  assert.equal(requests[0].options.headers.Authorization,'Bearer fixture-token');
  assert.doesNotMatch(requests[0].url,/email=|token=/);
});
