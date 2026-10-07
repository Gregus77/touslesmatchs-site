(function(){
  'use strict';
  function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function known(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
  function pct(value){return known(value)?Number(value).toFixed(1).replace(/\.0$/,'').replace('.',',')+' %':'—';}
  function summary(s){
    if(!s)return 'Statistiques indisponibles';
    var out=(s.wins||0)+' gagnés · '+(s.losses||0)+' perdus · '+(s.pending||0)+' en attente · '+pct(s.winrate);
    if(s.priced>0&&known(s.averageOdd)&&Number(s.averageOdd)>1)out+=' · cote moy. '+Number(s.averageOdd).toFixed(2).replace('.',',');
    if(s.priced>0&&known(s.roi))out+=' · ROI '+pct(s.roi);
    return out;
  }
  function row(x,official){
    var pending=x.outcome==='pending'||(official&&x.outcome==null);
    var result=x.outcome==='win'?'Gagné':x.outcome==='loss'?'Perdu':pending?'En attente':'À vérifier';
    var color=x.outcome==='win'?'var(--green)':x.outcome==='loss'?'var(--red)':'var(--muted)';
    var recordedOdd=official?x.odd:x.odd_at_pick;
    var targetTeam=official?x.team:x.target_team;
    var odd=known(recordedOdd)&&Number(recordedOdd)>1?Number(recordedOdd).toFixed(2).replace('.',','):'Cote non enregistrée';
    var date=x.predicted_at||x.sent_at||x.created_at||'';
    return '<article class="goal05-result-row"><div><strong>'+escape(x.home||'Équipe non précisée')+' — '+escape(x.away||'Équipe non précisée')+'</strong>'
      +'<div class="goal05-result-meta">'+escape(targetTeam||'Équipe ciblée non précisée')+' · +0,5 but</div>'
      +'<div class="goal05-result-meta">'+escape(x.competition||'')+(date?' · '+escape(String(date).slice(0,10)):'')+'</div></div>'
      +'<div class="goal05-result-detail"><strong style="color:'+color+'">'+result+'</strong><span>'+odd+'</span>'
      +'<span class="goal05-result-source">'+(official?'Signal officiel':'Observation scanner')+'</span></div></article>';
  }
  function history(d){
    var official=Array.isArray(d.officialRecent)?d.officialRecent:[],scanner=Array.isArray(d.scannerRecent)?d.scannerRecent:[];
    if(!official.length&&!scanner.length)return '<p class="goal05-result-meta">Aucun résultat +0,5 disponible pour le moment.</p>';
    return official.map(function(x){return row(x,true);}).join('')+scanner.map(function(x){return row(x,false);}).join('');
  }
  window.TLMGoal05Results={summary:summary,history:history};
})();
