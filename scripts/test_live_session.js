'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.env.TLM_ROOT||path.join(__dirname,'..');
function section(source,start,end){const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert(i>=0&&j>i,`Missing ${start}`);return source.slice(i,j);}
async function main(){
  const html=fs.readFileSync(path.join(root,'public/live-ia.html'),'utf8');
  const code=section(html,'function liveAuthHeaders(','// ── Init');
  const storage=new Map([['tlm_session_token','test-session'],['tlm_plan','elite']]);
  let requests=[];
  const ctx={localStorage:{getItem:k=>storage.get(k)||null},userAuth:null,fetch:async(url,opts)=>{requests.push({url,opts});return{ok:true,json:async()=>({ok:true,email:'member@example.invalid',plan:'elite'})};}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  let restored=await ctx.restoreLiveAuth();
  assert.equal(restored.plan,'elite');assert.equal(restored.email,'member@example.invalid');assert.equal(restored.code,undefined);
  assert.equal(requests[0].opts.headers.Authorization,'Bearer test-session');
  for(const key of ['tlm_token','tlm_session']){storage.clear();storage.set(key,'legacy-session');assert.equal(ctx.liveAuthHeaders().Authorization,'Bearer legacy-session');}
  storage.clear();storage.set('tlm_plan','elite');
  assert.equal(await ctx.restoreLiveAuth(),null,'A cached Elite badge is not authentication');
  storage.set('tlm_session_token','expired');
  ctx.fetch=async()=>({ok:false,status:401,json:async()=>({ok:false})});
  assert.equal(await ctx.restoreLiveAuth(),null,'Expired session must not unlock');
  storage.set('tlm_email','member@example.invalid');storage.set('tlm_code','legacy-code');
  ctx.fetch=async(url)=>({ok:!url.includes('/auth/'),json:async()=>({valid:true,plan:'premium',credits_left:7})});
  restored=await ctx.restoreLiveAuth();assert.equal(restored.plan,'premium');assert.equal(restored.code,'legacy-code');
  ctx.fetch=async()=>{throw Error('offline')};assert.equal(await ctx.restoreLiveAuth(),null);
  storage.clear();storage.set('tlm_session_token','valid-session');
  let unlock,opened=0,closedModal=0,posted=null;
  ctx.liveAuthReady=new Promise(resolve=>unlock=resolve);ctx.userAuth=null;
  ctx.document={getElementById:()=>({classList:{add:()=>opened++,remove:()=>closedModal++}})};
  vm.runInContext(section(html,'async function openLoginModal(','function doLogin('),ctx);
  const opening=ctx.openLoginModal();
  await Promise.resolve();assert.equal(opened,0,'No premature login while session validation is pending');
  ctx.userAuth={email:'member@example.invalid',plan:'elite'};unlock(ctx.userAuth);await opening;
  assert.equal(opened,0);assert.equal(closedModal,1,'Paid session must close login dialog');
  ctx.allMatches=[];ctx.window={};ctx.fetch=(url,opts)=>{posted={url,opts};return new Promise(()=>{})};
  vm.runInContext(section(html,'async function requestAnalysis(','// ── Surveillance'),ctx);
  await ctx.requestAnalysis({disabled:false,innerHTML:''},'1','A','B');
  assert.equal(posted.url,'/api/concile-analysis');assert.equal(posted.opts.headers.Authorization,'Bearer valid-session');
  assert.equal(JSON.parse(posted.opts.body).code,undefined);
  ctx.userAuth=null;ctx.liveAuthReady=Promise.resolve(null);await ctx.openLoginModal();assert.equal(opened,1);
  vm.runInContext(section(html,'function refreshCredits()', 'function updateAuthBar()'),ctx);
  ctx.userAuth={email:'member@example.invalid',plan:'elite'};ctx.updateAuthBar=()=>{};
  ctx.fetch=async(url,opts)=>{assert.equal(url,'/api/auth/access');assert.equal(opts.headers.Authorization,'Bearer valid-session');return{ok:true,json:async()=>({ok:true,locked:false,plan:'elite',credits_left:4,credits_max:10})}};
  await ctx.refreshCredits();assert.equal(ctx.userAuth.credits_left,4);assert.equal(ctx.userAuth.credits_max,10);
  const api=fs.readFileSync(process.env.API_SOURCE||path.join(root,'scripts/api_server.js'),'utf8');
  let closed=0;
  const server={paidGoal05Account:()=>({email:'real@example.invalid',plan:'elite'}),CODES_DB_PATH:'test',Date,
    creditsLeftForPlan:()=>7,
    Database:function(){this.prepare=sql=>{assert(!/select.*\bcode\b/i.test(sql),'Do not retrieve reusable credentials');return{get:email=>({account_id:5,email,plan:'elite',expires_at:null,credits_max:10,credits_used:3,credits_date:'2026-09-20'})}};this.close=()=>closed++;}};
  vm.createContext(server);vm.runInContext(section(api,'function concileSessionAccess(','app.post("/concile-analysis"'),server);
  let credentials=server.concileSessionAccess({body:{email:'attacker@example.invalid'},headers:{authorization:'Bearer valid'}});
  assert.equal(credentials.email,'real@example.invalid');assert.equal(credentials.account_id,5);assert.equal(credentials.code,undefined);assert.equal(credentials.credits_left,7);assert.equal(closed,1);
  server.paidGoal05Account=()=>null;
  assert.equal(server.concileSessionAccess({body:{email:'attacker@example.invalid'},headers:{}}),null);
  let Database;try{Database=require('better-sqlite3')}catch{Database=require('node:sqlite').DatabaseSync;}
  const sessions=new Database(':memory:'),accounts=new Database(':memory:');
  sessions.exec('CREATE TABLE sessions(token TEXT,email TEXT,expires_at TEXT)');
  accounts.exec('CREATE TABLE codes(email TEXT,code TEXT,plan TEXT,active INTEGER,expires_at TEXT,credits_max INTEGER,credits_used INTEGER,credits_date TEXT)');
  sessions.prepare('INSERT INTO sessions VALUES (?,?,?)').run('valid-session','paid@example.invalid','2099-01-01');
  sessions.prepare('INSERT INTO sessions VALUES (?,?,?)').run('expired-session','paid@example.invalid','2000-01-01');
  sessions.prepare('INSERT INTO sessions VALUES (?,?,?)').run('malformed-expiry','paid@example.invalid','not-a-date');
  accounts.prepare('INSERT INTO codes VALUES (?,?,?,?,?,?,?,?)').run('paid@example.invalid','never-return-this','premium',1,null,10,2,new Date().toISOString().slice(0,10));
  const routes={};
  const live={Date,console,db:sessions,CODES_DB_PATH:'test',verifyFcmSubscriber:()=>null,
    Database:function(){return{prepare:sql=>accounts.prepare(sql),close:()=>{}}},
    lookupAccountByEmail:email=>accounts.prepare('SELECT email,plan,expires_at FROM codes WHERE email=? AND active=1').get(email),
    creditsLeftForPlan:(plan,max,used)=>max?max-used:null,
    verifyCode:()=>({valid:false,error:'invalid code'}),isAdminAccess:()=>false,
    app:{post:(url,fn)=>routes[url]=fn},analysisCache:new Map(),
    requireVerifiedLiveMatch:async()=>({id:1,home:'A',away:'B',score_home:0,score_away:0,minute:39}),
    rejectScoreConflict:()=>false,livePickBlockReason:()=>null,
    runConcileAnalysis:async()=>({marker:'existing-paid-analysis'}),sanitizeAnalysisForClient:a=>a,setTimeout:()=>{}};
  vm.createContext(live);
  vm.runInContext(section(api,'function paidGoal05Account(','// Contrôle des droits'),live);
  vm.runInContext(section(api,'function concileSessionAccess(','// ── Pre-match analysis'),live);
  const request=async(token,body={})=>{let result;await routes['/concile-analysis']({headers:{authorization:'Bearer '+token},body},{json:d=>(result=d)});return result;};
  assert.equal((await request('expired-session',{email:'paid@example.invalid',plan:'elite'})).error,'Connexion requise');
  assert.equal((await request('forged-session')).error,'Connexion requise');
  assert.equal((await request('malformed-expiry')).error,'Connexion requise');
  assert.equal((await request('valid-session')).error,'Données du match manquantes');
  const result=await request('valid-session',{email:'attacker@example.invalid',match:{home:'A',away:'B'}});
  assert.equal(result.ok,true);assert.equal(result.marker,'existing-paid-analysis');
  assert.equal(accounts.prepare('SELECT credits_used FROM codes').get().credits_used,3,'Existing manual quota is still charged to the verified account');
  assert(!JSON.stringify(result).includes('never-return-this'));
  accounts.exec("UPDATE codes SET active=0");
  assert.equal((await request('valid-session')).error,'Connexion requise');
  accounts.exec("UPDATE codes SET active=1,expires_at='2000-01-01'");
  assert.equal((await request('valid-session')).error,'Connexion requise');
  accounts.exec("UPDATE codes SET expires_at=NULL,credits_used=10");
  assert.equal((await request('valid-session',{match:{home:'A',away:'B'}})).error,'CREDITS_EXHAUSTED');
  accounts.close();sessions.close();
  const route=section(api,'app.post("/concile-analysis"','// Decrement credits');
  assert(route.includes('verifyCode(email, code)'),'Server must still validate real active code, expiry and credits');
  console.log('LIVE_SESSION_TESTS_OK');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
