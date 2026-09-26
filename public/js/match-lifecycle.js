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
    if(statuses.some(function(s){return /^(HT|HALFTIME|HALF TIME|HALF_TIME|2H|SECOND HALF|ET|BT|P|EXTRA TIME)$/.test(s);}))return 'closed';
    var values=[m.minute,m.elapsed,m.status&&m.status.elapsed,m.time&&m.time.elapsed,m.fixture&&m.fixture.status&&m.fixture.status.elapsed];
    var minute=-1;
    for(var i=0;i<values.length;i++){
      var hit=String(values[i]==null?'':values[i]).trim().match(/^(\d+)(?:\+(\d+))?(?:['′’])?$/);
      if(hit){minute=Number(hit[1])+Number(hit[2]||0);break;}
    }
    if(minute<0)return 'unknown';
    var firstHalf=statuses.some(function(s){return /^(1H|FIRST HALF|FIRST_HALF)$/.test(s);});
    if((minute>45&&!firstHalf)||(m.ou25&&m.ou25.window_status==='closed'))return 'closed';
    if(minute<35)return 'waiting';
    return 'open';
  }
  function canFeature(m){var p=phase(m);return p==='open'||p==='waiting';}
  function canTrack(m){var p=phase(m);return p==='open'||p==='waiting'||p==='closed';}
  function entryClosed(m){var p=phase(m);return !!m&&(p==='unknown'||p==='closed'||p==='finished'||p==='unavailable'||!!(m.ou25&&m.ou25.window_status==='closed'));}
  function marketText(m){
    var r=m&&m.ou25||{},votes=(r.votes||[]).filter(function(v){return v.status==='voted';});
    if(!votes.length)return '';
    if(r.locked!==false)return 'Over/Under 2,5 · '+Number(r.consensus_count||0)+'/5 consensus';
    var over=votes.filter(function(v){return v.direction==='over';}),under=votes.filter(function(v){return v.direction==='under';});
    var direction=r.official?r.consensus_direction:over.length>under.length?'over':under.length>over.length?'under':null;
    if(direction!=='over'&&direction!=='under')return 'Over/Under 2,5 — votes partagés';
    var leaders=direction==='over'?over:under;
    var result=direction.toUpperCase()+' 2,5 · '+leaders.length+'/5';
    if(r.official&&r.official_confidence!=null)result+=' · confiance '+Number(r.official_confidence)+'/100';
    return result;
  }
  function statusText(m){
    var raw=m&&m.ou25||{},state=raw.analysis_state;
    if(raw.official)return 'Signal validé'+(entryClosed(m)?' en première mi-temps — suivi du résultat':'');
    if(state==='excluded')return 'Non retenu';
    if(state==='failed_before_providers'||state==='failed')return raw.recommendation_status || 'Analyse interrompue — statistiques ou données indisponibles';
    if(entryClosed(m))return 'Analyse terminée — aucun signal validé';
    if(Number(raw.vote_count)>0)return 'Analysé — '+Number(raw.consensus_count||0)+'/5 consensus';
    if(phase(m)==='waiting')return 'Analyse en cours — décision à partir de la 35e minute';
    return 'Analyse en cours';
  }
  function entryNoticeHtml(m){
    if(!entryClosed(m))return '';
    return '<span class="tlm-analysis-status" role="status" style="display:block;color:#a8afc4;font-size:11px;line-height:1.5;margin:6px 0">'+statusText(m)+'</span>';
  }
  root.TLMMatchLifecycle={marketText:marketText,statusText:statusText,phase:phase,canFeature:canFeature,canTrack:canTrack,entryClosed:entryClosed,entryNoticeHtml:entryNoticeHtml};
  if(typeof module==='object'&&module.exports)module.exports=root.TLMMatchLifecycle;
})(typeof globalThis!=='undefined'?globalThis:this);
