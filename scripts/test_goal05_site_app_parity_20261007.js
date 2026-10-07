'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
function load(relative,context){
  assert.ok(fs.existsSync(path.join(root,relative)), 'Shared site/app implementation is required');
  vm.runInNewContext(fs.readFileSync(path.join(root,relative),'utf8'),context);
}
function renderer(){const window={};load('public/js/goal05-results.js',{window});return window.TLMGoal05Results;}
test('official results and scanner observations retain separate provenance',()=>{
  const html=renderer().history({officialRecent:[{home:'A',away:'B',team:'A',outcome:'win',odd:1.8}],scannerRecent:[{home:'C',away:'D',target_team:'D',outcome:'loss',odd_at_pick:null}]});
  assert.match(html,/Signal officiel/);assert.match(html,/Observation scanner/);
  assert.match(html,/Gagné/);assert.match(html,/Perdu/);assert.match(html,/1,80/);assert.match(html,/Cote non enregistrée/);
  assert.match(html,/A · \+0,5 but/);
});
test('unknown and pending results never become wins and missing odds remain missing',()=>{
  const html=renderer().history({officialRecent:[],scannerRecent:[{home:'A',away:'B',outcome:'pending',odd_at_pick:0},{home:'C',away:'D',outcome:'unknown'}]});
  assert.doesNotMatch(html,/Gagné/);assert.match(html,/En attente/);assert.match(html,/À vérifier/);assert.doesNotMatch(html,/0,00/);
});
test('provider text is escaped rather than executed as HTML',()=>{
  const html=renderer().history({scannerRecent:[{home:'<img src=x onerror=alert(1)>',away:'B',target_team:'<script>x</script>'}]});
  assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);
});
test('empty history is explicit and summaries never invent ROI or an average odd',()=>{
  const r=renderer();assert.match(r.history({}),/Aucun résultat/);
  assert.match(r.summary({wins:0,losses:0,pending:2,winrate:null,priced:0}),/2 en attente/);
  assert.doesNotMatch(r.summary({wins:1,losses:0,pending:0,winrate:100,priced:1,averageOdd:null,roi:null}),/ROI|cote moy/);
});
function redirect(search){let target;const saved={};load('public/js/app-site-parity.js',{URL,URLSearchParams,window:{location:{origin:'https://www.touslesmatchs.com',search,replace:value=>{target=value}},localStorage:{setItem:(k,v)=>{saved[k]=v}}},document:{documentElement:{classList:{add(){}}}}});return {target,saved};}
test('unresolved official registry rows remain pending, not unknown or won',()=>{
  const html=renderer().history({officialRecent:[{home:'A',away:'B',team:'A',outcome:null,odd:1.8}]});
  assert.match(html,/En attente/);assert.doesNotMatch(html,/Gagné|À vérifier/);
});
test('Android app loads the actual homepage rather than a second design',()=>{
  assert.equal(redirect('?source=android&app=goal05&native=107').target,'/?source=android&app=site&native=107');
});
test('existing results, live and account deep links keep working inside the app',()=>{
  assert.equal(redirect('?tab=perf').target,'/performances?source=android&app=site');
  assert.equal(redirect('?tab=live').target,'/live-ia?source=android&app=site');
  assert.equal(redirect('?tab=me').target,'/dashboard?source=android&app=site');
});
test('only approved language and native parameters are forwarded, never credentials or arbitrary redirects',()=>{
  const r=redirect('?lang=en&email=private&code=secret&next=https://evil.test&native=oops');
  assert.equal(r.target,'/?source=android&app=site&lang=en');assert.equal(r.saved.tlm_lang,'en');
  assert.equal(redirect('?lang=bad').target,'/?source=android&app=site');
});
