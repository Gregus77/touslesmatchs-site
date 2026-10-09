(function () {
  'use strict';
  // Read attribution before SPA scripts can remove ?utm_... from the visible URL.
  // No network request here: existing /api/t beacons remain the single event source.
  var allowed={facebook:'facebook',fb:'facebook',instagram:'instagram',ig:'instagram',
    youtube:'youtube',yt:'youtube',tiktok:'tiktok',telegram:'telegram',tg:'telegram'};
  function canonical(value){return allowed[String(value||'').toLowerCase().trim()]||'';}
  function refNetwork(value){
    try {
      var u=new URL(String(value||'')),h=u.hostname.toLowerCase().replace(/^www\./,'');
      if(u.protocol!=='https:'&&u.protocol!=='http:')return '';
      if(/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(h))return 'facebook';
      if(/(^|\.)instagram\.com$/.test(h))return 'instagram';
      if(/(^|\.)youtube\.com$|^youtu\.be$/.test(h))return 'youtube';
      if(/(^|\.)tiktok\.com$/.test(h))return 'tiktok';
      if(/(^|\.)t\.me$/.test(h))return 'telegram';
    } catch (_) {}
    return '';
  }
  function tag(value){return String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,60);}
  var params=new URLSearchParams(window.location.search);
  var explicit=params.has('utm_source');
  var fromUrl=explicit?canonical(params.get('utm_source')):'';
  var fromRef=!explicit?refNetwork(document.referrer):'';
  var key='tlm_attribution_session_20261009',now=Date.now();
  var selected={source:'',medium:'',campaign:''};
  if(fromUrl||fromRef){
    selected={source:fromUrl||fromRef,medium:tag(params.get('utm_medium'))||'social',
      campaign:tag(params.get('utm_campaign'))};
    try{sessionStorage.setItem(key,JSON.stringify({...selected,at:now}));}catch(_){}
  } else if(explicit) {
    // Unknown explicit campaigns must not inherit a previous social network.
    try{sessionStorage.removeItem(key);}catch(_){}
  } else {
    try {
      var previous=JSON.parse(sessionStorage.getItem(key)||'null');
      if(previous&&canonical(previous.source)&&now-Number(previous.at)>=0&&now-Number(previous.at)<30*60000){
        selected={source:canonical(previous.source),medium:tag(previous.medium),campaign:tag(previous.campaign)};
      } else sessionStorage.removeItem(key);
    }catch(_){}
  }
  window.tlmSourceAttribution=selected;
})();
