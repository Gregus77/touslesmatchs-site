'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(__dirname+'/../public/app.html','utf8');
const start=html.indexOf('function appOu25('),end=html.indexOf('function appLogo(',start);
assert(start>=0&&end>start,'fonctions votes application absentes');
const ctx=vm.createContext({
  esc:v=>String(v),
  TLMMatchLifecycle:{phase:m=>Number(m.minute)>45?'closed':'open'},
});
vm.runInContext(html.slice(start,end),ctx);
const voted=[
  {status:'voted',direction:null},{status:'voted',direction:null},{status:'voted',direction:null},
  {status:'pending',direction:null},{status:'pending',direction:null},
];
const locked={minute:30,ou25:{locked:true,vote_count:3,consensus_count:3,votes:voted}};
const lockedMarkup=ctx.appMiniVotes(locked);
assert.equal(ctx.appVotes(locked),3);
assert.equal((lockedMarkup.match(/>\?</g)||[]).length,3);
assert(lockedMarkup.includes('>4<')&&lockedMarkup.includes('>5<'));
assert(!lockedMarkup.includes('>O<')&&!lockedMarkup.includes('>U<'));
const paid={minute:68,ou25:{locked:false,vote_count:4,consensus_count:3,votes:[
  {status:'voted',direction:'over',updated_at:'2026-09-12 18:31:00'},{status:'voted',direction:'over',updated_at:'2026-09-12 18:32:00'},{status:'voted',direction:'over',updated_at:'2026-09-12 18:33:00'},
  {status:'voted',direction:'under',updated_at:'2026-09-12 18:34:00'},{status:'pending',direction:null},
],snapshot_minute:31,consensus_at:'2026-09-12 18:33:00'}};
const paidMarkup=ctx.appMiniVotes(paid);
assert.equal(ctx.appVotes(paid),4);assert.equal((paidMarkup.match(/>O</g)||[]).length,3);assert.equal((paidMarkup.match(/>U</g)||[]).length,1);
assert(paidMarkup.includes('Anciennes tendances — aucun signal officiel'));
assert(paidMarkup.includes(' old'));
assert(html.includes('get("/api/homepage-live?t="+Date.now())'));
assert(html.includes('m.client_product_eligible===true&&m.analysis_verified===true&&m.homepage_display_eligible===true'));
console.log('OK: application limitée aux matchs analysés, votes Premium O/U, votes masqués ?, sièges en attente numérotés et votes antérieurs conservés');
