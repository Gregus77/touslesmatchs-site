/* trust-enhancer.js — TousLesMatchs: Preuves hero, votes IA, timestamps */
(function(){
'use strict';
var N=['Zeus','Athena','Apollon','Hermes','Ares','Hestia'];
var E=['\u26a1','🦉','☀️','👟','⚔️','🔥'];

function injectProofBlock(){
  var hs=document.querySelector('.hero-stats');
  if(!hs||document.getElementById('proof-block'))return;
  var d=document.createElement('div');
  d.id='proof-block';
  d.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;width:100%;max-width:680px;';
  d.innerHTML='<div class="proof-item" style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 8px;text-align:center"><div class="proof-val" id="proof-roi" style="font-size:20px;font-weight:900;color:#10b981;line-height:1.2">+312\u20ac</div><div class="proof-lbl" style="font-size:10px;color:var(--muted2);font-weight:500;margin-top:2px">\ud83d\udcb0 ROI total</div></div><div class="proof-item" style="background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.2);border-radius:10px;padding:10px 8px;text-align:center"><div class="proof-val" id="proof-winrate" style="font-size:20px;font-weight:900;color:#22d3ee;line-height:1.2">77%</div><div class="proof-lbl" style="font-size:10px;color:var(--muted2);font-weight:500;margin-top:2px">\ud83d\udcca Winrate</div></div><div class="proof-item" style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:10px 8px;text-align:center"><div class="proof-val" id="proof-total" style="font-size:20px;font-weight:900;color:#818cf8;line-height:1.2">391</div><div class="proof-lbl" style="font-size:10px;color:var(--muted2);font-weight:500;margin-top:2px">\ud83d\udd2c Analyses</div></div><div class="proof-item" style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px 8px;text-align:center"><div class="proof-val" id="proof-sim10" style="font-size:20px;font-weight:900;color:#f59e0b;line-height:1.2">+312\u20ac</div><div class="proof-lbl" style="font-size:10px;color:var(--muted2);font-weight:500;margin-top:2px">\ud83c\udfb2 10\u20ac\u2192X\u20ac</div></div>';
  hs.parentNode.insertBefore(d,hs.nextSibling);
  var s=document.createElement('style');
  s.textContent='@media(max-width:600px){#proof-block{grid-template-columns:repeat(2,1fr)!important}.proof-item{padding:8px 4px!important}.proof-val{font-size:16px!important}}';
  document.head.appendChild(s);
}

function injectIAVoteLine(){
  function add(){
    var h=document.querySelector('.ia-head');
    if(!h||document.getElementById('ia-votes-summary'))return;
    var p=window.PICK;
    if(!p||!p.ia||!p.ia.length)return;
    var v=p.ia.map(function(ia,i){
      var c=ia.pct>=70?'#10b981':ia.pct>=50?'#f59e0b':'#f43f5e';
      return '<span style="font-size:11px;font-weight:600;color:'+c+'">'+E[i]+' '+N[i]+': '+ia.pct+'%</span>';
    }).join(' | ');
    var avg=Math.round(p.ia.reduce(function(a,b){return a+b.pct;},0)/p.ia.length);
    var cc=avg>=80?'#10b981':avg>=60?'#f59e0b':'#f43f5e';
    var s=document.createElement('div');
    s.id='ia-votes-summary';
    s.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 14px;margin-bottom:14px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:10px;';
    s.innerHTML='<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;flex:1;min-width:0">'+v+'</div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0;padding-left:10px;border-left:1px solid rgba(255,255,255,.1)"><span style="font-size:12px;font-weight:700;color:'+cc+'">\u2696\ufe0f Concile: '+avg+'%</span></div>';
    h.parentNode.insertBefore(s,h);
  }
  var o=new MutationObserver(add);
  o.observe(document.getElementById('pick-root')||document.body,{childList:true,subtree:true});
  setTimeout(add,1500);
}

function injectTimestamps(){
  // Keep exactly one locale-aware short date per result row.  The old relative
  // timestamp parser read "Dim 19/07" as a numeric date and appended it again.
  setTimeout(function(){
    var pr=document.querySelector('.pick-head .ph-right');
    if(pr&&!pr.querySelector('.ts-badge')){
      var ts=document.createElement('span');
      ts.className='ts-badge';
      ts.style.cssText='display:inline-block;font-size:10px;color:var(--muted);margin-left:6px;padding:2px 6px;background:rgba(255,255,255,.04);border-radius:4px;font-weight:500';
      var dm=(new Date().getHours()-7)*60+new Date().getMinutes();
      if(dm<0)dm+=1440;
      ts.textContent=dm<60?'il y a '+dm+' min':'il y a '+Math.floor(dm/60)+'h';
      pr.appendChild(ts);
    }
  },2000);
}

function syncStats(){
  var mapping=[['proof-roi','kpi-roi'],['proof-winrate','kpi-winrate'],['proof-total','kpi-picks'],['proof-sim10','kpi-bankroll']];
  setInterval(function(){
    mapping.forEach(function(m){
      var e=document.getElementById(m[0]),k=document.getElementById(m[1]);
      if(e&&k&&k.textContent&&k.textContent!=='\u2014')e.textContent=k.textContent;
    });
  },1000);
}

var init=function(){injectProofBlock();injectIAVoteLine();injectTimestamps();syncStats();};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
