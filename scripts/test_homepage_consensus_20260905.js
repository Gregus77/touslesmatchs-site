'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const api=fs.readFileSync(__dirname+'/api_server.js','utf8');
const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');
function part(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start+a.length);assert(start>=0&&end>start);return s.slice(start,end);}
const ctx=vm.createContext({});
vm.runInContext(part(api,'function homepageLiveMatch(', 'app.get(["/live-matches"'),ctx);
vm.runInContext(part(html,'function heroOu25(', 'function heroWasSent('),ctx);
vm.runInContext(part(html,'function tlmHeroMinuteOf(', 'function tlmHomepageAnalyzedMatch('),ctx);
function fixture(id,directions,minute=25){return {id,home:'Home '+id,away:'Away '+id,minute,
  pinnedBet:'SECRET',pinnedReason:'SECRET',ou25:{window_status:'open',votes:
  directions.map((direction,i)=>({agent:'IA '+i,status:direction?'voted':'pending',direction,label:'SECRET',confidence:88}))}};}
const split=fixture('split',['over','over','over','under','under']);
const four=fixture('four',['under','under','under','under',null]);
const three=fixture('three',['over','over','over',null,null]);
const publicRows=[split,four,three].map(m=>ctx.homepageLiveMatch(m,false));
assert.equal(publicRows.length,3);
assert.equal([...publicRows].sort(ctx.compareHeroMatches)[0].id,'four');
assert.equal(publicRows.find(m=>m.id==='split').ou25.vote_count,5);
for(const m of publicRows){
  assert.equal(m.ou25.locked,true);assert.equal(m.ou25.over_count,null);assert.equal(m.ou25.under_count,null);
  assert(!JSON.stringify(m).includes('SECRET'));
  for(const v of m.ou25.votes){assert.equal(v.direction,null);assert.equal(v.confidence,null);assert.equal(v.label,null);}
}
const paid=ctx.homepageLiveMatch(four,true);
assert.equal(paid.ou25.votes[0].direction,'under');assert.equal(paid.ou25.under_count,4);
// Another match overtakes the featured one on the next complete refresh.
const next=[split,four,fixture('three',['over','over','over','over','over'])].map(m=>ctx.homepageLiveMatch(m,false));
assert.equal(next.sort(ctx.compareHeroMatches)[0].id,'three');
const elements=new Map();
function element(){return {textContent:'',style:{},classList:{toggle(k,on){this[k]=on},remove(...ks){ks.forEach(k=>delete this[k])}},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},querySelector(){return this.mark||(this.mark={})}};}
const slots=Array.from({length:5},element);
ctx.document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},querySelectorAll(){return slots}};
Object.assign(ctx,{heroCountry:()=>'',heroFlag(){},liveHomeLogo:()=>'',liveAwayLogo:()=>'',liveHomeScore:()=>0,liveAwayScore:()=>0,minLabelOf:()=>"25'"});
vm.runInContext(part(html,'function setHeroText(', 'function heroOu25('),ctx);
vm.runInContext(part(html,'function heroWasSent(', 'function renderHeroWatchlist('),ctx);
ctx.renderHeroLive(paid);assert.equal(slots[0].mark.textContent,'U');assert.equal(slots[0].classList.under,true);
ctx.renderHeroLive(ctx.homepageLiveMatch(four,false));
assert.equal(slots[0].mark.textContent,'?');assert.equal(slots[0].classList.under,false);
assert(!slots[0].title.includes('Under'));assert(!slots[0]['aria-label'].includes('Under'));
assert(!elements.get('hero-consensus-label').textContent.includes('Under'));
// No stale paid-vote cache can restore directions after logout or a new response.
assert(!html.includes('tlmKeepHeroVotes'));assert(!html.includes('tlmHeroVoteCache'));
assert(html.includes("matches=(d.matches||[]).filter(tlmMatchAllowed).sort(compareHeroMatches)"));
assert(api.includes('const matches = await fetchLiveMatches();\n    const observed = matches'));
console.log('OK: strongest consensus across all matches, leader changes, paid/anonymous projection, masks and accessible labels');
