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
    if(minute<0)return 'unknown';
    if(minute>85)return 'closed';
    if(minute<30)return 'waiting';
    return 'open';
  }
  function canFeature(m){var p=phase(m);return p==='open'||p==='waiting';}
  function canTrack(m){var p=phase(m);return p==='open'||p==='waiting'||p==='closed';}
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
    if(g.official===true)return 'Signal officiel +0,5 validé'+(entryClosed(m)?' — suivi terminé':'');
    if(state==='excluded')return 'Non retenu pour le +0,5';
    if(state==='failed_before_providers'||state==='failed')return g.recommendation_status || 'Analyse +0,5 interrompue — statistiques ou données indisponibles';
    if(entryClosed(m))return 'Analyse terminée — aucun signal officiel +0,5';
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


/* TLM_DAILY_MULTISPORT_SCANNER_20261007
   Scanner conversationnel du 7 octobre 2026.
   IMPORTANT : observations multi-sports séparées des signaux officiels Goal05/Telegram.
   Les lignes corrigées ne doivent jamais entrer dans les statistiques de performance.
*/
(function(){
  if(typeof document==='undefined')return;
  var path=(location&&location.pathname)||'/';
  if(!(path==='/'||path==='/index.html'||path==='/app.html'))return;

  var matches=[
    {
      sport:'⚾ Baseball',league:'KBO · Corée du Sud',time:'11h30',
      a:'KIA Tigers',aRank:'3e',b:'Lotte Giants',bRank:'8e',
      top:'KIA Tigers',bottom:'Lotte Giants',color:'green',rating:'8,7',
      status:'En cours / résultat final à confirmer',
      metrics:['Victoire KIA ≈ 69 %','KIA marque dans les 5 premières manches ≈ 83 %','Runs KIA : estimation prudente 5–6'],
      note:'Top 5 vs Bottom 5. Classement KBO vérifié le 7 octobre : KIA 3e, Lotte 8e.'
    },
    {
      sport:'⚽ Football',league:"Coupe de l’Empereur · Japon",time:'11h30',
      a:'Sanfrecce Hiroshima',aRank:'3e J1',b:'Iwaki FC',bRank:'16e J2',
      top:'Sanfrecce Hiroshima',bottom:'Iwaki FC',color:'green',rating:'8,4',
      status:'LIVE vérifié : Hiroshima menait 4–0 au contrôle',
      metrics:['Hiroshima marque ≥1 but : ≈ 87 %','Hiroshima marque en 1re MT : ≈ 62 %'],
      note:'Adaptation inter-divisions. Le signal +0,5 Hiroshima est déjà acquis en live.'
    },
    {
      sport:'🏒 Hockey',league:'KHL · Russie',time:'16h00',
      a:'Metallurg Magnitogorsk',aRank:'1er Est',b:'Admiral Vladivostok',bRank:'8e Est',
      top:'Metallurg Magnitogorsk',bottom:'Admiral Vladivostok',color:'orange',rating:'7,4',
      status:'À venir',
      metrics:['Victoire Metallurg ≈ 62 %','Metallurg ≥2 buts ≈ 82 %','But Metallurg en 1re période ≈ 63 %'],
      note:'Top 5 vs Bottom 5, mais Admiral a gagné 5–2 le 5 octobre : prudence maintenue.'
    },
    {
      sport:'🏀 Basketball',league:'KBL · Corée du Sud',time:'12h00',
      a:'Busan KCC Egis',aRank:'5e actuel · début de saison non significatif',b:'Daegu KOGAS Pegasus',bRank:'9e actuel · non significatif',
      top:'Busan KCC Egis',bottom:'Daegu KOGAS Pegasus',color:'orange',rating:'7,2',
      status:'LIVE vérifié : KCC menait 58–50 au contrôle (Q3)',
      metrics:['Victoire KCC ≈ 68 %','Victoire mi-temps ≈ 61 %','1er quart-temps ≈ 56 %'],
      note:'Classement de début de saison : méthode adaptée avec référence à la saison précédente.'
    },
    {
      sport:'⚾ Baseball',league:'NPB Central League · Japon',time:'11h00',
      a:'Hanshin Tigers',aRank:'1er au moment du scan',b:'Hiroshima Toyo Carp',bRank:'4e au moment du scan',
      top:'Hanshin Tigers',bottom:'Hiroshima Toyo Carp',color:'orange',rating:'7,2',
      status:'En cours / résultat final à confirmer',
      metrics:['Probabilités détaillées : non vérifiables dans le scan initial'],
      note:'Ligue à 6 équipes : adaptation leader vs moitié basse. Match du 7 octobre confirmé.'
    },
    {
      sport:'⚽ Football',league:"Coupe de l’Empereur · Japon",time:'11h30',
      a:'Cerezo Osaka',aRank:'11e J1',b:'Kagoshima United',bRank:'1er J3',
      top:'Adaptation : pas de Top 5 strict inter-divisions',bottom:'Adaptation : pas de Bottom 5 strict',color:'orange',rating:'6,9',
      status:'LIVE vérifié : Cerezo menait 1–0 au contrôle',
      metrics:['Cerezo marque ≥1 but : ≈ 76 %','Cerezo marque en 1re MT : ≈ 49 %'],
      note:'Cerezo joue deux divisions au-dessus, mais Kagoshima est leader J3. Le +0,5 Cerezo est déjà acquis en live.'
    },
    {
      sport:'⚽ Football',league:"Coupe de l’Empereur · Japon",time:'11h30',
      a:'Avispa Fukuoka',aRank:'18e J1',b:'Yokohama FC',bRank:'5e J2',
      top:'Yokohama FC',bottom:'Avispa Fukuoka',color:'orange',rating:'6,7',
      status:'LIVE vérifié : Yokohama FC menait 1–0 au contrôle',
      metrics:['Yokohama FC marque ≥1 but : ≈ 70 %','Yokohama FC marque en 1re MT : ≈ 42 %'],
      note:'Top 5 vs Bottom 5 sur deux divisions. Le +0,5 Yokohama FC est déjà acquis en live.'
    },
    {
      sport:'🏒 Hockey',league:'KHL · Russie',time:'14h30',
      a:'Sibir Novosibirsk',aRank:'11e Est au scan',b:'Salavat Yulaev Ufa',bRank:'5e Est au scan',
      top:'Salavat Yulaev Ufa',bottom:'Sibir Novosibirsk',color:'orange',rating:'6,5',
      status:'À venir',
      metrics:['Victoire Salavat ≈ 55 %','Salavat ≥2 buts ≈ 72 %','But Salavat en 1re période ≈ 54 %'],
      note:'Top 5 vs Bottom 5, mais dynamique récente insuffisante pour passer au vert.'
    }
  ];

  var corrections=[
    'Suwon KT Sonicboom – Changwon LG Sakers : annoncé à tort comme match du 7 octobre ; confrontation retrouvée au 9 octobre. Hors statistiques du 7.',
    'SKA Saint-Pétersbourg – Severstal : joué le 6 octobre (2–5). Hors statistiques du 7.',
    'NC Dinos – LG Twins : joué le 6 octobre (1–6). Le 7 octobre, NC joue SSG et LG joue Doosan. Hors statistiques du 7.',
    'Seibu Lions – Chiba Lotte Marines : joué le 6 octobre (3–0). Hors statistiques du 7.',
    'Traktor – Amur : joué le 6 octobre (1–2). Hors statistiques du 7.',
    'Avtomobilist – Avangard : joué le 6 octobre (4–0). Hors statistiques du 7.'
  ];

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function dot(c){return c==='green'?'🟢':c==='red'?'🔴':'🟠';}
  function card(m,i){
    return '<article class="tlm-ms-card" data-rank="'+(i+1)+'">'
      +'<div class="tlm-ms-head"><span class="tlm-ms-order">#'+(i+1)+'</span><strong>'+esc(m.sport)+'</strong><span class="tlm-ms-score">'+dot(m.color)+' '+esc(m.rating)+'/10</span></div>'
      +'<div class="tlm-ms-league">'+esc(m.league)+' · '+esc(m.time)+' Paris</div>'
      +'<div class="tlm-ms-teams"><div><b>'+esc(m.a)+'</b><span>'+esc(m.aRank)+'</span></div><div class="tlm-ms-vs">VS</div><div><b>'+esc(m.b)+'</b><span>'+esc(m.bRank)+'</span></div></div>'
      +'<div class="tlm-ms-tags"><span>Top : '+esc(m.top)+'</span><span>Bottom : '+esc(m.bottom)+'</span></div>'
      +'<div class="tlm-ms-status">'+esc(m.status)+'</div>'
      +'<ul>'+m.metrics.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'
      +'<p>'+esc(m.note)+'</p>'
      +'</article>';
  }
  function render(){
    if(document.getElementById('tlm-daily-multisport-scanner'))return;
    var section=document.createElement('section');
    section.id='tlm-daily-multisport-scanner';
    section.className='tlm-ms-wrap';
    section.innerHTML='<div class="tlm-ms-title"><div><span class="tlm-ms-kicker">Scanner multisport · 7 octobre 2026</span><h2>Matchs donnés dans la conversation — corrigés et synchronisés</h2><p>Football, basket, hockey et baseball. Ces observations restent séparées des signaux officiels +0,5 et ne modifient pas les statistiques Telegram.</p></div><span class="tlm-ms-count">'+matches.length+' matchs valides</span></div>'
      +'<div class="tlm-ms-grid">'+matches.map(card).join('')+'</div>'
      +'<details class="tlm-ms-fixes"><summary>⚠️ Corrections du scanner initial ('+corrections.length+')</summary><ul>'+corrections.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul><p>Ces lignes sont conservées pour traçabilité mais exclues de toute performance.</p></details>'
      +'<div class="tlm-ms-verdict"><strong>VERDICT</strong><span>🟢 KIA Tigers 8,7/10 · 🟢 Sanfrecce Hiroshima 8,4/10 · puis Metallurg et KCC en 🟠.</span></div>';
    var style=document.createElement('style');
    style.id='tlm-daily-multisport-scanner-css';
    style.textContent='.tlm-ms-wrap{max-width:1180px;margin:18px auto;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(10,14,32,.78);box-shadow:0 18px 42px rgba(0,0,0,.16);color:#f7f8ff}.tlm-ms-title{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;margin-bottom:14px}.tlm-ms-title h2{font-size:22px;line-height:1.15;margin:4px 0 7px}.tlm-ms-title p{margin:0;color:#b7bfdc;font-size:12px;line-height:1.5}.tlm-ms-kicker{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9}.tlm-ms-count{white-space:nowrap;font-size:11px;font-weight:900;padding:7px 9px;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.25)}.tlm-ms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tlm-ms-card{border:1px solid rgba(255,255,255,.09);border-radius:15px;padding:13px;background:rgba(255,255,255,.035)}.tlm-ms-head{display:flex;gap:8px;align-items:center}.tlm-ms-order{font-size:10px;color:#98a2c8}.tlm-ms-score{margin-left:auto;font-weight:950}.tlm-ms-league{font-size:11px;color:#aeb6d5;margin:5px 0 10px}.tlm-ms-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}.tlm-ms-teams>div:not(.tlm-ms-vs){display:flex;flex-direction:column;gap:2px}.tlm-ms-teams>div:last-child{text-align:right}.tlm-ms-teams b{font-size:13px}.tlm-ms-teams span{font-size:10px;color:#9ea8ca}.tlm-ms-vs{font-size:10px;font-weight:900;color:#697395}.tlm-ms-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.tlm-ms-tags span{font-size:10px;border-radius:999px;padding:5px 7px;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.24)}.tlm-ms-status{margin-top:9px;font-size:11px;font-weight:850;color:#facc15}.tlm-ms-card ul{margin:8px 0 6px;padding-left:18px}.tlm-ms-card li,.tlm-ms-card p{font-size:11px;line-height:1.45;color:#c8cee3}.tlm-ms-card p{margin:0}.tlm-ms-fixes{margin-top:12px;border:1px solid rgba(245,158,11,.22);border-radius:13px;padding:10px 12px;background:rgba(245,158,11,.06)}.tlm-ms-fixes summary{cursor:pointer;font-size:12px;font-weight:900}.tlm-ms-fixes li,.tlm-ms-fixes p{font-size:11px;line-height:1.5;color:#cbd1e6}.tlm-ms-verdict{display:flex;gap:10px;align-items:center;margin-top:12px;padding:11px 12px;border-radius:13px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18);font-size:11px}.tlm-ms-verdict strong{color:#6ee7b7}.tlm-ms-verdict span{color:#d8dcec}@media(max-width:720px){.tlm-ms-wrap{margin:12px 10px;padding:13px}.tlm-ms-title{display:block}.tlm-ms-count{display:inline-block;margin-top:9px}.tlm-ms-grid{grid-template-columns:1fr}.tlm-ms-title h2{font-size:18px}}';
    document.head.appendChild(style);

    var appHero=document.querySelector('.tlm-app-stadium-hero');
    if(appHero){appHero.insertAdjacentElement('afterend',section);return;}
    var email=document.getElementById('email-capture-card');
    if(email){
      var row=email.closest('.row')||email.parentElement;
      if(row&&row.parentNode){row.parentNode.insertBefore(section,row);return;}
    }
    var pick=document.getElementById('pick-body');
    if(pick){
      var prow=pick.closest('.row')||pick.closest('.card')||pick.parentElement;
      if(prow&&prow.parentNode){prow.insertAdjacentElement('afterend',section);return;}
    }
    (document.querySelector('main')||document.querySelector('.wrap')||document.body).appendChild(section);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
})();
