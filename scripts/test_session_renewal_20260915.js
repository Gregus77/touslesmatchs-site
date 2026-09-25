'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
const fn=source.slice(source.indexOf('function requireSession('),source.indexOf('app.post("/auth/logout"',source.indexOf('function requireSession(')));
const now=Date.now();
function attempt(createdDaysAgo,expiresDaysFromNow,exists=true){
  const row=exists?{email:'isolated@example.invalid',created_at:new Date(now-createdDaysAgo*86400000).toISOString(),expires_at:new Date(now+expiresDaysFromNow*86400000).toISOString()}:null;
  const sql=[];let denied=null,proceeded=false;
  const ctx=vm.createContext({db:{prepare(query){return{get(){return row},run(...args){sql.push({query,args});return{changes:1}}}}},telegramClient:{sqliteUtcMs(value){return value?Date.parse(value):NaN}},SESSION_TTL_MS:30*86400000,SESSION_ABSOLUTE_TTL_MS:90*86400000,SESSION_RENEW_WHEN_LEFT_MS:7*86400000,Date,Number,String});
  vm.runInContext(fn,ctx);
  const req={headers:{authorization:'Bearer isolated-test-token'},query:{},body:{}};
  ctx.requireSession(req,{status(code){denied=code;return this},json(){}},()=>{proceeded=true});
  return{sql,denied,proceeded,req};
}
const near=attempt(20,3);assert(near.proceeded&&!near.denied);assert.equal(near.sql.length,1);assert.match(near.sql[0].query,/expires_at/);assert(Date.parse(near.sql[0].args[0])>now+29*86400000);
const cap=attempt(60,3);assert(cap.proceeded);assert(Date.parse(cap.sql[0].args[0])<=now+30*86400000+5000);
const fresh=attempt(1,25);assert(fresh.proceeded);assert(!fresh.sql[0].query.includes('expires_at=?'));
const expired=attempt(20,-1);assert.equal(expired.denied,401);assert(!expired.proceeded);
const revoked=attempt(20,3,false);assert.equal(revoked.denied,401);assert(!revoked.proceeded);
console.log('PASS: session glissante bornée, non-renouvellement prématuré, expiration et révocation');
