'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.env.TLM_ROOT||path.join(__dirname,'..');
const lifecycle=require(path.join(root,'public/js/match-lifecycle.js'));
const votes=Array.from({length:5},()=>({status:'voted',direction:'over',confidence:80}));
const match={minute:69,status:'IN_PLAY',home:'A',away:'B',score_home:1,score_away:0,
  ou25:{official:true,locked:false,vote_count:5,consensus_count:5,consensus_direction:'over',
    snapshot_minute:30,snapshot_score:'1-0',official_confidence:80,official_odd:1.8,votes,outcome:'loss'}};
const original=JSON.stringify(match);
assert.equal(typeof lifecycle.entryClosed,'function','Explicit historical-entry gate required');
for(const m of [{...match,status:'HT',minute:45},match,{...match,status:'FT',minute:90}])assert.equal(lifecycle.entryClosed(m),true);
assert.equal(lifecycle.entryClosed({...match,minute:48,period:'1H'}),false,'Confirmed first-half stoppage stays open');
for(const flag of ['cached','stale','offline'])assert.equal(lifecycle.entryClosed({...match,[flag]:true}),true,'Unavailable state must never reopen entry');
assert.equal(lifecycle.entryClosed({...match,minute:null,status:'UNKNOWN'}),true);
function part(file,start,end){const s=fs.readFileSync(path.join(root,'public',file),'utf8'),i=s.indexOf(start),j=s.indexOf(end,i+start.length);assert(i>=0&&j>i);return s.slice(i,j);}
const context={TLMMatchLifecycle:lifecycle,document:{getElementById:()=>null},esc:String,escHtml:String,
  liveHomeScore:m=>m.score_home,liveAwayScore:m=>m.score_away};vm.createContext(context);
vm.runInContext(part('index.html','function heroOu25(','function renderAnalyzedList('),context);
vm.runInContext(part('app.html','function appOu25(','function appLogo('),context);
vm.runInContext(part('live-ia.html','function liveOu25State(','// ── Render'),context);
for(const name of ['tlmVoteCirclesHtml','appMiniVotes','renderLiveOu25Details']){
  const html=context[name](match);assert.match(html,/ENTRÉE FERMÉE/);assert.match(html,/NE PLUS ENTRER/);assert.match(html,/Analyse historique/);
  assert.match(html,/stale| old/,'Even official archived votes are visually dimmed');
  assert.equal((html.match(/>O</g)||[]).length,5,'Five historical vote markers remain');
  const locked=context[name]({...match,ou25:{...match.ou25,locked:true}});assert.doesNotMatch(locked,/>O<|>Over 2,5/,'Paid directions remain protected');
  const active=context[name]({...match,minute:40,period:'1H'});assert.doesNotMatch(active,/ENTRÉE FERMÉE/);
}
const detail=context.renderLiveOu25Details(match);
assert(detail.indexOf('ENTRÉE FERMÉE')<detail.indexOf('<details'),'Warning is visible with details collapsed');
assert.doesNotMatch(detail,/consensus-valid/,'Closed entry must not flash green');
function element(){const classes=new Set();return {textContent:'',style:{},dataset:{},classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},add(k){classes.add(k);},remove(...ks){ks.forEach(k=>classes.delete(k));},contains:k=>classes.has(k)},setAttribute(){},removeAttribute(){}};}
const nodes={},dots=Array.from({length:5},element);
Object.assign(context,{$:id=>nodes[id]||(nodes[id]=element()),appCountry:()=>'',appFlagUrl:()=>'',appHomeLogo:()=>'',appAwayLogo:()=>'',appLogo:()=>{},appHomeScore:m=>m.score_home,appAwayScore:m=>m.score_away});
context.document.querySelectorAll=()=>dots;
vm.runInContext(part('app.html','function renderAppHero(','function loadLive('),context);
context.renderAppHero(match);
assert.match(nodes['app-ai-result'].textContent,/ENTRÉE FERMÉE/);
assert.match(nodes['app-ai-result'].textContent,/30.*1-0/,'Hero keeps original minute and score');
assert(!nodes['app-ai-result'].classList.contains('consensus-valid'));
assert(dots.every(el=>el.classList.contains('old')));
context.renderAppHero({...match,minute:40,period:'1H'});
assert.doesNotMatch(nodes['app-ai-result'].textContent,/ENTRÉE FERMÉE/);
assert(dots.every(el=>!el.classList.contains('old')));
assert.equal(JSON.stringify(match),original,'No official signal or loss rewritten');
console.log('CLOSED_SIGNAL_DISPLAY_OK');
