/* Presentation only: never settles a result or creates a signal. */
(function(root){
  'use strict';
  if(typeof document!=='undefined'&&!document.querySelector('script[src*="/js/i18n.js"]')){
    var i18nScript=document.createElement('script');
    i18nScript.src='/js/i18n.js?v=20260915-account-v1';
    document.head.appendChild(i18nScript);
  }
  function phase(m){
    if(!m)return 'unknown';
    var statuses=[m.status,m.period,m.status_short,m.fixture&&m.fixture.status].map(function(s){return String(s&&typeof s==='object'?(s.short||s.long||''):s||'').trim().toUpperCase();});
    if(statuses.some(function(s){return /^(FT|AET|PEN|FINISHED|MATCH FINISHED|FULL TIME|FULL_TIME|AFTER EXTRA TIME|AFTER PENALTIES|ENDED|TERMINÉ)$/.test(s);}))return 'finished';
    if(statuses.some(function(s){return /^(NS|TBD|PST|CANC|ABD|AWD|WO|SUSP|INT|NOT STARTED|POSTPONED|CANCELLED|ABANDONED|SUSPENDED)$/.test(s);}))return 'unavailable';
    if(m.offline||m.cached||m.stale)return 'unknown';
    if(statuses.some(function(s){return /^(ET|BT|P|EXTRA TIME)$/.test(s);}))return 'closed';
    var values=[m.minute,m.elapsed,m.status&&m.status.elapsed,m.time&&m.time.elapsed,m.fixture&&m.fixture.status&&m.fixture.status.elapsed];
    var minute=-1;
    for(var i=0;i<values.length;i++){
      var hit=String(values[i]==null?'':values[i]).trim().match(/^(\d+)(?:\+(\d+))?(?:['′’])?$/);
      if(hit){minute=Number(hit[1])+Number(hit[2]||0);break;}
    }
    if(minute<0){
      if(statuses.some(function(s){return /^(LIVE|IN_PLAY|1H|2H|HT|Q1|Q2|Q3|Q4|P1|P2|P3|OT|BREAK|IN[1-9])$/.test(s);}))return 'live_unknown';
      return 'unknown';
    }
    if(minute>85)return 'closed';
    if(minute<30)return 'waiting';
    return 'open';
  }
  function canFeature(m){var p=phase(m);return p==='open'||p==='waiting';}
  function canTrack(m){var p=phase(m);return p==='open'||p==='waiting'||p==='live_unknown'||p==='closed';}
  function entryClosed(m){var p=phase(m);return !!m&&(p==='unknown'||p==='closed'||p==='finished'||p==='unavailable');}
  function marketText(m){
    /* LIVE_CURRENT_GOAL05_ONLY: l'ancien objet ou25 reste historique et ne pilote jamais l'affichage courant. */
    var g=m&&m.goal05||{};
    var count=Number(g.consensus_count||g.yes_votes||0);
    if(!count)return '';
    var result='Analyse +0,5 · '+count+'/5 consensus';
    if(g.confidence!=null)result+=' · confiance '+Number(g.confidence)+'/100';
    return result;
  }
  function statusText(m){
    /* LIVE_CURRENT_GOAL05_ONLY: ne jamais rebaptiser un ancien vote O/U en vote +0,5. */
    var g=m&&m.goal05||{},state=g.analysis_state;
    var target=g.target_team||g.targetTeam||(m&&(m.target_team||m.targetTeam))||'';
    var consensus=Number(g.consensus_count||g.yes_votes||g.consensus_votes||0);
    var odd=Number(g.official_odd!=null?g.official_odd:g.odd);
    if(g.official===true&&target&&consensus>=4&&Number.isFinite(odd)&&odd>=1.60)return 'Signal officiel : '+target+' +0,5 but'+(entryClosed(m)?' — suivi terminé':'');
    if(g.official===true)return 'Signal non validé — équipe/cote/consensus incomplet';
    if(state==='excluded')return 'Non retenu pour le +0,5';
    if(state==='failed_before_providers'||state==='failed')return g.recommendation_status || 'Analyse +0,5 interrompue — statistiques ou données indisponibles';
    if(entryClosed(m))return 'Analyse terminée — aucun signal officiel +0,5';
    if(phase(m)==='live_unknown')return Number(g.vote_count||g.yes_votes)>0
      ? 'Analyse +0,5 en cours — minute live indisponible'
      : 'Match en direct — minute live indisponible, aucun signal officiel +0,5';
    if(Number(g.vote_count||g.yes_votes)>0)return 'Analyse +0,5 — '+Number(g.consensus_count||g.yes_votes||0)+'/5 consensus';
    if(phase(m)==='waiting')return 'Analyse en cours — décision à partir de la 30e minute';
    return 'Analyse +0,5 en cours';
  }
  function entryNoticeHtml(m){
    if(!entryClosed(m))return '';
    return '<span class="tlm-analysis-status" role="status" style="display:block;color:#a8afc4;font-size:11px;line-height:1.5;margin:6px 0">'+statusText(m)+'</span>';
  }
  root.TLMMatchLifecycle={marketText:marketText,statusText:statusText,phase:phase,canFeature:canFeature,canTrack:canTrack,entryClosed:entryClosed,entryNoticeHtml:entryNoticeHtml};
  if(typeof module==='object'&&module.exports)module.exports=root.TLMMatchLifecycle;
})(typeof globalThis!=='undefined'?globalThis:this);


/* TLM_DAILY_MULTISPORT_SCANNER_V3
   Veille exploratoire multi-sports séparée de Goal05/Telegram.
   Les matchs du jour restent visibles et passent par trois états : À venir / En cours / Terminé.
*/
(function(){
  if(typeof document==='undefined')return;
  var path=(location&&location.pathname)||'/';
  if(!(path==='/'||path==='/index.html'||path==='/app.html'))return;

  var lang='fr';
  try{lang=(localStorage.getItem('tlm_lang')||document.documentElement.lang||'fr').slice(0,2).toLowerCase();}catch(e){}
  if(lang!=='fr')return;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function dot(c){return c==='green'?'🟢':c==='red'?'🔴':'🟠';}
  function parisDate(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
    catch(e){return new Date().toISOString().slice(0,10);}
  }
  function addHierarchy(){
    if(document.querySelector('.tlm-product-hierarchy'))return;
    var hero=document.querySelector('.tlm-app-stadium-hero,.hero-exact-card');
    if(!hero)return;
    var box=document.createElement('div');
    box.className='tlm-product-hierarchy';
    box.innerHTML='<strong>Produit officiel validé</strong><span>Football uniquement · une équipe ciblée doit marquer au moins un but · minimum 4 IA sur 5.</span><small>Scanner multisport : veille exploratoire distincte du Concile et des statistiques officielles.</small>';
    hero.appendChild(box);
  }
  function statusLine(m){
    if(m.status==='Terminé'){
      var out=m.outcome==='Gagnant'?'✅ Gagnant':m.outcome==='Perdant'?'❌ Perdant':'✅ Terminé';
      return '<div class="tlm-ms-status done">'+out+(m.result?' · '+esc(m.result):'')+'</div>';
    }
    if(m.status==='En cours'){
      return '<div class="tlm-ms-status live">🔴 En cours'+(m.liveScore?' · '+esc(m.liveScore):'')+'</div>';
    }
    var kickoff=Date.parse(m.startsAt||'');
    if(m.status==='À venir'&&Number.isFinite(kickoff)&&kickoff>Date.now()){
      return '<div class="tlm-ms-status upcoming">🕒 À venir</div>';
    }
    return '<div class="tlm-ms-status stale">⏳ Statut à actualiser</div>';
  }
  function card(m,i){
    var classable=m.classification&&m.classification.status==='valid';
    var score=classable&&m.rating?dot(m.color)+' '+esc(m.rating)+'/10':'Non classable';
    var tags=classable
      ? '<div class="tlm-ms-tags"><span>Top : '+esc(m.top)+'</span><span>Bottom : '+esc(m.bottom)+'</span></div>'
      : '<div class="tlm-ms-tags"><span>Classement : non classable</span></div>';
    var metrics=(m.metrics||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('');
    var selection=m.selection?'<div class="tlm-ms-selection">Cible scanner : '+esc(m.selection)+'</div>':'';
    return '<article class="tlm-ms-card" data-rank="'+(i+1)+'" data-status="'+esc(m.status)+'">'
      +'<div class="tlm-ms-head"><span class="tlm-ms-order">#'+(i+1)+'</span><strong>'+esc(m.sport)+'</strong><span class="tlm-ms-score">'+score+'</span></div>'
      +'<div class="tlm-ms-league">'+esc(m.league)+' · '+esc(m.time)+' Paris</div>'
      +'<div class="tlm-ms-teams"><div><b>'+esc(m.a)+'</b><span>'+esc(m.aRank)+'</span></div><div class="tlm-ms-vs">VS</div><div><b>'+esc(m.b)+'</b><span>'+esc(m.bRank)+'</span></div></div>'
      +tags+selection+statusLine(m)
      +(metrics?'<ul>'+metrics+'</ul>':'')
      +'<p>'+esc((m.classification&&m.classification.reason)||m.note||'')+'</p>'
      +'</article>';
  }
  function render(data,today){
    if(!data||data.date!==today||!Array.isArray(data.matches)||!data.matches.length)return;
    var matches=data.matches.slice().sort(function(a,b){return Date.parse(a.startsAt||0)-Date.parse(b.startsAt||0);});
    addHierarchy();
    var old=document.getElementById('tlm-daily-multisport-scanner');
    if(old)old.remove();
    var section=document.createElement('section');
    section.id='tlm-daily-multisport-scanner';
    section.className='tlm-ms-wrap';
    var done=matches.filter(function(m){return m.status==='Terminé';}).length;
    var live=matches.filter(function(m){return m.status==='En cours';}).length;
    var upcoming=matches.filter(function(m){return m.status==='À venir'&&Date.parse(m.startsAt||'')>Date.now();}).length;
    section.innerHTML='<div class="tlm-ms-title"><div><span class="tlm-ms-kicker">Scanner multisport du jour</span><h2>Veille et résultats des matchs suivis</h2><p>Les cartes restent visibles pendant la journée et changent d’état : à venir, en cours, puis terminé avec le résultat vérifié.</p></div><span class="tlm-ms-count">'+upcoming+' à venir · '+live+' en cours · '+done+' terminés</span></div>'
      +'<div class="tlm-ms-grid">'+matches.map(card).join('')+'</div>';

    var style=document.createElement('style');
    style.id='tlm-daily-multisport-scanner-css';
    style.textContent='.tlm-product-hierarchy{position:relative;z-index:5;margin:12px;padding:11px 12px;border:1px solid rgba(34,211,238,.28);border-radius:13px;background:rgba(5,12,30,.86);color:#eef8ff}.tlm-product-hierarchy strong,.tlm-product-hierarchy span,.tlm-product-hierarchy small{display:block}.tlm-product-hierarchy strong{font-size:12px;color:#7de8ff}.tlm-product-hierarchy span{margin-top:3px;font-size:11px;font-weight:850}.tlm-product-hierarchy small{margin-top:4px;color:#aeb8d8;font-size:10px;line-height:1.4}.tlm-ms-wrap{max-width:1180px;margin:18px auto;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(10,14,32,.78);box-shadow:0 18px 42px rgba(0,0,0,.16);color:#f7f8ff}.tlm-ms-title{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;margin-bottom:14px}.tlm-ms-title h2{font-size:22px;line-height:1.15;margin:4px 0 7px}.tlm-ms-title p{margin:0;color:#b7bfdc;font-size:12px;line-height:1.5}.tlm-ms-kicker{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9}.tlm-ms-count{white-space:nowrap;font-size:11px;font-weight:900;padding:7px 9px;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.25)}.tlm-ms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tlm-ms-card{border:1px solid rgba(255,255,255,.09);border-radius:15px;padding:13px;background:rgba(255,255,255,.035)}.tlm-ms-head{display:flex;gap:8px;align-items:center}.tlm-ms-order{font-size:10px;color:#98a2c8}.tlm-ms-score{margin-left:auto;font-weight:950}.tlm-ms-league{font-size:11px;color:#aeb6d5;margin:5px 0 10px}.tlm-ms-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}.tlm-ms-teams>div:not(.tlm-ms-vs){display:flex;flex-direction:column;gap:2px}.tlm-ms-teams>div:last-child{text-align:right}.tlm-ms-teams b{font-size:13px}.tlm-ms-teams span{font-size:10px;color:#9ea8ca}.tlm-ms-vs{font-size:10px;font-weight:900;color:#697395}.tlm-ms-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.tlm-ms-tags span{font-size:10px;border-radius:999px;padding:5px 7px;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.24)}.tlm-ms-selection{margin-top:8px;font-size:10.5px;color:#dbe4ff}.tlm-ms-status{margin-top:9px;font-size:11px;font-weight:900}.tlm-ms-status.done{color:#6ee7b7}.tlm-ms-status.live{color:#fb7185}.tlm-ms-status.upcoming{color:#67e8f9}.tlm-ms-status.stale{color:#fbbf24}.tlm-ms-card ul{margin:8px 0 6px;padding-left:18px}.tlm-ms-card li,.tlm-ms-card p{font-size:11px;line-height:1.45;color:#c8cee3}.tlm-ms-card p{margin:0}@media(max-width:720px){.tlm-ms-wrap{margin:12px 10px;padding:13px}.tlm-ms-title{display:block}.tlm-ms-count{display:inline-block;margin-top:9px}.tlm-ms-grid{grid-template-columns:1fr;max-height:68vh;overflow:auto;padding-right:2px}.tlm-ms-title h2{font-size:18px}}';
    var prevStyle=document.getElementById('tlm-daily-multisport-scanner-css');if(prevStyle)prevStyle.remove();
    document.head.appendChild(style);

    var appHero=document.querySelector('.tlm-app-stadium-hero');
    if(appHero){appHero.insertAdjacentElement('afterend',section);return;}
    var hero=document.querySelector('.hero-exact-card');
    if(hero){hero.insertAdjacentElement('afterend',section);return;}
    var email=document.getElementById('email-capture-card');
    if(email){var row=email.closest('.row')||email.parentElement;if(row&&row.parentNode){row.parentNode.insertBefore(section,row);return;}}
    var pick=document.getElementById('pick-body');
    if(pick){var prow=pick.closest('.row')||pick.closest('.card')||pick.parentElement;if(prow&&prow.parentNode){prow.insertAdjacentElement('afterend',section);return;}}
    (document.querySelector('main')||document.querySelector('.wrap')||document.body).appendChild(section);
  }

  var today=parisDate();
  fetch('/data/multisport-scanner-'+today+'.json?v=20261007-status-v3',{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('no-scanner');return r.json();})
    .then(function(data){render(data,today);})
    .catch(function(){});
})();


/* TLM_GROWTH_ACQUISITION_V1
   Acquisition organique : résultats vérifiés + partage + Telegram.
   Aucun taux de gain ni promesse de résultat n'est fabriqué.
*/
(function(){
  if(typeof document==='undefined') return;
  var p=(location&&location.pathname)||'/';
  if(!(p==='/'||p==='/index.html'||p==='/app.html')) return;
  function txt(fr,ru){return String(document.documentElement.lang||'fr').toLowerCase().startsWith('ru')?ru:fr;}
  function render(){
    if(document.getElementById('tlm-growth-acquisition'))return;
    var wrap=document.createElement('section');
    wrap.id='tlm-growth-acquisition';
    wrap.className='tlm-growth-box';
    wrap.innerHTML=
      '<div class="tlm-growth-kicker">'+txt('FAITES GRANDIR LA COMMUNAUTÉ','РАЗВИВАЙТЕ СООБЩЕСТВО')+'</div>'+
      '<h2>'+txt('Suivez les analyses, vérifiez les résultats, partagez.','Следите за анализами, проверяйте результаты и делитесь.')+'</h2>'+
      '<p>'+txt('Historique public, résultats gagnés et perdus conservés, analyses IA et accès Telegram pendant la phase de lancement.','Публичная история, сохранённые победы и поражения, ИИ-анализ и доступ в Telegram на этапе запуска.')+'</p>'+
      '<div class="tlm-growth-actions">'+
        '<a href="/performances.html" class="tlm-growth-btn primary">'+txt('📊 Résultats vérifiés','📊 Проверенные результаты')+'</a>'+
        '<a href="/go/tiktok?v=organic-site" class="tlm-growth-btn">'+txt('✈️ Telegram gratuit','✈️ Бесплатный Telegram')+'</a>'+
        '<button type="button" id="tlm-growth-share" class="tlm-growth-btn">'+txt('↗️ Inviter un ami','↗️ Пригласить друга')+'</button>'+
      '</div>'+
      '<small>'+txt('18+ · Analyse sportive · Aucun gain garanti.','18+ · Спортивный анализ · Выигрыш не гарантирован.')+'</small>';
    var style=document.createElement('style');
    style.textContent='.tlm-growth-box{max-width:1180px;margin:14px auto;padding:18px;border:1px solid rgba(34,211,238,.22);border-radius:18px;background:linear-gradient(145deg,rgba(34,211,238,.07),rgba(124,58,237,.08));color:#f7f8ff}.tlm-growth-kicker{font-size:10px;letter-spacing:.14em;font-weight:900;color:#67e8f9}.tlm-growth-box h2{font-size:20px;margin:6px 0}.tlm-growth-box p{font-size:12px;line-height:1.5;color:#bcc5df}.tlm-growth-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.tlm-growth-btn{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;text-decoration:none;padding:10px 12px;border-radius:11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.tlm-growth-btn.primary{background:rgba(34,211,238,.15);border-color:rgba(34,211,238,.3)}.tlm-growth-box small{color:#8f99b8;font-size:10px}@media(max-width:720px){.tlm-growth-box{margin:10px;padding:14px}.tlm-growth-actions{display:grid}.tlm-growth-btn{text-align:center}}';
    document.head.appendChild(style);
    var ms=document.getElementById('tlm-daily-multisport-scanner');
    if(ms){ms.insertAdjacentElement('afterend',wrap);} else {
      var main=document.querySelector('main')||document.querySelector('.wrap')||document.body;
      main.appendChild(wrap);
    }
    var b=document.getElementById('tlm-growth-share');
    if(b)b.addEventListener('click',async function(){
      var data={title:'TousLesMatchs',text:txt('Analyses sportives IA et résultats vérifiés','ИИ-анализ спорта и проверенные результаты'),url:location.origin+'/?utm_source=share&utm_medium=organic'};
      try{
        if(navigator.share){await navigator.share(data);return;}
        await navigator.clipboard.writeText(data.url);
        b.textContent=txt('✅ Lien copié','✅ Ссылка скопирована');
      }catch(e){}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true}); else render();
})();
