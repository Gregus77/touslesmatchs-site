/* history-enhancer.js — TousLesMatchs: Tableau historique complet + courbe rentabilite */
(function(){
'use strict';

// ─── Section historique complète avec tableau ───
function injectHistorySection(){
  if(document.getElementById('history-section-enhanced'))return;
  var faqSection=document.getElementById('faq');
  if(!faqSection) return;

  var section=document.createElement('section');
  section.id='history-section-enhanced';
  section.className='section-wrap';
  section.style.cssText='border-top:1px solid var(--b1);padding-bottom:40px;';

  section.innerHTML='\
    <div class="s-eyebrow">Historique</div>\
    <div class="s-title">Tous les picks passes</div>\
    <div class="s-sub">Date, match, pronostic, resultat, gain et cote — transparence totale.</div>\
    <div id="history-controls" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">\
      <div style="display:flex;gap:6px;align-items:center">\
        <label style="font-size:12px;color:var(--muted2)">Filtrer:</label>\
        <select id="history-filter" style="background:var(--bg3);border:1px solid var(--b2);border-radius:8px;padding:8px 12px;color:var(--text);font-size:12px;font-family:inherit">\
          <option value="all">Tous</option>\
          <option value="win">Gagnes</option>\
          <option value="loss">Perdus</option>\
        </select>\
      </div>\
      <div style="display:flex;gap:6px;align-items:center">\
        <label style="font-size:12px;color:var(--muted2)">Periode:</label>\
        <select id="history-period" style="background:var(--bg3);border:1px solid var(--b2);border-radius:8px;padding:8px 12px;color:var(--text);font-size:12px;font-family:inherit">\
          <option value="30">30 jours</option>\
          <option value="90">90 jours</option>\
          <option value="all">Tout</option>\
        </select>\
      </div>\
    </div>\
    <div id="history-table-wrap" style="overflow-x:auto;border-radius:12px;border:1px solid var(--b2);background:var(--bg2)">\
      <table id="history-table" style="width:100%;border-collapse:collapse;font-size:13px">\
        <thead>\
          <tr style="background:var(--bg3);border-bottom:1px solid var(--b2)">\
            <th style="padding:12px 14px;text-align:left;font-weight:700;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Date</th>\
            <th style="padding:12px 14px;text-align:left;font-weight:700;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Match</th>\
            <th style="padding:12px 14px;text-align:left;font-weight:700;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Pronostic</th>\
            <th style="padding:12px 14px;text-align:center;font-weight:700;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Resultat</th>\
            <th style="padding:12px 14px;text-align:right;font-weight:700;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Gain</th>\
            <th style="padding:12px 14px;text-align:right;font-weight:700;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Cote</th>\
          </tr>\
        </thead>\
        <tbody id="history-tbody">\
          <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--muted)">Chargement...</td></tr>\
        </tbody>\
      </table>\
    </div>\
    <div id="history-summary" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;padding:14px 18px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:10px">\
      <div><span style="font-size:11px;color:var(--muted2)">Total:</span> <span id="hist-total" style="font-weight:700;color:var(--text)">0</span></div>\
      <div><span style="font-size:11px;color:var(--muted2)">Gagnes:</span> <span id="hist-wins" style="font-weight:700;color:#10b981">0</span></div>\
      <div><span style="font-size:11px;color:var(--muted2)">Perdus:</span> <span id="hist-losses" style="font-weight:700;color:#f43f5e">0</span></div>\
      <div><span style="font-size:11px;color:var(--muted2)">Winrate:</span> <span id="hist-wr" style="font-weight:700;color:#22d3ee">0%</span></div>\
      <div><span style="font-size:11px;color:var(--muted2)">Profit net:</span> <span id="hist-profit" style="font-weight:700;color:#10b981">0\u20ac</span></div>\
    </div>\
  ';

  faqSection.parentNode.insertBefore(section,faqSection);

  // ─── Bar chart vert/rouge par jour ───
  var chartDiv=document.createElement('div');
  chartDiv.id='history-barchart-wrap';
  chartDiv.style.cssText='margin-top:24px;padding:20px;background:var(--bg2);border:1px solid var(--b2);border-radius:12px;';
  chartDiv.innerHTML='<div style="font-size:14px;font-weight:700;margin-bottom:14px">Courbe de rentabilite par jour</div><div id="history-barchart" style="display:flex;gap:4px;align-items:flex-end;height:120px;overflow-x:auto;padding:4px 0"></div>';
  section.appendChild(chartDiv);

  // Event listeners for filters
  document.getElementById('history-filter').addEventListener('change',renderHistoryTable);
  document.getElementById('history-period').addEventListener('change',renderHistoryTable);

  renderHistoryTable();
}

function renderHistoryTable(){
  var picks=window.PICKS_FEED||[];
  var filter=document.getElementById('history-filter').value;
  var period=document.getElementById('history-period').value;

  var now=new Date();
  var cutoff=period==='30'?new Date(now-30*86400000):period==='90'?new Date(now-90*86400000):null;

  picks=picks.filter(function(p){
    if(filter!=='all' && p.result!==filter) return false;
    if(cutoff && p.date){
      var pd=new Date(p.date);
      if(pd<cutoff) return false;
    }
    return true;
  });

  // Sort by date descending
  picks.sort(function(a,b){return (b.date||'')>(a.date||'')?1:-1;});

  var tbody=document.getElementById('history-tbody');
  if(!picks.length){
    tbody.innerHTML='<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--muted)">Aucun pick trouve</td></tr>';
    updateSummary([]);
    renderBarChart([]);
    return;
  }

  var html='';
  picks.forEach(function(p){
    var isWin=p.result==='win';
    var isLoss=p.result==='loss';
    var icon=isWin?'✅':isLoss?'❌':'⏳';
    var resultText=isWin?'Gagne':isLoss?'Perdu':'En attente';
    var resultColor=isWin?'#10b981':isLoss?'#f43f5e':'#f59e0b';
    var gain=isWin?'+' + Math.round((p.cote-1)*10)+'\u20ac':isLoss?'-10\u20ac':'—';
    var gainColor=isWin?'#10b981':isLoss?'#f43f5e':'var(--muted)';
    var matchName=p.home+' vs '+p.away;
    var dateStr=p.date&&window.TLMI18N?TLMI18N.formatDate(p.date,'short'):(p.date?p.date.split('-').reverse().join('/'):'—');
    html+='<tr style="border-bottom:1px solid var(--b1)">\
      <td style="padding:10px 14px;white-space:nowrap;color:var(--muted);font-size:12px">'+dateStr+'</td>\
      <td style="padding:10px 14px;font-weight:600">'+escHtml(matchName)+'</td>\
      <td style="padding:10px 14px;font-size:12px;color:var(--muted2)">'+escHtml(window.TLMI18N?TLMI18N.market(p.pick||'—'):(p.pick||'—'))+'</td>\
      <td style="padding:10px 14px;text-align:center"><span style="font-size:12px">'+icon+'</span> <span style="font-size:12px;font-weight:600;color:'+resultColor+'">'+resultText+'</span></td>\
      <td style="padding:10px 14px;text-align:right;font-weight:700;color:'+gainColor+'">'+gain+'</td>\
      <td style="padding:10px 14px;text-align:right;font-size:12px;color:var(--muted2)">@'+(p.cote||'—')+'</td>\
    </tr>';
  });

  tbody.innerHTML=html;
  updateSummary(picks);
  renderBarChart(picks);
}

function updateSummary(picks){
  var wins=picks.filter(function(p){return p.result==='win';}).length;
  var losses=picks.filter(function(p){return p.result==='loss';}).length;
  var total=wins+losses;
  var winrate=total>0?Math.round(wins/total*100):0;
  var profit=0;
  picks.forEach(function(p){
    if(p.result==='win') profit+=Math.round((p.cote-1)*10);
    else if(p.result==='loss') profit-=10;
  });

  document.getElementById('hist-total').textContent=total;
  document.getElementById('hist-wins').textContent=wins;
  document.getElementById('hist-losses').textContent=losses;
  document.getElementById('hist-wr').textContent=winrate+'%';
  var el=document.getElementById('hist-profit');
  el.textContent=(profit>=0?'+':'')+profit+'\u20ac';
  el.style.color=profit>=0?'#10b981':'#f43f5e';
}

function renderBarChart(picks){
  var container=document.getElementById('history-barchart');
  if(!container) return;

  // Group by date
  var grouped={};
  picks.forEach(function(p){
    if(p.result!=='win'&&p.result!=='loss') return;
    if(!grouped[p.date]) grouped[p.date]={wins:0,losses:0,total:0};
    grouped[p.date][p.result==='win'?'wins':'losses']++;
    grouped[p.date].total++;
  });

  var dates=Object.keys(grouped).sort();
  if(!dates.length){
    container.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;width:100%">Pas assez de données pour afficher le graphique</div>';
    return;
  }

  var maxCount=0;
  dates.forEach(function(d){if(grouped[d].total>maxCount)maxCount=grouped[d].total;});
  if(maxCount<1)maxCount=1;

  var html='';
  dates.slice(-30).forEach(function(d){
    var g=grouped[d];
    var winPct=Math.round(g.wins/g.total*100);
    var barH=Math.max(8,Math.round(g.total/maxCount*100));
    var label=d.split('-').slice(2).join('/');
    html+='<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;width:28px">\
      <div style="font-size:8px;font-weight:600;color:'+(winPct>=50?'#10b981':'#f43f5e')+'">'+g.total+'</div>\
      <div style="width:22px;height:'+barH+'px;border-radius:4px 4px 0 0;background:'+(winPct>=50?'rgba(16,185,129,.7)':'rgba(244,63,94,.7)')+';border:1px solid '+(winPct>=50?'rgba(16,185,129,.4)':'rgba(244,63,94,.4)')+';position:relative">\
        <div style="position:absolute;bottom:0;left:0;right:0;height:'+Math.round(g.wins/g.total*100)+'%;background:'+(winPct>=50?'rgba(16,185,129,.9)':'rgba(244,63,94,.3)')+';border-radius:0 0 3px 3px"></div>\
      </div>\
      <div style="font-size:7px;color:var(--muted);white-space:nowrap">'+label+'</div>\
    </div>';
  });

  container.innerHTML=html;
}

function escHtml(s){
  if(!s)return'';
  return String(s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

var init=function(){
  // Wait for PICKS_FEED to be available
  var check=function(){
    if(window.PICKS_FEED&&window.PICKS_FEED.length){
      injectHistorySection();
    }else{
      setTimeout(check,500);
    }
  };
  check();
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
